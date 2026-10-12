import type {
  Exercise,
  ExerciseFeedback,
  Experience,
  Movement,
  MuscleId,
  Plan,
  PlanDay,
  PlannedExercise,
  UserProfile,
  WorkoutSession,
} from '../../data/types';
import { equipmentLabel } from '../../data/equipment';
import { MUSCLE_BY_ID } from '../../data/muscles';
import { MOVEMENT_LABELS } from '../../data/movements';
import { determineSplit, type SplitDef } from './splits';
import { filterEligibleExercises } from './validator';
import {
  adjustedScore,
  commitToWeek,
  createWeekState,
  volumeClass,
  weekVolume,
} from './weekSelection';

export interface PlanGenerationOptions {
  planId?: string;
  createdAt?: number;
  feedback?: ExerciseFeedback[];
  existingPlan?: Plan;
}

const COMPOUND_MOVEMENTS: ReadonlySet<Movement> = new Set<Movement>([
  'squat',
  'hinge',
  'hpush',
  'vpush',
  'hpull',
  'vpull',
]);

function capitalize(str: string): string {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Session-shape rules for each duration (§7.2 step 4). Also the hard bounds
 *  every generated session must stay inside, so the plan screen, the workout
 *  screen and the tests can all rely on them. */
export interface SessionBounds {
  minExercises: number;
  maxExercises: number;
  minSets: number;
  maxSets: number;
  minRest: number;
  maxRest: number;
}

export function getSessionBounds(durationMin: 30 | 45 | 60): SessionBounds {
  if (durationMin === 30) {
    return {
      minExercises: 3,
      maxExercises: 4,
      minSets: 2,
      maxSets: 3,
      minRest: 60,
      maxRest: 90,
    };
  }
  if (durationMin === 45) {
    return {
      minExercises: 4,
      maxExercises: 5,
      minSets: 3,
      maxSets: 3,
      minRest: 90,
      maxRest: 120,
    };
  }
  return {
    minExercises: 5,
    maxExercises: 6,
    minSets: 3,
    maxSets: 4,
    minRest: 120,
    maxRest: 120,
  };
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

  const isCompound = COMPOUND_MOVEMENTS.has(movement);

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

/** Static holds use seconds; a plank or wall sit should not prescribe reps. */
function getExerciseRepScheme(goal: UserProfile['goal'], exercise: Exercise): string {
  const names = [exercise.name, ...exercise.aliases].join(' ').toLowerCase();
  const isHold = /\b(hold|wall sit|wall-sit|isometric)\b/.test(names) ||
    (/\bplank\b/.test(names) && !/\b(row|jack|reach|tap|walk|rotation|up.down)\b/.test(names));
  if (isHold) return goal === 'endurance' ? '30–45s hold' : '20–30s hold';
  return getRepScheme(goal, exercise.movement);
}

/**
 * Determine rest duration in seconds based on session duration and movement type.
 * - 30 min: 60-90s rest
 * - 45 min: 90-120s rest
 * - 60 min: 120s rest
 */
function getRestSeconds(durationMin: 30 | 45 | 60, movement: Movement): number {
  const isCompound = COMPOUND_MOVEMENTS.has(movement);
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
  return experience === 'experienced' || COMPOUND_MOVEMENTS.has(movement) ? 4 : 3;
}

/** Seconds of actual work assumed per set, by movement pattern. */
const SET_WORK_SEC: Record<Movement, number> = {
  squat: 50,
  hinge: 50,
  hpush: 50,
  vpush: 50,
  hpull: 50,
  vpull: 50,
  core: 45,
  accessory: 45,
  carry: 40,
  mobility: 40,
};

/** Setup / transition time budgeted once per exercise. */
const SESSION_SETUP_SEC = 45;

/** Target fraction of the time budget a session should actually use. */
const UNDERFILL_TARGET = 0.78;
/** Slack allowed before a session is considered over its time budget. */
const OVERFILL_TOLERANCE = 1.05;

/**
 * Estimates how long a planned session takes, including work, rest between
 * sets and setup. Used to size sessions against the user's durationMin.
 */
export function estimateSessionMinutes(
  exercises: PlannedExercise[],
  catalogById: ReadonlyMap<string, Exercise>,
): number {
  let seconds = 0;
  for (const item of exercises) {
    const movement = catalogById.get(item.exerciseId)?.movement ?? 'accessory';
    const work = item.sets * (SET_WORK_SEC[movement] ?? 45);
    const rest = Math.max(0, item.sets - 1) * item.restSec;
    seconds += work + rest + SESSION_SETUP_SEC;
  }
  return seconds / 60;
}

/** Ordering rank inside a session: main lifts first, then assistance,
 *  then core, then mobility as a cool-down. Stable within a rank so the
 *  split's target order is preserved. */
const SESSION_RANK: Record<Movement, number> = {
  squat: 0,
  hinge: 0,
  hpush: 0,
  vpush: 0,
  hpull: 0,
  vpull: 0,
  accessory: 1,
  carry: 1,
  core: 2,
  mobility: 3,
};

/** Orders a day's exercises into a sensible training order. */
export function orderExercisesForSession(
  exercises: PlannedExercise[],
  catalogById: ReadonlyMap<string, Exercise>,
): PlannedExercise[] {
  return exercises
    .map((item, index) => {
      const movement = catalogById.get(item.exerciseId)?.movement ?? 'accessory';
      return { item, index, rank: SESSION_RANK[movement] ?? 1 };
    })
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map((entry) => entry.item);
}

/**
 * Clamps sets/rest into the session bounds and nudges volume so the session
 * uses its time budget: drops the weakest (last-ranked) exercises if it runs
 * long, adds a set if it would come in far too short.
 */
function fitToDuration(
  exercises: PlannedExercise[],
  bounds: SessionBounds,
  catalogById: ReadonlyMap<string, Exercise>,
  durationMin: number,
  protectedIds: ReadonlySet<string> = new Set(),
): PlannedExercise[] {
  if (exercises.length === 0) return exercises;

  // Pinned lifts are the user's: keep their prescription, never drop them.
  const shapeable = (item: PlannedExercise) => !protectedIds.has(item.exerciseId);

  let fitted = exercises.map((item) =>
    shapeable(item)
      ? {
          ...item,
          sets: clamp(item.sets, bounds.minSets, bounds.maxSets),
          restSec: clamp(item.restSec, bounds.minRest, bounds.maxRest),
        }
      : item,
  );

  const overBudget = (minutes: number) => minutes > durationMin * OVERFILL_TOLERANCE;
  const underBudget = (minutes: number) => minutes < durationMin * UNDERFILL_TARGET;

  // Trim from the end (assistance work) if the session runs long.
  while (
    fitted.length > bounds.minExercises &&
    overBudget(estimateSessionMinutes(fitted, catalogById)) &&
    fitted.some(shapeable)
  ) {
    const index = [...fitted].map(shapeable).lastIndexOf(true);
    fitted = fitted.filter((_, i) => i !== index);
  }

  // Add a set if the session would come in far short of the booked time.
  if (underBudget(estimateSessionMinutes(fitted, catalogById))) {
    const raised = fitted.map((item) =>
      shapeable(item) && item.sets < bounds.maxSets ? { ...item, sets: item.sets + 1 } : item,
    );
    if (
      raised.some((item, index) => item.sets !== fitted[index].sets) &&
      !overBudget(estimateSessionMinutes(raised, catalogById))
    ) {
      fitted = raised;
    }
  }

  return fitted;
}

/** Reads primary muscles as short user-facing names, e.g. "chest and triceps".
 *  Returns an empty string when the exercise carries no muscle tags. */
function muscleList(candidate: Exercise): string {
  const names = candidate.primary.map((id) => MUSCLE_BY_ID[id]?.short ?? id);
  if (names.length === 0) return '';
  return humanList(names);
}

/** " — trains chest and triceps", or "" when there is nothing to name. */
function trainClause(candidate: Exercise): string {
  const muscles = muscleList(candidate);
  return muscles ? ` — trains ${muscles}` : '';
}

/**
 * Generates an explainable reason for selecting an exercise.
 */
function getExerciseReason(
  candidate: Exercise,
  profile: UserProfile,
  options: {
    isPinned: boolean;
    dayFocus: string;
    isFill: boolean;
    substitutedFor?: Movement;
  },
): string {
  if (options.isPinned) {
    return 'Pinned by you.';
  }
  if (profile.liked?.includes(candidate.id)) {
    return 'One of your favourite exercises.';
  }

  const label = MOVEMENT_LABELS[candidate.movement] ?? capitalize(candidate.movement);
  const trains = trainClause(candidate);

  if (options.substitutedFor) {
    const wanted = MOVEMENT_LABELS[options.substitutedFor] ?? capitalize(options.substitutedFor);
    return `Fresh ${label.toLowerCase()} in place of repeating this week's ${wanted.toLowerCase()}${trains}.`;
  }
  const requested = candidate.primary.filter((muscle) => profile.targetMuscles?.includes(muscle));
  if (requested.length) {
    return `Chosen for your ${humanList(requested.map((id) => MUSCLE_BY_ID[id]?.short ?? id))} focus${trains}.`;
  }
  if (profile.goal === 'strength' && COMPOUND_MOVEMENTS.has(candidate.movement)) {
    return `Main strength lift${trains}.`;
  }
  if (profile.goal === 'endurance') {
    return `Endurance work${trains}.`;
  }
  if (profile.goal === 'technique') {
    return `Technique drill${trains}.`;
  }
  if (options.isFill) {
    return `Extra ${label.toLowerCase()} work${trains}.`;
  }
  return `${label} work for this ${options.dayFocus.toLowerCase()} session${trains}.`;
}

/** Joins a list the way a person would read it: "a, b and c". */
function humanList(values: string[]): string {
  if (values.length === 0) return '';
  if (values.length === 1) return values[0];
  return `${values.slice(0, -1).join(', ')} and ${values[values.length - 1]}`;
}

/**
 * Generate plain-English explanations for the generated plan (§7.2 step 5).
 */
function generateExplanations(
  profile: UserProfile,
  splitDef: SplitDef,
  bounds: SessionBounds,
  hasDiscomfortSubstitutions: boolean,
  pinnedCount: number,
  stats: {
    estimatedMinutes: number;
    pushSets: number;
    pullSets: number;
    legSets: number;
    topMuscles: string[];
    rotatedCount: number;
  },
): string[] {
  const explanations: string[] = [];

  // 1. Split explanation
  explanations.push(
    `${splitDef.name} selected based on your ${profile.daysPerWeek}-day schedule.`,
  );

  // 2. Equipment applied (readable names, not internal ids)
  const equipList = profile.equipment?.[profile.activeLocation] ?? [];
  const equipStr =
    equipList.length > 0 ? equipList.map((id) => equipmentLabel(id)).join(', ') : 'Bodyweight';
  explanations.push(
    `${capitalize(profile.activeLocation)} equipment applied (${equipStr}).`,
  );

  // 3. Duration sizing, with the time estimate that produced it
  const setsText =
    bounds.minSets === bounds.maxSets
      ? `${bounds.minSets} sets`
      : `${bounds.minSets}–${bounds.maxSets} sets`;
  const countText =
    bounds.minExercises === bounds.maxExercises
      ? `${bounds.minExercises} exercises`
      : `${bounds.minExercises}–${bounds.maxExercises} exercises`;
  explanations.push(
    `${profile.durationMin}-minute sessions sized with ${countText}, ${setsText} and ` +
      `${bounds.minRest}–${bounds.maxRest}s rest — about ${Math.round(stats.estimatedMinutes)} minutes of work including rest.`,
  );

  // 4. Discomfort notes / substitutions
  if (profile.discomfortNotes && profile.discomfortNotes.trim()) {
    const note = profile.discomfortNotes.toLowerCase();
    if (note.includes('shoulder')) {
      explanations.push(
        'Shoulder press substituted or omitted where it matches your discomfort notes. This is exercise filtering, not medical advice.',
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

  // 7. Variety: exercises rotate instead of repeating on every day
  if (profile.daysPerWeek > 1 && stats.rotatedCount > 0) {
    explanations.push(
      `Exercises rotate across the week — ${stats.rotatedCount} slot(s) were filled with a fresh movement instead of repeating one you already do.`,
    );
  }

  // 8. Weekly push / pull / legs balance
  if (profile.goal === 'mobility') {
    explanations.push('Mobility sessions prioritise controlled range-of-motion work rather than a strength-training split.');
  } else if (profile.daysPerWeek > 1) {
    explanations.push(
      `Weekly balance: ${stats.pushSets} push sets, ${stats.pullSets} pull sets and ${stats.legSets} lower-body sets.`,
    );
  }

  // 9. Weekly coverage
  if (stats.topMuscles.length > 0) {
    explanations.push(
      `Highest working-set totals this week: ${humanList(stats.topMuscles)}.`,
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
 * 3. Select exercises week-first: no exercise repeats across days while fresh
 *    alternatives exist, and push/pull/muscle volume stays balanced
 * 4. Size the session against profile.durationMin (exercises, sets, rest)
 * 5. Order the day main-lift-first and fit it to the time budget
 * 6. Generate plain-English explanation array
 * 7. Preserve pinned exercises if regenerating
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
  ).sort((a, b) => a.id.localeCompare(b.id));

  const eligibleMap = new Map(eligible.map((e) => [e.id, e]));
  const catalogById = new Map(catalog.map((e) => [e.id, e]));

  const bounds = getSessionBounds(profile.durationMin);
  const targetExerciseCount = bounds.maxExercises;

  const pinnedIds = new Set(profile.pinned ?? []);
  const dislikedIds = new Set(profile.disliked ?? []);
  // Disliked exercises are hard-excluded unless the user pinned them (or the
  // whole pool is disliked, in which case we still owe them a full session).
  const preferredPool = eligible.filter(
    (ex) => pinnedIds.has(ex.id) || !dislikedIds.has(ex.id),
  );
  const pool = preferredPool.length > 0 ? preferredPool : eligible;

  // Week-level context: rotation, push/pull balance and muscle volume.
  const week = createWeekState(history);
  let scoringWeek = week;
  let rotatedSlots = 0;
  // Base scoring only needs the newest session. Resolve it once instead of
  // sorting the entire log for every candidate/slot; the week state retains
  // the wider completed-session rotation window.
  const newestSession = history.reduce<WorkoutSession | undefined>((latest, session) =>
    !latest || (session.startedAt || 0) > (latest.startedAt || 0) ? session : latest,
  undefined);
  const scoringHistory = newestSession ? [newestSession] : [];

  const existingPlan = options?.existingPlan;

  const plannedSetsFor = (movement: Movement): number =>
    getPlannedSets(profile.durationMin, profile.experience, movement);

  const rankCandidates = (candidates: Exercise[], dayTargets: Movement[]) =>
    candidates
      .map((candidate) => ({
        candidate,
        score: adjustedScore(
          candidate,
          profile,
          scoringHistory,
          dayTargets,
          scoringWeek,
          plannedSetsFor(candidate.movement),
        ),
      }))
      .sort((a, b) => b.score - a.score || a.candidate.id.localeCompare(b.candidate.id));

  /** Best candidate for a movement pattern.
   *
   *  1. Prefer an exercise that is not already used this week, so the week
   *     does not repeat itself.
   *  2. If every candidate for the pattern is already used, substitute a fresh
   *     exercise from the same push/pull/legs class — a second row beats a
   *     second copy of the only pull-up variation you own.
   *  3. Only repeat when even that class is exhausted. */
  const bestForMovement = (
    movement: Movement,
    dayTargets: Movement[],
    pickedIds: ReadonlySet<string>,
  ): { exercise: Exercise; rotated: boolean; substitutedFor?: Movement } | null => {
    const matches = pool.filter((ex) => ex.movement === movement && !pickedIds.has(ex.id));
    const candidates =
      matches.length > 0
        ? matches
        : eligible.filter((ex) => ex.movement === movement && !pickedIds.has(ex.id));

    if (candidates.length > 0) {
      const ranked = rankCandidates(candidates, dayTargets);
      const top = ranked[0];
      const fresh = ranked.find((entry) => !week.usedIds.has(entry.candidate.id));
      if (fresh) {
        if (week.usedIds.has(top.candidate.id)) {
          return { exercise: fresh.candidate, rotated: true };
        }
        return { exercise: top.candidate, rotated: false };
      }
      // Every candidate for this pattern is already on this week's plan.
    }

    const cls = volumeClass(movement);
    if (cls) {
      const substitutes = pool.filter(
        (ex) =>
          !pickedIds.has(ex.id) &&
          !week.usedIds.has(ex.id) &&
          volumeClass(ex.movement) === cls,
      );
      if (substitutes.length > 0) {
        const ranked = rankCandidates(substitutes, dayTargets);
        return { exercise: ranked[0].candidate, rotated: true, substitutedFor: movement };
      }
    }

    if (candidates.length > 0) {
      const ranked = rankCandidates(candidates, dayTargets);
      return { exercise: ranked[0].candidate, rotated: false };
    }
    return null;
  };

  // 3 & 4. Build days with movement patterns and exercise sizing
  const days: PlanDay[] = splitDef.days.map((splitDay, dayIndex) => {
    // Include provisional picks in balance scoring without committing them
    // to the week until the session survives duration fitting.
    scoringWeek = {
      ...week,
      usedIds: new Set(week.usedIds),
      classSets: { ...week.classSets },
      muscleSets: { ...week.muscleSets },
    };
    const pickedIds = new Set<string>();
    const pickedExercises: PlannedExercise[] = [];
    const targets: Movement[] = profile.goal === 'mobility'
      ? Array.from({ length: targetExerciseCount }, () => 'mobility' as const)
      : splitDay.movementTargets;

    const place = (
      ex: Exercise,
      isPinned: boolean,
      isFill: boolean,
      options?: {
        substitutedFor?: Movement;
        prescription?: Pick<PlannedExercise, 'sets' | 'reps' | 'restSec'>;
      },
    ): boolean => {
      if (pickedIds.has(ex.id) || pickedExercises.length >= targetExerciseCount) {
        return false;
      }
      pickedExercises.push({
        exerciseId: ex.id,
        sets: options?.prescription?.sets || plannedSetsFor(ex.movement),
        reps: options?.prescription?.reps || getExerciseRepScheme(profile.goal, ex),
        restSec:
          options?.prescription?.restSec || getRestSeconds(profile.durationMin, ex.movement),
        reason: getExerciseReason(ex, profile, {
          isPinned,
          dayFocus: splitDay.focus,
          isFill,
          substitutedFor: options?.substitutedFor,
        }),
      });
      pickedIds.add(ex.id);
      commitToWeek(scoringWeek, [pickedExercises[pickedExercises.length - 1]], catalogById);
      return true;
    };

    // 6. Preserve pinned exercises if regenerating or already pinned in existingPlan
    if (existingPlan?.days) {
      const existingDay = existingPlan.days[dayIndex];
      if (existingDay?.exercises) {
        for (const existingItem of existingDay.exercises) {
          if (!pinnedIds.has(existingItem.exerciseId)) continue;
          const ex = eligibleMap.get(existingItem.exerciseId);
          if (!ex || pickedIds.has(ex.id)) continue;
          if (week.usedIds.has(ex.id)) continue; // already placed on another day
          place(ex, true, false, { prescription: existingItem });
        }
      }
    }

    // Match movement patterns from splitDay.movementTargets
    for (const targetPattern of targets) {
      if (pickedExercises.length >= targetExerciseCount) break;

      // A pinned exercise that fits this pattern and has not been used yet wins.
      const pinnedCandidate = eligible.find(
        (ex) =>
          pinnedIds.has(ex.id) &&
          ex.movement === targetPattern &&
          !pickedIds.has(ex.id) &&
          !week.usedIds.has(ex.id),
      );

      const best = pinnedCandidate
        ? { exercise: pinnedCandidate, rotated: false }
        : bestForMovement(targetPattern, targets, pickedIds);

      if (best) {
        if (best.rotated) rotatedSlots += 1;
        place(
          best.exercise,
          pinnedIds.has(best.exercise.id),
          false,
          { substitutedFor: best.substitutedFor },
        );
      }
    }

    // Pinned exercises whose movement is not a target of this day still get a
    // slot while there is room — a pin should never silently disappear.
    if (pickedExercises.length < targetExerciseCount) {
      for (const pinnedId of pinnedIds) {
        if (pickedExercises.length >= targetExerciseCount) break;
        if (pickedIds.has(pinnedId) || week.usedIds.has(pinnedId)) continue;
        const ex = eligibleMap.get(pinnedId);
        if (!ex) continue;
        place(ex, true, false);
      }
    }

    // Fallback fill: best remaining candidates, fresh-this-week first.
    if (pickedExercises.length < targetExerciseCount) {
      const fillPool = pool.filter((ex) => !pickedIds.has(ex.id));
      const ranked = rankCandidates(fillPool, targets);
      const fresh = ranked.filter((entry) => !week.usedIds.has(entry.candidate.id));
      const reused = ranked.filter((entry) => week.usedIds.has(entry.candidate.id));
      for (const entry of [...fresh, ...reused]) {
        if (pickedExercises.length >= targetExerciseCount) break;
        place(entry.candidate, pinnedIds.has(entry.candidate.id), true);
      }
    }

    // Last resort: if dislikes shrank the pool below the minimum session
    // size, allow otherwise-disliked exercises so the session still fits.
    if (pickedExercises.length < bounds.minExercises) {
      const remaining = eligible
        .filter((ex) => !pickedIds.has(ex.id))
        .sort((a, b) => a.id.localeCompare(b.id));
      for (const ex of remaining) {
        if (pickedExercises.length >= bounds.minExercises) break;
        place(ex, pinnedIds.has(ex.id), true);
      }
    }

    // 5. Order main lifts first, then fit the session to the time budget.
    const ordered = orderExercisesForSession(pickedExercises, catalogById);
    const fitted = fitToDuration(ordered, bounds, catalogById, profile.durationMin, pinnedIds);

    // Commit only what survived fitting, so the week context stays accurate.
    commitToWeek(week, fitted, catalogById);

    return {
      id: splitDay.id,
      label: splitDay.label,
      focus: profile.goal === 'mobility' ? `${splitDay.focus} mobility` : splitDay.focus,
      movementTargets: targets,
      exercises: fitted,
    };
  });
  scoringWeek = week;

  // A scoring bonus alone cannot cover abs/calves when their slot falls
  // beyond a short session's exercise cap. Repair uncovered focus muscles
  // using assistance slots, without removing pins or the only exercise
  // covering another requested muscle. Boundaries always outrank focus.
  const focusMuscles = [...new Set(profile.targetMuscles ?? [])];
  const primaryCounts = (): Map<MuscleId, number> => {
    const counts = new Map<MuscleId, number>();
    for (const day of days) for (const item of day.exercises) {
      for (const muscle of catalogById.get(item.exerciseId)?.primary ?? []) {
        counts.set(muscle, (counts.get(muscle) ?? 0) + 1);
      }
    }
    return counts;
  };
  for (const muscle of focusMuscles) {
    const counts = primaryCounts();
    if (counts.has(muscle)) continue;
    const usedIds = new Set(days.flatMap((day) => day.exercises.map((item) => item.exerciseId)));
    const candidates = rankCandidates(pool.filter((ex) => ex.primary.includes(muscle)), []);
    const replacements: Array<{ dayIndex: number; itemIndex: number; candidate: Exercise; cost: number }> = [];
    for (const { candidate } of candidates) {
      for (const [dayIndex, day] of days.entries()) {
        if (day.exercises.some((item) => item.exerciseId === candidate.id)) continue;
        for (const [itemIndex, item] of day.exercises.entries()) {
          if (pinnedIds.has(item.exerciseId)) continue;
          const old = catalogById.get(item.exerciseId);
          if (!old) continue;
          if (focusMuscles.some((focus) => old.primary.includes(focus) && counts.get(focus) === 1 && !candidate.primary.includes(focus))) continue;
          // Keep at least one exercise of each main movement class in a
          // session. A focus preference should not erase all pulling/legs.
          const oldClass = volumeClass(old.movement);
          if (oldClass && volumeClass(candidate.movement) !== oldClass &&
            !day.exercises.some((other) => other !== item && volumeClass(catalogById.get(other.exerciseId)?.movement ?? 'accessory') === oldClass)) continue;
          const fitsDay = day.movementTargets.includes(candidate.movement) ||
            day.exercises.some((other) => catalogById.get(other.exerciseId)?.primary.some((id) => candidate.primary.includes(id)));
          const cost = (COMPOUND_MOVEMENTS.has(old.movement) ? 100 : 0) +
            (fitsDay ? 0 : 50) + (usedIds.has(candidate.id) ? 20 : 0);
          replacements.push({ dayIndex, itemIndex, candidate, cost });
        }
      }
    }
    const replacement = replacements.sort((a, b) => a.cost - b.cost)[0];
    if (!replacement) continue;
    const { dayIndex, itemIndex, candidate } = replacement;
    const day = days[dayIndex];
    const revised = [...day.exercises];
    revised[itemIndex] = {
      exerciseId: candidate.id,
      sets: plannedSetsFor(candidate.movement),
      reps: getExerciseRepScheme(profile.goal, candidate),
      restSec: getRestSeconds(profile.durationMin, candidate.movement),
      reason: `Included for your ${MUSCLE_BY_ID[muscle]?.short ?? muscle} focus${trainClause(candidate)}.`,
    };
    const ordered = orderExercisesForSession(revised, catalogById);
    const fitted = fitToDuration(ordered, bounds, catalogById, profile.durationMin, pinnedIds);
    if (fitted.some((item) => item.exerciseId === candidate.id)) day.exercises = fitted;
  }

  // 5. Generate plain-English explanation array
  const hasDiscomfort = Boolean(
    profile.discomfortNotes?.trim() ||
      options?.feedback?.some((f) => f.discomfort),
  );

  const finalWeek = createWeekState(history);
  for (const day of days) commitToWeek(finalWeek, day.exercises, catalogById);
  const volume = weekVolume(finalWeek);
  const plannedIds = new Set(days.flatMap((day) => day.exercises.map((e) => e.exerciseId)));
  const pinnedCount = (profile.pinned ?? []).filter((id) => plannedIds.has(id)).length;
  const estimatedMinutes = days.reduce(
    (worst, day) => Math.max(worst, estimateSessionMinutes(day.exercises, catalogById)),
    0,
  );
  const topMuscles = volume.muscles
    .filter((entry) => entry.sets > 0)
    .slice(0, 5)
    .map((entry) => MUSCLE_BY_ID[entry.muscle]?.short ?? entry.muscle);

  const explanation = generateExplanations(profile, splitDef, bounds, hasDiscomfort, pinnedCount, {
    estimatedMinutes,
    pushSets: volume.push,
    pullSets: volume.pull,
    legSets: volume.legs,
    topMuscles,
    rotatedCount: rotatedSlots,
  });
  if (profile.avoidEquipment?.length) {
    explanation.push(`Equipment excluded: ${humanList(profile.avoidEquipment.map(equipmentLabel))}. This also applies to pinned exercises.`);
  }
  if (focusMuscles.length) {
    const covered = focusMuscles.filter((muscle) => primaryCounts().has(muscle));
    const missing = focusMuscles.filter((muscle) => !covered.includes(muscle));
    if (covered.length) explanation.push(`Your muscle focus: ${humanList(covered.map((id) => MUSCLE_BY_ID[id]?.short ?? id))}. Other muscle groups remain in the plan.`);
    if (missing.length) explanation.push(`Could not fit ${humanList(missing.map((id) => MUSCLE_BY_ID[id]?.short ?? id))} focus within your equipment, boundaries and session size. Adjust those preferences to add more options.`);
  }
  if (days.some((day) => day.exercises.length < bounds.minExercises)) {
    explanation.push('Some sessions have fewer exercises because your available equipment and boundaries limit the options. Avoided equipment and restricted exercises were not reintroduced.');
  }

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
    reps: newEx ? getExerciseRepScheme(plan.goal, newEx) : existingPlanned.reps,
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
