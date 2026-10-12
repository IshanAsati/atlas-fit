import { describe, expect, it } from 'vitest';
import { CATALOG } from '../data/catalog';
import { DEFAULT_EQUIPMENT } from '../data/equipment';
import { MUSCLE_BY_ID } from '../data/muscles';
import type { Movement, Plan, UserProfile, WorkoutSession } from '../data/types';
import {
  estimateSessionMinutes,
  generatePlan,
} from '../features/planner/engine';
import { volumeClass } from '../features/planner/weekSelection';
import { isExerciseEligible, validatePlan } from '../features/planner/validator';

/**
 * Generator quality bars (§7).
 *
 * These assert the *shape* of a good week, not the exact exercises:
 * no lift repeats across days while fresh options exist, main lifts lead the
 * session, the session uses its time budget, and push/pull/muscle volume
 * stays inside sane limits.
 */

const BASE_PROFILE: UserProfile = {
  displayName: 'Bench',
  goal: 'strength',
  experience: 'some',
  activeLocation: 'home',
  equipment: {
    home: ['bodyweight', 'mat', 'chair', 'dumbbells', 'bands', 'backpack'],
    gym: DEFAULT_EQUIPMENT.gym,
    travel: DEFAULT_EQUIPMENT.travel,
  },
  daysPerWeek: 3,
  durationMin: 45,
  weekdays: ['Mon', 'Wed', 'Fri'],
  restrictions: [],
  discomfortNotes: '',
  otherSports: '',
  liked: [],
  disliked: [],
  pinned: [],
  favourites: [],
  onboarded: true,
};

const COMPOUND: ReadonlySet<Movement> = new Set<Movement>([
  'squat',
  'hinge',
  'hpush',
  'vpush',
  'hpull',
  'vpull',
]);

const byId = new Map(CATALOG.map((e) => [e.id, e]));

interface ProfileCase {
  label: string;
  profile: UserProfile;
}

const CASES: ProfileCase[] = [
  { label: 'home 3-day 45m', profile: BASE_PROFILE },
  {
    label: 'gym 3-day PPL 60m',
    profile: {
      ...BASE_PROFILE,
      activeLocation: 'gym',
      experience: 'experienced',
      durationMin: 60,
      daysPerWeek: 3,
    },
  },
  {
    label: 'home 2-day beginner 30m',
    profile: {
      ...BASE_PROFILE,
      daysPerWeek: 2,
      durationMin: 30,
      experience: 'new',
      goal: 'fitness',
    },
  },
  {
    label: 'travel 4-day 60m',
    profile: {
      ...BASE_PROFILE,
      activeLocation: 'travel',
      daysPerWeek: 4,
      durationMin: 60,
      goal: 'fitness',
    },
  },
  {
    label: 'gym 5-day 45m',
    profile: {
      ...BASE_PROFILE,
      activeLocation: 'gym',
      daysPerWeek: 5,
      durationMin: 45,
      experience: 'experienced',
      goal: 'endurance',
    },
  },
  {
    label: 'home 3-day mobility',
    profile: { ...BASE_PROFILE, goal: 'mobility', daysPerWeek: 3, durationMin: 45 },
  },
];

function duplicateIds(plan: Plan): string[] {
  const seen = new Map<string, number>();
  for (const day of plan.days) {
    for (const item of day.exercises) {
      seen.set(item.exerciseId, (seen.get(item.exerciseId) ?? 0) + 1);
    }
  }
  return [...seen.entries()].filter(([, count]) => count > 1).map(([id]) => id);
}

function pushPullSets(plan: Plan): { push: number; pull: number } {
  let push = 0;
  let pull = 0;
  for (const day of plan.days) {
    for (const item of day.exercises) {
      const movement = byId.get(item.exerciseId)?.movement;
      if (movement === 'hpush' || movement === 'vpush') push += item.sets;
      if (movement === 'hpull' || movement === 'vpull') pull += item.sets;
    }
  }
  return { push, pull };
}

function topMuscleShare(plan: Plan): { name: string; share: number } {
  const setsByMuscle = new Map<string, number>();
  let total = 0;
  for (const day of plan.days) {
    for (const item of day.exercises) {
      const exercise = byId.get(item.exerciseId);
      if (!exercise) continue;
      total += item.sets;
      for (const muscle of exercise.primary) {
        setsByMuscle.set(muscle, (setsByMuscle.get(muscle) ?? 0) + item.sets);
      }
    }
  }
  const [muscle, sets] = [...setsByMuscle.entries()].sort((a, b) => b[1] - a[1])[0] ?? ['-', 0];
  return {
    name: MUSCLE_BY_ID[muscle as keyof typeof MUSCLE_BY_ID]?.short ?? muscle,
    share: total > 0 ? sets / total : 0,
  };
}

/** A day is well ordered once every main lift sits before assistance work. */
function unorderedDays(plan: Plan): string[] {
  const bad: string[] = [];
  for (const day of plan.days) {
    let sawAccessory = false;
    for (const item of day.exercises) {
      const isCompound = COMPOUND.has(byId.get(item.exerciseId)?.movement ?? 'accessory');
      if (!isCompound) sawAccessory = true;
      else if (sawAccessory) {
        bad.push(day.label);
        break;
      }
    }
  }
  return bad;
}

