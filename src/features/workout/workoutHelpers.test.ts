import { describe, it, expect } from 'vitest';
import type { WorkoutSession, SessionItem } from '../../data/types';
import { canonicalLoad, copySource, displayLoad, elapsedWorkoutSeconds, previousSet, workingMetrics } from './workoutHelpers';

const item: SessionItem = { exerciseId: 'push-up', sets: [{ reps: null, loadKg: null, done: false }, { reps: null, loadKg: null, done: false }] };
const session: WorkoutSession = { id: 'test', title: 'Test', location: 'home', startedAt: 1000, state: 'done', items: [item] };

describe('workout helpers', () => {
  it('converts pounds to canonical kg without rounding stored loads', () => {
    expect(canonicalLoad(100, 'lb')).toBeCloseTo(45.359237, 6);
    expect(displayLoad(20, 'lb')).toBe(44.09);
    expect(canonicalLoad(20, 'kg')).toBe(20);
    expect(canonicalLoad(displayLoad(20, 'lb'), 'lb')).toBeCloseTo(20, 2);
  });

  it('uses the most recent completed matching kind and ignores skipped/incomplete history', () => {
    const history: WorkoutSession[] = [
      { ...session, startedAt: 1000, items: [{ ...item, sets: [{ reps: 4, loadKg: 5, done: true, kind: 'warmup' }, { reps: 10, loadKg: 20, done: true }] }] },
      { ...session, startedAt: 2000, items: [{ ...item, skipped: true, sets: [{ reps: 20, loadKg: 100, done: true }] }] },
      { ...session, startedAt: 3000, items: [{ ...item, sets: [{ reps: 9, loadKg: 10, done: false }] }] },
    ];
    expect(previousSet(history, item, 0)).toEqual({ reps: 10, loadKg: 20, done: true });
    expect(previousSet(history, { ...item, sets: [{ reps: null, loadKg: null, done: false, kind: 'warmup' }] }, 0)?.loadKg).toBe(5);
  });

  it('copies only a completed earlier same-kind set, otherwise uses real history', () => {
    const current: SessionItem = { ...item, sets: [{ reps: 10, loadKg: 20, done: true }, { reps: 4, loadKg: 5, done: true, kind: 'warmup' }, { reps: 9, loadKg: 25, done: false }, item.sets[1]] };
    expect(copySource([], current, 3)?.loadKg).toBe(20);
    expect(copySource([], current, 1)).toBeUndefined();
    expect(copySource([], item, 0)).toBeUndefined();
  });

  it('excludes warm-ups, skipped items, and unlogged completion from metrics', () => {
    const actual = { ...session, items: [{ ...item, sets: [{ reps: 10, loadKg: 10, done: true, kind: 'warmup' as const }, { reps: 8, loadKg: 20, done: true }, { reps: null, loadKg: 50, done: true }] }, { ...item, skipped: true, sets: [{ reps: 20, loadKg: 100, done: true }] }] };
    expect(workingMetrics(actual)).toEqual({ total: 2, completed: 1, volumeKg: 160, percent: 50 });
  });

  it('restores elapsed time from timestamps and deducts paused time', () => {
    expect(elapsedWorkoutSeconds({ ...session, state: 'active', pausedAt: 11000, pausedMs: 2000 }, 99000)).toBe(8);
    expect(elapsedWorkoutSeconds({ ...session, endedAt: 31000, pausedMs: 20000 })).toBe(10);
    expect(elapsedWorkoutSeconds({ ...session, startedAt: 99000 }, 1000)).toBe(0);
  });
});
