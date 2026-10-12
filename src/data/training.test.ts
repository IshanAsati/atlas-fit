import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Dexie } from 'dexie';
import { db, DEFAULT_PROFILE, saveActiveWorkout, finishSession, getActiveWorkout } from './db';
import { completedWorkingSets, routineFromDay, saveRoutine, getRoutines, sessionFromRoutine, saveRoutineFromSession } from './training';
import { exportBackup, importBackup } from './backup';
import type { WorkoutSession, PlanDay } from './types';
const day: PlanDay = { id: 'day', label: 'Upper body', focus: 'Push', movementTargets: ['hpush'], exercises: [{ exerciseId: 'push-up', sets: 3, reps: '8–12', restSec: 90, reason: 'Push' }] };
const session: WorkoutSession = { id: 'session', title: 'Upper body', state: 'active', startedAt: 100, location: 'home', items: [{ exerciseId: 'push-up', planned: day.exercises[0], sets: [{ reps: 8, loadKg: 0, done: true }, { reps: 5, loadKg: 0, done: true, kind: 'warmup' }] }] };
describe('durable training data', () => {
  beforeEach(async () => { await db.delete(); await db.open(); });
  afterEach(async () => { vi.restoreAllMocks(); await db.delete(); });
  it('migrates the old database without discarding sessions', async () => {
    db.close(); await Dexie.delete('AtlasFitDatabase');
    const old = new Dexie('AtlasFitDatabase');
    old.version(1).stores({ profiles: 'displayName', plans: 'id, createdAt, location, goal', sessions: 'id, startedAt, endedAt, state, planId', feedback: 'exerciseId, updatedAt', activeWorkout: 'id, updatedAt' });
    await old.table('sessions').put(session); old.close();
    await db.open();
    expect(await db.sessions.get(session.id)).toEqual(session);
    expect(await getRoutines()).toEqual([]);
  });
  it('saves active and history copies atomically, then finishes without leaving an active session', async () => {
    await saveActiveWorkout(session);
    expect(await getActiveWorkout()).toEqual(session);
    expect(await db.sessions.get(session.id)).toEqual(session);
    await finishSession({ ...session, endedAt: 200, state: 'done' });
    expect(await getActiveWorkout()).toBeNull();
    expect((await db.sessions.get(session.id))?.state).toBe('done');
  });
  it('rolls back completion if removing the active record fails', async () => {
    await saveActiveWorkout(session);
    vi.spyOn(db.activeWorkout, 'clear').mockRejectedValueOnce(new Error('storage failure'));
    await expect(finishSession({ ...session, state: 'done', endedAt: 200 })).rejects.toThrow('storage failure');
    expect(await getActiveWorkout()).toEqual(session);
    expect((await db.sessions.get(session.id))?.state).toBe('active');
  });
  it('stores reusable routines without copying completed set values', async () => {
    const routine = routineFromDay(day,'home'); await saveRoutine(routine);
    expect(await getRoutines()).toHaveLength(1);
    const next = sessionFromRoutine(routine);
    expect(next.items[0].sets).toHaveLength(3);
    expect(next.items[0].sets[0]).toEqual({ reps: null, loadKg: null, done: false, kind: 'working' });
    expect(next.id).not.toBe(sessionFromRoutine(routine).id);
  });
  it('excludes warmup and skipped sets and preserves legacy working sets', async () => {
    expect(completedWorkingSets({ ...session, items: [...session.items, { ...session.items[0], skipped: true }] })).toBe(1);
    const routine = await saveRoutineFromSession(session);
    expect(routine.exercises[0].sets).toBe(1);
  });
  it('backs up and restores routines, active workout, and canonical loads', async () => {
    await db.profiles.put({ ...DEFAULT_PROFILE, weightUnit: 'lb' });
    await saveRoutine(routineFromDay(day,'home'));
    await saveActiveWorkout(session);
    const json = await exportBackup();
    await db.delete(); await db.open();
    expect((await importBackup(json)).success).toBe(true);
    expect(await getRoutines()).toHaveLength(1);
    expect(await getActiveWorkout()).toEqual(session);
    expect((await db.profiles.toArray())[0].weightUnit).toBe('lb');
  });
  it('accepts schema-1 backups without new optional fields', async () => {
    expect((await importBackup(JSON.stringify({ schema: 1, exportedAt: 100, profile: DEFAULT_PROFILE, plans: [], sessions: [], feedback: [] }))).success).toBe(true);
    expect(await getRoutines()).toEqual([]);
  });
  it('rejects invalid routine data before changing existing records', async () => {
    const routine = routineFromDay(day,'home'); await saveRoutine(routine);
    const bad = { schema: 1, exportedAt: 100, profile: null, plans: [], sessions: [], feedback: [], routines: [{ ...routine, exercises: [{ ...routine.exercises[0], sets: -1 }] }] };
    expect((await importBackup(JSON.stringify(bad))).success).toBe(false);
    expect(await getRoutines()).toHaveLength(1);
    await expect(saveRoutine({ ...routine, title: ' ' })).rejects.toThrow();
  });
  it('rejects malformed profile, plan, and session contents without replacing records', async () => {
    await saveActiveWorkout(session);
    const base = JSON.parse(await exportBackup());
    for (const bad of [
      { ...base, profile: { displayName: 'Broken', onboarded: true } },
      { ...base, plans: [{ id: 'broken', days: 'not an array' }] },
      { ...base, sessions: [{ ...session, items: [{ exerciseId: 'push-up', sets: 'not an array' }] }] },
      { ...base, activeWorkout: { ...session, items: [null] } },
      { ...base, activeWorkout: false },
    ]) {
      expect((await importBackup(JSON.stringify(bad))).success).toBe(false);
      expect(await getActiveWorkout()).toEqual(session);
    }
  });
});
