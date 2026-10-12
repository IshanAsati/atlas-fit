import { describe, expect, it } from 'vitest';
import type { Exercise } from '../../data/types';
import { canonicalLoad, displayLoad } from './workoutHelpers';
import { suggestWarmupSets } from './warmups';

const exercise: Exercise = {
  id: 'db-press', name: 'Dumbbell press', aliases: [], source: 'atlas', equipmentIds: ['dumbbells', 'bench'],
  movement: 'hpush', difficulty: 1, primary: ['chest'], secondary: [], instructions: [], cues: [], mistakes: [], substitutes: [],
};

describe('suggestWarmupSets', () => {
  it('returns ascending 50/70/85% warmups with reps 8/5/3', () => {
    expect(suggestWarmupSets(20, exercise)).toEqual([
      { loadKg: 10, reps: 8, done: false, kind: 'warmup' },
      { loadKg: 14, reps: 5, done: false, kind: 'warmup' },
      { loadKg: 17, reps: 3, done: false, kind: 'warmup' },
    ]);
  });

  it('uses smaller rounded increments for dumbbells than bars', () => {
    expect(suggestWarmupSets(10, exercise).map((set) => set.loadKg)).toEqual([5, 7, 8.5]);
    expect(suggestWarmupSets(20, { ...exercise, equipmentIds: ['barbell'] }).map((set) => set.loadKg))
      .toEqual([10, 13.75, 16.25]);
  });

  it('omits duplicate rounded weights while retaining two useful sets', () => {
    expect(suggestWarmupSets(1.5, exercise)).toEqual([
      { loadKg: 0.5, reps: 8, done: false, kind: 'warmup' },
      { loadKg: 1, reps: 5, done: false, kind: 'warmup' },
    ]);
  });

  it.each([0, -10, NaN, Infinity, -Infinity, 0.1, 0.5, 1])('omits unusable load %s', (load) => {
    expect(suggestWarmupSets(load, exercise)).toEqual([]);
  });

  it.each(['bodyweight', 'bands', 'pullup-bar', 'suspension', 'assisted-pullup', 'unknown', 'bench'])
    ('does not invent weighted warmups for %s equipment', (equipment) => {
      expect(suggestWarmupSets(20, { ...exercise, equipmentIds: [equipment] })).toEqual([]);
    });

  it('does not mistake an assistance stack for external load', () => {
    expect(suggestWarmupSets(20, { ...exercise, equipmentIds: ['assisted-pullup', 'cable'] })).toEqual([]);
  });

  it.each(['mobility', 'carry'] as const)('omits %s exercises', (movement) => {
    expect(suggestWarmupSets(20, { ...exercise, movement })).toEqual([]);
  });

  it.each(['Plank', 'Wall sit', 'Superman hold', 'Isometric curl', 'Dead hang', 'Front lever', 'Back lever', 'Yoga pose'])
    ('omits static exercise %s', (name) => {
      expect(suggestWarmupSets(20, { ...exercise, name })).toEqual([]);
    });

  it('recognizes hold aliases and allows dynamic plank rows', () => {
    expect(suggestWarmupSets(20, { ...exercise, aliases: ['wall-sit hold'] })).toEqual([]);
    expect(suggestWarmupSets(20, { ...exercise, name: 'Plank dumbbell row' })).toHaveLength(3);
  });

  it('rounds pounds in display units but stores kg', () => {
    const sets = suggestWarmupSets(canonicalLoad(40, 'lb'), exercise, 'lb');
    expect(sets.map((set) => displayLoad(set.loadKg!, 'lb'))).toEqual([20, 28, 34]);
    expect(sets[0].loadKg).toBeCloseTo(canonicalLoad(20, 'lb'));
  });

  it('keeps all positive weights strictly below an unrounded working load', () => {
    for (const load of [2, 2.13, 5.5, 20.01, 100, 1000]) {
      for (const unit of ['kg', 'lb'] as const) {
        const sets = suggestWarmupSets(load, exercise, unit);
        expect(sets.length === 0 || sets.length === 2 || sets.length === 3).toBe(true);
        sets.forEach((set, index) => {
          expect(set.loadKg).toBeGreaterThan(0);
          expect(set.loadKg).toBeLessThan(load);
          expect(set.loadKg).toBeGreaterThan(index ? sets[index - 1].loadKg! : 0);
          expect(set.done).toBe(false);
          expect(set.kind).toBe('warmup');
          expect(set).not.toHaveProperty('effort');
        });
      }
    }
  });

  it('returns fresh sets without mutating the exercise or sharing references', () => {
    const before = structuredClone(exercise);
    const first = suggestWarmupSets(20, exercise);
    first[0].done = true;
    expect(suggestWarmupSets(20, exercise)[0].done).toBe(false);
    expect(exercise).toEqual(before);
  });
});
