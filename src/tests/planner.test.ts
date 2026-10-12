import { describe, expect, it } from 'vitest';
import { CATALOG } from '../data/catalog';
import { DEFAULT_EQUIPMENT } from '../data/equipment';
import type { Exercise, UserProfile, WorkoutSession } from '../data/types';
import {
  generatePlan,
  swapExerciseInPlan,
} from '../features/planner/engine';
import { scoreExercise } from '../features/planner/scoring';
import {
  determineSplit,
  FIVE_DAY_SPLIT,
  FULL_BODY_2_DAY,
  FULL_BODY_3_DAY,
  PPL_3_DAY,
  UPPER_LOWER_4_DAY,
} from '../features/planner/splits';
import {
  hasRequiredEquipment,
  isExerciseEligible,
  isSuitableForExperience,
  validatePlan,
} from '../features/planner/validator';

const BASE_PROFILE: UserProfile = {
  displayName: 'Ishan',
  goal: 'strength',
  experience: 'some',
  activeLocation: 'home',
  equipment: {
    home: ['bodyweight', 'mat', 'chair', 'dumbbells', 'bands'],
    gym: DEFAULT_EQUIPMENT.gym,
    travel: DEFAULT_EQUIPMENT.travel,
  },
  daysPerWeek: 3,
  durationMin: 45,
  weekdays: ['Monday', 'Wednesday', 'Friday'],
  restrictions: [],
  discomfortNotes: '',
  otherSports: '',
  liked: [],
  disliked: [],
  pinned: [],
  favourites: [],
  onboarded: true,
};

describe('Split Determination (§7.2)', () => {
  it('selects 2-day Full Body split for 2 days', () => {
    const split = determineSplit(2, 'new');
    expect(split.id).toBe(FULL_BODY_2_DAY.id);
    expect(split.days).toHaveLength(2);
    expect(split.days[0].label).toBe('Full Body A');
    expect(split.days[1].label).toBe('Full Body B');
    expect(split.days[0].movementTargets).toEqual([
      'squat',
      'hpush',
      'hpull',
      'hinge',
      'core',
      'accessory',
    ]);
  });

  it('selects 3-day Full Body for beginner and intermediate users', () => {
    const splitNew = determineSplit(3, 'new');
    expect(splitNew.id).toBe(FULL_BODY_3_DAY.id);
    expect(splitNew.days).toHaveLength(3);
    expect(splitNew.days.map((d) => d.label)).toEqual([
      'Full Body A',
      'Full Body B',
      'Full Body C',
    ]);

    const splitSome = determineSplit(3, 'some');
    expect(splitSome.id).toBe(FULL_BODY_3_DAY.id);
  });

  it('selects 3-day Push/Pull/Legs for experienced users', () => {
    const split = determineSplit(3, 'experienced');
    expect(split.id).toBe(PPL_3_DAY.id);
    expect(split.days).toHaveLength(3);
    expect(split.days.map((d) => d.label)).toEqual(['Push', 'Pull', 'Legs']);
    expect(split.days[0].movementTargets).toContain('hpush');
    expect(split.days[1].movementTargets).toContain('hpull');
    expect(split.days[2].movementTargets).toContain('squat');
  });

  it('selects 4-day Upper/Lower split for 4 days', () => {
    const split = determineSplit(4, 'some');
    expect(split.id).toBe(UPPER_LOWER_4_DAY.id);
    expect(split.days).toHaveLength(4);
    expect(split.days.map((d) => d.label)).toEqual([
      'Upper A',
      'Lower A',
      'Upper B',
      'Lower B',
    ]);
    expect(split.days[0].movementTargets).toContain('hpush');
    expect(split.days[1].movementTargets).toContain('squat');
  });

  it('selects 5-day PPL Upper/Lower split for 5 days', () => {
    const split = determineSplit(5, 'experienced');
    expect(split.id).toBe(FIVE_DAY_SPLIT.id);
    expect(split.days).toHaveLength(5);
    expect(split.days.map((d) => d.label)).toEqual([
      'Push',
      'Pull',
      'Legs',
      'Upper',
      'Lower',
    ]);
  });
});

