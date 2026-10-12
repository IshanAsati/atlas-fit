import type { PlanDay, LocationType, Routine, WorkoutSession } from './types';
import { db } from './db';

export function routineFromDay(day: PlanDay, location: LocationType, title = day.label): Routine {
  const now = Date.now();
  return { id: crypto.randomUUID(), title: title.trim() || day.label, createdAt: now, updatedAt: now,
    location, exercises: day.exercises.map((exercise) => ({ ...exercise })) };
}

export async function getRoutines(): Promise<Routine[]> {
  return db.routines.orderBy('updatedAt').reverse().toArray();
}

export async function saveRoutine(routine: Routine): Promise<void> {
  if (!routine.title.trim() || !routine.exercises.length) throw new Error('Give the routine a name and at least one exercise.');
  if (routine.exercises.some((exercise) => !Number.isInteger(exercise.sets) || exercise.sets < 1 || exercise.sets > 30 ||
    !Number.isFinite(exercise.restSec) || exercise.restSec < 0 || exercise.restSec > 1800 || !exercise.reps.trim())) {
    throw new Error('Use 1–30 sets, a rep target, and a rest time between 0 and 1800 seconds.');
  }
  await db.routines.put({ ...routine, title: routine.title.trim(), updatedAt: Date.now() });
}

export async function deleteRoutine(id: string): Promise<void> { await db.routines.delete(id); }

export function sessionFromRoutine(routine: Routine): WorkoutSession {
  return { id: crypto.randomUUID(), title: routine.title, location: routine.location, startedAt: Date.now(), state: 'active',
    items: routine.exercises.map((exercise) => ({ exerciseId: exercise.exerciseId, planned: { ...exercise },
      sets: Array.from({ length: exercise.sets }, () => ({ reps: null, loadKg: null, done: false, kind: 'working' })) })) };
}

export async function saveRoutineFromSession(session: WorkoutSession, title = session.title): Promise<Routine> {
  const now = Date.now();
  const routine: Routine = { id: crypto.randomUUID(), title, location: session.location, createdAt: now, updatedAt: now,
    exercises: session.items.filter((item) => !item.skipped).map((item) => ({
      exerciseId: item.exerciseId, sets: Math.max(1, item.sets.filter((set) => set.kind !== 'warmup').length),
      reps: item.planned?.reps ?? '8–12', restSec: item.planned?.restSec ?? 90, reason: 'Saved from your workout',
    })) };
  await saveRoutine(routine);
  return routine;
}

export function completedWorkingSets(session: WorkoutSession): number {
  return session.items.filter((item) => !item.skipped).reduce((total, item) =>
    total + item.sets.filter((set) => set.done && set.kind !== 'warmup').length, 0);
}
