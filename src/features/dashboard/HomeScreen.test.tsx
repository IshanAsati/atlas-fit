// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { HomeScreen } from './HomeScreen';
import * as db from '../../data/db';
import type { UserProfile, Plan, WorkoutSession } from '../../data/types';

const mockProfile: UserProfile = {
  displayName: 'Ishan',
  goal: 'strength',
  experience: 'experienced',
  activeLocation: 'home',
  equipment: {
    home: ['dumbbells', 'pull-up-bar'],
    gym: ['barbell', 'bench', 'squat-rack'],
    travel: ['bodyweight'],
  },
  daysPerWeek: 4,
  durationMin: 45,
  weekdays: ['Mon', 'Tue', 'Thu', 'Fri'],
  restrictions: [],
  discomfortNotes: '',
  otherSports: '',
  liked: [],
  disliked: [],
  pinned: [],
  favourites: [],
  onboarded: true,
};

const mockPlan: Plan = {
  id: 'plan-1',
  createdAt: Date.now(),
  location: 'home',
  split: 'Upper / Lower',
  goal: 'strength',
  experience: 'experienced',
  days: [
    {
      id: 'day-1',
      label: 'Day 1 · Upper Body Power',
      focus: 'Horizontal Push & Pull',
      movementTargets: ['hpush', 'hpull'],
      exercises: [
        { exerciseId: 'push-up', sets: 4, reps: '8-10', restSec: 90, reason: 'Chest and triceps' },
        { exerciseId: 'incline-push-up', sets: 3, reps: '10-12', restSec: 60, reason: 'Chest endurance' },
      ],
    },
    {
      id: 'day-2',
      label: 'Day 2 · Lower Body Power',
      focus: 'Squat & Hinge',
      movementTargets: ['squat', 'hinge'],
      exercises: [
        { exerciseId: 'push-up', sets: 4, reps: '8-10', restSec: 90, reason: 'Foundation' },
      ],
    },
  ],
  explanation: ['Custom plan for Ishan'],
};

describe('HomeScreen Component (§4.2)', () => {
  beforeEach(() => {
    vi.spyOn(db, 'getUserProfile').mockResolvedValue(mockProfile);
    vi.spyOn(db, 'getLatestPlan').mockResolvedValue(mockPlan);
    vi.spyOn(db, 'getWorkoutSessions').mockResolvedValue([]);
    vi.spyOn(db, 'getActiveWorkout').mockResolvedValue(null);
    vi.spyOn(db, 'saveUserProfile').mockResolvedValue();
    vi.spyOn(db, 'savePlan').mockResolvedValue();
    vi.spyOn(db, 'saveActiveWorkout').mockResolvedValue();
    vi.spyOn(db, 'saveWorkoutSession').mockResolvedValue();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders top greeting with user display name and training objective badge', async () => {
    render(<HomeScreen />);

    await waitFor(() => {
      expect(screen.getByText('Hey, Ishan')).toBeDefined();
      expect(screen.getByText('Strength Focus')).toBeDefined();
      expect(screen.getByText(/4 days\/week/)).toBeDefined();
    });
  });

  it('renders Next Workout Hero surface with day info, movements, count, duration, and Start button', async () => {
    const handleStartWorkout = vi.fn();
    render(<HomeScreen onStartWorkout={handleStartWorkout} />);

    await waitFor(() => {
      expect(screen.getByText('Next Workout')).toBeDefined();
      expect(screen.getByText(/Day 1 · Upper Body Power · Horizontal Push & Pull/)).toBeDefined();
      expect(screen.getByText(/2 exercises/)).toBeDefined();
      expect(screen.getByText(/~45 min/)).toBeDefined();
      expect(screen.getByRole('button', { name: /Start Workout/i })).toBeDefined();
    });

    // Click Start Workout
    fireEvent.click(screen.getByRole('button', { name: /Start Workout/i }));
    await waitFor(() => {
      expect(handleStartWorkout).toHaveBeenCalledTimes(1);
    });
    const sessionArg: WorkoutSession = handleStartWorkout.mock.calls[0][0];
    expect(sessionArg.dayId).toBe('day-1');
    expect(sessionArg.items).toHaveLength(2);
  });

  it('allows toggling training location (Home / Gym / Travel)', async () => {
    render(<HomeScreen />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Home' }).getAttribute('aria-pressed')).toBe('true');
    });

    const gymBtn = screen.getByRole('button', { name: 'Gym' });
    fireEvent.click(gymBtn);

    await waitFor(() => {
      expect(db.saveUserProfile).toHaveBeenCalled();
    });
  });

  it('renders 7-Day Activity Strip with Mon through Sun cells', async () => {
    render(<HomeScreen />);

    await waitFor(() => {
      expect(screen.getByText("This Week's Activity")).toBeDefined();
      const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      for (const label of labels) {
        expect(screen.getByText(label)).toBeDefined();
      }
    });
  });

  it('renders Mini Bodygraph Widget with explore button', async () => {
    const handleNavigate = vi.fn();
    render(<HomeScreen onNavigateTab={handleNavigate} />);

    await waitFor(() => {
      expect(screen.getByText('Muscle Recovery & Activity')).toBeDefined();
      expect(screen.getByText(/Training activity estimate based on logged sets/i)).toBeDefined();
      expect(screen.getByRole('button', { name: /Explore Bodygraph/i })).toBeDefined();
    });

    fireEvent.click(screen.getByRole('button', { name: /Explore Bodygraph/i }));
    expect(handleNavigate).toHaveBeenCalledWith('bodygraph');
  });

  it('shows well-designed empty state when 0 workouts are logged', async () => {
    render(<HomeScreen />);

    await waitFor(() => {
      expect(screen.getByText('No logged workouts yet.')).toBeDefined();
      expect(screen.getByText(/Complete your first session to see real activity trends!/i)).toBeDefined();
    });
  });

  it('renders quick action buttons and visible RepDB attribution', async () => {
    const handleNavigate = vi.fn();
    render(<HomeScreen onNavigateTab={handleNavigate} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Adjust Plan/i })).toBeDefined();
      expect(screen.getByRole('button', { name: /Browse Exercise Library/i })).toBeDefined();
      expect(screen.getByText(/Exercise data by/i)).toBeDefined();
      expect(screen.getByRole('link', { name: /RepDB \(repdb\.co\)/i }).getAttribute('href')).toBe('https://repdb.co');
    });

    fireEvent.click(screen.getByRole('button', { name: /Adjust Plan/i }));
    expect(handleNavigate).toHaveBeenCalledWith('plan');

    fireEvent.click(screen.getByRole('button', { name: /Browse Exercise Library/i }));
    expect(handleNavigate).toHaveBeenCalledWith('exercises');
  });
});
