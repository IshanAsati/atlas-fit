import type {
  Exercise,
  ExerciseFeedback,
  Experience,
  Movement,
  Plan,
  PlanDay,
  PlannedExercise,
  UserProfile,
  WorkoutSession,
} from '../../data/types';
import { scoreExercise } from './scoring';
import { determineSplit, type SplitDef } from './splits';
import { filterEligibleExercises } from './validator';

export interface PlanGenerationOptions {
  planId?: string;
  createdAt?: number;
  feedback?: ExerciseFeedback[];
  existingPlan?: Plan;
}

function capitalize(str: string): string {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Determine rep scheme based on user goal and movement pattern.
 */
function getRepScheme(goal: UserProfile['goal'], movement: Movement): string {
  if (movement === 'core') {
    return '10–15 controlled';
  }
  if (movement === 'carry') {
    return '30–45s carry';
  }
  if (movement === 'mobility') {
    return '10–12 controlled';
  }

  const isCompound = ['squat', 'hinge', 'hpush', 'vpush', 'hpull', 'vpull'].includes(movement);

  switch (goal) {
    case 'strength':
      return isCompound ? '5–8' : '8–12';
    case 'endurance':
      return isCompound ? '12–15' : '15–20';
    case 'technique':
      return '8–10 controlled';
    case 'mobility':
      return '10–12 controlled';
    case 'fitness':
    default:
      return isCompound ? '8–10' : '10–12';
  }
}

/**
 * Determine rest duration in seconds based on session duration and movement type.
 * - 30 min: 60-90s rest
 * - 45 min: 90-120s rest
 * - 60 min: 120s rest
 */
function getRestSeconds(durationMin: 30 | 45 | 60, movement: Movement): number {
  const isCompound = ['squat', 'hinge', 'hpush', 'vpush', 'hpull', 'vpull'].includes(movement);
  if (durationMin === 30) {
    return isCompound ? 90 : 60;
  }
  if (durationMin === 45) {
    return isCompound ? 120 : 90;
  }
  return 120;
}

/**
 * Determine planned sets based on duration, experience, and movement type.
 * - 30 min: 2-3 sets each
 * - 45 min: 3 sets each
 * - 60 min: 3-4 sets each
 */
function getPlannedSets(
  durationMin: 30 | 45 | 60,
  experience: Experience,
  movement: Movement,
): number {
  if (durationMin === 30) {
    return experience === 'new' ? 2 : 3;
  }
  if (durationMin === 45) {
    return 3;
  }
  // 60 min
  const isCompound = ['squat', 'hinge', 'hpush', 'vpush', 'hpull', 'vpull'].includes(movement);
  return experience === 'experienced' || isCompound ? 4 : 3;
}

/**
 * Target exercise count per session based on profile duration.
 * - 30 min: 3-4 exercises (target 4)
 * - 45 min: 4-5 exercises (target 5)
 * - 60 min: 5-6 exercises (target 6)
 */
function getTargetExerciseCount(durationMin: 30 | 45 | 60): number {
  if (durationMin === 30) return 4;
  if (durationMin === 45) return 5;
  return 6;
}

/**
 * Generates an explainable reason for selecting an exercise.
 */
function getExerciseReason(
  candidate: Exercise,
  profile: UserProfile,
  isPinned: boolean,
): string {
  if (isPinned) {
    return 'Pinned by you.';
  }
  if (profile.liked?.includes(candidate.id)) {
    return 'Selected based on your positive preference.';
  }
  if (
    profile.goal === 'strength' &&
    ['squat', 'hinge', 'hpush', 'vpush', 'hpull', 'vpull'].includes(candidate.movement)
  ) {
    return 'Primary compound movement for strength development.';
  }
  if (profile.goal === 'endurance') {
    return 'High-repetition movement selected for muscular endurance.';
  }
  if (profile.goal === 'technique') {
    return 'Fundamental exercise selected for movement quality and technique.';
  }
  const primaryMuscles = candidate.primary.join(', ');
  return `${capitalize(candidate.movement)} movement targeting ${primaryMuscles}.`;
}

/**
 * Generate plain-English explanations for the generated plan (§7.2 step 5).
 */
function generateExplanations(
  profile: UserProfile,
  splitDef: SplitDef,
  targetCount: number,
  hasDiscomfortSubstitutions: boolean,
  pinnedCount: number,
): string[] {
  const explanations: string[] = [];

  // 1. Split explanation
  explanations.push(
    `${splitDef.name} selected based on your ${profile.daysPerWeek}-day schedule.`,
  );

  // 2. Equipment applied
  const equipList = profile.equipment?.[profile.activeLocation] ?? [];
  const equipStr = equipList.length > 0 ? equipList.join(', ') : 'bodyweight';
  explanations.push(
    `${capitalize(profile.activeLocation)} equipment applied (${equipStr}).`,
  );

  // 3. Duration sizing
  explanations.push(
    `${profile.durationMin}-minute sessions sized with ${targetCount} exercises with appropriate rest periods.`,
  );

  // 4. Discomfort notes / substitutions
  if (profile.discomfortNotes && profile.discomfortNotes.trim()) {
    const note = profile.discomfortNotes.toLowerCase();
    if (note.includes('shoulder')) {
      explanations.push(
        'Shoulder press substituted with neutral grip variation per discomfort notes.',
      );
    } else {
      explanations.push(
        `Adjusted exercise selection per discomfort notes: "${profile.discomfortNotes.trim()}".`,
      );
    }
  } else if (hasDiscomfortSubstitutions) {
    explanations.push(
      'Exercise variations adjusted per discomfort feedback.',
    );
  }

  // 5. Restrictions
  if (profile.restrictions && profile.restrictions.length > 0) {
    explanations.push(
      `Excluded ${profile.restrictions.length} restricted exercise(s) from your routine.`,
    );
  }

  // 6. Pinned exercises
  if (pinnedCount > 0) {
    explanations.push(
      `Preserved ${pinnedCount} pinned exercise(s) across your weekly split.`,
    );
  }

  return explanations;
}

/**
 * Generates an adaptive, deterministic workout plan (§7 of ATLAS_FIT_SPEC).
 *
 * Pipeline:
 * 1. Choose split based on days & experience
 * 2. Apply hard filters to catalog for profile.activeLocation
 * 3. For each day, match movement patterns and select top scored exercises
 * 4. Size session based on profile.durationMin (exercises, sets, rest)
 * 5. Generate plain-English explanation array
 * 6. Preserve pinned exercises if regenerating
 */
export function generatePlan(
  profile: UserProfile,
  catalog: Exercise[],
  history: WorkoutSession[] = [],
  options?: PlanGenerationOptions,
): Plan {
  // 1. Choose split based on days & experience
  const splitDef = determineSplit(profile.daysPerWeek, profile.experience);

  // 2. Apply hard filters for profile.activeLocation
  const eligible = filterEligibleExercises(
    catalog,
    profile,
    profile.activeLocation,
    options?.feedback,
  );

  const eligibleMap = new Map(eligible.map((e) => [e.id, e]));
  const targetExerciseCount = getTargetExerciseCount(profile.durationMin);

  let totalPinnedPreserved = 0;
  const existingPlan = options?.existingPlan;

  // 3 & 4. Build days with movement patterns and exercise sizing
  const days: PlanDay[] = splitDef.days.map((splitDay, dayIndex) => {
    const pickedExercises: PlannedExercise[] = [];
    const pickedIds = new Set<string>();

    // 6. Preserve pinned exercises if regenerating or already pinned in existingPlan
    if (existingPlan?.days) {
      const existingDay = existingPlan.days[dayIndex];
      if (existingDay?.exercises) {
        for (const existingItem of existingDay.exercises) {
          if (
            profile.pinned?.includes(existingItem.exerciseId) &&
            eligibleMap.has(existingItem.exerciseId) &&
            !pickedIds.has(existingItem.exerciseId)
          ) {
            const ex = eligibleMap.get(existingItem.exerciseId)!;
            pickedExercises.push({
              exerciseId: ex.id,
              sets: existingItem.sets || getPlannedSets(profile.durationMin, profile.experience, ex.movement),
              reps: existingItem.reps || getRepScheme(profile.goal, ex.movement),
              restSec: existingItem.restSec || getRestSeconds(profile.durationMin, ex.movement),
              reason: 'Pinned by you.',
            });
            pickedIds.add(ex.id);
            totalPinnedPreserved += 1;
          }
        }
      }
    }

    // Match movement patterns from splitDay.movementTargets
    const targets = splitDay.movementTargets;

    for (let i = 0; i < targets.length && pickedExercises.length < targetExerciseCount; i += 1) {
      const targetPattern = targets[i];

      // Check if user has an unpicked pinned exercise matching this pattern
      const pinnedCandidate = eligible.find(
        (ex) =>
          profile.pinned?.includes(ex.id) &&
          ex.movement === targetPattern &&
          !pickedIds.has(ex.id),
      );

      let selectedExercise: Exercise | null = pinnedCandidate ?? null;

      if (!selectedExercise) {
        // Find all eligible exercises for this movement pattern
        const patternCandidates = eligible
          .filter((ex) => ex.movement === targetPattern && !pickedIds.has(ex.id))
          .map((candidate) => ({
            candidate,
            score: scoreExercise(candidate, profile, history, targets),
          }))
          .sort((a, b) => b.score - a.score || a.candidate.id.localeCompare(b.candidate.id));

        if (patternCandidates.length > 0) {
          selectedExercise = patternCandidates[0].candidate;
        }
      }

      if (selectedExercise) {
        const isPinned = profile.pinned?.includes(selectedExercise.id) ?? false;
        if (isPinned && !pinnedCandidate) {
          totalPinnedPreserved += 1;
        }

        pickedExercises.push({
          exerciseId: selectedExercise.id,
          sets: getPlannedSets(profile.durationMin, profile.experience, selectedExercise.movement),
          reps: getRepScheme(profile.goal, selectedExercise.movement),
          restSec: getRestSeconds(profile.durationMin, selectedExercise.movement),
          reason: getExerciseReason(selectedExercise, profile, isPinned),
        });
        pickedIds.add(selectedExercise.id);
      }
    }

    // Fallback: if we haven't reached target count, fill from remaining eligible exercises
    if (pickedExercises.length < targetExerciseCount) {
      const remainingCandidates = eligible
        .filter((ex) => !pickedIds.has(ex.id))
        .map((candidate) => ({
          candidate,
          score: scoreExercise(candidate, profile, history, targets),
        }))
        .sort((a, b) => b.score - a.score || a.candidate.id.localeCompare(b.candidate.id));

      for (const item of remainingCandidates) {
        if (pickedExercises.length >= targetExerciseCount) break;
        const ex = item.candidate;
        const isPinned = profile.pinned?.includes(ex.id) ?? false;
        pickedExercises.push({
          exerciseId: ex.id,
          sets: getPlannedSets(profile.durationMin, profile.experience, ex.movement),
          reps: getRepScheme(profile.goal, ex.movement),
          restSec: getRestSeconds(profile.durationMin, ex.movement),
          reason: getExerciseReason(ex, profile, isPinned),
        });
        pickedIds.add(ex.id);
      }
    }

    return {
      id: splitDay.id,
      label: splitDay.label,
      focus: splitDay.focus,
      movementTargets: splitDay.movementTargets,
      exercises: pickedExercises,
    };
  });

  // 5. Generate plain-English explanation array
  const hasDiscomfort = Boolean(
    profile.discomfortNotes?.trim() ||
      options?.feedback?.some((f) => f.discomfort),
  );

  const explanation = generateExplanations(
    profile,
    splitDef,
    targetExerciseCount,
    hasDiscomfort,
    totalPinnedPreserved,
  );

  const planId =
    options?.planId ??
    `plan-${profile.activeLocation}-${profile.daysPerWeek}d-${profile.durationMin}m`;

  const createdAt = options?.createdAt ?? 1700000000000;

  return {
    id: planId,
    createdAt,
    location: profile.activeLocation,
    split: splitDef.name,
    goal: profile.goal,
    experience: profile.experience,
    days,
    explanation,
  };
}

/**
 * Swaps an exercise within an existing plan for an alternative exercise (§7.3).
 */
export function swapExerciseInPlan(
  plan: Plan,
  dayId: string,
  oldExerciseId: string,
  newExerciseId: string,
  catalog: Exercise[],
): Plan {
  const dayIndex = plan.days.findIndex((d) => d.id === dayId);
  if (dayIndex === -1) {
    throw new Error(`Day "${dayId}" not found in plan.`);
  }

  const day = plan.days[dayIndex];
  const exerciseIndex = day.exercises.findIndex((e) => e.exerciseId === oldExerciseId);
  if (exerciseIndex === -1) {
    throw new Error(`Exercise "${oldExerciseId}" not found in day "${dayId}".`);
  }

  const catalogMap = new Map(catalog.map((e) => [e.id, e]));
  const oldEx = catalogMap.get(oldExerciseId);
  const newEx = catalogMap.get(newExerciseId);

  const existingPlanned = day.exercises[exerciseIndex];
  const updatedPlanned: PlannedExercise = {
    ...existingPlanned,
    exerciseId: newExerciseId,
    reason: `Swapped substitute for ${oldEx?.name ?? oldExerciseId}.`,
    sets: existingPlanned.sets,
    reps: newEx ? getRepScheme(plan.goal, newEx.movement) : existingPlanned.reps,
    restSec: newEx
      ? getRestSeconds(day.exercises.length <= 4 ? 30 : day.exercises.length === 5 ? 45 : 60, newEx.movement)
      : existingPlanned.restSec,
  };

  const updatedExercises = [...day.exercises];
  updatedExercises[exerciseIndex] = updatedPlanned;

  const updatedDay: PlanDay = {
    ...day,
    exercises: updatedExercises,
  };

  const updatedDays = [...plan.days];
  updatedDays[dayIndex] = updatedDay;

  const oldName = oldEx?.name ?? oldExerciseId;
  const newName = newEx?.name ?? newExerciseId;
  const swapExplanation = `Swapped ${oldName} for ${newName} in ${day.label}.`;

  return {
    ...plan,
    days: updatedDays,
    explanation: [...plan.explanation, swapExplanation],
  };
}
