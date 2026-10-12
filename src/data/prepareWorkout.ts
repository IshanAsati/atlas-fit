import type { UserProfile, WorkoutSession } from './types';
import { applyTrainingBlockToSession, getTrainingBlockPhase } from '../features/planner/trainingBlocks';

/** Only a fresh, empty session receives block prescriptions, never a resume. */
export function prepareNewWorkout(session: WorkoutSession, profile: UserProfile): WorkoutSession {
  if (session.state !== 'active' || session.blockContext || session.endedAt !== undefined || session.pausedAt !== undefined || (session.pausedMs ?? 0) > 0 || session.items.some((item) =>
    item.skipped || item.discomfort || item.sets.some((set) => set.done || set.reps !== null || set.loadKg !== null || set.effort !== undefined))) return session;
  const date = new Date(session.startedAt);
  const phase = getTrainingBlockPhase(profile.trainingBlock, date);
  if (phase.phase !== 'build' && phase.phase !== 'deload') return session;
  const adjusted = applyTrainingBlockToSession(session, profile.trainingBlock, date);
  return { ...adjusted, blockContext: {
    week: phase.week, lengthWeeks: profile.trainingBlock!.lengthWeeks,
    phase: phase.phase, loadFactor: phase.loadFactor,
  } };
}
