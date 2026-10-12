import { describe, expect, it } from 'vitest';
import type { NutritionPreferences } from '../../data/types';
import { INDIAN_FOODS } from './indianFoods';
import {
  calculateNutritionTargets, DEFAULT_NUTRITION_PREFERENCES, FOOD_EXCLUSION_OPTIONS,
  generateIndianDietPlan, validateNutritionPreferences,
} from './nutritionModel';
import type { NutritionTotals } from './nutritionModel';

const prefs = (changes: Partial<NutritionPreferences> = {}): NutritionPreferences => ({
  ...DEFAULT_NUTRITION_PREFERENCES, foodExclusions: [], ...changes,
});

describe('adult nutrition estimates', () => {
  it('provides editable illustrative defaults', () => {
    expect(DEFAULT_NUTRITION_PREFERENCES).toMatchObject({ age: 30, weightKg: 70, heightCm: 170,
      diet: 'vegetarian', activity: 'light', goal: 'maintain' });
    expect(validateNutritionPreferences(DEFAULT_NUTRITION_PREFERENCES)).toBe(true);
  });

  it('validates numeric boundaries and rejects malformed runtime inputs', () => {
    expect(validateNutritionPreferences(prefs({ age: 18, weightKg: 30, heightCm: 120 }))).toBe(true);
    expect(validateNutritionPreferences(prefs({ age: 100, weightKg: 300, heightCm: 230 }))).toBe(true);
    for (const invalid of [null, {}, prefs({ age: 17 }), prefs({ age: 101 }),
      prefs({ weightKg: 29 }), prefs({ weightKg: 301 }), prefs({ heightCm: 119 }),
      prefs({ heightCm: 231 }), prefs({ weightKg: NaN }), prefs({ heightCm: Infinity }),
      { ...prefs(), equationSex: 'other' }, { ...prefs(), diet: 'vegan' },
      { ...prefs(), activity: 'extreme' }, { ...prefs(), goal: 'cut' },
      { ...prefs(), foodExclusions: null }, prefs({ foodExclusions: ['unsupported-allergen'] })]) {
      expect(validateNutritionPreferences(invalid)).toBe(false);
    }
    expect(() => calculateNutritionTargets(prefs({ age: 17 }))).toThrow('adult');
    expect(() => generateIndianDietPlan(prefs({ age: 17 }))).toThrow('adult');
  });

  it('uses the explicit Mifflin sex coefficient and all activity multipliers', () => {
    expect(calculateNutritionTargets(prefs()).bmr).toBe(1618);
    expect(calculateNutritionTargets(prefs({ equationSex: 'female' })).bmr).toBe(1452);
    const exactBmr = 1617.5;
    for (const [activity, factor] of Object.entries({ sedentary: 1.2, light: 1.375, moderate: 1.55, high: 1.725 })) {
      expect(calculateNutritionTargets(prefs({ activity: activity as NutritionPreferences['activity'] })).tdee)
        .toBe(Math.round(exactBmr * factor));
    }
    expect(calculateNutritionTargets(prefs()).bmi).toBe(24.2);
  });

  it('uses modest goal adjustments, not an aggressive deficit', () => {
    const maintenance = calculateNutritionTargets(prefs());
    expect(calculateNutritionTargets(prefs({ goal: 'lose' })).calories).toBe(maintenance.calories - 300);
    expect(calculateNutritionTargets(prefs({ goal: 'gain' })).calories).toBe(maintenance.calories + 200);
    const lower = prefs({ equationSex: 'female', weightKg: 50, heightCm: 160, activity: 'light', goal: 'lose' });
    const bmr = 10 * 50 + 6.25 * 160 - 5 * 30 - 161;
    expect(calculateNutritionTargets(lower).calories).toBe(Math.round(bmr * 1.375 * 0.85));
  });

  it('enforces adult calorie guardrails and clearly reports clamping', () => {
    for (const equationSex of ['male', 'female'] as const) {
      const target = calculateNutritionTargets(prefs({ equationSex, age: 100, weightKg: 30, heightCm: 120, activity: 'sedentary', goal: 'lose' }));
      expect(target.calories).toBe(equationSex === 'male' ? 1500 : 1200);
      expect(target.warnings.join(' ')).toContain('guardrail');
    }
    const high = calculateNutritionTargets(prefs({ weightKg: 300, heightCm: 230, age: 18, activity: 'high', goal: 'gain' }));
    expect(high.calories).toBe(4000);
    expect(high.warnings.join(' ')).toContain('capped');
  });

  it('keeps macro targets meaningful and consistent at all boundary combinations', () => {
    for (const equationSex of ['male', 'female'] as const) {
      for (const weightKg of [30, 70, 300]) {
        for (const heightCm of [120, 170, 230]) {
          for (const age of [18, 30, 100]) {
            const target = calculateNutritionTargets(prefs({ equationSex, weightKg, heightCm, age }));
            expect(target.proteinG).toBeLessThanOrEqual(200);
            expect(target.proteinG).toBeGreaterThan(0);
            expect(target.fatG).toBeGreaterThan(0);
            expect(target.carbsG).toBeGreaterThanOrEqual(100);
            expect(Math.abs(target.proteinG * 4 + target.carbsG * 4 + target.fatG * 9 - target.calories)).toBeLessThan(1);
          }
        }
      }
    }
    expect(calculateNutritionTargets(prefs()).proteinG).toBe(112);
  });
});

