import type { NutritionPreferences, TrainingBlockSettings, WorkoutReminderSettings } from './types';

export function isLocalCalendarDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  if (year < 1) return false;
  const date = new Date(0);
  date.setFullYear(year, month - 1, day);
  date.setHours(0, 0, 0, 0);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

export function isTrainingBlockSettings(value: unknown): value is TrainingBlockSettings {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const settings = value as Record<string, unknown>;
  return typeof settings.enabled === 'boolean' && [4, 6, 8].includes(Number(settings.lengthWeeks)) &&
    typeof settings.lengthWeeks === 'number' && isLocalCalendarDate(settings.startDate) && typeof settings.deloadLastWeek === 'boolean';
}

export function isWorkoutReminderSettings(value: unknown): value is WorkoutReminderSettings {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const settings = value as Record<string, unknown>;
  return typeof settings.enabled === 'boolean' && typeof settings.time === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(settings.time);
}

export function isNutritionPreferences(value: unknown): value is NutritionPreferences {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prefs = value as Record<string, unknown>;
  return ['vegetarian','eggetarian','non-vegetarian'].includes(String(prefs.diet)) &&
    typeof prefs.age === 'number' && Number.isInteger(prefs.age) && prefs.age >= 18 && prefs.age <= 100 &&
    ['female','male'].includes(String(prefs.equationSex)) &&
    typeof prefs.weightKg === 'number' && Number.isFinite(prefs.weightKg) && prefs.weightKg >= 30 && prefs.weightKg <= 300 &&
    typeof prefs.heightCm === 'number' && Number.isFinite(prefs.heightCm) && prefs.heightCm >= 120 && prefs.heightCm <= 230 &&
    ['sedentary','light','moderate','high'].includes(String(prefs.activity)) && ['maintain','lose','gain'].includes(String(prefs.goal)) &&
    Array.isArray(prefs.foodExclusions) && prefs.foodExclusions.length <= 30 && prefs.foodExclusions.every((entry) => typeof entry === 'string' && entry.length <= 40) &&
    (prefs.planSeed === undefined || (typeof prefs.planSeed === 'string' && prefs.planSeed.length <= 100));
}
