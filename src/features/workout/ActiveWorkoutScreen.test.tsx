// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { ActiveWorkoutScreen } from './ActiveWorkoutScreen';
import { RestTimer } from './RestTimer';
import type { WorkoutSession } from '../../data/types';
import * as db from '../../data/db';

const mockSession: WorkoutSession = {
  id: 'session-test-1',
  title: 'Upper Body Power',
  location: 'gym',
  startedAt: Date.now() - 60000,
  state: 'active',
  items: [
    {
      exerciseId: 'push-up',
      planned: {
        exerciseId: 'push-up',
        sets: 2,
        reps: '8-10',
        restSec: 60,
        reason: 'Horizontal press compound',
      },
      sets: [
        { loadKg: 20, reps: 10, done: false },
        { loadKg: null, reps: null, done: false },
      ],
    },
  ],
};

afterEach(() => {
  cleanup();
});

describe('RestTimer', () => {
  it('renders rest timer with initial seconds and responds to +30s', () => {
    const onDismiss = vi.fn();
    const { getByText, getByLabelText } = render(
      <RestTimer
        initialSeconds={60}
        isOpen={true}
        onDismiss={onDismiss}
      />
    );

    expect(getByLabelText('Rest timer')).toBeDefined();
    expect(getByText('+30s')).toBeDefined();

    // Tap +30s
    fireEvent.click(getByText('+30s'));
    expect(getByText('90s planned rest')).toBeDefined();

    // Tap skip
    fireEvent.click(getByText('Skip'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});

describe('ActiveWorkoutScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(db, 'getUserProfile').mockResolvedValue(db.DEFAULT_PROFILE);
    vi.spyOn(db, 'getActiveWorkout').mockResolvedValue(null);
    vi.spyOn(db, 'saveActiveWorkout').mockResolvedValue(undefined);
    vi.spyOn(db, 'saveWorkoutSession').mockResolvedValue(undefined);
    vi.spyOn(db, 'clearActiveWorkout').mockResolvedValue(undefined);
    vi.spyOn(db, 'getWorkoutSessions').mockResolvedValue([]);
  });

  it('renders active workout session header, exercises, and set table', async () => {
    const onFinish = vi.fn();
    const onExit = vi.fn();

    render(
      <ActiveWorkoutScreen
        session={mockSession}
        onFinishSession={onFinish}
        onExitSession={onExit}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Upper Body Power')).toBeDefined();
    });
    expect(screen.getByText('📍 gym')).toBeDefined();
    expect(screen.getByText('Push-up')).toBeDefined();
    expect(screen.getByText('1')).toBeDefined();
    expect(screen.getByText('2')).toBeDefined();
    expect(screen.getByText(/2 sets × 8-10/)).toBeDefined();
    expect(screen.getByText('Chest')).toBeDefined();
  });

  it('toggles set done, triggers rest timer, and autosaves', async () => {
    const onFinish = vi.fn();
    const onExit = vi.fn();

    render(
      <ActiveWorkoutScreen
        session={mockSession}
        onFinishSession={onFinish}
        onExitSession={onExit}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Upper Body Power')).toBeDefined();
    });

    const checkButtons = screen.getAllByTitle('Mark set done');
    expect(checkButtons.length).toBeGreaterThan(0);

    // Tap first check button
    fireEvent.click(checkButtons[0]);

    // DB saveActiveWorkout should have been called
    expect(db.saveActiveWorkout).toHaveBeenCalled();

    // Rest timer should appear
    await waitFor(() => {
      expect(screen.getByLabelText('Rest timer')).toBeDefined();
    });
  });

  it('adds and removes a set correctly', async () => {
    const onFinish = vi.fn();
    const onExit = vi.fn();

    render(
      <ActiveWorkoutScreen
        session={mockSession}
        onFinishSession={onFinish}
        onExitSession={onExit}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Upper Body Power')).toBeDefined();
    });

    // Tap + Add Set
    const addSetBtn = screen.getByText('+ Add Set');
    fireEvent.click(addSetBtn);

    // Set 3 should now exist
    await waitFor(() => {
      expect(screen.getByText('3')).toBeDefined();
    });

    // Tap - Remove Set
    const removeSetBtn = screen.getByText('- Remove Set');
    fireEvent.click(removeSetBtn);

    await waitFor(() => {
      expect(screen.queryByText('3')).toBeNull();
    });
  });

  it('opens finish workout modal and completes session', async () => {
    const onFinish = vi.fn();
    const onExit = vi.fn();

    render(
      <ActiveWorkoutScreen
        session={mockSession}
        onFinishSession={onFinish}
        onExitSession={onExit}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Upper Body Power')).toBeDefined();
    });

    // Click "Finish Workout"
    const finishBtn = screen.getByText('Finish Workout');
    fireEvent.click(finishBtn);

    // Modal opens
    await waitFor(() => {
      expect(screen.getByText('Workout Crushed!')).toBeDefined();
    });

    // Click "Save & Finish Session"
    const confirmBtn = screen.getByText('Save & Finish Session');
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(db.saveWorkoutSession).toHaveBeenCalled();
      expect(db.clearActiveWorkout).toHaveBeenCalled();
      expect(onFinish).toHaveBeenCalledTimes(1);
    });
  });
});
