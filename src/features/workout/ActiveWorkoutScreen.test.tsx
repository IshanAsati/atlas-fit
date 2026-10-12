// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { ActiveWorkoutScreen } from './ActiveWorkoutScreen';
import { RestTimer } from './RestTimer';
import type { WorkoutSession } from '../../data/types';
import * as db from '../../data/db';
import * as training from '../../data/training';
import * as catalog from '../../data/catalog';

const mockSession: WorkoutSession = {
  id: 'session-test-1', title: 'Upper Body Power', location: 'gym', startedAt: Date.now() - 60000, state: 'active',
  items: [{ exerciseId: 'push-up', planned: { exerciseId: 'push-up', sets: 2, reps: '8-10', restSec: 60, reason: 'Horizontal press compound' },
    sets: [{ loadKg: 20, reps: 10, done: false }, { loadKg: null, reps: null, done: false }] }],
};

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('RestTimer', () => {
  it('renders the countdown, adds rest, and dismisses', () => {
    const onDismiss = vi.fn();
    render(<RestTimer initialSeconds={60} isOpen onDismiss={onDismiss} />);
    expect(screen.getByLabelText('Rest timer')).toBeDefined();
    fireEvent.click(screen.getByText('+30s'));
    expect(screen.getByText('90s planned rest')).toBeDefined();
    fireEvent.click(screen.getByText('Skip'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});

describe('ActiveWorkoutScreen', () => {
  beforeEach(() => {
    vi.spyOn(db, 'getUserProfile').mockResolvedValue({ ...db.DEFAULT_PROFILE, weightUnit: 'kg' });
    vi.spyOn(db, 'getActiveWorkout').mockResolvedValue(null);
    vi.spyOn(db, 'saveActiveWorkout').mockResolvedValue(undefined);
    vi.spyOn(db, 'saveUserProfile').mockResolvedValue(undefined);
    vi.spyOn(db, 'saveWorkoutSession').mockResolvedValue(undefined);
    vi.spyOn(db, 'clearActiveWorkout').mockResolvedValue(undefined);
    vi.spyOn(db, 'finishSession').mockResolvedValue(undefined);
    vi.spyOn(db, 'getWorkoutSessions').mockResolvedValue([]);
    vi.spyOn(training, 'saveRoutineFromSession').mockResolvedValue({ id: 'routine-test', title: 'Upper Body Power', location: 'gym', createdAt: 1, updatedAt: 1, exercises: [] });
  });

  async function open(session: WorkoutSession | undefined = mockSession) {
    const onFinish = vi.fn();
    const onExit = vi.fn();
    render(<ActiveWorkoutScreen session={session} onFinishSession={onFinish} onExitSession={onExit} />);
    await waitFor(() => expect(screen.queryByText('Loading your workout…')).toBeNull());
    return { onFinish, onExit };
  }

  it('does not silently create or save a session when none exists', async () => {
    const onExit = vi.fn();
    render(<ActiveWorkoutScreen onFinishSession={vi.fn()} onExitSession={onExit} />);
    await screen.findByText('No workout in progress');
    expect(db.saveActiveWorkout).not.toHaveBeenCalled();
    expect(db.saveWorkoutSession).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Back to training'));
    expect(onExit).toHaveBeenCalledOnce();
  });

  it('renders exercise targets and accessible set fields', async () => {
    await open();
    expect(screen.getByText('Upper Body Power')).toBeDefined();
    expect(screen.getByText('Gym')).toBeDefined();
    expect(screen.getByText('Push-up')).toBeDefined();
    expect(screen.getByText(/2 sets × 8-10/)).toBeDefined();
    expect(screen.getByText('Chest')).toBeDefined();
    expect(screen.getByLabelText('Push-up set 1 load kg')).toBeDefined();
    expect(screen.getByLabelText('Push-up set 2 reps')).toBeDefined();
  });

  it('applies a historical suggestion only to empty unmarked working rows', async () => {
    const planned = { exerciseId: 'db-row', sets: 2, reps: '8–12', restSec: 90, reason: '' };
    vi.mocked(db.getWorkoutSessions).mockResolvedValue([{ ...mockSession, id: 'history', state: 'done', startedAt: 1,
      items: [{ exerciseId: 'db-row', planned, sets: [{ loadKg: 20, reps: 10, done: true, effort: 2 }, { loadKg: 20, reps: 10, done: true, effort: 2 }] }] }]);
    await open({ ...mockSession, items: [{ exerciseId: 'db-row', planned,
      sets: [{ loadKg: 5, reps: 8, done: false }, { loadKg: null, reps: null, done: false }] }] });
    const name = catalog.CATALOG_BY_ID['db-row'].name;
    fireEvent.click(screen.getByText('Suggested targets & warm-ups'));
    fireEvent.click(screen.getByRole('button', { name: 'Use suggested target' }));
    expect((screen.getByLabelText(`${name} set 1 load kg`) as HTMLInputElement).value).toBe('5');
    expect((screen.getByLabelText(`${name} set 2 load kg`) as HTMLInputElement).value).toBe('20');
    expect((screen.getByLabelText(`${name} set 2 reps`) as HTMLInputElement).value).toBe('11');
    expect(screen.getByRole('button', { name: `Complete ${name} set 2` }).getAttribute('aria-pressed')).toBe('false');
  });

  it('adds unmarked warmups before existing working sets without duplicating them', async () => {
    await open({ ...mockSession, items: [{ exerciseId: 'db-row', planned: { exerciseId: 'db-row', sets: 2, reps: '8–12', restSec: 90, reason: '' },
      sets: [{ loadKg: 20, reps: 8, done: false }, { loadKg: null, reps: null, done: false }] }] });
    fireEvent.click(screen.getByText('Suggested targets & warm-ups'));
    fireEvent.click(screen.getByRole('button', { name: 'Add warm-up sets' }));
    await waitFor(() => {
      const saved = vi.mocked(db.saveActiveWorkout).mock.calls.at(-1)?.[0];
      expect(saved?.items[0].sets).toHaveLength(5);
      expect(saved?.items[0].sets.slice(0, 3).every((set) => set.kind === 'warmup' && !set.done)).toBe(true);
      expect(saved?.items[0].sets[3]).toMatchObject({ loadKg: 20, reps: 8, done: false });
    });
    expect((screen.getByRole('button', { name: 'Add warm-up sets' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('uses readable movement names while preserving the filter ids', async () => {
    await open();
    fireEvent.click(screen.getByRole('button', { name: 'Add exercise' }));
    expect(screen.getByRole('option', { name: 'Horizontal push' }).getAttribute('value')).toBe('hpush');
    fireEvent.change(screen.getByLabelText('Movement'), { target: { value: 'hpush' } });
    expect((screen.getByLabelText('Movement') as HTMLSelectElement).value).toBe('hpush');
    expect(screen.queryByRole('option', { name: 'hpush' })).toBeNull();
  });

  it('excludes avoided equipment from add-exercise suggestions', async () => {
    vi.mocked(db.getUserProfile).mockResolvedValue({ ...db.DEFAULT_PROFILE, avoidEquipment: ['barbell', 'smith-machine'] });
    const base = catalog.CATALOG_BY_ID['push-up'];
    vi.spyOn(catalog, 'searchExercises').mockReturnValue([
      { ...base, id: 'allowed', name: 'Allowed dumbbell movement', equipmentIds: ['dumbbells'] },
      { ...base, id: 'barred', name: 'Avoided barbell movement', equipmentIds: ['barbell'] },
      { ...base, id: 'smith', name: 'Avoided Smith movement', equipmentIds: ['smith-machine'] },
    ]);
    await open();
    fireEvent.click(screen.getByRole('button', { name: 'Add exercise' }));
    expect(screen.getByRole('button', { name: /Allowed dumbbell movement/ })).toBeDefined();
    expect(screen.queryByRole('button', { name: /Avoided barbell movement/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Avoided Smith movement/ })).toBeNull();
  });

  it('defaults to a single focused exercise and provides overview navigation', async () => {
    await open({ ...mockSession, items: [...mockSession.items, { exerciseId: 'bodyweight-squat', sets: [{ loadKg: null, reps: null, done: false }] }] });
    expect(screen.queryByRole('heading', { name: 'Bodyweight Squat' })).toBeNull();
    fireEvent.click(screen.getByText('Workout overview'));
    fireEvent.click(screen.getByRole('button', { name: /Bodyweight Squat/ }));
    expect(screen.getByRole('heading', { name: 'Bodyweight Squat' })).toBeDefined();
    expect(screen.queryByRole('heading', { name: 'Push-up' })).toBeNull();
  });

  it('marks a real set complete, opens rest, and autosaves', async () => {
    await open();
    fireEvent.click(screen.getAllByTitle('Mark set done')[0]);
    await screen.findByLabelText('Rest timer');
    await waitFor(() => expect(db.saveActiveWorkout).toHaveBeenLastCalledWith(expect.objectContaining({ items: [expect.objectContaining({ sets: [expect.objectContaining({ done: true }), expect.anything()] })] })));
  });

  it('leaves an incomplete set unmarked instead of inventing performance', async () => {
    await open();
    fireEvent.click(screen.getAllByTitle('Mark set done')[1]);
    expect(screen.getByRole('alert').textContent).toContain('Enter reps');
    expect(screen.getByRole('button', { name: 'Complete Push-up set 2' }).getAttribute('aria-pressed')).toBe('false');
    expect(screen.queryByLabelText('Rest timer')).toBeNull();
  });

  it('copies the last real set without copying completion or effort', async () => {
    await open({ ...mockSession, items: [{ ...mockSession.items[0], sets: [{ loadKg: 22.5, reps: 8, done: true, effort: 3 }, mockSession.items[0].sets[1]] }] });
    fireEvent.click(screen.getByLabelText('Options for Push-up set 2'));
    fireEvent.click(screen.getByLabelText('Copy last set into Push-up set 2'));
    expect((screen.getByLabelText('Push-up set 2 load kg') as HTMLInputElement).value).toBe('22.5');
    expect((screen.getByLabelText('Push-up set 2 reps') as HTMLInputElement).value).toBe('8');
    expect(screen.getByRole('button', { name: 'Complete Push-up set 2' }).getAttribute('aria-pressed')).toBe('false');
    await waitFor(() => expect(db.saveActiveWorkout).toHaveBeenLastCalledWith(expect.objectContaining({ items: [expect.objectContaining({ sets: [expect.anything(), expect.objectContaining({ reps: 8, loadKg: 22.5, done: false, effort: undefined })] })] })));
  });

  it('shows and copies real historical performance', async () => {
    vi.mocked(db.getWorkoutSessions).mockResolvedValue([{ ...mockSession, id: 'past', state: 'done', startedAt: 1, items: [{ ...mockSession.items[0], sets: [{ loadKg: 25, reps: 12, done: true }] }] }]);
    await open();
    expect(screen.getByText('25 kg × 12')).toBeDefined();
    fireEvent.click(screen.getByLabelText('Copy last set into Push-up set 1'));
    expect((screen.getByLabelText('Push-up set 1 load kg') as HTMLInputElement).value).toBe('25');
    expect((screen.getByLabelText('Push-up set 1 reps') as HTMLInputElement).value).toBe('12');
  });

  it('persists pounds as a display preference while preserving canonical kg', async () => {
    await open();
    fireEvent.change(screen.getByLabelText('Load unit'), { target: { value: 'lb' } });
    expect((screen.getByLabelText('Push-up set 1 load lb') as HTMLInputElement).value).toBe('44.09');
    fireEvent.change(screen.getByLabelText('Push-up set 1 load lb'), { target: { value: '100' } });
    await waitFor(() => expect(db.saveUserProfile).toHaveBeenCalledWith(expect.objectContaining({ weightUnit: 'lb' })));
    await waitFor(() => {
      const saved = vi.mocked(db.saveActiveWorkout).mock.calls.at(-1)?.[0];
      expect(saved?.items[0].sets[0].loadKg).toBeCloseTo(45.3592, 4);
    });
  });

  it('excludes warm-ups and skipped exercises from working progress', async () => {
    await open({ ...mockSession, items: [{ ...mockSession.items[0], sets: [{ loadKg: 10, reps: 10, done: true, kind: 'warmup' }, { loadKg: 20, reps: 8, done: true }] }, { exerciseId: 'bodyweight-squat', skipped: true, sets: [{ loadKg: 30, reps: 10, done: true }] }] });
    expect(screen.getByText('1 / 1 working sets completed')).toBeDefined();
    fireEvent.change(screen.getByLabelText('Push-up set 2 type'), { target: { value: 'warmup' } });
    expect(screen.getByText('0 / 0 working sets completed')).toBeDefined();
  });

  it('adds empty unmarked sets and removes the final set', async () => {
    await open();
    fireEvent.click(screen.getByText('Add set'));
    expect((screen.getByLabelText('Push-up set 3 load kg') as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText('Push-up set 3 reps') as HTMLInputElement).value).toBe('');
    fireEvent.click(screen.getByText('Remove last set'));
    expect(screen.queryByLabelText('Push-up set 3 reps')).toBeNull();
  });

  it('persists pause timestamps and restores a paused workout', async () => {
    vi.mocked(db.getActiveWorkout).mockResolvedValue({ ...mockSession, startedAt: 1000, pausedAt: 11000, pausedMs: 2000 });
    await open();
    expect(screen.getByRole('button', { name: 'Resume workout timer' }).textContent).toContain('0:08');
    fireEvent.click(screen.getByRole('button', { name: 'Resume workout timer' }));
    await waitFor(() => expect(db.saveActiveWorkout).toHaveBeenLastCalledWith(expect.objectContaining({ pausedAt: undefined, pausedMs: expect.any(Number) })));
    fireEvent.click(screen.getByRole('button', { name: 'Pause workout timer' }));
    await waitFor(() => expect(db.saveActiveWorkout).toHaveBeenLastCalledWith(expect.objectContaining({ pausedAt: expect.any(Number) })));
  });

  it('has accessible start/end image controls and an honest error fallback', async () => {
    vi.spyOn(catalog, 'getExerciseImageUrl').mockImplementation((_exercise, pose) => `/test-${pose}.webp`);
    await open();
    fireEvent.click(screen.getByText('Illustrations & form guidance'));
    expect(screen.getByAltText('Push-up, start position')).toBeDefined();
    fireEvent.click(screen.getByText('End position'));
    fireEvent.error(screen.getByAltText('Push-up, end position'));
    expect(screen.getByText('Illustration unavailable')).toBeDefined();
    expect(screen.getByText(/This image could not load/)).toBeDefined();
    fireEvent.click(screen.getByText('Start position'));
    expect(screen.getByAltText('Push-up, start position')).toBeDefined();
  });

  it('reports failed saves and supports retrying without losing typed values', async () => {
    await open();
    await screen.findByText('Saved on device');
    vi.mocked(db.saveActiveWorkout).mockRejectedValueOnce(new Error('disk failure'));
    fireEvent.change(screen.getByLabelText('Push-up set 1 reps'), { target: { value: '9' } });
    await screen.findByText('Not saved');
    expect((screen.getByLabelText('Push-up set 1 reps') as HTMLInputElement).value).toBe('9');
    fireEvent.click(screen.getByText('Retry'));
    await screen.findByText('Saved on device');
  });

  it('serializes saves and drains them before clearing the active session', async () => {
    await open();
    await screen.findByText('Saved on device');
    let release!: () => void;
    vi.mocked(db.saveActiveWorkout).mockImplementationOnce(() => new Promise<void>((resolve) => { release = resolve; }));
    fireEvent.change(screen.getByLabelText('Push-up set 1 reps'), { target: { value: '9' } });
    await waitFor(() => expect(release).toBeDefined());
    fireEvent.change(screen.getByLabelText('Push-up set 1 reps'), { target: { value: '8' } });
    expect(db.saveActiveWorkout).toHaveBeenCalledTimes(2); // initial save and first edit only
    fireEvent.click(screen.getByText('Finish workout'));
    fireEvent.click(screen.getByText('Save workout'));
    expect(db.finishSession).not.toHaveBeenCalled();
    await act(async () => { release(); });
    await screen.findByText('Workout saved');
    expect(db.finishSession).toHaveBeenCalledWith(expect.objectContaining({ state: 'done', items: [expect.objectContaining({ sets: [expect.objectContaining({ reps: 8, done: false }), expect.anything()] })] }));
    expect(db.finishSession).toHaveBeenCalledOnce();
    const calls = vi.mocked(db.saveActiveWorkout).mock.invocationCallOrder;
    expect(calls[calls.length - 1]).toBeLessThan(vi.mocked(db.finishSession).mock.invocationCallOrder[0]);
  });

  it('does not hide a failed unit preference write after a successful session save', async () => {
    await open();
    await screen.findByText('Saved on device');
    vi.mocked(db.saveUserProfile).mockRejectedValueOnce(new Error('profile failure'));
    fireEvent.change(screen.getByLabelText('Load unit'), { target: { value: 'lb' } });
    fireEvent.change(screen.getByLabelText('Push-up set 1 reps'), { target: { value: '9' } });
    await screen.findByText('Not saved');
    fireEvent.click(screen.getByText('Retry'));
    await screen.findByText('Saved on device');
    expect(db.saveUserProfile).toHaveBeenLastCalledWith(expect.objectContaining({ weightUnit: 'lb' }));
  });

  it('keeps the paused session open if saving fails on exit', async () => {
    const { onExit } = await open();
    await screen.findByText('Saved on device');
    vi.mocked(db.saveActiveWorkout).mockRejectedValueOnce(new Error('disk failure'));
    fireEvent.click(screen.getByText('Save & exit'));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('before leaving'));
    expect(onExit).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Resume workout timer' })).toBeDefined();
    fireEvent.click(screen.getByText('Save & exit'));
    await waitFor(() => expect(onExit).toHaveBeenCalledOnce());
  });

  it('filters substitutions by restrictions, experience, and unavailable equipment', async () => {
    const original = catalog.CATALOG_BY_ID['db-floor-press'];
    const beginner = catalog.CATALOG_BY_ID['push-up'];
    const restricted = catalog.CATALOG_BY_ID['incline-push-up'];
    const tooHard = catalog.CATALOG_BY_ID['pike-push-up'];
    vi.spyOn(catalog, 'findSubstitutes').mockReturnValue([beginner, restricted, tooHard, original]);
    vi.mocked(db.getUserProfile).mockResolvedValue({ ...db.DEFAULT_PROFILE, experience: 'new', restrictions: [restricted.id], disliked: [], equipment: { ...db.DEFAULT_PROFILE.equipment, gym: ['dumbbells'] } });
    await open({ ...mockSession, items: [{ exerciseId: original.id, sets: [{ loadKg: null, reps: null, done: false }] }] });
    fireEvent.click(screen.getByText('Swap exercise'));
    expect(screen.getByRole('dialog').textContent).toContain('Push-up');
    expect(screen.queryByRole('button', { name: /Incline Push-up/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Pike Push-up/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Dumbbell Floor Press/ })).toBeNull();
    expect(catalog.findSubstitutes).toHaveBeenLastCalledWith(original.id, []);
    fireEvent.change(screen.getByLabelText('Why swap?'), { target: { value: 'Prefer another' } });
    expect(catalog.findSubstitutes).toHaveBeenLastCalledWith(original.id, ['dumbbells']);
  });

  it('preserves completed sets on the original exercise when swapping', async () => {
    vi.spyOn(catalog, 'findSubstitutes').mockReturnValue([catalog.CATALOG_BY_ID['bodyweight-squat']]);
    await open({ ...mockSession, items: [{ ...mockSession.items[0], sets: [{ loadKg: 20, reps: 10, done: true }, mockSession.items[0].sets[1]] }] });
    fireEvent.click(screen.getByText('Swap exercise'));
    fireEvent.click(screen.getByRole('button', { name: /Bodyweight Squat/ }));
    expect(screen.getByRole('heading', { name: 'Bodyweight Squat' })).toBeDefined();
    expect((screen.getByLabelText('Bodyweight Squat set 1 reps') as HTMLInputElement).value).toBe('');
    await waitFor(() => {
      const saved = vi.mocked(db.saveActiveWorkout).mock.calls.at(-1)?.[0];
      expect(saved?.items[0].exerciseId).toBe('push-up');
      expect(saved?.items[0].sets).toEqual([{ loadKg: 20, reps: 10, done: true }]);
      expect(saved?.items[1].sets[0].done).toBe(false);
    });
  });

  it('shows actual completion and saves a routine before returning to training', async () => {
    const { onFinish } = await open();
    fireEvent.click(screen.getAllByTitle('Mark set done')[0]);
    fireEvent.click(screen.getByText('Finish workout'));
    fireEvent.click(screen.getByText('Save workout'));
    await screen.findByText('Workout saved');
    expect(screen.getByText(/Working set 1: 20 kg × 10/)).toBeDefined();
    expect(screen.getByText('Unfinished sets left unmarked.')).toBeDefined();
    expect(onFinish).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Routine name'), { target: { value: 'My push day' } });
    fireEvent.click(screen.getByText('Save as routine'));
    await screen.findByText('Routine saved');
    expect(training.saveRoutineFromSession).toHaveBeenCalledWith(expect.objectContaining({ state: 'done' }), 'My push day');
    fireEvent.click(screen.getByText('Back to Today'));
    expect(onFinish).toHaveBeenCalledOnce();
  });

  it('does not clear a session or call finish when history saving fails', async () => {
    vi.mocked(db.finishSession).mockRejectedValueOnce(new Error('disk failure'));
    const { onFinish } = await open();
    fireEvent.click(screen.getByText('Finish workout'));
    fireEvent.click(screen.getByText('Save workout'));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Workout could not be finished'));
    expect(db.clearActiveWorkout).not.toHaveBeenCalled();
    expect(onFinish).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Save workout'));
    await screen.findByText('Workout saved');
  });
});
