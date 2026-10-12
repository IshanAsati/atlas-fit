import type { Exercise, SessionItem, WorkoutSession } from '../../data/types';
import { hasRealPerformance } from './workoutHelpers';
import type { WeightUnit } from './workoutHelpers';
import {
  isLoadEligibleExercise, isRepBasedExercise, roundSuggestedLoadDown, suggestedLoadStepKg,
} from './warmups';

export interface ProgressionSuggestion {
  loadKg: number | null;
  reps: number | null;
  action: string;
  reason: string;
}

function repRange(value: string | undefined): { lower: number; upper: number } | null {
  // Accept the planner's controlled-rep suffix, but never seconds, distances, AMRAP or arbitrary prose.
  const match = value?.trim().match(/^(\d{1,3})(?:\s*[-–—]\s*(\d{1,3}))?(?:\s+(?:reps?|controlled|per side))*$/i);
  if (!match) return null;
  const lower = Number(match[1]);
  const upper = Number(match[2] ?? match[1]);
  return lower >= 1 && upper >= lower && upper <= 100 ? { lower, upper } : null;
}

function plannedCount(item: SessionItem): number {
  const count = item.planned?.sets;
  return count !== undefined && Number.isInteger(count) && count > 0 ? count : 0;
}

/** A transparent, opt-in target based on one workout, never a rewrite of recorded performance. */
export function getProgressionSuggestion(
  exercise: Exercise, item: SessionItem, history: WorkoutSession[],
  unit: WeightUnit = 'kg', loadFactor = 1,
): ProgressionSuggestion | null {
  if (exercise.id !== item.exerciseId || item.skipped || item.discomfort || !isRepBasedExercise(exercise)
    || !Number.isFinite(loadFactor) || loadFactor <= 0 || loadFactor > 1) return null;

  // Do not fall back to an older success if the latest relevant attempt was incomplete or uncomfortable.
  const session = [...history].filter((candidate) => candidate.state === 'done'
    && Number.isFinite(candidate.startedAt)
    && candidate.items.some((entry) => entry.exerciseId === item.exerciseId && !entry.skipped))
    .sort((a, b) => b.startedAt - a.startedAt)[0];
  const previous = session?.items.find((entry) => entry.exerciseId === item.exerciseId && !entry.skipped);
  if (!previous || previous.discomfort) return null;
  const range = repRange(item.planned?.reps ?? previous.planned?.reps);
  if (!range) return null;

  const working = previous.sets.filter((set) => set.kind !== 'warmup');
  const logged = working.filter(hasRealPerformance);
  if (!logged.length) return null;
  const required = Math.max(plannedCount(item), plannedCount(previous), working.length,
    item.sets.filter((set) => set.kind !== 'warmup').length, 1);
  const complete = logged.length >= required;
  const reps = Math.min(range.upper, ...logged.map((set) => set.reps!));
  const weighted = isLoadEligibleExercise(exercise);
  const loads = logged.map((set) => set.loadKg);
  const knownLoad = weighted && loads.every((load) => load !== null && load > 0);
  const loadKg = knownLoad ? Math.min(...loads.map((load) => load!)) : null;
  const sameLoad = loads.every((load) => load === loads[0]);

  if (loadFactor < 1) {
    const reduced = loadKg === null ? null : roundSuggestedLoadDown(loadKg * loadFactor, exercise, unit);
    if (reduced !== null && reduced <= 0) return null;
    return { loadKg: reduced, reps, action: 'deload', reason: 'Deload target: reduce the last logged load without progressing reps.' };
  }

  const hold = (reason: string): ProgressionSuggestion => ({ loadKg, reps, action: 'hold', reason });
  if (!complete) return hold('Keep the last logged target: not all required working sets were completed.');
  if (working.some((set) => set.effort === 3)) return hold('Keep the target: a working set was marked hard.');
  const previousRange = repRange(previous.planned?.reps);
  if (logged.some((set) => set.reps! < Math.max(range.lower, previousRange?.lower ?? range.lower))) {
    return hold('Keep the target: a working set fell below the planned rep range.');
  }
  if (!logged.every((set) => set.effort === 1 || set.effort === 2)) {
    return hold('Keep the target and log effort on every working set before progressing.');
  }
  if (weighted && (!knownLoad || !sameLoad)) return hold('Keep the target: comparable working loads are needed before progressing.');

  if (reps < range.upper) {
    return { loadKg, reps: reps + 1, action: 'reps', reason: 'All working sets met the range without hard effort. Try one more rep at the same load.' };
  }
  if (loadKg === null) return hold('You reached the top of the rep range. Keep this bodyweight target; no added weight is suggested.');

  // Aim for 2.5%, allowing one rounded increment only when it is still at most 5% (and 2.5 kg).
  const step = suggestedLoadStepKg(exercise, unit);
  const increment = Math.max(step, Math.floor(loadKg * 0.025 / step + 1e-9) * step);
  const nextLoad = roundSuggestedLoadDown(loadKg + Math.min(increment, 2.5), exercise, unit);
  const increase = nextLoad - loadKg;
  if (increase <= 0 || increase > loadKg * 0.05 + 1e-9 || increase > 2.5 + 1e-9) {
    return hold('Keep the load: the next rounded increment would be too large for a conservative increase.');
  }
  return { loadKg: nextLoad, reps: range.lower, action: 'load', reason: 'Every required working set reached the top of the range without hard effort. Try a small load increase and return to the lower rep target.' };
}
