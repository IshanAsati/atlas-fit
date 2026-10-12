import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { HomeScreen } from './HomeScreen';
import * as storage from '../../data/db';
import type { Plan, WorkoutSession } from '../../data/types';
const plan: Plan = { id: 'plan-1', createdAt: 1, location: 'home', split: 'Full body', goal: 'strength', experience: 'some', explanation: [], days: [{ id: 'day-1', label: 'Full body A', focus: 'Push, pull and legs', movementTargets: [], exercises: [{ exerciseId: 'push-up', sets: 3, reps: '8–12', restSec: 90, reason: 'Push' }] }] };
describe('Today', () => {
  beforeEach(() => {
    vi.spyOn(storage,'getUserProfile').mockResolvedValue({ ...storage.DEFAULT_PROFILE, displayName: 'Ishan', onboarded: true });
    vi.spyOn(storage,'getLatestPlan').mockResolvedValue(plan);
    vi.spyOn(storage,'getWorkoutSessions').mockResolvedValue([]);
    vi.spyOn(storage,'getActiveWorkout').mockResolvedValue(null);
    vi.spyOn(storage,'saveActiveWorkout').mockResolvedValue();
    vi.spyOn(storage,'savePlan').mockResolvedValue();
    vi.spyOn(storage,'saveUserProfile').mockResolvedValue();
  });
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });
  it('renders a useful next workout without fabricated metrics', async () => {
    render(<HomeScreen />);
    expect(await screen.findByRole('heading', { level: 1, name: 'Today' })).toBeTruthy();
    expect(screen.getByText('Full body A')).toBeTruthy();
    expect(screen.getByText('No completed workouts yet')).toBeTruthy();
    expect(screen.queryByText(/Recovery/)).toBeNull();
    expect(storage.saveActiveWorkout).not.toHaveBeenCalled();
  });
  it('creates a session only after explicit start', async () => {
    const start = vi.fn(); render(<HomeScreen onStartWorkout={start} />);
    fireEvent.click(await screen.findByRole('button',{ name: 'Start workout' }));
    expect(start).toHaveBeenCalledTimes(1);
    expect(start.mock.calls[0][0].items[0].sets).toHaveLength(3);
    expect(start.mock.calls[0][0].items[0].sets[0].done).toBe(false);
  });
  it('does not regenerate plans or update profiles while browsing', async () => {
    const navigate = vi.fn(); render(<HomeScreen onNavigateTab={navigate} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Adjust workout' }));
    expect(navigate).toHaveBeenCalledWith('plan');
    expect(storage.savePlan).not.toHaveBeenCalled();
    expect(storage.saveUserProfile).not.toHaveBeenCalled();
  });
  it('counts actual working sets once, not muscle contributions', async () => {
    const session: WorkoutSession = { id: 's', title: 'Logged workout', location: 'home', state: 'done', startedAt: Date.now(), endedAt: Date.now(), items: [
      { exerciseId: 'push-up', sets: [{ loadKg: 0, reps: 10, done: true }, { loadKg: 0, reps: 5, done: true, kind: 'warmup' }] },
      { exerciseId: 'push-up', skipped: true, sets: [{ loadKg: 0, reps: 10, done: true }] },
    ] };
    vi.spyOn(storage,'getWorkoutSessions').mockResolvedValue([session]);
    render(<HomeScreen />);
    expect(await screen.findByText('1 working set logged this week.')).toBeTruthy();
  });
  it('resumes the real existing session', async () => {
    const session: WorkoutSession = { id: 'active', title: 'Existing session', location: 'home', state: 'active', startedAt: Date.now(), items: [] };
    vi.spyOn(storage,'getActiveWorkout').mockResolvedValue(session);
    const start = vi.fn(); render(<HomeScreen onStartWorkout={start} />);
    fireEvent.click(await screen.findByRole('button',{ name: 'Resume workout' }));
    expect(start).toHaveBeenCalledWith(session);
  });
  it('shows all seven days and a reachable settings button', async () => {
    const navigate = vi.fn(); render(<HomeScreen onNavigateTab={navigate} />);
    await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(7));
    fireEvent.click(screen.getByRole('button',{ name: 'Open settings' }));
    expect(navigate).toHaveBeenCalledWith('data');
  });
  it('keeps the page header stable instead of inserting a long display name', async () => {
    vi.mocked(storage.getUserProfile).mockResolvedValue({ ...storage.DEFAULT_PROFILE, displayName: 'A very long display name that should not crowd the header', onboarded: true });
    const navigate = vi.fn();
    render(<HomeScreen onNavigateTab={navigate} />);
    expect(await screen.findByRole('heading', { level: 1, name: 'Today' })).toBeTruthy();
    expect(screen.queryByText(/Hey,/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Open settings' }));
    expect(navigate).toHaveBeenCalledWith('data');
  });
  it('offers a real retry instead of a misleading start button when loading fails', async () => {
    vi.mocked(storage.getUserProfile).mockRejectedValueOnce(new Error('Storage unavailable'));
    render(<HomeScreen />);
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Start workout' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('button', { name: 'Start workout' })).toBeTruthy();
  });
  it('does not invent a duration for an active custom workout', async () => {
    vi.mocked(storage.getActiveWorkout).mockResolvedValue({ id: 'custom', title: 'My workout', location: 'travel', startedAt: Date.now(), state: 'active', items: [{ exerciseId: 'push-up', sets: [] }] });
    render(<HomeScreen />);
    expect(await screen.findByText('Travel')).toBeTruthy();
    expect(screen.getByText('1 exercise')).toBeTruthy();
    expect(screen.queryByText(/About .* min/)).toBeNull();
  });
});
