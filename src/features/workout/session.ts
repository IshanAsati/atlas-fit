import type { Plan, PlanDay, SessionItem, WorkoutSession } from '../../data/types';

/** Build a fresh session from a planned day (real sets, no fake data). */
export function buildSession(plan: Plan, day: PlanDay, id?: string): WorkoutSession {
  const items: SessionItem[] = day.exercises.map((pe) => ({
    exerciseId: pe.exerciseId,
    planned: pe,
    sets: Array.from({ length: pe.sets }, () => ({ reps: null, loadKg: null, done: false })),
  }));
  return {
    id: id ?? `session-${Date.now()}`,
    title: day.label,
    planId: plan.id,
    dayId: day.id,
    location: plan.location,
    startedAt: Date.now(),
    state: 'active',
    items,
  };
}

/** Quick unsaved warm-up session when no plan exists yet. */
export function buildEmptySession(title: string, id?: string): WorkoutSession {
  return {
    id: id ?? `session-${Date.now()}`,
    title,
    location: 'home',
    startedAt: Date.now(),
    state: 'active',
    items: [],
  };
}

export function doneSets(session: WorkoutSession): { done: number; total: number } {
  let done = 0;
  let total = 0;
  for (const item of session.items) {
    if (item.skipped) continue;
    for (const s of item.sets) {
      total += 1;
      if (s.done) done += 1;
    }
  }
  return { done, total };
}

export function formatElapsed(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