function expectTotals(total: NutritionTotals, items: NutritionTotals[]) {
  for (const key of ['calories', 'proteinG', 'fatG', 'carbsG'] as const) {
    expect(total[key]).toBeCloseTo(items.reduce((sum, item) => sum + item[key], 0), 7);
  }
}

describe('offline Indian menus', () => {
  it('has a bounded curated catalog with all diet classifications', () => {
    expect(INDIAN_FOODS.length).toBeGreaterThanOrEqual(20);
    expect(INDIAN_FOODS.length).toBeLessThanOrEqual(35);
    expect(new Set(INDIAN_FOODS.map(food => food.id)).size).toBe(INDIAN_FOODS.length);
    for (const food of INDIAN_FOODS) {
      expect(food.servingDescription.length).toBeGreaterThan(0);
      if (food.tags.some(tag => ['egg', 'chicken', 'fish'].includes(tag))) {
        expect(food.dietsAllowed).not.toContain('vegetarian');
      }
      if (food.tags.some(tag => ['chicken', 'fish'].includes(tag))) {
        expect(food.dietsAllowed).not.toContain('eggetarian');
      }
    }
  });

  it.each(['vegetarian', 'eggetarian', 'non-vegetarian'] as const)('respects %s across every day and food', diet => {
    const plan = generateIndianDietPlan(prefs({ diet }));
    expect(plan.days).toHaveLength(7);
    const seenTags = new Set<string>();
    for (const day of plan.days) {
      expect(day.meals.map(meal => meal.name)).toEqual(['Breakfast', 'Lunch', 'Snack', 'Dinner']);
      for (const meal of day.meals) {
        expect(meal.foods.length).toBeGreaterThan(0);
        for (const item of meal.foods) {
          const food = INDIAN_FOODS.find(food => food.id === item.foodId)!;
          expect(food.dietsAllowed).toContain(diet);
          food.tags.forEach(tag => seenTags.add(tag));
        }
      }
    }
    expect(seenTags.has('dairy')).toBe(true);
    if (diet !== 'vegetarian') expect(seenTags.has('egg')).toBe(true);
    if (diet === 'non-vegetarian') expect(seenTags.has('chicken') || seenTags.has('fish')).toBe(true);
  });

  it('hard-filters every exclusion, including ingredients of composite recipes', () => {
    const exclusions = FOOD_EXCLUSION_OPTIONS.map(option => option.id);
    // Test every combination, including highly restrictive / impossible menus.
    for (let mask = 0; mask < 2 ** exclusions.length; mask++) {
      const foodExclusions = exclusions.filter((_, index) => mask & 1 << index);
      const plan = generateIndianDietPlan(prefs({ diet: 'non-vegetarian', foodExclusions }));
      for (const day of plan.days) {
        for (const meal of day.meals) {
          for (const item of meal.foods) {
            const source = INDIAN_FOODS.find(food => food.id === item.foodId)!;
            expect(source.tags.some(tag => foodExclusions.includes(tag))).toBe(false);
          }
        }
      }
      if (!plan.days.length) expect(plan.notes.join(' ')).toMatch(/No complete menu|No foods remain/);
    }
  });

  it('honestly reports impossible plans and supports excluding individual foods', () => {
    const impossible = generateIndianDietPlan(prefs({ foodExclusions: INDIAN_FOODS.map(food => food.id) }));
    expect(impossible.days).toEqual([]);
    expect(impossible.notes.join(' ')).toContain('No foods remain');
    const noRice = generateIndianDietPlan(prefs({ foodExclusions: ['rice'] }));
    for (const day of noRice.days) for (const meal of day.meals) {
      expect(meal.foods.some(food => ['rice', 'poha', 'idli', 'dosa'].includes(food.foodId))).toBe(false);
    }
    const noProtein = generateIndianDietPlan(prefs({ foodExclusions: ['dairy', 'legumes'] }));
    expect(noProtein.days).toEqual([]);
    expect(noProtein.notes.join(' ')).toContain('No complete menu');
  });

  it('reports achieved sums rather than assigning target totals to the menu', () => {
    const input = prefs({ foodExclusions: ['dairy', 'soy'] });
    const plan = generateIndianDietPlan(input);
    const targets = calculateNutritionTargets(input);
    expect(plan.days).toHaveLength(7);
    for (const day of plan.days) {
      expectTotals(day, day.meals);
      for (const meal of day.meals) {
        expectTotals(meal, meal.foods);
        for (const item of meal.foods) {
          const servings = Number(item.portion.split(' ')[0]);
          const food = INDIAN_FOODS.find(food => food.id === item.foodId)!;
          expect(servings).toBeGreaterThanOrEqual(0.5);
          expect(servings).toBeLessThanOrEqual(3);
          expect(item.portion).toContain('approx.');
          expect(item.calories).toBe(Math.round(food.calories * servings));
        }
      }
    }
    expect(plan.days.some(day => day.calories !== targets.calories)).toBe(true);
    if (plan.days.some(day => day.proteinG < targets.proteinG * 0.9)) {
      expect(plan.notes.join(' ')).toContain('below 90%');
    }
    if (plan.days.some(day => Math.abs(day.calories - targets.calories) > targets.calories * 0.1)) {
      expect(plan.notes.join(' ')).toContain('more than 10%');
    }
  });

  it('is seed-deterministic, varied and does not mutate preferences or catalog', () => {
    const input = prefs({ foodExclusions: ['peanut'] });
    const before = JSON.stringify(input);
    const catalogBefore = JSON.stringify(INDIAN_FOODS);
    const first = generateIndianDietPlan(input, 'repeatable');
    expect(generateIndianDietPlan(input, 'repeatable')).toEqual(first);
    expect(generateIndianDietPlan(input, 'different')).not.toEqual(first);
    expect(new Set(first.days.map(day => JSON.stringify(day.meals))).size).toBeGreaterThanOrEqual(3);
    expect(JSON.stringify(input)).toBe(before);
    expect(JSON.stringify(INDIAN_FOODS)).toBe(catalogBefore);
    expect(first.notes.join(' ')).toMatch(/Pregnancy/);
    expect(first.notes.join(' ')).toContain('cross-contact');
  });
});
