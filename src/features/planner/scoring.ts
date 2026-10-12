import type { Exercise, Movement, UserProfile, WorkoutSession } from '../../data/types';

const COMPOUND_MOVEMENTS: ReadonlySet<Movement> = new Set([
  'squat',
  'hinge',
  'hpush',
  'vpush',
  'hpull',
  'vpull',
]);

const MACHINE_EQUIPMENT: ReadonlySet<string> = new Set([
  'cable',
  'lat-pulldown',
  'seated-row',
  'chest-press',
  'leg-press',
  'leg-extension',
  'leg-curl',
  'pec-deck',
  'assisted-pullup',
  'dip-station',
  'back-extension',
  'tbar-row',
  'hip-thrust',
  'calf-raise',
  'adductor',
  'treadmill',
  'rower',
  'cycle',
]);

const SIMPLE_EQUIPMENT: ReadonlySet<string> = new Set([
  'bodyweight',
  'mat',
  'chair',
  'bands',
  'dumbbells',
  'adj-dumbbells',
]);

/**
 * Checks if the exercise was performed in the most recent session.
 */
function isTrainedInRecentSession(candidateId: string, history: WorkoutSession[]): boolean {
  if (!history || history.length === 0) return false;
  const sorted = [...history].sort((a, b) => (b.startedAt || 0) - (a.startedAt || 0));
  const recentSession = sorted[0];
  if (!recentSession?.items) return false;
  return recentSession.items.some((item) => item.exerciseId === candidateId && !item.skipped);
}

/**
 * Evaluates whether an exercise fits the user's selected primary goal (§7.2).
 */
function fitsGoal(candidate: Exercise, goal: UserProfile['goal']): boolean {
  switch (goal) {
    case 'strength':
      return COMPOUND_MOVEMENTS.has(candidate.movement);
    case 'endurance':
      return (
        candidate.equipmentIds.includes('bodyweight') ||
        candidate.equipmentIds.some((eq) => MACHINE_EQUIPMENT.has(eq))
      );
    case 'technique':
      return candidate.difficulty === 1;
    case 'mobility':
      return candidate.movement === 'mobility';
    case 'fitness':
      return COMPOUND_MOVEMENTS.has(candidate.movement) || candidate.difficulty <= 2;
    default:
      return false;
  }
}

/** Bonus for training a muscle the user asked the planner to focus on. */
export const TARGET_MUSCLE_BONUS = 25;

/**
 * Candidate exercise scoring engine (§7.2).
 *
 * Scoring factors:
 * - Fit for movement target: +40
 * - Fit for goal (strength = compounds/heavier, endurance = higher reps/bodyweight/machines, technique = lower difficulty): +20
 * - User liked: +20, Pinned: +50, Disliked: -100
 * - Requested focus muscle: +25
 * - Recent session rotation (penalize if trained in very recent session to avoid repetition): -15
 * - Suitability for experience (difficulty matches experience): +15
 * - Equipment friction: prefer simpler equipment when home/travel: +10
 */
export function scoreExercise(
  candidate: Exercise,
  profile: UserProfile,
  history: WorkoutSession[] = [],
  dayTargets: Movement[] = [],
): number {
  let score = 0;

  // 1. Fit for movement target (+40)
  if (dayTargets.includes(candidate.movement)) {
    score += 40;
  }

  // 2. Fit for goal (+20)
  if (fitsGoal(candidate, profile.goal)) {
    score += 20;
  }

  // 3. User preferences (Pinned: +50, Liked: +20, Disliked: -100)
  if (profile.pinned?.includes(candidate.id)) {
    score += 50;
  }
  if (profile.liked?.includes(candidate.id)) {
    score += 20;
  }
  if (profile.disliked?.includes(candidate.id)) {
    score -= 100;
  }

  // 4. Requested focus muscles (+25)
  const targetMuscles = profile.targetMuscles ?? [];
  if (candidate.primary.some((muscle) => targetMuscles.includes(muscle))) {
    score += TARGET_MUSCLE_BONUS;
  }

  // 5. Recent session rotation (-15)
  if (isTrainedInRecentSession(candidate.id, history)) {
    score -= 15;
  }

  // 6. Suitability for experience (+15)
  // Difficulty 1 = beginner ('new'), 2 = intermediate ('some'), 3 = advanced ('experienced')
  if (
    (profile.experience === 'new' && candidate.difficulty === 1) ||
    (profile.experience === 'some' && candidate.difficulty === 2) ||
    (profile.experience === 'experienced' && candidate.difficulty === 3)
  ) {
    score += 15;
  }

  // 7. Equipment friction (+10): prefer simpler equipment for home/travel
  if (profile.activeLocation === 'home' || profile.activeLocation === 'travel') {
    const usesOnlySimpleEquipment =
      candidate.equipmentIds.length > 0 &&
      candidate.equipmentIds.every((eq) => SIMPLE_EQUIPMENT.has(eq));
    if (usesOnlySimpleEquipment) {
      score += 10;
    }
  }

  return score;
}