describe('Equipment Constraint Enforcement (§7.2 step 3)', () => {
  it('enforces home equipment constraints strictly (dumbbells and bodyweight only)', () => {
    const homeProfile: UserProfile = {
      ...BASE_PROFILE,
      activeLocation: 'home',
      equipment: {
        ...BASE_PROFILE.equipment,
        home: ['bodyweight', 'dumbbells'],
      },
    };

    const plan = generatePlan(homeProfile, CATALOG);
    expect(plan.days.length).toBeGreaterThan(0);

    const catalogMap = new Map(CATALOG.map((e) => [e.id, e]));

    for (const day of plan.days) {
      for (const planned of day.exercises) {
        const ex = catalogMap.get(planned.exerciseId)!;
        expect(ex).toBeDefined();
        // Must not require barbell, squat-rack, cable, or machines
        for (const eq of ex.equipmentIds) {
          expect(['bodyweight', 'dumbbells', 'adj-dumbbells']).toContain(eq);
        }
      }
    }
  });

  it('enforces travel equipment constraints (bodyweight and bands only)', () => {
    const travelProfile: UserProfile = {
      ...BASE_PROFILE,
      activeLocation: 'travel',
      equipment: {
        ...BASE_PROFILE.equipment,
        travel: ['bodyweight', 'bands'],
      },
    };

    const plan = generatePlan(travelProfile, CATALOG);
    const catalogMap = new Map(CATALOG.map((e) => [e.id, e]));

    for (const day of plan.days) {
      for (const planned of day.exercises) {
        const ex = catalogMap.get(planned.exerciseId)!;
        expect(ex).toBeDefined();
        for (const eq of ex.equipmentIds) {
          expect(['bodyweight', 'bands']).toContain(eq);
        }
      }
    }
  });

  it('correctly evaluates hasRequiredEquipment helper', () => {
    const dumbbellRow: Exercise = {
      id: 'db-row',
      name: 'Dumbbell Row',
      aliases: [],
      source: 'atlas',
      equipmentIds: ['dumbbells', 'bench'],
      movement: 'hpull',
      difficulty: 1,
      primary: ['lats'],
      secondary: ['biceps'],
      instructions: [],
      cues: [],
      mistakes: [],
      substitutes: [],
    };

    expect(hasRequiredEquipment(dumbbellRow, ['dumbbells'])).toBe(false);
    expect(hasRequiredEquipment(dumbbellRow, ['dumbbells', 'bench'])).toBe(true);
    expect(hasRequiredEquipment(dumbbellRow, ['adj-dumbbells', 'bench'])).toBe(true);
  });
});

describe('Restriction and Discomfort Filtering (§7.2 step 3)', () => {
  it('excludes exercises specified in user restrictions list', () => {
    const restrictedProfile: UserProfile = {
      ...BASE_PROFILE,
      activeLocation: 'gym',
      restrictions: ['barbell-bench-press', 'barbell-back-squat'],
    };

    const plan = generatePlan(restrictedProfile, CATALOG);
    const plannedIds = plan.days.flatMap((d) => d.exercises.map((e) => e.exerciseId));

    expect(plannedIds).not.toContain('barbell-bench-press');
    expect(plannedIds).not.toContain('barbell-back-squat');
  });

  it('filters exercises based on discomfort notes mentioning exercise names', () => {
    const discomfortProfile: UserProfile = {
      ...BASE_PROFILE,
      activeLocation: 'gym',
      discomfortNotes: 'Shoulder press causes acute shoulder pain',
    };

    const plan = generatePlan(discomfortProfile, CATALOG);
    const plannedIds = plan.days.flatMap((d) => d.exercises.map((e) => e.exerciseId));

    expect(plannedIds).not.toContain('overhead-press');
    expect(plannedIds).not.toContain('db-shoulder-press');

    // Explanation should note the shoulder substitution
    expect(
      plan.explanation.some((e) => e.includes('Shoulder press substituted')),
    ).toBe(true);
  });

  it('filters exercises with discomfort in user feedback', () => {
    const plan = generatePlan(BASE_PROFILE, CATALOG, [], {
      feedback: [{ exerciseId: 'push-up', discomfort: true, updatedAt: Date.now() }],
    });
    const plannedIds = plan.days.flatMap((d) => d.exercises.map((e) => e.exerciseId));
    expect(plannedIds).not.toContain('push-up');
  });
});

