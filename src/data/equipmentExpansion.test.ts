import { describe, expect, it } from 'vitest';
import { CATALOG, CATALOG_BY_ID, CURATED_EXERCISES, mapRepdbEquipment } from './catalog';
import { DEFAULT_EQUIPMENT, EQUIPMENT, EQUIPMENT_BY_ID } from './equipment';
import type { Exercise, Movement, UserProfile } from './types';
import { generatePlan } from '../features/planner/engine';
import {
  avoidsEquipment,
  filterEligibleExercises,
  hasRequiredEquipment,
  isExerciseEligible,
} from '../features/planner/validator';

/** Equipment added for abs/core and legs expansion. */
const NEW_EQUIPMENT_IDS = [
  'captains-chair',
  'decline-bench',
  'ab-crunch',
  'stability-ball',
  'smith-machine',
  'hack-squat',
  'ghd',
  'nordic-bench',
  'sled',
  'battle-rope',
  'jump-rope',
  'slam-ball',
  'plyo-box',
  'trap-bar',
  'landmine',
  'sandbag',
  'weight-vest',
  'bosu',
];

/** Core exercises added in the expansion (bodyweight bottleneck fix). */
const NEW_CORE_IDS = [
  'russian-twist',
  'flutter-kick',
  'heel-tap',
  'mountain-climber',
  'bicycle-crunch',
  'v-up',
  'lying-leg-raise',
  'hanging-leg-raise',
  'captains-chair-leg-raise',
  'decline-crunch',
  'stability-ball-crunch',
  'cable-crunch',
  'landmine-rotation',
];

/** Leg exercises added in the expansion. */
const NEW_LEG_IDS = [
  'smith-machine-squat',
  'hack-squat',
  'nordic-curl',
  'ghd-hip-extension',
  'sled-push',
  'trap-bar-deadlift',
  'weight-vest-squat',
  'bosu-squat',
  'sandbag-good-morning',
  'wall-sit',
  'bodyweight-calf-raise',
];

const NEW_EXERCISE_IDS = [...NEW_CORE_IDS, ...NEW_LEG_IDS];

describe('equipment & catalogue expansion', () => {
  it('registers every new equipment id exactly once', () => {
    for (const id of NEW_EQUIPMENT_IDS) {
      expect(EQUIPMENT_BY_ID[id]).toBeDefined();
    }
    const counts = new Map<string, number>();
    for (const eq of EQUIPMENT) {
      counts.set(eq.id, (counts.get(eq.id) ?? 0) + 1);
    }
    for (const id of NEW_EQUIPMENT_IDS) {
      expect(counts.get(id)).toBe(1);
    }
  });

  it('keeps curated exercise ids and names unique', () => {
    const ids = CURATED_EXERCISES.map((e) => e.id);
    const names = CURATED_EXERCISES.map((e) => e.name.toLowerCase());
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(names).size).toBe(names.length);
  });

  it('gives every new exercise valid equipment, muscles and substitutes', () => {
    const equipmentIds = new Set(EQUIPMENT.map((e) => e.id));
    for (const id of NEW_EXERCISE_IDS) {
      const ex = CATALOG_BY_ID[id];
      expect(ex, `exercise ${id} missing`).toBeDefined();
      expect(ex.source).toBe('atlas');
      expect(ex.equipmentIds.length).toBeGreaterThan(0);
      for (const eq of ex.equipmentIds) {
        expect(equipmentIds.has(eq), `${id} references unknown equipment '${eq}'`).toBe(true);
      }
      expect(ex.primary.length).toBeGreaterThan(0);
      for (const sub of ex.substitutes) {
        expect(CATALOG_BY_ID[sub], `${id} substitute '${sub}' unresolved`).toBeDefined();
      }
    }
  });

  it('provides enough bodyweight/mat core options for the travel profile', () => {
    const travelCore = CURATED_EXERCISES.filter(
      (e) =>
        e.movement === 'core' &&
        e.equipmentIds.every((eq) => eq === 'bodyweight' || eq === 'mat'),
    );
    expect(travelCore.length).toBeGreaterThanOrEqual(12);
    const ids = travelCore.map((e) => e.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        'russian-twist',
        'flutter-kick',
        'heel-tap',
        'mountain-climber',
        'bicycle-crunch',
      ]),
    );
  });
});

/* =========================================================================
   Imported RepDB mapping: exact gear, no silent bodyweight fallback
   ========================================================================= */

/** Main-lift slots the planner must fill with real compound patterns. */
const MAIN_PATTERNS: Movement[] = ['squat', 'hinge', 'hpush', 'vpush', 'hpull', 'vpull'];

function profile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    displayName: 'RepDB mapping',
    goal: 'strength',
    experience: 'experienced',
    activeLocation: 'gym',
    equipment: DEFAULT_EQUIPMENT,
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
    ...overrides,
  };
}

