import type { Exercise, PerformedSet, SessionItem, WorkoutSession } from '../../data/types';
import { getProgressionSuggestion, type ProgressionSuggestion } from './progression';
import { isLoadEligibleExercise, suggestWarmupSets } from './warmups';
import { displayLoad, type WeightUnit } from './workoutHelpers';

export function applySuggestedTarget(item: SessionItem, suggestion: ProgressionSuggestion): SessionItem {
  if (item.skipped || item.discomfort) return item;
  return { ...item, sets: item.sets.map((set) => !set.done && set.kind !== 'warmup' && set.loadKg === null && set.reps === null
    ? { ...set, loadKg: suggestion.loadKg, reps: suggestion.reps } : set) };
}

export function prependWarmups(item: SessionItem, warmups: PerformedSet[]): SessionItem {
  if (item.skipped || item.discomfort || item.sets.some((set) => set.kind === 'warmup' || set.done)) return item;
  return { ...item, sets: [...warmups.map((set) => ({ ...set, done: false, kind: 'warmup' as const })), ...item.sets] };
}

interface Props {
  exercise: Exercise;
  item: SessionItem;
  history: WorkoutSession[];
  unit: WeightUnit;
  loadFactor?: number;
  disabled?: boolean;
  onUseSuggestion: (suggestion: ProgressionSuggestion) => void;
  onAddWarmups: (sets: PerformedSet[]) => void;
}

export function WorkoutTrainingTools({ exercise, item, history, unit, loadFactor = 1, disabled, onUseSuggestion, onAddWarmups }: Props) {
  // Reduced deload loads must not become the next block's progression baseline.
  const suggestion = getProgressionSuggestion(exercise, item, history.filter((session) => session.blockContext?.phase !== 'deload'), unit, loadFactor);
  const manualLoad = item.sets.find((set) => set.kind !== 'warmup' && set.loadKg !== null && set.loadKg > 0)?.loadKg;
  const warmups = suggestWarmupSets(manualLoad ?? suggestion?.loadKg ?? 0, exercise, unit);
  const emptyTargets = item.sets.some((set) => !set.done && set.kind !== 'warmup' && set.loadKg === null && set.reps === null);
  const canWarmup = warmups.length > 0 && !item.sets.some((set) => set.kind === 'warmup' || set.done);
  if (item.skipped || item.discomfort) return null;
  return <section className="workout-training-tools" aria-label="Training suggestions">
    <h3>Suggested target</h3>
    {suggestion ? <>
      <p>{suggestion.loadKg === null ? '' : `${displayLoad(suggestion.loadKg, unit)} ${unit} × `}{suggestion.reps} reps</p>
      <p className="small">{suggestion.reason} Suggestions are optional, not a form or safety assessment.</p>
      <button type="button" disabled={disabled || !emptyTargets} onClick={() => onUseSuggestion(suggestion)}>Use suggested target</button>
      <p className="small">Fills empty working sets only. Sets stay unmarked until you complete them.</p>
    </> : <p className="small">Log a completed workout and each working set’s effort to get a next-session target. Timed holds and mobility do not receive rep suggestions.</p>}
    {isLoadEligibleExercise(exercise) && <>
      <button type="button" disabled={disabled || !canWarmup} onClick={() => onAddWarmups(warmups)}>Add warm-up sets</button>
      <p className="small">{item.sets.some((set) => set.kind === 'warmup') ? 'Warm-up sets are already included.' : canWarmup
        ? `Adds ${warmups.length} lighter, unmarked sets before your working sets: ${warmups.map((set) => `${displayLoad(set.loadKg!, unit)} ${unit} × ${set.reps}`).join(' · ')}.`
        : 'Enter a working load before your first completed set to suggest lighter warm-ups.'}</p>
    </>}
  </section>;
}
