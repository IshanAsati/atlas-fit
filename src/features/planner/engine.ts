import type {
  Exercise,
  Experience,
  Goal,
  Movement,
  MuscleId,
  Plan,
  PlanDay,
  PlannedExercise,
  UserProfile,
} from '../../data/types';

/**
 * Plan generator: hand-coded decision tree + hard eligibility constraints +
 * scoring/ranking + conservative sizing (§7). No remote AI, no neural net.
 *
 * Pipeline: read preferences → choose split → hard-filter candidates →
 * score eligible → allocate volume/time/order → validate → explain → save.
 * Deterministic for fixed inputs (tie-break by exercise id).
 */

export interface HistorySignals {
  /** Working sets logged per muscle in the recent window. */
  recentMuscleSets: Partial<Record<MuscleId, number>>;
  /** Times each exercise was performed recently. */
  recentExerciseCount: Record<string, number>;
}

export const EMPTY_HISTORY: HistorySignals = {
  recentMuscleSets: {},
  recentExerciseCount: {},
};

export interface DayTemplate {
  label: string;
  focus: string;
  movementTargets: Movement[];
}

/** Broad split defaults by training days — defaults, not mandates (§7.2). */
export function chooseSplit(days: number, experience: Experience): DayTemplate[] {
  const fb = (suffix: string): DayTemplate => ({
    label: `Full body ${suffix}`,
    focus: 'Whole-body strength & technique',
    movementTargets: ['squat', 'hinge', 'hpush', 'hpull', 'vpush', 'vpull', 'core'],
  });
  if (days <= 2) return [fb('A'), fb('B')];
  if (days === 3) return [fb('A'), fb('B'), fb('C')];
  if (days === 4) {
    return [
      { label: 'Upper A', focus: 'Push + pull', movementTargets: ['hpush', 'vpush', 'hpull', 'vpull', 'core', 'accessory'] },
      { label: 'Lower A', focus: 'Squat + hinge', movementTargets: ['squat', 'hinge', 'core', 'carry', 'accessory'] },
      { label: 'Upper B', focus: 'Pull emphasis', movementTargets: ['hpull', 'vpull', 'hpush', 'core', 'accessory'] },
      { label: 'Lower B', focus: 'Hinge + carries', movementTargets: ['hinge', 'squat', 'carry', 'core', 'accessory'] },
    ];
  }
  // 5 days: flexible split
  const extra: DayTemplate =
    experience === 'new'
      ? { label: 'Technique & mobility', focus: 'Easy practice day', movementTargets: ['core', 'mobility', 'squat', 'hinge'] }
      : { label: 'Arms & conditioning', focus: 'Accessory + carry finish', movementTargets: ['accessory', 'carry', 'core', 'hpush', 'hpull'] };
  return [
    { label: 'Push', focus: 'Chest, shoulders, triceps', movementTargets: ['hpush', 'vpush', 'accessory', 'core'] },
    { label: 'Pull', focus: 'Back, biceps', movementTargets: ['hpull', 'vpull', 'accessory', 'core'] },
    { label: 'Legs', focus: 'Quads, glutes, hamstrings', movementTargets: ['squat', 'hinge', 'accessory', 'carry'] },
    { label: 'Upper mix', focus: 'Push + pull balance', movementTargets: ['hpush', 'hpull', 'vpush', 'vpull', 'core'] },
    extra,
  ];
}

export function experienceLevel(e: Experience): number {
  return e === 'new' ? 1 : e === 'some' ? 2 : 3;
}

/** Hard filter: exact equipment must exist in the active location inventory. */
export function hasRequiredEquipment(ex: Exercise, owned: string[]): boolean {
  if (ex.equipmentIds.includes('bodyweight') && ex.equipmentIds.length === 1) {
    return owned.includes('bodyweight');
  }
  return ex.equipmentIds.every((id) => owned.includes(id));
}

export function conflictsWithRestrictions(ex: Exercise, restrictions: string[]): boolean {
  return restrictions.includes(ex.id);
}