function estimate(plan: Plan): number {
  return Math.max(
    ...plan.days.map((day) => estimateSessionMinutes(day.exercises, byId)),
  );
}

function report(label: string, plan: Plan): void {
  const { push, pull } = pushPullSets(plan);
  const muscle = topMuscleShare(plan);
  console.log(
    `[quality:${label}] dupes=${duplicateIds(plan).length} unordered=${unorderedDays(plan).length} ` +
      `est=${estimate(plan).toFixed(0)}/${plan.days[0] ? '…' : '?'} push=${push} pull=${pull} ` +
      `top=${muscle.name} ${(muscle.share * 100).toFixed(0)}%`,
  );
}

describe('Plan quality bars (§7)', () => {
  for (const { label, profile } of CASES) {
    it(`${label}: validates, orders and fits its time budget`, () => {
      const plan = generatePlan(profile, CATALOG);

      const validation = validatePlan(plan, profile, CATALOG);
      expect(validation.issues).toEqual([]);

      // Session shape stays inside the duration bounds.
      for (const day of plan.days) {
        expect(day.exercises.length).toBeGreaterThanOrEqual(3);
        expect(day.exercises.length).toBeLessThanOrEqual(6);
        for (const item of day.exercises) {
          expect(item.sets).toBeGreaterThanOrEqual(2);
          expect(item.sets).toBeLessThanOrEqual(4);
          expect(item.restSec).toBeGreaterThanOrEqual(60);
          expect(item.restSec).toBeLessThanOrEqual(120);
        }
      }

      // Main lifts lead the session.
      expect(unorderedDays(plan)).toEqual([]);

      // The session uses, but does not blow through, its booked time.
      const minutes = estimate(plan);
      expect(minutes).toBeLessThanOrEqual(profile.durationMin * 1.05);
      expect(minutes).toBeGreaterThanOrEqual(profile.durationMin * 0.5);

      // Push and pull stay within a handful of sets of each other.
      const { push, pull } = pushPullSets(plan);
      expect(Math.abs(push - pull)).toBeLessThanOrEqual(6);

      // No single muscle hogs the week.
      expect(topMuscleShare(plan).share).toBeLessThanOrEqual(0.45);

      report(label, plan);
    });
  }

  it('never repeats a lift across days while a fresh option exists', () => {
    for (const { label, profile } of CASES) {
      const plan = generatePlan(profile, CATALOG);
      const plannedIds = new Set(
        plan.days.flatMap((day) => day.exercises.map((e) => e.exerciseId)),
      );

      // A repeat is only acceptable when the whole pool it draws from — the
      // movement itself, or for main lifts any exercise of the same
      // push/pull/legs class — is already on this week's plan.
      const avoidable = duplicateIds(plan).filter((id) => {
        const exercise = byId.get(id);
        if (!exercise) return false;
        const cls = volumeClass(exercise.movement);
        return CATALOG.some(
          (other) =>
            other.id !== id &&
            !plannedIds.has(other.id) &&
            isExerciseEligible(other, profile, profile.activeLocation) &&
            (cls
              ? volumeClass(other.movement) === cls
              : other.movement === exercise.movement),
        );
      });

      expect(avoidable, `${label} needlessly repeats ${avoidable.join(', ')}`).toEqual([]);
    }
  });

  it('fills the booked time rather than underusing it', () => {
    for (const { label, profile } of CASES) {
      const plan = generatePlan(profile, CATALOG);
      const minutes = estimate(plan);
      expect(minutes, `${label} only uses ${minutes.toFixed(0)} of ${profile.durationMin}m`).toBeGreaterThanOrEqual(
        profile.durationMin * 0.55,
      );
    }
  });

  it('skips disliked exercises whenever an alternative exists', () => {
    const disliked = 'db-goblet-squat';
    const profile: UserProfile = { ...BASE_PROFILE, disliked: [disliked] };
    const plan = generatePlan(profile, CATALOG);
    const planned = plan.days.flatMap((day) => day.exercises.map((e) => e.exerciseId));
    expect(planned).not.toContain(disliked);
    expect(planned.length).toBeGreaterThan(0);
  });

  it('rotates away from exercises logged in recent sessions', () => {
    // Log a full session using the exact plan the generator would write, then
    // regenerate: the fresh plan should not simply replay it.
    const first = generatePlan(BASE_PROFILE, CATALOG);
    const history: WorkoutSession[] = first.days.map((day, index) => ({
      id: `s-${index}`,
      title: day.label,
      location: BASE_PROFILE.activeLocation,
      startedAt: 1700000000000 - (index + 1) * 86400000,
      state: 'done',
      items: day.exercises.map((item) => ({ exerciseId: item.exerciseId, sets: [] })),
    }));

    const regenerated = generatePlan(BASE_PROFILE, CATALOG, history);
    const planned = regenerated.days.flatMap((day) => day.exercises.map((e) => e.exerciseId));
    const replayed = planned.filter((id) =>
      first.days.some((day) => day.exercises.some((item) => item.exerciseId === id)),
    );
    // Some overlap is unavoidable with a fixed pool, but it should not be
    // an identical week.
    expect(replayed.length).toBeLessThan(planned.length);
    expect(duplicateIds(regenerated)).toEqual([]);
  });
});
