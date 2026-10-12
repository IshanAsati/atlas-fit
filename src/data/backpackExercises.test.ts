import { describe, expect, it } from 'vitest';
import { CATALOG_BY_ID, searchExercises } from './catalog';
import { DEFAULT_EQUIPMENT, EQUIPMENT_BY_ID } from './equipment';

describe('backpack training catalogue', () => {
  it('defines a real planner equipment type and enables it for home and travel', () => {
    expect(EQUIPMENT_BY_ID.backpack?.label).toBe('Loaded backpack');
    expect(DEFAULT_EQUIPMENT.home).toContain('backpack');
    expect(DEFAULT_EQUIPMENT.travel).toContain('backpack');
  });

  it('returns backpack movements when the user has only a backpack', () => {
    const results = searchExercises('', { equipment: ['backpack'] });
    expect(results.map((exercise) => exercise.id)).toEqual(expect.arrayContaining([
      'backpack-front-squat', 'backpack-rdl', 'backpack-row', 'backpack-floor-press', 'backpack-overhead-press',
    ]));
    expect(results.filter((exercise) => exercise.id.startsWith('backpack-')).every((exercise) => exercise.equipmentIds.includes('backpack'))).toBe(true);
  });

  it('keeps instructions and muscle semantics explicit for each movement', () => {
    for (const id of ['backpack-front-squat', 'backpack-rdl', 'backpack-row', 'backpack-floor-press', 'backpack-overhead-press']) {
      const exercise = CATALOG_BY_ID[id];
      expect(exercise).toBeDefined();
      expect(exercise.instructions.length).toBeGreaterThanOrEqual(3);
      expect(exercise.primary.length).toBeGreaterThan(0);
      expect(exercise.secondary.length).toBeGreaterThan(0);
    }
  });
});