export function isSuitableForExperience(ex: Exercise, experience: Experience): boolean {
  // Beginners are never prescribed advanced (d3) technique-first movements.
  if (experience === 'new') return ex.difficulty <= 2;
  return true;
}

export function fitsMovementNeeds(ex: Exercise, day: DayTemplate): boolean {
  return day.movementTargets.includes(ex.movement);
}

/** Goal emphasis used by the scorer (tuning values, not fitness science). */
function goalFit(ex: Exercise, goal: Goal, experience: Experience): number {
  const compound: Movement[] = ['squat', 'hinge', 'hpush', 'hpull', 'vpush', 'vpull'];
  switch (goal) {
    case 'strength':
      return compound.includes(ex.movement) && ex.difficulty >= 2 ? 1 : 0.45;
    case 'endurance':
      return ex.movement === 'core' || ex.movement === 'carry' || ex.movement === 'accessory'
        ? 1
        : 0.55;
    case 'technique':
      return ex.difficulty === 1 ? 1 : ex.difficulty === 2 ? 0.6 : 0.25;
    case 'mobility':
      return ex.movement === 'mobility' || ex.movement === 'core' ? 1 : 0.4;
    case 'fitness':
      return experienceLevel(experience) >= ex.difficulty ? 0.85 : 0.5;
  }
}

function techniqueSuitability(ex: Exercise, experience: Experience): number {
  const lvl = experienceLevel(experience);
  if (experience === 'new') return ex.difficulty <= lvl ? 1 : 0.3;
  if (experience === 'experienced') return ex.difficulty >= 2 ? 1 : 0.6;
  return ex.difficulty <= 2 ? 1 : 0.55;
}

/**
 * Score candidates: goal 25% + coverage 25% + preference 15% +
 * novelty/rotation 10% + technique suitability 25% (§7.2.5).
 */
export function scoreExercise(
  ex: Exercise,
  profile: UserProfile,
  history: HistorySignals,
  dayCovered: Set<Movement>,
  recentMuscleLoad: Partial<Record<MuscleId, number>>,
): number {
  const goal = goalFit(ex, profile.goal, profile.experience) * 0.25;
  const coverage = (dayCovered.has(ex.movement) ? 0.2 : 1) * 0.25;
  let pref = 0.5;
  if (profile.pinned.includes(ex.id)) pref = 1;
  else if (profile.liked.includes(ex.id)) pref = 0.8;
  else if (profile.disliked.includes(ex.id)) pref = 0;
  const preference = pref * 0.15;
  const times = history.recentExerciseCount[ex.id] ?? 0;
  const novelty = Math.max(0.15, 1 - times / 3) * 0.1;
  // Down-rank muscles trained heavily in the recent window.
  const load = ex.primary.reduce((acc, m) => acc + (recentMuscleLoad[m] ?? 0), 0);
  const freshness = Math.max(0.3, 1 - load / 12);
  const technique = techniqueSuitability(ex, profile.experience) * 0.25 * (0.6 + 0.4 * freshness);
  return goal + coverage + preference + novelty + technique;
}

function repsForGoal(goal: Goal, experience: Experience): string {
  switch (goal) {
    case 'strength':
      return experience === 'new' ? '5–6' : '4–6';
    case 'endurance':
      return '12–15';
    case 'technique':
      return '6–8 (slow)';
    case 'mobility':
      return '30–45s holds';
    case 'fitness':
      return experience === 'experienced' ? '8–10' : '8–12';
  }
}

function setsFor(experience: Experience, movement: Movement): number {
  const base = experience === 'new' ? 2 : experience === 'some' ? 3 : 3;
  if (movement === 'core' || movement === 'mobility') return 2;
  return experience === 'experienced' && movement !== 'accessory' ? 4 : base;
}

function restFor(goal: Goal): number {
  return goal === 'strength' ? 150 : goal === 'endurance' ? 45 : 90;
}

