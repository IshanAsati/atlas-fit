import type {
  Exercise,
  ExerciseFeedback,
  Experience,
  LocationType,
  Plan,
  UserProfile,
} from '../../data/types';

/**
 * Checks whether an exercise requires only equipment available in the user's location inventory.
 */
export function hasRequiredEquipment(
  exercise: Exercise,
  availableEquipment: string[] = [],
): boolean {
  if (!exercise.equipmentIds || exercise.equipmentIds.length === 0) {
    return true;
  }
  const availableSet = new Set(availableEquipment);
  return exercise.equipmentIds.every(
    (eq) =>
      availableSet.has(eq) ||
      (eq === 'dumbbells' && availableSet.has('adj-dumbbells')) ||
      (eq === 'adj-dumbbells' && availableSet.has('dumbbells')),
  );
}

/**
 * Checks whether an exercise matches discomfort notes written by the user.
 */
export function matchesDiscomfortNotes(
  exercise: Exercise,
  discomfortNotes?: string,
): boolean {
  if (!discomfortNotes || !discomfortNotes.trim()) return false;
  const noteLower = discomfortNotes.toLowerCase();
  const nameLower = exercise.name.toLowerCase();
  const idNormalized = exercise.id.toLowerCase().replace(/[-_]/g, ' ');

  // 1. Direct contains either way
  if (noteLower.includes(nameLower) || noteLower.includes(exercise.id.toLowerCase())) {
    return true;
  }
  if (nameLower.includes(noteLower) || idNormalized.includes(noteLower)) {
    return true;
  }

  // 2. Check aliases
  if (
    exercise.aliases?.some((alias) => {
      const a = alias.toLowerCase();
      return a.length > 2 && (noteLower.includes(a) || a.includes(noteLower));
    })
  ) {
    return true;
  }

  // 3. Check phrases split by punctuation (commas, semicolons, periods)
  const phrases = noteLower
    .split(/[,;.\n]+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 2);
  for (const phrase of phrases) {
    if (nameLower.includes(phrase) || idNormalized.includes(phrase)) {
      return true;
    }
  }

  // 4. Check 2-word n-grams from the note
  const words = noteLower.split(/[^a-z0-9]+/).filter((w) => w.length > 2);
  for (let i = 0; i < words.length - 1; i += 1) {
    const bigram = `${words[i]} ${words[i + 1]}`;
    if (nameLower.includes(bigram) || idNormalized.includes(bigram)) {
      return true;
    }
  }

  // 5. If note mentions "shoulder" and "press" and this is an overhead/shoulder vertical push exercise
  if (
    words.includes('shoulder') &&
    words.includes('press') &&
    (exercise.movement === 'vpush' || idNormalized.includes('press'))
  ) {
    return true;
  }

  return false;
}

/**
 * Checks whether an exercise conflicts with user restrictions, discomfort notes, or feedback.
 */
export function conflictsWithRestrictions(
  exercise: Exercise,
  profile: UserProfile,
  feedback?: ExerciseFeedback[],
): boolean {
  // 1. Explicitly in user's restrictions array
  if (profile.restrictions?.includes(exercise.id)) {
    return true;
  }

  // 2. Flagged discomfort in feedback
  if (feedback?.some((f) => f.exerciseId === exercise.id && f.discomfort)) {
    return true;
  }

  // 3. Mentions in discomfort notes
  if (matchesDiscomfortNotes(exercise, profile.discomfortNotes)) {
    return true;
  }

  return false;
}

/**
 * Checks whether an exercise's difficulty is appropriate for the user's experience level:
 * - beginner ('new'): difficulty === 1
 * - intermediate ('some'): difficulty <= 2
 * - experienced ('experienced'): any (1, 2, or 3)
 */
export function isSuitableForExperience(
  exercise: Exercise,
  experience: Experience,
): boolean {
  if (experience === 'new') {
    return exercise.difficulty === 1;
  }
  if (experience === 'some') {
    return exercise.difficulty <= 2;
  }
  return true; // 'experienced'
}

/**
 * Hard filters validation for a candidate exercise (§7.2 step 3).
 */
export function isExerciseEligible(
  candidate: Exercise,
  profile: UserProfile,
  location?: LocationType,
  feedback?: ExerciseFeedback[],
): boolean {
  const activeLocation = location ?? profile.activeLocation;
  const availableEquipment = profile.equipment?.[activeLocation] ?? [];

  return (
    hasRequiredEquipment(candidate, availableEquipment) &&
    !conflictsWithRestrictions(candidate, profile, feedback) &&
    isSuitableForExperience(candidate, profile.experience)
  );
}

/**
 * Filter an entire exercise catalog by hard constraints for the given profile and location.
 */
export function filterEligibleExercises(
  catalog: Exercise[],
  profile: UserProfile,
  location?: LocationType,
  feedback?: ExerciseFeedback[],
): Exercise[] {
  return catalog.filter((candidate) =>
    isExerciseEligible(candidate, profile, location, feedback),
  );
}

export interface PlanValidationResult {
  valid: boolean;
  issues: string[];
}

/**
 * Validates a generated plan against user profile constraints and catalog data (§7.2 step 7).
 */
export function validatePlan(
  plan: Plan,
  profile: UserProfile,
  catalog: Exercise[],
  feedback?: ExerciseFeedback[],
): PlanValidationResult {
  const issues: string[] = [];
  const catalogMap = new Map(catalog.map((ex) => [ex.id, ex]));
  const availableEquipment = profile.equipment?.[plan.location] ?? [];

  if (!plan.days || plan.days.length === 0) {
    issues.push('Plan must contain at least one day.');
  }

  for (const day of plan.days) {
    if (!day.exercises || day.exercises.length === 0) {
      issues.push(`Day "${day.label}" has no exercises planned.`);
      continue;
    }

    const seenInDay = new Set<string>();

    for (const planned of day.exercises) {
      const ex = catalogMap.get(planned.exerciseId);
      if (!ex) {
        issues.push(`Exercise "${planned.exerciseId}" not found in catalog.`);
        continue;
      }

      if (seenInDay.has(ex.id)) {
        issues.push(`Duplicate exercise "${ex.name}" in day "${day.label}".`);
      }
      seenInDay.add(ex.id);

      if (!hasRequiredEquipment(ex, availableEquipment)) {
        issues.push(
          `Exercise "${ex.name}" requires equipment not available for location "${plan.location}".`,
        );
      }

      if (conflictsWithRestrictions(ex, profile, feedback)) {
        issues.push(
          `Exercise "${ex.name}" conflicts with user restrictions or discomfort.`,
        );
      }

      if (!isSuitableForExperience(ex, profile.experience)) {
        issues.push(
          `Exercise "${ex.name}" difficulty (${ex.difficulty}) exceeds experience level "${profile.experience}".`,
        );
      }
    }
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}
