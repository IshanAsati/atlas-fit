// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { OnboardingScreen } from './OnboardingScreen';
import * as db from '../../data/db';

describe('OnboardingScreen', () => {
  let saveUserProfileSpy: any;
  let savePlanSpy: any;

  beforeEach(() => {
    saveUserProfileSpy = vi.spyOn(db, 'saveUserProfile').mockResolvedValue(undefined);
    savePlanSpy = vi.spyOn(db, 'savePlan').mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders Step 1 with display name input and advances to Step 2', async () => {
    const onComplete = vi.fn();
    render(<OnboardingScreen onComplete={onComplete} />);

    expect(screen.getByText('Step 1 of 11')).toBeTruthy();
    expect(screen.getByText('Welcome to Atlas Fit')).toBeTruthy();

    const input = screen.getByLabelText(/Display Name/i) as HTMLInputElement;
    expect(input.value).toBe('Lifter');

    fireEvent.change(input, { target: { value: 'Alex' } });
    expect(input.value).toBe('Alex');

    // Click Continue
    const continueBtn = screen.getByRole('button', { name: 'Continue' });
    fireEvent.click(continueBtn);

    // Should now be on Step 2
    expect(screen.getByText('Step 2 of 11')).toBeTruthy();
    expect(screen.getByText('Main Objective')).toBeTruthy();
  });

  it('allows selecting goals on Step 2 and navigating back', async () => {
    const onComplete = vi.fn();
    render(<OnboardingScreen onComplete={onComplete} />);

    // Advance to Step 2
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByText('Step 2 of 11')).toBeTruthy();

    // Select Mobility & Functional
    const mobilityTile = screen.getByRole('button', { name: /Mobility & Functional/i });
    expect(mobilityTile.getAttribute('aria-pressed')).toBe('false');

    fireEvent.click(mobilityTile);
    expect(mobilityTile.getAttribute('aria-pressed')).toBe('true');

    // Test Back button
    const backBtn = screen.getByRole('button', { name: /Back to previous step/i });
    fireEvent.click(backBtn);
    expect(screen.getByText('Step 1 of 11')).toBeTruthy();
  });

  it('offers a bottom Back button and preserves answers when going back', () => {
    render(<OnboardingScreen onComplete={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/Display Name/i), { target: { value: 'Alex' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.click(screen.getByRole('button', { name: /Mobility & Functional/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Go back one step' }));
    expect((screen.getByLabelText(/Display Name/i) as HTMLInputElement).value).toBe('Alex');
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByRole('button', { name: /Mobility & Functional/i }).getAttribute('aria-pressed')).toBe('true');
    expect(saveUserProfileSpy).not.toHaveBeenCalled();
  });

  it('can leave preference editing from the first step without saving', () => {
    const cancel = vi.fn();
    render(<OnboardingScreen initialProfile={{ ...db.DEFAULT_PROFILE, onboarded: true }} onComplete={vi.fn()} onCancel={cancel} />);
    fireEvent.click(screen.getByRole('button', { name: 'Back to Settings' }));
    expect(cancel).toHaveBeenCalledOnce();
    expect(saveUserProfileSpy).not.toHaveBeenCalled();
    expect(savePlanSpy).not.toHaveBeenCalled();
  });

  it('progresses through all 11 steps and saves profile and plan on completion', async () => {
    const onComplete = vi.fn();
    render(<OnboardingScreen onComplete={onComplete} />);

    // Step 1: Name
    const nameInput = screen.getByLabelText(/Display Name/i);
    fireEvent.change(nameInput, { target: { value: 'Jordan' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    // Step 2: Goal
    expect(screen.getByText('Step 2 of 11')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Strength/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    // Step 3: Experience
    expect(screen.getByText('Step 3 of 11')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Some Experience/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    // Step 4: Where do you train?
    expect(screen.getByText('Step 4 of 11')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Both \(Home & Gym\)/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue to Equipment' }));

    // Step 5: Equipment Inventory
    expect(screen.getByText('Step 5 of 11')).toBeTruthy();
    expect(screen.getByText('Equipment Inventory')).toBeTruthy();

    // Switch between Home and Gym tabs
    const gymTab = screen.getByRole('tab', { name: /Gym Gear/i });
    fireEvent.click(gymTab);
    expect(gymTab.getAttribute('aria-selected')).toBe('true');
    const customEquipment = screen.getByRole('button', { name: /Sultan pai/i });
    expect(customEquipment.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(customEquipment);
    expect(customEquipment.getAttribute('aria-pressed')).toBe('true');

    // Search equipment
    const searchInput = screen.getByPlaceholderText(/Search equipment/i);
    fireEvent.change(searchInput, { target: { value: 'bench' } });

    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    // Step 6: Days per week
    expect(screen.getByText('Step 6 of 11')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /4 Days per week/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    // Step 7: Session length
    expect(screen.getByText('Step 7 of 11')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /45 Minutes/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    // Step 8: Preferred weekdays
    expect(screen.getByText('Step 8 of 11')).toBeTruthy();
    const monChip = screen.getByRole('button', { name: 'Mon' });
    fireEvent.click(monChip); // toggle
    fireEvent.click(monChip); // toggle back
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    // Step 9: Movement comfort & restrictions
    expect(screen.getByText('Step 9 of 11')).toBeTruthy();
    const overheadBtn = screen.getByRole('button', { name: /Overhead pressing/i });
    fireEvent.click(overheadBtn);
    expect(overheadBtn.getAttribute('aria-pressed')).toBe('true');

    const discomfortInput = screen.getByPlaceholderText(/Right shoulder pain/i);
    fireEvent.change(discomfortInput, { target: { value: 'Mild knee ache on deep squats' } });

    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    // Step 10: Other physical activities
    expect(screen.getByText('Step 10 of 11')).toBeTruthy();
    const runningBtn = screen.getByRole('button', { name: /Running/i });
    fireEvent.click(runningBtn);
    expect(runningBtn.getAttribute('aria-pressed')).toBe('true');

    fireEvent.click(screen.getByRole('button', { name: 'Generate Plan Preview →' }));

    // Step 11: Plan Preview
    expect(screen.getByText('Step 11 of 11')).toBeTruthy();
    expect(screen.getByText(/WHY THIS PLAN\?/i)).toBeTruthy();
    expect(screen.getByText(/Adaptive Plan Generated/i)).toBeTruthy();

    // Check Start Training button
    const startTrainingBtn = screen.getByRole('button', { name: /Start Training/i });
    expect(startTrainingBtn).toBeTruthy();

    fireEvent.click(startTrainingBtn);

    await waitFor(() => {
      expect(saveUserProfileSpy).toHaveBeenCalledTimes(1);
      expect(savePlanSpy).toHaveBeenCalledTimes(1);
      expect(onComplete).toHaveBeenCalledTimes(1);
    });

    const savedProfile = saveUserProfileSpy.mock.calls[0][0];
    expect(savedProfile.displayName).toBe('Jordan');
    expect(savedProfile.onboarded).toBe(true);
    expect(savedProfile.goal).toBe('strength');
    expect(savedProfile.daysPerWeek).toBe(4);
    expect(savedProfile.durationMin).toBe(45);
    expect(savedProfile.otherSports).toContain('Running');
    expect(savedProfile.discomfortNotes).toContain('Overhead pressing');
    expect(savedProfile.equipment.gym).toContain('sultan-pai');
  });

  it('supports skipping the movement comfort step on Step 9', async () => {
    const onComplete = vi.fn();
    render(<OnboardingScreen onComplete={onComplete} />);

    // Fast-forward to Step 9
    for (let i = 1; i <= 8; i++) {
      const btn = screen.getAllByRole('button').find((b) =>
        /continue/i.test(b.textContent || '')
      );
      if (btn) fireEvent.click(btn);
    }

    expect(screen.getByText('Step 9 of 11')).toBeTruthy();
    const skipBtn = screen.getByRole('button', { name: /Skip \(No Restrictions\)/i });
    fireEvent.click(skipBtn);

    // Directly advances to Step 10
    expect(screen.getByText('Step 10 of 11')).toBeTruthy();
  });
});
