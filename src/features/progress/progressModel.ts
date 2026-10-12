import type { ExerciseFeedback, PerformedSet, UserProfile, WorkoutSession } from '../../data/types';
import { workingSets } from '../bodygraph/activity';
import { displayLoad, type WeightUnit } from '../workout/workoutHelpers';

export function completedSessions(sessions: WorkoutSession[]): WorkoutSession[] {
  return sessions.filter((session) => session.state === 'done')
    .sort((a, b) => (b.endedAt ?? b.startedAt) - (a.endedAt ?? a.startedAt));
}

/** Local calendar dates: UTC slicing would put late-night sessions on the wrong day. */
export function localDay(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function exerciseHistory(sessions: WorkoutSession[], exerciseId: string) {
  return completedSessions(sessions).flatMap((session) => {
    const sets = session.items.filter((item) => item.exerciseId === exerciseId).flatMap(workingSets);
    return sets.length ? [{ session, sets }] : [];
  });
}

export interface RecordedPR { loadKg: number; reps: number; timestamp: number }

/** PR = heaviest recorded working set, then most reps recorded at exactly that load. Not estimated 1RM. */
export function recordedPR(sessions: WorkoutSession[], exerciseId: string): RecordedPR | null {
  let best: RecordedPR | null = null;
  for (const { session, sets } of exerciseHistory(sessions, exerciseId)) {
    for (const set of sets) {
      if (!hasRecordedPerformance(set)) continue;
      const loadKg = set.loadKg!;
      const reps = set.reps!;
      if (!best || loadKg > best.loadKg || (loadKg === best.loadKg && reps > best.reps)) {
        best = { loadKg, reps, timestamp: session.endedAt ?? session.startedAt };
      }
    }
  }
  return best;
}

function hasRecordedPerformance(set: PerformedSet): boolean {
  return set.loadKg !== null && Number.isFinite(set.loadKg) && set.loadKg >= 0
    && set.reps !== null && Number.isFinite(set.reps) && set.reps > 0;
}

export function progressionSuggestion(
  sessions: WorkoutSession[], exerciseId: string,
  profile: UserProfile | null, feedback: ExerciseFeedback[],
): string | null {
  // Unknown safety context, restrictions, or any free-text discomfort means no progression prompt.
  if (!profile || profile.restrictions.includes(exerciseId) || profile.discomfortNotes.trim()
    || feedback.some((entry) => entry.exerciseId === exerciseId && entry.discomfort)) return null;
  if (sessions.some((session) => session.items.some((item) => item.exerciseId === exerciseId && item.discomfort))) return null;
  const latest = exerciseHistory(sessions, exerciseId)[0];
  if (!latest || latest.sets.length < 2 || !latest.sets.every(hasRecordedPerformance)) return null;
  if (!latest.sets.every((set) => set.effort === 1 || set.effort === 2)) return null;
  const load = latest.sets[0].loadKg;
  if (!latest.sets.every((set) => set.loadKg === load)) return null;
  if (latest.sets.every((set) => set.effort === 1)) {
    return `Your latest ${latest.sets.length} working sets were marked easy. If technique feels steady and there is no discomfort, consider one extra rep on one set at the same load next time. Optional, not a prescription.`;
  }
  return 'Your latest working sets were marked easy or right. Consider repeating the same load and reps before increasing. Only if technique feels steady and there is no discomfort. Optional, not a prescription.';
}

export function formatSet(set: PerformedSet, unit: WeightUnit = 'kg'): string {
  const reps = set.reps === null ? 'Reps not recorded' : `${set.reps} reps`;
  const load = set.loadKg === null ? 'load not recorded' : set.loadKg === 0 ? 'no added load' : `${displayLoad(set.loadKg, unit)} ${unit}`;
  return `${reps} · ${load}`;
}
