// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import * as db from '../../data/db';
import type { WorkoutSession } from '../../data/types';
import { ProgressScreen } from './ProgressScreen';

const now = new Date();
const firstDate = new Date(now.getFullYear(), now.getMonth(), 4, 10).getTime();
const secondDate = new Date(now.getFullYear(), now.getMonth(), 8, 10).getTime();
const sessions: WorkoutSession[] = [{ id: 'first', title: 'First workout', location: 'gym', startedAt: firstDate, endedAt: firstDate + 1800000, state: 'done',
  items: [{ exerciseId: 'push-up', sets: [
    { done: true, reps: 6, loadKg: 20 }, { done: true, reps: 8, loadKg: 20 },
    { done: true, reps: 4, loadKg: 50, kind: 'warmup' }, { done: false, reps: 5, loadKg: 60 },
  ] }] }, { id: 'second', title: 'Second workout', location: 'home', startedAt: secondDate, state: 'done',
  items: [{ exerciseId: 'push-up', sets: [{ done: true, reps: 15, loadKg: 0 }] }] },
  { id: 'active', title: 'Unfinished workout', location: 'home', startedAt: Date.now(), state: 'active', items: [] }];

beforeEach(() => {
  vi.spyOn(db, 'getWorkoutSessions').mockResolvedValue(sessions);
  vi.spyOn(db, 'getUserProfile').mockResolvedValue(db.DEFAULT_PROFILE);
  vi.spyOn(db, 'getAllFeedback').mockResolvedValue([]);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('ProgressScreen', () => {
  it('shows completed sessions only, expands actual detail, and passes the original session to Repeat', async () => {
    const repeat = vi.fn();
    render(<ProgressScreen onRepeatSession={repeat} />);
    await screen.findByText('First workout');
    expect(screen.queryByText('Unfinished workout')).toBeNull();
    expect(screen.getByText(/2 working sets/)).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: /First workout/ }));
    expect(screen.getByText(/excluded from working sets/)).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Repeat workout' }));
    expect(repeat).toHaveBeenCalledWith(sessions[0]);
  });

  it('filters calendar days by local completed-session dates and clears the filter', async () => {
    render(<ProgressScreen />);
    await screen.findByText('First workout');
    const dayLabel = `${new Date(firstDate).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}, 1 completed workout`;
    fireEvent.click(screen.getByRole('button', { name: dayLabel }));
    expect(screen.queryByText('Second workout')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Show all' }));
    expect(screen.getByText('Second workout')).toBeDefined();
  });

  it('shows truthful per-exercise PR and working-set history', async () => {
    render(<ProgressScreen />);
    await screen.findByText('First workout');
    fireEvent.click(screen.getByRole('button', { name: 'Strength' }));
    expect(screen.getByText('20 kg')).toBeDefined();
    expect(screen.getByText('× 8 reps')).toBeDefined();
    expect(screen.queryByText(/50 kg/)).toBeNull();
    expect(screen.queryByText(/60 kg/)).toBeNull();
    expect(screen.getByText(/Not an estimated one-rep max/)).toBeDefined();
    expect(screen.getByText('15 reps · no added load')).toBeDefined();
  });
  it('uses the saved display unit without converting canonical records', async () => {
    vi.mocked(db.getUserProfile).mockResolvedValue({ ...db.DEFAULT_PROFILE, weightUnit: 'lb' });
    render(<ProgressScreen />);
    await screen.findByText('First workout');
    fireEvent.click(screen.getByRole('button', { name: 'Strength' }));
    await screen.findByText('44.09 lb');
    expect(screen.getByText('6 reps · 44.09 lb')).toBeDefined();
    expect(sessions[0].items[0].sets[0].loadKg).toBe(20);
  });

  it('wraps the muscle screen without reloading sessions or opening exercise details from its picker', async () => {
    const select = vi.fn();
    render(<ProgressScreen onSelectExercise={select} />);
    await screen.findByText('First workout');
    fireEvent.click(screen.getByRole('button', { name: 'Muscles' }));
    fireEvent.click(screen.getByRole('button', { name: /Showing targets for/ }));
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'bodyweight squat' } });
    fireEvent.click(screen.getByRole('button', { name: /Bodyweight Squat/ }));
    expect(select).not.toHaveBeenCalled();
    expect(db.getWorkoutSessions).toHaveBeenCalledTimes(1);
  });

  it('distinguishes honest empty history from load failures', async () => {
    vi.mocked(db.getWorkoutSessions).mockResolvedValue([]);
    const { unmount } = render(<ProgressScreen />);
    await screen.findByText('Your history starts with a workout');
    fireEvent.click(screen.getByRole('button', { name: 'Strength' }));
    expect(screen.getByText('Strength comes from your logged sets')).toBeDefined();
    unmount();
    vi.mocked(db.getWorkoutSessions).mockRejectedValue(new Error('Blocked'));
    render(<ProgressScreen />);
    await waitFor(() => expect(screen.getByRole('alert')).toBeDefined());
    expect(screen.queryByText('Your history starts with a workout')).toBeNull();
  });
});