function targetExerciseCount(durationMin: number, experience: Experience): number {
  const base = durationMin <= 30 ? 4 : durationMin <= 45 ? 6 : 7;
  return Math.min(8, base + (experience === 'experienced' ? 1 : 0));
}

function reasonFor(ex: Exercise, profile: UserProfile, history: HistorySignals): string {
  const parts: string[] = [];
  const owned = profile.equipment[profile.activeLocation];
  const matched = ex.equipmentIds.filter((id) => owned.includes(id));
  if (matched.length > 0 && !(ex.equipmentIds.length === 1 && ex.equipmentIds[0] === 'bodyweight')) {
    parts.push(`fits your ${profile.activeLocation} gear`);
  } else {
    parts.push('needs no equipment');
  }
  if (profile.pinned.includes(ex.id)) parts.push('you pinned it');
  else if (profile.liked.includes(ex.id)) parts.push('you liked it');
  const times = history.recentExerciseCount[ex.id] ?? 0;
  if (times === 0) parts.push('fresh in your rotation');
  return `Chosen because it ${parts.join(' · ')}.`;
}

export interface SizedPlan {
  plan: Plan;
  warnings: string[];
}

/**
 * Build a complete weekly plan. Returns warnings instead of silently
 * ignoring constraints (e.g. asks for adjustment when nothing is safe).
 */
export function createPlan(
  profile: UserProfile,
  history: HistorySignals,
  catalog: Exercise[],
  planId?: string,
): SizedPlan {
  const templates = chooseSplit(profile.daysPerWeek, profile.experience);
  const owned = profile.equipment[profile.activeLocation];
  const warnings: string[] = [];

  const eligible = catalog.filter(
    (ex) =>
      hasRequiredEquipment(ex, owned) &&
      !conflictsWithRestrictions(ex, profile.restrictions) &&
      !profile.disliked.includes(ex.id) &&
      isSuitableForExperience(ex, profile.experience),
  );

  if (eligible.length === 0) {
    warnings.push(
      'No exercise fits your current equipment and restrictions. Add equipment or review your avoid-list, then regenerate.',
    );
  }

  const reps = repsForGoal(profile.goal, profile.experience);
  const restSec = restFor(profile.goal);
  const targetCount = targetExerciseCount(profile.durationMin, profile.experience);
  const usedAcrossWeek = new Map<string, number>();
  const explanation: string[] = [
    `${templates.length}-day ${templates.length <= 3 ? 'full-body' : templates.length === 4 ? 'upper/lower' : 'flexible'} split for ${profile.durationMin}-minute ${profile.activeLocation} sessions.`,
    `Filtered to your ${profile.activeLocation} equipment (${owned.length} item${owned.length === 1 ? '' : 's'}) and ${profile.restrictions.length} avoided movement${profile.restrictions.length === 1 ? '' : 's'}.`,
  ];

  const days: PlanDay[] = templates.map((t, i) => {
    const covered = new Set<Movement>();
    const dayHistory: HistorySignals = {
      recentMuscleSets: history.recentMuscleSets,
      recentExerciseCount: { ...history.recentExerciseCount },
    };
    // Avoid repeating the previous day's exact picks inside this plan.
    const candidates = eligible.filter((ex) => fitsMovementNeeds(ex, t));
    const pool = candidates.length > 0 ? candidates : eligible;
    if (candidates.length === 0) {
      warnings.push(
        `${t.label}: no ${t.focus.toLowerCase()} options fit your gear, so balanced alternatives were used.`,
      );
    }
    const ranked = pool
      .map((ex) => ({
        ex,
        score:
          scoreExercise(ex, profile, dayHistory, covered, history.recentMuscleSets) -
          (usedAcrossWeek.get(ex.id) ?? 0) * 0.12,
      }))
      .sort((a, b) => (b.score !== a.score ? b.score - a.score : a.ex.id.localeCompare(b.ex.id)));

    const picks: PlannedExercise[] = [];
    // Pinned favourites first when they fit the day.
    for (const pid of profile.pinned) {
      const found = ranked.find((r) => r.ex.id === pid);
      if (found && picks.length < targetCount) {
        picks.push({
          exerciseId: found.ex.id,
          sets: setsFor(profile.experience, found.ex.movement),
          reps,
          restSec,
          reason: reasonFor(found.ex, profile, history),
        });
        covered.add(found.ex.movement);
      }
    }
    for (const r of ranked) {
      if (picks.length >= targetCount) break;
      if (picks.some((p) => p.exerciseId === r.ex.id)) continue;
      picks.push({
        exerciseId: r.ex.id,
        sets: setsFor(profile.experience, r.ex.movement),
        reps,
        restSec,
        reason: reasonFor(r.ex, profile, history),
      });
      covered.add(r.ex.movement);
      usedAcrossWeek.set(r.ex.id, (usedAcrossWeek.get(r.ex.id) ?? 0) + 1);
    }

    return {
      id: `day-${i + 1}`,
      label: t.label,
      focus: t.focus,
      movementTargets: t.movementTargets,
      exercises: picks,
    };
  });

  const split = templates.length <= 3 ? 'Full-body' : templates.length === 4 ? 'Upper / lower' : 'Flexible split';
  const plan: Plan = {
    id: planId ?? `plan-${Date.now()}`,
    createdAt: Date.now(),
    location: profile.activeLocation,
    split,
    goal: profile.goal,
    experience: profile.experience,
    days,
    explanation,
  };
  return { plan, warnings };
}