describe('Experience Suitability Filtering (§7.2 step 3)', () => {
  it('limits beginner users (new) to difficulty 1 only', () => {
    const beginnerProfile: UserProfile = {
      ...BASE_PROFILE,
      experience: 'new',
      activeLocation: 'gym',
    };

    const plan = generatePlan(beginnerProfile, CATALOG);
    const catalogMap = new Map(CATALOG.map((e) => [e.id, e]));

    for (const day of plan.days) {
      for (const planned of day.exercises) {
        const ex = catalogMap.get(planned.exerciseId)!;
        expect(ex.difficulty).toBe(1);
      }
    }
  });

  it('limits intermediate users (some) to difficulty 1 or 2', () => {
    const intermediateProfile: UserProfile = {
      ...BASE_PROFILE,
      experience: 'some',
      activeLocation: 'gym',
    };

    const plan = generatePlan(intermediateProfile, CATALOG);
    const catalogMap = new Map(CATALOG.map((e) => [e.id, e]));

    for (const day of plan.days) {
      for (const planned of day.exercises) {
        const ex = catalogMap.get(planned.exerciseId)!;
        expect(ex.difficulty).toBeLessThanOrEqual(2);
      }
    }
  });

  it('correctly checks isSuitableForExperience helper', () => {
    const diff1: Exercise = { ...CATALOG[0], difficulty: 1 };
    const diff2: Exercise = { ...CATALOG[0], difficulty: 2 };
    const diff3: Exercise = { ...CATALOG[0], difficulty: 3 };

    expect(isSuitableForExperience(diff1, 'new')).toBe(true);
    expect(isSuitableForExperience(diff2, 'new')).toBe(false);
    expect(isSuitableForExperience(diff3, 'new')).toBe(false);

    expect(isSuitableForExperience(diff1, 'some')).toBe(true);
    expect(isSuitableForExperience(diff2, 'some')).toBe(true);
    expect(isSuitableForExperience(diff3, 'some')).toBe(false);

    expect(isSuitableForExperience(diff1, 'experienced')).toBe(true);
    expect(isSuitableForExperience(diff2, 'experienced')).toBe(true);
    expect(isSuitableForExperience(diff3, 'experienced')).toBe(true);
  });
});

