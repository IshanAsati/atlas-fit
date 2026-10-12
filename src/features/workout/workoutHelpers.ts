import type { PerformedSet, SessionItem, WorkoutSession } from '../../data/types';

export type WeightUnit = 'kg' | 'lb';
const POUNDS_PER_KG = 2.2046226218;

/** Display units only: all stored loads remain kilograms. */
export function displayLoad(loadKg: number, unit: WeightUnit): number {
  return Math.round((unit === 'lb' ? loadKg * POUNDS_PER_KG : loadKg) * 100) / 100;
}

export function canonicalLoad(load: number, unit: WeightUnit): number {
  return unit === 'lb' ? load / POUNDS_PER_KG : load;
}

export function hasRealPerformance(set: PerformedSet): boolean {
  return set.done && set.reps !== null && Number.isInteger(set.reps) && set.reps > 0
    && (set.loadKg === null || (Number.isFinite(set.loadKg) && set.loadKg >= 0));
}

/** Match like-for-like set kinds, not a warm-up to a working set. */
export function previousSet(
  sessions: WorkoutSession[], item: SessionItem, setIndex: number,
): PerformedSet | undefined {
  const kind = item.sets[setIndex]?.kind ?? 'working';
  const ordinal = item.sets.slice(0, setIndex).filter((set) => (set.kind ?? 'working') === kind).length;
  for (const session of [...sessions].sort((a, b) => b.startedAt - a.startedAt)) {
    if (session.state !== 'done') continue;
    const previous = session.items.find((candidate) => candidate.exerciseId === item.exerciseId && !candidate.skipped);
    const match = previous?.sets.filter((set) => (set.kind ?? 'working') === kind)[ordinal];
    if (match && hasRealPerformance(match)) return match;
  }
  return undefined;
}

export function copySource(sessions: WorkoutSession[], item: SessionItem, setIndex: number): PerformedSet | undefined {
  const kind = item.sets[setIndex]?.kind ?? 'working';
  const earlier = item.sets.slice(0, setIndex).reverse().find((set) =>
    (set.kind ?? 'working') === kind && hasRealPerformance(set));
  return earlier ?? previousSet(sessions, item, setIndex);
}

export function formatPerformance(set: PerformedSet, unit: WeightUnit): string {
  return set.loadKg === null
    ? `${set.reps} reps`
    : `${displayLoad(set.loadKg, unit)} ${unit} × ${set.reps}`;
}

export function workingMetrics(session: WorkoutSession) {
  let total = 0;
  let completed = 0;
  let volumeKg = 0;
  for (const item of session.items) {
    if (item.skipped) continue;
    for (const set of item.sets) {
      if (set.kind === 'warmup') continue;
      total++;
      if (!hasRealPerformance(set)) continue;
      completed++;
      if (set.loadKg !== null && Number.isFinite(set.loadKg)) volumeKg += set.loadKg * (set.reps ?? 0);
    }
  }
  return { total, completed, volumeKg, percent: total ? Math.round(completed / total * 100) : 0 };
}

export function elapsedWorkoutSeconds(session: WorkoutSession, now = Date.now()): number {
  const end = session.endedAt ?? session.pausedAt ?? now;
  return Math.max(0, Math.floor((end - session.startedAt - (session.pausedMs ?? 0)) / 1000));
}

export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  return `${mins}:${String(seconds % 60).padStart(2, '0')}`;
}
