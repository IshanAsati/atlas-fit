import type { Exercise, MuscleId, PerformedSet, SessionItem, WorkoutSession } from '../../data/types';

/** Legacy sets have no kind and are working sets. Never infer completion from session state. */
export function isWorkingSet(set: PerformedSet & { kind?: string }): boolean {
  return set.done && set.kind !== 'warmup';
}

export function workingSets(item: SessionItem): PerformedSet[] {
  return item.skipped ? [] : item.sets.filter(isWorkingSet);
}

export function sessionWorkingSetCount(session: WorkoutSession): number {
  return session.items.reduce((count, item) => count + workingSets(item).length, 0);
}

export interface MuscleActivity {
  /** A single working set can target multiple primary muscles; these are not additive totals. */
  primary: Partial<Record<MuscleId, number>>;
  /** Supporting contribution is a heuristic: half a set per secondary target, not actual sets. */
  secondaryEstimate: Partial<Record<MuscleId, number>>;
  actualWorkingSets: number;
}

export function calculateMuscleActivity(
  sessions: WorkoutSession[],
  catalog: Exercise[],
  window: 'week' | 'month' | 'all',
  now = Date.now(),
): MuscleActivity {
  const cutoff = window === 'all' ? 0 : now - (window === 'week' ? 7 : 30) * 86400000;
  const exercises = new Map(catalog.map((exercise) => [exercise.id, exercise]));
  const result: MuscleActivity = { primary: {}, secondaryEstimate: {}, actualWorkingSets: 0 };
  for (const session of sessions) {
    const timestamp = session.endedAt ?? session.startedAt;
    if (session.state !== 'done' || timestamp < cutoff || timestamp > now) continue;
    for (const item of session.items) {
      const count = workingSets(item).length;
      result.actualWorkingSets += count;
      const exercise = exercises.get(item.exerciseId);
      if (!exercise || !count) continue;
      for (const id of new Set(exercise.primary)) {
        result.primary[id] = (result.primary[id] ?? 0) + count;
      }
      for (const id of new Set(exercise.secondary)) {
        if (exercise.primary.includes(id)) continue;
        result.secondaryEstimate[id] = (result.secondaryEstimate[id] ?? 0) + count * 0.5;
      }
    }
  }
  return result;
}