function exercise(id: string): Exercise {
  const found = CATALOG_BY_ID[id];
  if (!found) throw new Error(`exercise ${id} missing from the catalog`);
  return found;
}

describe('RepDB equipment mapping requires the exact gear', () => {
  it('maps the Smith machine to a Smith machine, never to barbell + rack', () => {
    const smith = exercise('smith-machine-bench-press');
    expect(smith.equipmentIds).toEqual(['smith-machine', 'bench']);
    expect(smith.equipmentIds).not.toContain('barbell');
    expect(smith.equipmentIds).not.toContain('squat-rack');
    expect(exercise('smith-machine-squat').equipmentIds).toEqual(['smith-machine']);
    expect(mapRepdbEquipment('smith_machine', 'Smith Machine Squat', 'upper_legs')).toEqual([
      'smith-machine',
    ]);
    // A Smith machine is its own station: avoiding a barbell does not avoid it,
    // and avoiding it does not require owning a barbell.
    expect(avoidsEquipment(smith, ['barbell'])).toBe(false);
  });

  it('cannot schedule Smith work without a Smith machine, even with a rack and barbell', () => {
    const gymInventory = DEFAULT_EQUIPMENT.gym;
    expect(gymInventory).toContain('barbell');
    expect(gymInventory).toContain('squat-rack');
    expect(gymInventory).not.toContain('smith-machine');

    const owner = profile();
    for (const id of ['smith-machine-bench-press', 'smith-machine-squat']) {
      expect(hasRequiredEquipment(exercise(id), gymInventory)).toBe(false);
      expect(isExerciseEligible(exercise(id), owner)).toBe(false);
      expect(filterEligibleExercises(CATALOG, owner).some((c) => c.id === id)).toBe(false);
    }

    const plan = generatePlan(owner, CATALOG);
    const planned = plan.days.flatMap((day) => day.exercises.map((item) => item.exerciseId));
    expect(planned.length).toBeGreaterThan(0);
    for (const id of planned) {
      expect(CATALOG_BY_ID[id]?.equipmentIds ?? []).not.toContain('smith-machine');
    }
  });

  it('drops Smith machine work through avoidEquipment even when it is owned', () => {
    const avoidsSmith = profile({
      equipment: {
        ...DEFAULT_EQUIPMENT,
        gym: [...DEFAULT_EQUIPMENT.gym, 'smith-machine'],
      },
      avoidEquipment: ['smith-machine'],
    });
    const smith = exercise('smith-machine-bench-press');
    // Availability and preference stay separate: the gear is owned…
    expect(hasRequiredEquipment(smith, avoidsSmith.equipment.gym)).toBe(true);
    // …and the hard filter still refuses it.
    expect(avoidsEquipment(smith, avoidsSmith.avoidEquipment)).toBe(true);
    expect(isExerciseEligible(smith, avoidsSmith)).toBe(false);
    expect(
      filterEligibleExercises(CATALOG, avoidsSmith).some((c) => c.id === 'smith-machine-bench-press'),
    ).toBe(false);

    const plan = generatePlan(avoidsSmith, CATALOG);
    const planned = plan.days.flatMap((day) => day.exercises.map((item) => item.exerciseId));
    expect(planned.length).toBeGreaterThan(0);
    for (const id of planned) {
      expect(CATALOG_BY_ID[id]?.equipmentIds ?? []).not.toContain('smith-machine');
    }
  });

  it('requires a ball for ball work instead of falling back to a mat', () => {
    const crunch = exercise('stability-ball-crunch');
    expect(crunch.equipmentIds).toEqual(['stability-ball']);
    expect(hasRequiredEquipment(crunch, DEFAULT_EQUIPMENT.gym)).toBe(false);
    expect(hasRequiredEquipment(crunch, ['mat', 'bodyweight'])).toBe(false);
    expect(hasRequiredEquipment(crunch, ['mat', 'stability-ball'])).toBe(true);
    expect(exercise('ball-leg-curl').equipmentIds).toEqual(['stability-ball']);
    expect(exercise('stability-ball-push-up').equipmentIds).toEqual(['stability-ball']);
    expect(mapRepdbEquipment('stability_ball', 'Ball Pike', 'core')).toEqual(['stability-ball']);
  });

  it('requires a sled for sled work', () => {
    expect(exercise('sled-push').equipmentIds).toEqual(['sled']);
    expect(exercise('sled-row').equipmentIds).toEqual(['sled']);
    expect(hasRequiredEquipment(exercise('sled-push'), DEFAULT_EQUIPMENT.gym)).toBe(false);
    expect(hasRequiredEquipment(exercise('sled-push'), ['bodyweight', 'mat'])).toBe(false);
    expect(hasRequiredEquipment(exercise('sled-push'), ['bodyweight', 'mat', 'sled'])).toBe(true);
  });

  it('never passes battle ropes, jump ropes or slam balls off as bodyweight / kettlebells', () => {
    const ropes = exercise('battle-ropes');
    expect(ropes.equipmentIds).toEqual(['battle-rope']);
    expect(ropes.equipmentIds).not.toContain('bodyweight');
    expect(hasRequiredEquipment(ropes, DEFAULT_EQUIPMENT.home)).toBe(false);
    expect(hasRequiredEquipment(ropes, DEFAULT_EQUIPMENT.gym)).toBe(false);
    expect(exercise('battle-rope-double-slam').equipmentIds).toEqual(['battle-rope']);
    expect(exercise('jump-rope').equipmentIds).toEqual(['jump-rope']);
    expect(exercise('medicine-ball-slam').equipmentIds).toEqual(['slam-ball']);
    expect(exercise('machine-seated-crunch').equipmentIds).toEqual(['ab-crunch']);
    expect(exercise('hex-bar-deadlift').equipmentIds).toEqual(['trap-bar']);
    expect(exercise('nordic-hamstring-curl').equipmentIds).toEqual(['ghd']);
    expect(exercise('box-jump').equipmentIds).toEqual(['plyo-box']);
  });

  it('adds the secondary gear named by the exercise itself', () => {
    expect(exercise('band-assisted-pull-ups').equipmentIds).toEqual(['bands', 'pullup-bar']);
    expect(hasRequiredEquipment(exercise('band-assisted-pull-ups'), ['bands'])).toBe(false);
    expect(hasRequiredEquipment(exercise('band-assisted-pull-ups'), ['bands', 'pullup-bar'])).toBe(
      true,
    );
    expect(exercise('chest-supported-db-row').equipmentIds).toEqual(['dumbbells', 'bench']);
    expect(hasRequiredEquipment(exercise('chest-supported-db-row'), ['dumbbells'])).toBe(false);
    expect(mapRepdbEquipment(undefined, "Captain's Chair Leg Raise", 'core')).toEqual([
      'captains-chair',
    ]);
    expect(mapRepdbEquipment(undefined, 'Decline Crunch', 'core')).toEqual(['decline-bench']);
  });

  it('keeps unknown RepDB gear explicit instead of degrading to bodyweight', () => {
    expect(mapRepdbEquipment('gravity_boots', 'Moon Hop', 'legs')).toEqual([
      'repdb:gravity_boots',
    ]);
    // True no-equipment entries stay bodyweight / mat.
    expect(mapRepdbEquipment(undefined, 'Push Up', 'chest')).toEqual(['bodyweight']);
    expect(mapRepdbEquipment(undefined, 'Forearm Plank', 'core')).toEqual(['mat']);
    expect(mapRepdbEquipment('body_weight', 'Bodyweight Squat', 'upper_legs')).toEqual([
      'bodyweight',
    ]);
    // Every catalog entry uses registered gear or states its requirement verbatim.
    for (const ex of CATALOG) {
      for (const eq of ex.equipmentIds) {
        expect(
          eq.startsWith('repdb:') || EQUIPMENT_BY_ID[eq],
          `${ex.id} references unregistered equipment '${eq}'`,
        ).toBeTruthy();
      }
    }
  });
});

