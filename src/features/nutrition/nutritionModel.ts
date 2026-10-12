import type { NutritionPreferences } from '../../data/types';
import { INDIAN_FOODS } from './indianFoods';
import type { NutritionFood } from './indianFoods';

/** Illustrative editable defaults, not inferred personal measurements. */
export const DEFAULT_NUTRITION_PREFERENCES: NutritionPreferences = {
  diet: 'vegetarian', age: 30, equationSex: 'male', weightKg: 70, heightCm: 170,
  activity: 'light', goal: 'maintain', foodExclusions: [],
};

export const FOOD_EXCLUSION_OPTIONS: Array<{ id: string; label: string }> = [
  { id: 'dairy', label: 'Dairy' }, { id: 'egg', label: 'Eggs' },
  { id: 'wheat', label: 'Wheat' }, { id: 'soy', label: 'Soy' },
  { id: 'peanut', label: 'Peanuts' }, { id: 'nuts', label: 'Tree nuts' },
  { id: 'fish', label: 'Fish' }, { id: 'legumes', label: 'All legumes (including soy and peanuts)' },
  { id: 'chicken', label: 'Chicken' },
];

export interface NutritionTotals { calories: number; proteinG: number; carbsG: number; fatG: number }
export interface NutritionTargets extends NutritionTotals { bmr: number; tdee: number; bmi: number; warnings: string[] }
export interface DietFoodPortion extends NutritionTotals { foodId: string; name: string; portion: string }
export interface DietMeal extends NutritionTotals { name: string; foods: DietFoodPortion[] }
export interface DietDay extends NutritionTotals { label: string; meals: DietMeal[] }
export interface DietPlan { days: DietDay[]; notes: string[] }

const activityFactors = { sedentary: 1.2, light: 1.375, moderate: 1.55, high: 1.725 };
const knownExclusions = new Set(INDIAN_FOODS.flatMap(food => [food.id, ...food.tags]));
const round = (value: number) => Math.round(value * 10) / 10;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const inRange = (value: unknown, min: number, max: number) =>
  typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;

export function validateNutritionPreferences(prefs: unknown): prefs is NutritionPreferences {
  if (!prefs || typeof prefs !== 'object') return false;
  const p = prefs as NutritionPreferences;
  return ['vegetarian', 'eggetarian', 'non-vegetarian'].includes(p.diet)
    && ['female', 'male'].includes(p.equationSex)
    && ['sedentary', 'light', 'moderate', 'high'].includes(p.activity)
    && ['maintain', 'lose', 'gain'].includes(p.goal)
    && inRange(p.age, 18, 100) && inRange(p.weightKg, 30, 300) && inRange(p.heightCm, 120, 230)
    && Array.isArray(p.foodExclusions)
    && p.foodExclusions.every(id => typeof id === 'string' && knownExclusions.has(id));
}

function assertPreferences(prefs: NutritionPreferences): void {
  if (!validateNutritionPreferences(prefs)) {
    throw new Error('Enter valid adult preferences: age 18–100, weight 30–300 kg, height 120–230 cm, and supported diet, equation sex, activity, goal and food exclusions.');
  }
}

export function calculateNutritionTargets(prefs: NutritionPreferences): NutritionTargets {
  assertPreferences(prefs);
  // Mifflin–St Jeor (1990): sex coefficient is an equation input, not gender identity.
  const bmr = 10 * prefs.weightKg + 6.25 * prefs.heightCm - 5 * prefs.age
    + (prefs.equationSex === 'male' ? 5 : -161);
  const tdee = bmr * activityFactors[prefs.activity];
  const adjustment = prefs.goal === 'lose' ? -Math.min(300, tdee * 0.15) : prefs.goal === 'gain' ? 200 : 0;
  const proposed = tdee + adjustment;
  const floor = prefs.equationSex === 'male' ? 1500 : 1200;
  const calories = Math.round(clamp(proposed, floor, 4000));
  const warnings: string[] = [];
  if (proposed < floor) warnings.push(`The estimate is below this general planner's ${floor} kcal adult guardrail; the calorie target has been raised. This is not an individual safety assessment.`);
  if (proposed > 4000) warnings.push('Estimated needs exceed this general planner’s 4,000 kcal range; the target is capped. Seek individual advice rather than treating this cap as your energy need.');
  // Keep a meaningful carbohydrate allowance at low calorie targets / high body weights.
  const desiredProtein = Math.min(200, prefs.weightKg * 1.6);
  const proteinG = Math.round(Math.min(desiredProtein, calories * 0.3 / 4));
  if (proteinG < desiredProtein - 1) warnings.push('Protein was limited to 30% of planned calories to keep a balanced carbohydrate allowance; a weight-based target needs individual review.');
  const fatG = round(calories * 0.25 / 9);
  const carbsG = round((calories - proteinG * 4 - fatG * 9) / 4);
  return { bmr: Math.round(bmr), tdee: Math.round(tdee), calories, proteinG, fatG, carbsG,
    bmi: round(prefs.weightKg / (prefs.heightCm / 100) ** 2), warnings };
}