/** Substitute picker: same movement pattern, available gear, not restricted. */
export function suggestSwap(
  exerciseId: string,
  profile: UserProfile,
  catalog: Exercise[],
  byId: (id: string) => Exercise | undefined,
): Exercise[] {
  const current = byId(exerciseId);
  if (!current) return [];
  const owned = profile.equipment[profile.activeLocation];
  return catalog
    .filter(
      (ex) =>
        ex.id !== exerciseId &&
        ex.movement === current.movement &&
        hasRequiredEquipment(ex, owned) &&
        !conflictsWithRestrictions(ex, profile.restrictions) &&
        isSuitableForExperience(ex, profile.experience),
    )
    .sort((a, b) => {
      const sa = (profile.liked.includes(a.id) ? 0 : 1) + a.difficulty * 0.05;
      const sb = (profile.liked.includes(b.id) ? 0 : 1) + b.difficulty * 0.05;
      return sa !== sb ? sa - sb : a.id.localeCompare(b.id);
    })
    .slice(0, 4);
}

export type ProgressHint = 'progress' | 'hold' | 'regress' | 'swap' | 'fresh';

/**
 * Conservative post-session adaptation (§7.3). Never prescribes pushing
 * through pain; discomfort flags route to alternatives + qualified guidance.
 */
export function adaptHint(args: {
  completions: number;
  attempts: number;
  discomfort: boolean;
  hardCount: number;
  easyCount: number;
}): { hint: ProgressHint; note: string } {
  const { completions, attempts, discomfort, hardCount, easyCount } = args;
  if (discomfort) {
    return {
      hint: 'swap',
      note: 'Marked uncomfortable — consider a non-painful alternative or qualified in-person guidance. Not a diagnosis.',
    };
  }
  if (attempts === 0) return { hint: 'fresh', note: 'Not logged yet.' };
  const rate = completions / attempts;
  if (rate < 0.5) {
    return { hint: 'regress', note: 'Frequent misses — keep or reduce load/complexity, or try an easier variation.' };
  }
  if (easyCount >= 2 && rate >= 0.85) {
    return { hint: 'progress', note: 'Comfortable twice in a row — a small load bump or an extra quality set is reasonable.' };
  }
  if (hardCount >= 2) {
    return { hint: 'hold', note: 'Consistently hard — hold this level until form feels repeatable.' };
  }
  return { hint: 'hold', note: 'Steady — hold this level.' };
}