/* =========================================================================
   Imported RepDB movement classification
   ========================================================================= */

describe('RepDB movement classification keeps main patterns reliable', () => {
  it('keeps poses, holds and isolation work out of the six strength patterns', () => {
    expect(exercise('clamshells').movement).toBe('accessory');
    expect(exercise('clamshells-hold').movement).toBe('accessory');
    expect(exercise('banded-clamshell').movement).toBe('accessory');
    expect(exercise('bow-pose').movement).toBe('mobility');
    expect(exercise('tree-pose').movement).toBe('mobility');
    expect(exercise('warrior-two').movement).toBe('mobility');
    expect(exercise('dead-hang').movement).toBe('accessory');
    expect(exercise('superman').movement).toBe('accessory');
    expect(MAIN_PATTERNS).not.toContain(exercise('battle-ropes').movement);
    expect(exercise('battle-ropes').movement).toBe('carry');
  });

  it('still recognises real compound patterns as main lifts', () => {
    expect(exercise('box-jump').movement).toBe('squat');
    expect(exercise('plate-loaded-glute-drive').movement).toBe('hinge');
    expect(exercise('machine-back-extension').movement).toBe('hinge');
    expect(exercise('band-assisted-pull-ups').movement).toBe('vpull');
    expect(exercise('smith-machine-bench-press').movement).toBe('hpush');
  });
});
