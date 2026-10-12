import type { Exercise, PerformedSet } from '../../data/types';
import { canonicalLoad } from './workoutHelpers';
import type { WeightUnit } from './workoutHelpers';

const LOAD_EQUIPMENT = new Set([
  'dumbbells', 'adj-dumbbells', 'backpack', 'kettlebell', 'sandbag', 'slam-ball', 'weight-vest',
  'barbell', 'trap-bar', 'ez-bar', 'cable', 'lat-pulldown', 'seated-row', 'chest-press',
  'shoulder-press', 'pec-deck', 'leg-press', 'leg-extension', 'leg-curl', 'calf-raise',
  'hip-thrust', 'adductor', 'smith-machine', 'hack-squat', 'ab-crunch', 'tbar-row', 'landmine',
]);
const SMALL_LOAD_EQUIPMENT = new Set([
  'dumbbells', 'adj-dumbbells', 'backpack', 'kettlebell', 'sandbag', 'slam-ball', 'weight-vest',
]);

/** Seconds, distance, static holds and mobility must not become fictional reps. */
export function isRepBasedExercise(exercise: Exercise): boolean {
  if (exercise.movement === 'mobility' || exercise.movement === 'carry') return false;
  const names = [exercise.id.replaceAll('-', ' '), exercise.name, ...exercise.aliases].join(' ').toLowerCase();
  return !(/\b(hold|wall sit|isometric|dead hang|front lever|back lever|pose)\b/.test(names)
    || (/\bplank\b/.test(names) && !/\b(row|jack|reach|tap|walk|rotation|up.down)\b/.test(names)));
}

export function isLoadEligibleExercise(exercise: Exercise): boolean {
  // An assistance-stack number is not external resistance: increasing it makes the lift easier.
  return isRepBasedExercise(exercise) && !exercise.equipmentIds.includes('assisted-pullup')
    && exercise.equipmentIds.some((id) => LOAD_EQUIPMENT.has(id));
}

/** Suggested increments, not a claim about the equipment a user actually owns. */
export function suggestedLoadStepKg(exercise: Exercise, unit: WeightUnit): number {
  const small = exercise.equipmentIds.some((id) => SMALL_LOAD_EQUIPMENT.has(id));
  return canonicalLoad(unit === 'lb' ? (small ? 1 : 2.5) : (small ? 0.5 : 1.25), unit);
}

export function roundSuggestedLoadDown(loadKg: number, exercise: Exercise, unit: WeightUnit): number {
  const step = suggestedLoadStepKg(exercise, unit);
  return Math.floor(loadKg / step + 1e-9) * step;
}

/** Optional preparation only. Callers explicitly append these; existing logs are never touched. */
export function suggestWarmupSets(
  workingLoadKg: number, exercise: Exercise, unit: WeightUnit = 'kg',
): PerformedSet[] {
  if (!Number.isFinite(workingLoadKg) || workingLoadKg <= 0 || !isLoadEligibleExercise(exercise)) return [];
  const sets: PerformedSet[] = [];
  for (const [factor, reps] of [[0.5, 8], [0.7, 5], [0.85, 3]]) {
    const loadKg = roundSuggestedLoadDown(workingLoadKg * factor, exercise, unit);
    if (loadKg <= 0 || loadKg >= workingLoadKg || loadKg <= (sets.at(-1)?.loadKg ?? 0)) continue;
    sets.push({ loadKg, reps, done: false, kind: 'warmup' });
  }
  // Very light loads may not support two distinct rounded preparation weights.
  return sets.length >= 2 ? sets : [];
}
