import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { NutritionScreen } from './NutritionScreen';
import * as storage from '../../data/db';
import type { UserProfile } from '../../data/types';
import { DEFAULT_NUTRITION_PREFERENCES, generateIndianDietPlan } from './nutritionModel';

let profile: UserProfile;

function fillMeasurements(age = '30', weight = '70', height = '170') {
  fireEvent.change(screen.getByLabelText('Age (18 or older)'), { target: { value: age } });
  fireEvent.change(screen.getByLabelText('Weight (kg)'), { target: { value: weight } });
  fireEvent.change(screen.getByLabelText('Height (cm)'), { target: { value: height } });
}

describe('Diet and nutrition screen', () => {
  beforeEach(() => {
    profile = { ...storage.DEFAULT_PROFILE, nutrition: undefined, onboarded: true };
    vi.spyOn(storage, 'getUserProfile').mockImplementation(async () => profile);
    vi.spyOn(storage, 'saveUserProfile').mockImplementation(async (next) => { profile = next; });
  });
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });

  it('starts in settings with blank personal measurements and no invented calculations', async () => {
    render(<NutritionScreen />);
    expect(await screen.findByRole('heading', { name: 'Make it your diet' })).toBeTruthy();
    expect((screen.getByLabelText('Age (18 or older)') as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText('Weight (kg)') as HTMLInputElement).value).toBe('');
    expect(screen.getByText(/editable examples, not facts about you/)).toBeTruthy();
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull();
    expect(storage.saveUserProfile).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Meals' }));
    expect(screen.getByRole('heading', { name: 'Your meals start here' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Calculators' }));
    expect(screen.getByRole('heading', { name: 'Estimates need your details' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Open diet settings' }));
    expect(screen.getByRole('button', { name: 'Diet settings' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('requires explicit personal measurements and rejects under-18 or fractional ages', async () => {
    render(<NutritionScreen />);
    fireEvent.click(await screen.findByRole('button', { name: 'Save & generate diet' }));
    expect(screen.getByRole('alert').textContent).toContain('Enter your age, weight and height');
    fillMeasurements('17');
    fireEvent.click(screen.getByRole('button', { name: 'Save & generate diet' }));
    expect(screen.getByRole('alert').textContent).toContain('18–100 whole years');
    fillMeasurements('30.5');
    fireEvent.click(screen.getByRole('button', { name: 'Save & generate diet' }));
    expect(screen.getByRole('alert').textContent).toContain('18–100 whole years');
    expect(storage.saveUserProfile).not.toHaveBeenCalled();
  });

  it('saves exclusions and merges the latest training and reminder preferences', async () => {
    const updated = vi.fn();
    render(<NutritionScreen onProfileUpdated={updated} />);
    await screen.findByRole('heading', { name: 'Make it your diet' });
    fillMeasurements();
    fireEvent.click(screen.getByText('Food exclusions', { selector: 'summary' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Dairy' }));
    expect(screen.getByText(/not certified allergy safety/)).toBeTruthy();
    profile = { ...profile, targetMuscles: ['quads'], reminders: { enabled: true, time: '19:30' } };
    fireEvent.click(screen.getByRole('button', { name: 'Save & generate diet' }));
    await screen.findByRole('heading', { name: 'Your meal week' });
    expect(profile.nutrition?.foodExclusions).toEqual(['dairy']);
    expect(profile.nutrition?.planSeed).toBeTruthy();
    expect(profile.targetMuscles).toEqual(['quads']);
    expect(profile.reminders).toEqual({ enabled: true, time: '19:30' });
    expect(updated).toHaveBeenCalledWith(profile);
    expect(screen.getByRole('status').textContent).toContain('saved');
  });

  it('shows a single selected day with honest achieved totals and seven navigable days', async () => {
    profile.nutrition = { ...DEFAULT_NUTRITION_PREFERENCES, planSeed: 'test-week' };
    render(<NutritionScreen />);
    await screen.findByRole('heading', { name: 'Your meal week' });
    const daySelect = screen.getByLabelText('Choose a day');
    expect(within(daySelect).getAllByRole('option')).toHaveLength(7);
    expect(screen.getAllByRole('article')).toHaveLength(4);
    expect(screen.getByRole('heading', { name: 'Day 1 totals' })).toBeTruthy();
    expect(screen.getByText(/This menu is .* that estimate/)).toBeTruthy();
    expect(screen.getByText(/Menu difference:/)).toBeTruthy();
    fireEvent.change(daySelect, { target: { value: '6' } });
    expect(screen.getByRole('heading', { name: 'Day 7 totals' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Day 1 totals' })).toBeNull();
    expect(storage.saveUserProfile).not.toHaveBeenCalled();
  });

  it('calculates only from saved values and keeps unsaved edits while changing views', async () => {
    profile.nutrition = { ...DEFAULT_NUTRITION_PREFERENCES };
    render(<NutritionScreen />);
    await screen.findByRole('heading', { name: 'Your meal week' });
    fireEvent.click(screen.getByRole('button', { name: 'Diet settings' }));
    fireEvent.change(screen.getByLabelText('Weight (kg)'), { target: { value: '95' } });
    fireEvent.click(screen.getByRole('button', { name: 'Calculators' }));
    expect(screen.getByRole('heading', { name: 'Daily energy' })).toBeTruthy();
    expect(screen.getByText('30 years · 70 kg · 170 cm')).toBeTruthy();
    expect(screen.getByText(/not a diagnosis, body-fat measurement or ideal-weight recommendation/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Edit diet settings' }));
    expect((screen.getByLabelText('Weight (kg)') as HTMLInputElement).value).toBe('95');
    expect(storage.saveUserProfile).not.toHaveBeenCalled();
  });

  it('does not show calculations for invalid saved adult data', async () => {
    profile.nutrition = { ...DEFAULT_NUTRITION_PREFERENCES, age: 16 };
    render(<NutritionScreen />);
    await screen.findByRole('heading', { name: 'Your meals start here' });
    fireEvent.click(screen.getByRole('button', { name: 'Calculators' }));
    expect(screen.queryByRole('heading', { name: 'Daily energy' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Open diet settings' })).toBeTruthy();
  });

  it('rotates a persisted seed without losing unsaved inputs or unrelated fresh profile changes', async () => {
    const updated = vi.fn();
    profile.nutrition = { ...DEFAULT_NUTRITION_PREFERENCES, planSeed: 'old-seed' };
    const first = render(<NutritionScreen onProfileUpdated={updated} />);
    await screen.findByRole('heading', { name: 'Your meal week' });
    fireEvent.click(screen.getByRole('button', { name: 'Diet settings' }));
    fireEvent.change(screen.getByLabelText('Weight (kg)'), { target: { value: '85' } });
    fireEvent.click(screen.getByRole('button', { name: 'Meals' }));
    profile = { ...profile, discomfortNotes: 'Preserve this fresh update' };
    fireEvent.click(screen.getByRole('button', { name: 'Generate another week' }));
    await screen.findByText('Another week saved. Your workout history is unchanged.');
    expect(profile.nutrition?.planSeed).not.toBe('old-seed');
    expect(profile.nutrition?.weightKg).toBe(70);
    expect(profile.discomfortNotes).toBe('Preserve this fresh update');
    expect(updated).toHaveBeenCalledWith(profile);
    const week = generateIndianDietPlan(profile.nutrition!, profile.nutrition!.planSeed);
    fireEvent.click(screen.getByRole('button', { name: 'Diet settings' }));
    expect((screen.getByLabelText('Weight (kg)') as HTMLInputElement).value).toBe('85');
    first.unmount();
    render(<NutritionScreen />);
    await screen.findByRole('heading', { name: 'Your meal week' });
    for (const food of week.days[0].meals.flatMap((meal) => meal.foods)) {
      expect(screen.getAllByText(food.name).length).toBeGreaterThan(0);
    }
    expect(storage.saveUserProfile).toHaveBeenCalledTimes(1);
  });

  it('keeps the old week and does not notify the parent if saving another week fails', async () => {
    const updated = vi.fn();
    profile.nutrition = { ...DEFAULT_NUTRITION_PREFERENCES, planSeed: 'old-seed' };
    vi.mocked(storage.saveUserProfile).mockRejectedValueOnce(new Error('Storage full'));
    render(<NutritionScreen onProfileUpdated={updated} />);
    await screen.findByRole('heading', { name: 'Your meal week' });
    const before = screen.getAllByRole('article').map((article) => article.textContent);
    fireEvent.click(screen.getByRole('button', { name: 'Generate another week' }));
    expect((await screen.findByRole('alert')).textContent).toContain('Your previous week is unchanged');
    expect(screen.getAllByRole('article').map((article) => article.textContent)).toEqual(before);
    expect(profile.nutrition.planSeed).toBe('old-seed');
    expect(updated).not.toHaveBeenCalled();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('retains user-entered settings without claiming success when saving fails', async () => {
    vi.mocked(storage.saveUserProfile).mockRejectedValueOnce(new Error('Storage full'));
    const updated = vi.fn();
    render(<NutritionScreen onProfileUpdated={updated} />);
    await screen.findByRole('heading', { name: 'Make it your diet' });
    fillMeasurements();
    fireEvent.click(screen.getByRole('button', { name: 'Save & generate diet' }));
    expect((await screen.findByRole('alert')).textContent).toContain('Could not save your diet settings');
    expect((screen.getByLabelText('Weight (kg)') as HTMLInputElement).value).toBe('70');
    expect(updated).not.toHaveBeenCalled();
    expect(profile.nutrition).toBeUndefined();
    expect(screen.queryByRole('status')).toBeNull();
    await waitFor(() => expect((screen.getByRole('button', { name: 'Save & generate diet' }) as HTMLButtonElement).disabled).toBe(false));
  });

  it('explains impossible exclusions rather than displaying a false complete week', async () => {
    profile.nutrition = { ...DEFAULT_NUTRITION_PREFERENCES, foodExclusions: ['dairy', 'legumes', 'egg', 'chicken', 'fish'] };
    render(<NutritionScreen />);
    expect(await screen.findByRole('heading', { name: 'No complete menu available' })).toBeTruthy();
    expect(screen.queryByLabelText('Choose a day')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Generate another week' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Review food exclusions' }));
    expect(screen.getByRole('heading', { name: 'Make it your diet' })).toBeTruthy();
  });

  it('offers retry on a failed profile read without saving anything', async () => {
    vi.mocked(storage.getUserProfile).mockRejectedValueOnce(new Error('Unavailable'));
    render(<NutritionScreen />);
    expect((await screen.findByRole('alert')).textContent).toContain('Nothing has been changed');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('heading', { name: 'Make it your diet' })).toBeTruthy();
    expect(storage.saveUserProfile).not.toHaveBeenCalled();
  });
});