function seededRandom(seed: string): () => number {
  let state = 2166136261;
  for (let i = 0; i < seed.length; i++) state = Math.imul(state ^ seed.charCodeAt(i), 16777619);
  return () => {
    state += 0x6D2B79F5;
    let value = Math.imul(state ^ state >>> 15, state | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

function totals(items: NutritionTotals[]): NutritionTotals {
  return {
    calories: items.reduce((sum, item) => sum + item.calories, 0),
    proteinG: round(items.reduce((sum, item) => sum + item.proteinG, 0)),
    carbsG: round(items.reduce((sum, item) => sum + item.carbsG, 0)),
    fatG: round(items.reduce((sum, item) => sum + item.fatG, 0)),
  };
}

function portion(food: NutritionFood, calorieBudget: number): DietFoodPortion {
  // Half-serving increments avoid pretending household measures are precise.
  const servings = clamp(Math.round(calorieBudget / food.calories * 2) / 2, 0.5, 3);
  return { foodId: food.id, name: food.name,
    portion: `${servings} × ${food.servingDescription} (approx.)`,
    calories: Math.round(food.calories * servings), proteinG: round(food.proteinG * servings),
    carbsG: round(food.carbsG * servings), fatG: round(food.fatG * servings) };
}

export function generateIndianDietPlan(prefs: NutritionPreferences, seed = 'atlas'): DietPlan {
  const targets = calculateNutritionTargets(prefs);
  const notes = [
    'Offline, approximate household-recipe estimates. Actual nutrition varies with ingredients, oil, brands and preparation; adjust portions to your needs.',
    'General adult meal ideas, not a medical diet. Pregnancy, breastfeeding, eating disorders or medical conditions need qualified professional advice.',
    'Exclusions apply to the listed curated recipes, not cross-contact or every possible local recipe. Check ingredients and labels, especially for allergies.',
    'BMI is an informational calculation, not an ideal-weight recommendation or a diagnosis.',
    ...targets.warnings,
  ];
  const eligible = INDIAN_FOODS.filter(food => food.dietsAllowed.includes(prefs.diet)
    && !prefs.foodExclusions.some(id => food.id === id || food.tags.includes(id)));
  if (!eligible.length) return { days: [], notes: [...notes, 'No foods remain after your exclusions. Change constraints or seek help building an appropriate menu.'] };
  const group = (roles: NutritionFood['role'][]) => eligible.filter(food => roles.includes(food.role));
  const starches = group(['starch']);
  const breakfasts = group(['breakfast', 'starch']);
  const proteins = group(['protein']);
  const vegetables = group(['vegetable']);
  const fruits = group(['fruit']);
  const snacks = group(['snack', 'protein']);
  // Do not silently substitute fruit for all main meals under impossible constraints.
  if (!starches.length || !breakfasts.length || !proteins.length || !vegetables.length || !fruits.length || !snacks.length) {
    return { days: [], notes: [...notes, 'Your exclusions leave too few food groups for a varied four-meal plan. No complete menu was generated; relax constraints or seek individual advice.'] };
  }
  const random = seededRandom(seed);
  const shuffled = (foods: NutritionFood[]) => {
    const result = [...foods];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [result[i], result[j]] = [result[j]!, result[i]!];
    }
    return result;
  };
  const pools = [starches, breakfasts, proteins, vegetables, fruits, snacks].map(shuffled);
  const pick = (pool: number, index: number) => pools[pool]![index % pools[pool]!.length]!;
  const meal = (name: string, selections: Array<[NutritionFood, number]>): DietMeal => {
    const foods = selections.map(([food, budget]) => portion(food, budget));
    return { name, foods, ...totals(foods) };
  };
  const days = Array.from({ length: 7 }, (_, index): DietDay => {
    const calories = targets.calories;
    const meals = [
      meal('Breakfast', [[pick(1, index), calories * 0.16], [pick(2, index * 3), calories * 0.09]]),
      meal('Lunch', [[pick(0, index), calories * 0.13], [pick(2, index * 3 + 1), calories * 0.15], [pick(3, index), calories * 0.07]]),
      meal('Snack', [[pick(4, index), calories * 0.06], [pick(5, index), calories * 0.09]]),
      meal('Dinner', [[pick(0, index + 1), calories * 0.09], [pick(2, index * 3 + 2), calories * 0.11], [pick(3, index + 1), calories * 0.05]]),
    ];
    return { label: `Day ${index + 1}`, meals, ...totals(meals) };
  });
  const energyMisses = days.filter(day => Math.abs(day.calories - targets.calories) > targets.calories * 0.1);
  const proteinMisses = days.filter(day => day.proteinG < targets.proteinG * 0.9);
  if (energyMisses.length) notes.push(`${energyMisses.length} of 7 days differ from the calorie target by more than 10%. Available recipes, exclusions and bounded household portions prevent a closer match; shown totals are the achieved estimates.`);
  if (proteinMisses.length) notes.push(`${proteinMisses.length} of 7 days fall below 90% of the protein target. These menus do not guarantee your protein target; adjust suitable foods or get individual advice.`);
  notes.push('Targets and menu totals are separate estimates, not exact matches. Portions stay between half and three of the described cooked household servings.');
  return { days, notes };
}