describe('Duration Bounds and Session Sizing (§7.2 step 4)', () => {
  it('sizes 30-minute sessions to 3-4 exercises, 2-3 sets, and 60-90s rest', () => {
    const shortProfile: UserProfile = {
      ...BASE_PROFILE,
      durationMin: 30,
      experience: 'new',
      activeLocation: 'gym',
    };

    const plan = generatePlan(shortProfile, CATALOG);

    for (const day of plan.days) {
      expect(day.exercises.length).toBeGreaterThanOrEqual(3);
      expect(day.exercises.length).toBeLessThanOrEqual(4);

      for (const ex of day.exercises) {
        expect(ex.sets).toBeGreaterThanOrEqual(2);
        expect(ex.sets).toBeLessThanOrEqual(3);
        expect(ex.restSec).toBeGreaterThanOrEqual(60);
        expect(ex.restSec).toBeLessThanOrEqual(90);
      }
    }
  });

  it('sizes 45-minute sessions to 4-5 exercises, 3 sets, and 90-120s rest', () => {
    const medProfile: UserProfile = {
      ...BASE_PROFILE,
      durationMin: 45,
      activeLocation: 'gym',
    };

    const plan = generatePlan(medProfile, CATALOG);

    for (const day of plan.days) {
      expect(day.exercises.length).toBeGreaterThanOrEqual(4);
      expect(day.exercises.length).toBeLessThanOrEqual(5);

      for (const ex of day.exercises) {
        expect(ex.sets).toBe(3);
        expect(ex.restSec).toBeGreaterThanOrEqual(90);
        expect(ex.restSec).toBeLessThanOrEqual(120);
      }
    }
  });

  it('sizes 60-minute sessions to 5-6 exercises, 3-4 sets, and 120s rest', () => {
    const longProfile: UserProfile = {
      ...BASE_PROFILE,
      durationMin: 60,
      experience: 'experienced',
      activeLocation: 'gym',
    };

    const plan = generatePlan(longProfile, CATALOG);

    for (const day of plan.days) {
      expect(day.exercises.length).toBeGreaterThanOrEqual(5);
      expect(day.exercises.length).toBeLessThanOrEqual(6);

      for (const ex of day.exercises) {
        expect(ex.sets).toBeGreaterThanOrEqual(3);
        expect(ex.sets).toBeLessThanOrEqual(4);
        expect(ex.restSec).toBe(120);
      }
    }
  });
});

describe('Scoring Factors (§7.2)', () => {
  it('awards +40 for movement target match', () => {
    const pushup = CATALOG.find((e) => e.id === 'push-up')!;
    const scoreWithTarget = scoreExercise(pushup, BASE_PROFILE, [], ['hpush']);
    const scoreWithoutTarget = scoreExercise(pushup, BASE_PROFILE, [], ['squat']);
    expect(scoreWithTarget - scoreWithoutTarget).toBe(40);
  });

  it('awards +20 for goal match (strength compound)', () => {
    const squat = CATALOG.find((e) => e.id === 'db-goblet-squat')!;
    const strengthProfile = { ...BASE_PROFILE, goal: 'strength' as const };
    const enduranceProfile = { ...BASE_PROFILE, goal: 'endurance' as const };
    const strengthScore = scoreExercise(squat, strengthProfile, [], ['squat']);
    const enduranceScore = scoreExercise(squat, enduranceProfile, [], ['squat']);
    expect(strengthScore - enduranceScore).toBe(20);
  });

  it('handles preference scoring: +20 liked, +50 pinned, -100 disliked', () => {
    const ex = CATALOG[0];
    const baseScore = scoreExercise(ex, BASE_PROFILE, [], []);

    const likedScore = scoreExercise(
      ex,
      { ...BASE_PROFILE, liked: [ex.id] },
      [],
      [],
    );
    expect(likedScore - baseScore).toBe(20);

    const pinnedScore = scoreExercise(
      ex,
      { ...BASE_PROFILE, pinned: [ex.id] },
      [],
      [],
    );
    expect(pinnedScore - baseScore).toBe(50);

    const dislikedScore = scoreExercise(
      ex,
      { ...BASE_PROFILE, disliked: [ex.id] },
      [],
      [],
    );
    expect(dislikedScore - baseScore).toBe(-100);
  });

  it('penalizes recent session rotation by -15', () => {
    const ex = CATALOG[0];
    const recentSession: WorkoutSession = {
      id: 's-1',
      title: 'Recent workout',
      location: 'home',
      startedAt: Date.now() - 3600000,
      state: 'done',
      items: [{ exerciseId: ex.id, sets: [] }],
    };

    const freshScore = scoreExercise(ex, BASE_PROFILE, [], []);
    const recentScore = scoreExercise(ex, BASE_PROFILE, [recentSession], []);
    expect(freshScore - recentScore).toBe(15);
  });

  it('awards +15 when difficulty matches experience level', () => {
    const diff1Ex = CATALOG.find((e) => e.difficulty === 1)!;
    const diff2Ex = CATALOG.find((e) => e.difficulty === 2)!;

    const newProfile = { ...BASE_PROFILE, experience: 'new' as const };
    const scoreDiff1 = scoreExercise(diff1Ex, newProfile, [], []);
    const scoreDiff2 = scoreExercise(diff2Ex, newProfile, [], []);
    expect(scoreDiff1 - scoreDiff2).toBe(15);
  });

  it('awards +10 equipment friction bonus for simple home equipment', () => {
    const bwEx = CATALOG.find((e) => e.equipmentIds.includes('bodyweight') && e.equipmentIds.length === 1)!;
    const homeScore = scoreExercise(
      bwEx,
      { ...BASE_PROFILE, activeLocation: 'home' },
      [],
      [],
    );
    const gymScore = scoreExercise(
      bwEx,
      { ...BASE_PROFILE, activeLocation: 'gym' },
      [],
      [],
    );
    expect(homeScore - gymScore).toBe(10);
  });
});

