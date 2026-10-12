import type { NutritionPreferences } from '../../data/types';

export interface NutritionFood {
  id: string;
  name: string;
  dietsAllowed: NutritionPreferences['diet'][];
  /** Includes ingredients in the curated recipe, not just its main ingredient. */
  tags: string[];
  servingDescription: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  role: 'starch' | 'breakfast' | 'protein' | 'vegetable' | 'fruit' | 'snack';
}

const all: NutritionPreferences['diet'][] = ['vegetarian', 'eggetarian', 'non-vegetarian'];
const eggs: NutritionPreferences['diet'][] = ['eggetarian', 'non-vegetarian'];
const meat: NutritionPreferences['diet'][] = ['non-vegetarian'];

// Hand-curated, rounded household-recipe estimates, not laboratory analysis.
// Cooked weights include water; spices and modest cooking oil are included.
// These are illustrative recipes: oil, brands, preparation and serving sizes vary.
// Tags describe these recipes only; they cannot certify allergen-free preparation.
function food(
  id: string, name: string, role: NutritionFood['role'], servingDescription: string,
  calories: number, proteinG: number, carbsG: number, fatG: number,
  tags: string[], dietsAllowed = all,
): NutritionFood {
  return { id, name, role, servingDescription, calories, proteinG, carbsG, fatG, tags, dietsAllowed };
}

export const INDIAN_FOODS: NutritionFood[] = [
  food('roti', 'Whole-wheat roti', 'starch', '1 medium roti (about 40 g cooked)', 110, 3, 20, 2, ['wheat']),
  food('rice', 'Steamed rice', 'starch', '1 cup cooked rice (about 150 g)', 195, 4, 42, 0.5, ['rice']),
  food('millet', 'Cooked millet', 'starch', '1 cup cooked millet (about 170 g)', 205, 6, 41, 2, ['millet']),
  food('poha', 'Vegetable poha (without peanuts)', 'breakfast', '1 bowl (about 180 g cooked)', 250, 5, 45, 6, ['rice', 'vegetables']),
  food('idli', 'Idli', 'breakfast', '3 medium idlis (about 150 g cooked)', 210, 7, 42, 1.5, ['rice', 'legumes']),
  food('upma', 'Vegetable upma', 'breakfast', '1 bowl (about 180 g cooked)', 250, 7, 40, 7, ['wheat', 'vegetables']),
  food('dosa', 'Plain dosa', 'breakfast', '1 medium dosa (about 100 g cooked)', 180, 4, 29, 5, ['rice', 'legumes']),
  food('oats', 'Savory vegetable oats', 'breakfast', '1 bowl (about 200 g cooked)', 220, 7, 34, 6, ['oats', 'vegetables']),
  food('besan-chilla', 'Besan vegetable chilla', 'breakfast', '2 small chillas (about 150 g cooked)', 240, 12, 30, 8, ['legumes', 'vegetables']),
  food('dal', 'Moong dal', 'protein', '1 cup cooked dal (about 200 g)', 210, 13, 30, 5, ['legumes']),
  food('chana', 'Chana masala', 'protein', '1 cup cooked chana (about 180 g)', 270, 13, 40, 7, ['legumes']),
  food('rajma', 'Rajma curry', 'protein', '1 cup cooked rajma (about 180 g)', 240, 13, 35, 6, ['legumes']),
  food('sambar', 'Vegetable sambar', 'protein', '1 cup (about 200 g cooked)', 150, 7, 23, 4, ['legumes', 'vegetables']),
  food('dahi', 'Plain dahi', 'protein', '1 bowl (about 200 g)', 125, 8, 10, 6, ['dairy']),
  food('strained-curd', 'Plain strained curd', 'protein', '1 small bowl (about 150 g)', 135, 15, 8, 5, ['dairy']),
  food('paneer', 'Paneer bhurji', 'protein', '1 small bowl (about 100 g paneer with vegetables)', 300, 19, 9, 21, ['dairy', 'vegetables']),
  food('tofu', 'Tofu bhurji', 'protein', '1 bowl (about 150 g tofu with vegetables)', 185, 18, 9, 9, ['soy', 'legumes', 'vegetables']),
  food('soy-chunks', 'Soya chunk curry', 'protein', '1 bowl (about 150 g cooked)', 210, 22, 18, 6, ['soy', 'legumes', 'vegetables']),
  food('eggs', 'Boiled eggs', 'protein', '2 large eggs (about 100 g edible portion)', 145, 13, 1, 10, ['egg'], eggs),
  food('egg-bhurji', 'Egg bhurji', 'protein', '2 eggs with vegetables (about 150 g cooked)', 210, 14, 6, 14, ['egg', 'vegetables'], eggs),
  food('chicken', 'Grilled chicken with Indian spices', 'protein', '1 palm-sized portion (about 100 g cooked)', 180, 30, 1, 6, ['chicken'], meat),
  food('fish', 'Pan-cooked fish with Indian spices', 'protein', '1 palm-sized portion (about 100 g cooked)', 180, 24, 2, 8, ['fish'], meat),
  food('mixed-veg', 'Mixed vegetable sabzi', 'vegetable', '1 cup cooked vegetables (about 150 g)', 120, 3, 16, 5, ['vegetables']),
  food('bhindi', 'Bhindi sabzi', 'vegetable', '1 cup cooked bhindi (about 150 g)', 110, 3, 12, 5, ['vegetables']),
  food('palak', 'Garlic palak (without cream)', 'vegetable', '1 cup cooked spinach (about 150 g)', 95, 4, 9, 5, ['vegetables']),
  food('salad', 'Cucumber and tomato salad', 'vegetable', '1 bowl (about 150 g)', 40, 2, 8, 0, ['vegetables']),
  food('banana', 'Banana', 'fruit', '1 medium banana (about 100 g edible portion)', 90, 1, 23, 0, ['fruit']),
  food('apple', 'Apple', 'fruit', '1 medium apple (about 150 g edible portion)', 80, 0, 21, 0, ['fruit']),
  food('guava', 'Guava', 'fruit', '1 medium guava (about 150 g edible portion)', 100, 4, 21, 1, ['fruit']),
  food('roasted-chana', 'Roasted chana', 'snack', '1 small handful (about 30 g)', 120, 6, 18, 2, ['legumes']),
  food('peanuts', 'Roasted peanuts', 'snack', '1 small handful (about 25 g)', 145, 6, 4, 12, ['peanut', 'legumes']),
  food('almonds', 'Almonds', 'snack', '1 small handful (about 20 g)', 115, 4, 4, 10, ['nuts']),
  food('milk', 'Plain milk', 'protein', '1 glass (about 200 ml)', 120, 7, 10, 6, ['dairy']),
  food('makhana', 'Lightly roasted makhana', 'snack', '1 bowl (about 25 g with a little oil)', 110, 3, 19, 3, ['lotus-seed']),
];
