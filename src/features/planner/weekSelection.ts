import type {
  Exercise,
  Movement,
  MuscleId,
  PlannedExercise,
  UserProfile,
  WorkoutSession,
} from '../../data/types';
import { scoreExercise } from './scoring';

/**
 * Week-level selection context (§7.2).
 *
 * `scoreExercise` scores a single candidate in isolation, which is why a
 * naive "pick the best score per slot" generator repeats the same squat on
 * Monday, Wednesday and Friday. This module keeps a running picture of the
 * whole training week — which exercises are already used, how many working
 * sets each muscle and movement class has, and how often each exercise
 * appeared in recent sessions — and folds that context into the score.
 *
 * Every adjustment here is a *penalty* for over-represented options, so a
 * candidate that fits the day still wins when nothing is imbalanced yet.
 */

/** Discourages re-using one exercise on multiple days of the same week.
 *  Sized to dominate the maximum preference bonus (+50 pinned, +20 liked,
 *  +20 goal, +15 difficulty, +10 equipment = 115), so rotation always wins
 *  while a fresh candidate exists. Repeats only happen once the pool is dry. */
export const WEEK_REPEAT_PENALTY = 140;

/** Extra penalty for each recent session the exercise appeared in (capped). */
export const RECENT_USE_PENALTY = 10;
export const RECENT_USE_MAX_PENALTY = 30;
/** How many past sessions still count as "recent" for rotation. */
export const RECENT_USE_WINDOW = 5;

/** No single muscle should own more than this share of weekly working sets. */
export const MUSCLE_SHARE_CAP = 0.34;
/** Penalty scaling: 1 point of share over the cap costs 2 penalty points. */
export const MUSCLE_SHARE_PENALTY_SCALE = 200;
export const MUSCLE_OVERAGE_MAX_PENALTY = 30;

/** Weekly push vs pull sets may drift apart by this many sets before the
 *  generator starts nudging candidates toward the under-worked side. */
export const CLASS_IMBALANCE_TOLERANCE = 4;
export const CLASS_IMBALANCE_PENALTY = 6;
export const CLASS_IMBALANCE_MAX_PENALTY = 30;

/** Push/pull/legs grouping used for weekly balance. */
export type VolumeClass = 'push' | 'pull' | 'legs';

const PARTNER_CLASS: Record<VolumeClass, VolumeClass | null> = {
  push: 'pull',
  pull: 'push',
  legs: null,
};

const LEG_MOVEMENTS: ReadonlySet<Movement> = new Set<Movement>(['squat', 'hinge']);

export function volumeClass(movement: Movement): VolumeClass | null {
  if (movement === 'hpush' || movement === 'vpush') return 'push';
  if (movement === 'hpull' || movement === 'vpull') return 'pull';
  if (LEG_MOVEMENTS.has(movement)) return 'legs';
  return null;
}

export interface WeekState {
  /** Exercise ids already placed somewhere in this week's plan. */
  usedIds: Set<string>;
  /** Working sets committed per push/pull/legs class. */
  classSets: Record<VolumeClass, number>;
  /** Working sets committed per primary muscle. */
  muscleSets: Partial<Record<MuscleId, number>>;
  /** Total working sets committed so far. */
  totalSets: number;
  /** Appearances per exercise across the last {@link RECENT_USE_WINDOW} sessions. */
  recentUse: Map<string, number>;
}

export interface WeekVolume {
  push: number;
  pull: number;
  legs: number;
  sets: number;
  /** Primary muscles sorted by working sets, highest first. */
  muscles: Array<{ muscle: MuscleId; sets: number }>;
}