describe('Determinism', () => {
  it('generates completely identical plans given identical inputs', () => {
    const plan1 = generatePlan(BASE_PROFILE, CATALOG);
    const plan2 = generatePlan(BASE_PROFILE, CATALOG);

    expect(plan1.id).toBe(plan2.id);
    expect(plan1.createdAt).toBe(plan2.createdAt);
    expect(plan1.split).toBe(plan2.split);
    expect(plan1.explanation).toEqual(plan2.explanation);
    expect(plan1.days).toEqual(plan2.days);
  });
});

describe('Exercise Swapping and Pinned Exercises', () => {
  it('swaps an exercise cleanly and adds an explanatory log', () => {
    const initialPlan = generatePlan(BASE_PROFILE, CATALOG);
    const day = initialPlan.days[0];
    const oldExId = day.exercises[0].exerciseId;

    // Pick an alternative exercise from catalog that is eligible
    const eligibleAlternatives = CATALOG.filter(
      (e) =>
        e.id !== oldExId &&
        isExerciseEligible(e, BASE_PROFILE, BASE_PROFILE.activeLocation) &&
        !day.exercises.some((item) => item.exerciseId === e.id),
    );

    expect(eligibleAlternatives.length).toBeGreaterThan(0);
    const newEx = eligibleAlternatives[0];

    const updatedPlan = swapExerciseInPlan(
      initialPlan,
      day.id,
      oldExId,
      newEx.id,
      CATALOG,
    );

    const updatedDay = updatedPlan.days.find((d) => d.id === day.id)!;
    expect(updatedDay.exercises[0].exerciseId).toBe(newEx.id);
    expect(updatedDay.exercises[0].reason).toContain('Swapped substitute');
    expect(
      updatedPlan.explanation.some((e) => e.includes(`Swapped`)),
    ).toBe(true);

    // Initial plan must remain immutable
    expect(initialPlan.days[0].exercises[0].exerciseId).toBe(oldExId);
  });

  it('preserves pinned exercises when generating plan', () => {
    const pinnedProfile: UserProfile = {
      ...BASE_PROFILE,
      activeLocation: 'home',
      pinned: ['push-up'],
    };

    const plan = generatePlan(pinnedProfile, CATALOG);
    const allPlannedIds = plan.days.flatMap((d) => d.exercises.map((e) => e.exerciseId));
    expect(allPlannedIds).toContain('push-up');

    // Regenerate passing existing plan
    const regeneratedPlan = generatePlan(pinnedProfile, CATALOG, [], {
      existingPlan: plan,
    });
    const regenIds = regeneratedPlan.days.flatMap((d) => d.exercises.map((e) => e.exerciseId));
    expect(regenIds).toContain('push-up');
  });

  it('passes plan validation against profile constraints', () => {
    const plan = generatePlan(BASE_PROFILE, CATALOG);
    const result = validatePlan(plan, BASE_PROFILE, CATALOG);
    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });
});
