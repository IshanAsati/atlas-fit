import { describe, expect, it } from 'vitest';
import {
  chooseSplit,
  createPlan,
  EMPTY_HISTORY,
  experienceLevel,
  fitsMovementNeeds,
  hasRequiredEquipment,
  isSuitableForExperience,
  conflictsWithRestrictions,
  adaptHint,
  suggestSwap,
} from '../features/planner/engine';
import { CATALOG, getExercise } from '../data/catalog';
import { DEFAULT_EQUIPMENT } from '../data/equipment';
import type { UserProfile } from '../data/types';

const profile: UserProfile = {
  displayName: 'Tester',
  goal: 'strength',
  experience: 'some',
  activeLocation: 'home',
  equipment: {
    home: [...DEFAULT_EQUIPMENT.home],
    gym: [...DEFAULT_EQUIPMENT.gym],
    travel: [...DEFAULT_EQUIPMENT.travel],
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

describe('split selection by schedule (§7.2)', () => {
  it('2–3 days → full-body days', () => {
    expect(chooseSplit(2, 'some')).toHaveLength(2);
    expect(chooseSplit(3, 'some')[0].label).toContain('Full body');
  });
  it('4 days → upper/lower', () => {
    const days = chooseSplit(4, 'experienced');
    expect(days).toHaveLength(4);
    expect(days[0].label).toContain('Upper');
    expect(days[1].label).toContain('Lower');
  });
  it('5 days → flexible split', () => {
    expect(chooseSplit(5, 'some')).toHaveLength(5);
  });
});

describe('equipment filtering (§7.2.3)', () => {
  it('never picks gear the location lacks', () => {
    expect(hasRequiredEquipment(getExercise('barbell-squat')!, ['dumbbells', 'bodyweight'])).toBe(false);
    expect(hasRequiredEquipment(getExercise('barbell-squat')!, ['barbell', 'squat-rack'])).toBe(true);
  });
  it('bodyweight needs the bodyweight capability', () => {
    expect(hasRequiredEquipment(getExercise('push-up')!, ['bodyweight'])).toBe(true);
    expect(hasRequiredEquipment(getExercise('push-up')!, ['barbell'])).toBe(false);
  });
  it('generated plan contains only exercises available at the location', () => {
    const { plan } = createPlan(profile, EMPTY_HISTORY, CATALOG);
    for (const day of plan.days) {
      for (const pe of day.exercises) {
        const ex = getExercise(pe.exerciseId)!;
        expect(hasRequiredEquipment(ex, profile.equipment.home)).toBe(true);
      }
    }
  });
});

describe('restrictions and experience', () => {
  it('excludes avoided exercises', () => {
    expect(conflictsWithRestrictions(getExercise('push-up')!, ['push-up'])).toBe(true);
    const withAvoid: UserProfile = { ...profile, restrictions: ['push-up', 'plank'] };
    const { plan } = createPlan(withAvoid, EMPTY_HISTORY, CATALOG);
    for (const day of plan.days) {
      for (const pe of day.exercises) {
        expect(withAvoid.restrictions).not.toContain(pe.exerciseId);
      }
    }
  });
  it('beginners never get advanced movements', () => {
    expect(isSuitableForExperience(getExercise('barbell-squat')!, 'new')).toBe(false);
    expect(isSuitableForExperience(getExercise('push-up')!, 'new')).toBe(true);
  });
  it('experience levels map sensibly', () => {
    expect(experienceLevel('new')).toBe(1);
    expect(experienceLevel('some')).toBe(2);
    expect(experienceLevel('experienced')).toBe(3);
  });
});

describe('session construction (§7.2.6–7)', () => {
  it('is deterministic for fixed inputs', () => {
    const a = createPlan(profile, EMPTY_HISTORY, CATALOG, 'fixed-id');
    const b = createPlan(profile, EMPTY_HISTORY, CATALOG, 'fixed-id');
    expect(JSON.stringify(a.plan)).toBe(JSON.stringify(b.plan));
  });
  it('has no duplicate exercises within a day', () => {
    const { plan } = createPlan(profile, EMPTY_HISTORY, CATALOG);
    for (const day of plan.days) {
      const ids = day.exercises.map((e) => e.exerciseId);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });
  it('every day is non-empty and sized to the session duration', () => {
    const { plan } = createPlan(profile, EMPTY_HISTORY, CATALOG);
    expect(plan.days.length).toBe(profile.daysPerWeek);
    for (const day of plan.days) {
      expect(day.exercises.length).toBeGreaterThan(0);
      expect(day.exercises.length).toBeLessThanOrEqual(7); // 45 min cap
    }
  });
  it('30-minute sessions plan fewer exercises than 60-minute ones', () => {
    const short = createPlan({ ...profile, durationMin: 30 }, EMPTY_HISTORY, CATALOG).plan;
    const long = createPlan({ ...profile, durationMin: 60 }, EMPTY_HISTORY, CATALOG).plan;
    const n = (p: typeof short) => p.days.reduce((acc, d) => acc + d.exercises.length, 0);
    expect(n(short)).toBeLessThan(n(long));
  });
  it('every plan explains itself (no AI claims)', () => {
    const { plan } = createPlan(profile, EMPTY_HISTORY, CATALOG);
    expect(plan.explanation.length).toBeGreaterThan(0);
    for (const day of plan.days) {
      for (const pe of day.exercises) expect(pe.reason.length).toBeGreaterThan(0);
    }
  });
  it('pinned exercises are honoured when they fit', () => {
    const pinned: UserProfile = { ...profile, pinned: ['plank', 'push-up'] };
    const { plan } = createPlan(pinned, EMPTY_HISTORY, CATALOG);
    const ids = plan.days.flatMap((d) => d.exercises.map((e) => e.exerciseId));
    expect(ids).toContain('plank');
    expect(ids).toContain('push-up');
  });
  it('asks for adjustment when nothing is safe instead of ignoring constraints', () => {
    const impossible: UserProfile = {
      ...profile,
      equipment: { home: ['treadmill'], gym: [], travel: [] },
      restrictions: [],
    };
    const { plan } = createPlan(impossible, EMPTY_HISTORY, CATALOG);
    for (const day of plan.days) {
      for (const pe of day.exercises) {
        expect(hasRequiredEquipment(getExercise(pe.exerciseId)!, ['treadmill'])).toBe(true);
      }
    }
  });
  it('movement coverage: each day targets its planned patterns', () => {
    const { plan } = createPlan(profile, EMPTY_HISTORY, CATALOG);
    for (const day of plan.days) {
      expect(day.exercises.length).toBeGreaterThan(0);
      for (const exId of day.exercises.map((e) => e.exerciseId)) {
        const ex = getExercise(exId)!;
        expect(fitsMovementNeeds(ex, {
          label: day.label,
          focus: day.focus,
          movementTargets: day.movementTargets,
        })).toBe(true);
      }
    }
  });
});

describe('substitutions and adaptation (§7.3)', () => {
  it('suggests same-pattern, available-gear alternatives', () => {
    const options = suggestSwap('barbell-bench', profile, CATALOG, getExercise);
    expect(options.length).toBeGreaterThan(0);
    for (const opt of options) {
      expect(opt.movement).toBe('hpush');
      expect(hasRequiredEquipment(opt, profile.equipment.home)).toBe(true);
      expect(opt.id).not.toBe('barbell-bench');
    }
  });
  it('flags discomfort for alternatives, never "push through"', () => {
    const hint = adaptHint({ completions: 3, attempts: 3, discomfort: true, hardCount: 0, easyCount: 0 });
    expect(hint.hint).toBe('swap');
    expect(hint.note).toMatch(/alternative/i);
  });
  it('regresses after frequent misses', () => {
    const hint = adaptHint({ completions: 1, attempts: 5, discomfort: false, hardCount: 0, easyCount: 0 });
    expect(hint.hint).toBe('regress');
  });
  it('progresses only after comfortable, repeatable effort', () => {
    const hint = adaptHint({ completions: 6, attempts: 6, discomfort: false, hardCount: 0, easyCount: 2 });
    expect(hint.hint).toBe('progress');
  });
});

describe('catalogue sanity (§8.2)', () => {
  it('every exercise references known muscles and has content', () => {
    for (const ex of CATALOG) {
      expect(ex.primary.length).toBeGreaterThan(0);
      expect(ex.instructions.length).toBeGreaterThan(0);
      expect(ex.equipmentIds.length).toBeGreaterThan(0);
      expect(ex.difficulty).toBeGreaterThanOrEqual(1);
      expect(ex.difficulty).toBeLessThanOrEqual(3);
    }
  });
  it('substitute ids resolve', () => {
    for (const ex of CATALOG) {
      for (const sub of ex.substitutes) {
        expect(getExercise(sub), `${ex.id} → ${sub}`).toBeTruthy();
      }
    }
  });
  it('exercise ids are unique', () => {
    const ids = CATALOG.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
