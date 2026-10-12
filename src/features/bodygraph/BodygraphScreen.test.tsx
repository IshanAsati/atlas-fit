// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { BodygraphScreen } from './BodygraphScreen';
import * as db from '../../data/db';
import type { WorkoutSession } from '../../data/types';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const session: WorkoutSession = { id: 'completed', title: 'Workout', location: 'home', state: 'done',
  startedAt: Date.now() - 3600000, endedAt: Date.now(), items: [{ exerciseId: 'push-up', sets: [
    { done: true, reps: 10, loadKg: 0 }, { done: true, reps: 8, loadKg: 0 },
    { done: true, reps: 5, loadKg: 0, kind: 'warmup' },
  ] }] };

describe('BodygraphScreen', () => {
  it('starts with a compact map and collapsed picker, without backup or duplicate history UI', () => {
    render(<BodygraphScreen sessions={[]} />);
    expect(screen.getByRole('button', { name: 'Exercise targets' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText('Push-up')).toBeDefined();
    expect(screen.queryByRole('searchbox')).toBeNull();
    expect(screen.queryByText(/backup/i)).toBeNull();
    expect(screen.queryByText(/history log/i)).toBeNull();
    expect(screen.getByRole('region', { name: /Interactive bodygraph/ })).toBeDefined();
  });

  it('searches and changes the map without calling the detail-modal callback', () => {
    const select = vi.fn();
    render(<BodygraphScreen sessions={[]} onSelectExercise={select} />);
    fireEvent.click(screen.getByRole('button', { name: /Showing targets for/ }));
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'bodyweight squat' } });
    fireEvent.click(screen.getByRole('button', { name: /Bodyweight Squat/ }));
    expect(screen.queryByRole('searchbox')).toBeNull();
    expect(select).not.toHaveBeenCalled();
    expect(document.getElementById('quads')?.getAttribute('fill')).toContain('--muscle-primary');
  });

  it('reports actual sets independently of overlapping target counts and optional supporting estimates', () => {
    render(<BodygraphScreen sessions={[session]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Training activity' }));
    expect(screen.getByText('2 completed working sets in this period')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Last 30 days' })).toBeDefined();
    expect(screen.getByText(/counts overlap/)).toBeDefined();
    expect(screen.queryByText('Supporting estimate')).toBeNull();
    fireEvent.click(screen.getByRole('checkbox'));
    expect(screen.getByText('Supporting estimate')).toBeDefined();
    expect(screen.getByText(/0.5 ×/)).toBeDefined();
  });

  it('does not silently present a database failure as empty history', async () => {
    vi.spyOn(db, 'getWorkoutSessions').mockRejectedValue(new Error('Blocked'));
    render(<BodygraphScreen />);
    fireEvent.click(screen.getByRole('button', { name: 'Training activity' }));
    await waitFor(() => expect(screen.getByRole('alert')).toBeDefined());
    expect(screen.getByRole('button', { name: 'Try again' })).toBeDefined();
    expect(screen.queryByText(/0 completed working sets/)).toBeNull();
  });
});