function countRecentUse(history: WorkoutSession[]): Map<string, number> {
  const counts = new Map<string, number>();
  if (!history || history.length === 0) return counts;

  const recent = history.filter((session) => session.state === 'done')
    .sort((a, b) => (b.endedAt ?? b.startedAt ?? 0) - (a.endedAt ?? a.startedAt ?? 0) || a.id.localeCompare(b.id))
    .slice(0, RECENT_USE_WINDOW);

  for (const session of recent) {
    const performedIds = new Set((session.items ?? []).filter((item) => !item.skipped).map((item) => item.exerciseId));
    for (const id of performedIds) {
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }
  return counts;
}

/** Creates an empty week context, seeded with recency data from history. */
export function createWeekState(history: WorkoutSession[] = []): WeekState {
  return {
    usedIds: new Set<string>(),
    classSets: { push: 0, pull: 0, legs: 0 },
    muscleSets: {},
    totalSets: 0,
    recentUse: countRecentUse(history),
  };
}

/** Reads-only snapshot of the weekly volume committed so far. */
export function weekVolume(week: WeekState): WeekVolume {
  return {
    push: week.classSets.push,
    pull: week.classSets.pull,
    legs: week.classSets.legs,
    sets: week.totalSets,
    muscles: Object.entries(week.muscleSets)
      .map(([muscle, sets]) => ({ muscle: muscle as MuscleId, sets: sets ?? 0 }))
      .sort((a, b) => b.sets - a.sets || a.muscle.localeCompare(b.muscle)),
  };
}

/**
 * Weekly balance adjustment: penalises candidates that would push push/pull
 * further out of step, or push a single muscle past its share of the week.
 * Returns 0 while the week is still empty — there is nothing to balance yet.
 */
function balanceAdjustment(candidate: Exercise, week: WeekState, sets: number): number {
  if (week.totalSets === 0) return 0;

  let adjustment = 0;

  const cls = volumeClass(candidate.movement);
  const partner = cls ? PARTNER_CLASS[cls] : null;
  if (cls && partner) {
    const drift = week.classSets[cls] + sets - week.classSets[partner];
    if (drift > CLASS_IMBALANCE_TOLERANCE) {
      adjustment -= Math.min(
        CLASS_IMBALANCE_MAX_PENALTY,
        (drift - CLASS_IMBALANCE_TOLERANCE) * CLASS_IMBALANCE_PENALTY,
      );
    }
  }

  const projectedTotal = week.totalSets + sets;
  for (const muscle of candidate.primary) {
    const projectedShare = ((week.muscleSets[muscle] ?? 0) + sets) / projectedTotal;
    if (projectedShare > MUSCLE_SHARE_CAP) {
      adjustment -= Math.min(
        MUSCLE_OVERAGE_MAX_PENALTY,
        Math.ceil((projectedShare - MUSCLE_SHARE_CAP) * MUSCLE_SHARE_PENALTY_SCALE),
      );
    }
  }

  return adjustment;
}

/**
 * Scores a candidate with the week's context applied on top of the base
 * {@link scoreExercise} factors (target fit, goal, preferences, rotation,
 * experience, equipment friction).
 */
export function adjustedScore(
  candidate: Exercise,
  profile: UserProfile,
  history: WorkoutSession[],
  dayTargets: Movement[],
  week: WeekState,
  sets: number,
): number {
  let score = scoreExercise(candidate, profile, history, dayTargets);

  // Reviewed teaching entries are a more reliable default than a broad
  // imported taxonomy. Preferences can still promote other candidates.
  if (candidate.source === 'atlas') score += 15;
  // Ballistic drills are not default strength lifts merely because the
  // imported catalogue groups them with squats or presses.
  if (profile.goal === 'strength' && /\b(jumps?|jumping|burpees?|plyometric|plyo)\b/i.test([candidate.name, ...candidate.aliases].join(' '))) {
    score -= 40;
  }

  if (week.usedIds.has(candidate.id)) {
    score -= WEEK_REPEAT_PENALTY;
  }

  const recent = week.recentUse.get(candidate.id) ?? 0;
  if (recent > 0) {
    score -= Math.min(RECENT_USE_MAX_PENALTY, recent * RECENT_USE_PENALTY);
  }

  score += balanceAdjustment(candidate, week, sets);

  return score;
}

/** Commits a day's final (post-fit) exercises into the week context. */
export function commitToWeek(
  week: WeekState,
  exercises: PlannedExercise[],
  catalogById: ReadonlyMap<string, Exercise>,
): void {
  for (const item of exercises) {
    week.usedIds.add(item.exerciseId);
    week.totalSets += item.sets;

    const exercise = catalogById.get(item.exerciseId);
    if (!exercise) continue;

    const cls = volumeClass(exercise.movement);
    if (cls) week.classSets[cls] += item.sets;

    for (const muscle of exercise.primary) {
      week.muscleSets[muscle] = (week.muscleSets[muscle] ?? 0) + item.sets;
    }
  }
}
