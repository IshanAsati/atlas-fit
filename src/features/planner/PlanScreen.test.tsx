// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { PlanScreen } from './PlanScreen';
import * as db from '../../data/db';
import * as training from '../../data/training';
import * as media from '../../data/media';
import * as engine from './engine';
import type { Plan, PerformedSet, Routine, UserProfile, WorkoutSession } from '../../data/types';

vi.mock('../../data/db', () => ({
  db: { profiles: {}, plans: {}, transaction: vi.fn(async (...args: unknown[]) => (args[args.length - 1] as () => Promise<void>)()) },
  getUserProfile: vi.fn(), getLatestPlan: vi.fn(), getWorkoutSessions: vi.fn(), getActiveWorkout: vi.fn(), getAllFeedback: vi.fn(),
  saveUserProfile: vi.fn(), savePlan: vi.fn(),
}));
vi.mock('../../data/training', async (importOriginal) => ({
  ...await importOriginal<typeof import('../../data/training')>(),
  getRoutines: vi.fn(), saveRoutine: vi.fn(), deleteRoutine: vi.fn(),
}));
vi.mock('../../data/media', () => ({ downloadExerciseMedia: vi.fn() }));
vi.mock('../../data/catalog', () => {
  const defaults = { aliases: [], source: 'atlas', movement: 'hpush', difficulty: 1, primary: ['chest'], secondary: [], instructions: [], cues: [], mistakes: [], substitutes: [] };
  const CATALOG = [
    { ...defaults, id: 'push-up', name: 'Push-up', equipmentIds: ['bodyweight'] },
    { ...defaults, id: 'dumbbell-press', name: 'Dumbbell press', equipmentIds: ['dumbbells'] },
    { ...defaults, id: 'incline-push-up', name: 'Incline push-up', equipmentIds: [] },
    { ...defaults, id: 'restricted', name: 'Restricted press', equipmentIds: [] },
    { ...defaults, id: 'advanced', name: 'Advanced press', equipmentIds: [], difficulty: 3 },
    { ...defaults, id: 'cable-press', name: 'Cable press', equipmentIds: ['cable'] },
    { ...defaults, id: 'chair-press', name: 'Chair press', equipmentIds: ['chair'] },
    { ...defaults, id: 'feedback-press', name: 'Feedback press', equipmentIds: [] },
    { ...defaults, id: 'bench-press', name: 'Bench press', equipmentIds: ['bench'] },
  ];
  return { CATALOG, CATALOG_BY_ID: Object.fromEntries(CATALOG.map((exercise) => [exercise.id, exercise])), getExerciseImageUrl: vi.fn(() => '/exercise.png'), findSubstitutes: vi.fn((id: string) => CATALOG.filter((exercise) => exercise.id !== id)) };
});

const profile: UserProfile = {
  displayName: 'Ishan', goal: 'fitness', experience: 'some', activeLocation: 'home',
  equipment: { home: ['bodyweight', 'dumbbells', 'bench'], gym: ['bodyweight', 'dumbbells', 'bench', 'cable'], travel: ['bodyweight'] },
  daysPerWeek: 2, durationMin: 45, weekdays: ['Mon', 'Fri'], restrictions: ['restricted'], discomfortNotes: '', otherSports: '',
  pinned: ['push-up'], liked: [], disliked: [], favourites: [], onboarded: true,
};
const plan: Plan = {
  id: 'weekly-plan', createdAt: 100, location: 'home', split: 'Full Body (2-Day)', goal: 'fitness', experience: 'some',
  days: [
    { id: 'stable-a', label: 'Workout A', focus: 'Push', movementTargets: ['hpush'], exercises: [
      { exerciseId: 'push-up', sets: 4, reps: '6–8 controlled', restSec: 125, reason: 'Pinned by you.' },
      { exerciseId: 'dumbbell-press', sets: 2, reps: '10–12', restSec: 70, reason: 'Original accessory reason.' },
    ] },
    { id: 'stable-b', label: 'Workout B', focus: 'Push', movementTargets: ['hpush'], exercises: [
      { exerciseId: 'incline-push-up', sets: 3, reps: '8–12', restSec: 90, reason: 'Technique practice.' },
    ] },
  ], explanation: ['Chosen for your available equipment.'],
};
const routine: Routine = { id: 'saved-routine', title: 'My repeat workout', location: 'home', createdAt: 123, updatedAt: 456, exercises: plan.days[0].exercises.map((exercise) => ({ ...exercise })) };
const existingSession: WorkoutSession = { id: 'already-active', title: 'In-progress workout', location: 'gym', startedAt: 500, state: 'active', items: [] };

async function mount(onStartSession = vi.fn()) {
  render(<PlanScreen onStartSession={onStartSession} />);
  await screen.findByRole('heading', { name: 'Your week' });
  return onStartSession;
}
function adjust() { fireEvent.click(screen.getByText('Adjust plan')); }
function savedRoutines() { fireEvent.click(screen.getByRole('button', { name: /^Saved routines/ })); }

describe('PlanScreen schedule and reusable routines', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.getUserProfile).mockResolvedValue(structuredClone(profile));
    vi.mocked(db.getLatestPlan).mockResolvedValue(structuredClone(plan));
    vi.mocked(db.getWorkoutSessions).mockResolvedValue([]);
    vi.mocked(db.getActiveWorkout).mockResolvedValue(null);
    vi.mocked(db.getAllFeedback).mockResolvedValue([{ exerciseId: 'feedback-press', discomfort: true, updatedAt: 100 }]);
    vi.mocked(db.saveUserProfile).mockResolvedValue();
    vi.mocked(db.savePlan).mockResolvedValue();
    vi.mocked(training.getRoutines).mockResolvedValue([structuredClone(routine)]);
    vi.mocked(training.saveRoutine).mockResolvedValue();
    vi.mocked(training.deleteRoutine).mockResolvedValue();
    vi.mocked(media.downloadExerciseMedia).mockResolvedValue({ downloaded: 4, total: 4, failed: 0 });
  });
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });

  it('leads with the preferred schedule and keeps configuration and explanation collapsed', async () => {
    await mount();
    expect(screen.getByRole('heading', { name: 'Full Body (2-Day)' })).toBeDefined();
    expect(screen.getByRole('group', { name: 'Plan details' }).textContent).toContain('2 workouts / week');
    expect(screen.getByRole('group', { name: 'Plan details' }).textContent).toContain('45 min / session');
    expect(screen.getByRole('group', { name: 'Plan details' }).textContent).toContain('Home equipment');
    expect(screen.getByText('2 exercises', { exact: true })).toBeDefined();
    const calendar = screen.getByRole('list', { name: 'Preferred weekly schedule' });
    expect(within(calendar).getAllByRole('listitem')).toHaveLength(7);
    expect(within(calendar).getByRole('link', { name: 'Mon: Workout A' }).getAttribute('href')).toBe('#plan-day-stable-a');
    expect(within(calendar).getByRole('link', { name: 'Fri: Workout B' })).toBeDefined();
    expect(screen.getByText('Adjust plan').closest('details')?.open).toBe(false);
    expect(screen.getByText('Why this plan?').closest('details')?.open).toBe(false);
    expect(db.savePlan).not.toHaveBeenCalled();
    expect(media.downloadExerciseMedia).not.toHaveBeenCalled();
  });

  it('previews a location change without writing preferences or regenerating the saved plan', async () => {
    await mount(); adjust(); fireEvent.click(screen.getByRole('button', { name: 'Travel' }));
    expect(screen.getByRole('heading', { name: 'Change preview' })).toBeDefined();
    expect(screen.getByRole('button', { name: "Adapt today's workout" })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Update weekly plan' })).toBeDefined();
    expect(db.savePlan).not.toHaveBeenCalled(); expect(db.saveUserProfile).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: 'Workout A' })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Discard changes' }));
    expect(screen.queryByRole('heading', { name: 'Change preview' })).toBeNull();
  });

  it('adapts only the session and keeps the saved weekly plan and preferences untouched', async () => {
    const onStart = await mount(); adjust(); fireEvent.click(screen.getByRole('button', { name: 'Travel' }));
    fireEvent.click(screen.getByRole('button', { name: "Adapt today's workout" }));
    await waitFor(() => expect(onStart).toHaveBeenCalledTimes(1));
    const session: WorkoutSession = onStart.mock.calls[0][0];
    expect(session.location).toBe('travel'); expect(session.planId).toBe(plan.id);
    expect(session.items.some((item) => item.exerciseId === 'dumbbell-press')).toBe(false);
    expect(db.savePlan).not.toHaveBeenCalled(); expect(db.saveUserProfile).not.toHaveBeenCalled();
  });

  it('saves settings and a new weekly plan explicitly, passing history and the existing plan for pins', async () => {
    const history: WorkoutSession[] = [{ ...existingSession, id: 'completed', state: 'done', planId: plan.id, dayId: 'stable-a', endedAt: Date.now() }];
    vi.mocked(db.getWorkoutSessions).mockResolvedValue(history);
    const generate = vi.spyOn(engine, 'generatePlan');
    await mount(); adjust(); fireEvent.change(screen.getByLabelText('Workout duration'), { target: { value: '30' } });
    fireEvent.click(screen.getByRole('button', { name: 'Update weekly plan' }));
    await screen.findByText('Weekly plan saved on this device. Completed workouts are unchanged.');
    expect(db.db.transaction).toHaveBeenCalled();
    expect(db.saveUserProfile).toHaveBeenCalledWith(expect.objectContaining({ durationMin: 30 }));
    const saved = vi.mocked(db.savePlan).mock.calls[0][0];
    expect(saved.id).not.toBe(plan.id); expect(saved.days.map((day) => day.id)).toEqual(['stable-a', 'stable-b']);
    expect(saved.days[0].exercises.find((exercise) => exercise.exerciseId === 'push-up')?.sets).toBe(4);
    expect(generate).toHaveBeenLastCalledWith(expect.objectContaining({ durationMin: 30 }), expect.any(Array), history, expect.objectContaining({ existingPlan: plan }));
    expect(history[0].planId).toBe(plan.id); expect(history[0].dayId).toBe('stable-a');
  });

  it('retains the change preview on a save failure and offers a retry without claiming success', async () => {
    vi.mocked(db.savePlan).mockRejectedValueOnce(new Error('Storage full'));
    await mount(); adjust(); fireEvent.click(screen.getByRole('button', { name: 'Travel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Update weekly plan' }));
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', expect.stringContaining('Storage full'));
    expect(screen.queryByText('Weekly plan saved on this device. Completed workouts are unchanged.')).toBeNull();
    expect(screen.getByRole('button', { name: 'Update weekly plan' }).hasAttribute('disabled')).toBe(false);
    expect(screen.getByRole('heading', { name: 'Workout A' })).toBeDefined();
  });

  it('edits days, duration, and preferred weekdays and blocks an incomplete schedule', async () => {
    await mount(); adjust();
    fireEvent.change(screen.getByLabelText('Days per week'), { target: { value: '3' } });
    fireEvent.change(screen.getByLabelText('Workout duration'), { target: { value: '60' } });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Mon' }));
    expect(screen.getByRole('alert').textContent).toContain('Select exactly 3');
    expect(screen.getByRole('button', { name: 'Update weekly plan' }).hasAttribute('disabled')).toBe(true);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Wed' }));
    fireEvent.click(screen.getByRole('button', { name: 'Update weekly plan' }));
    await waitFor(() => expect(db.saveUserProfile).toHaveBeenCalledWith(expect.objectContaining({ daysPerWeek: 3, durationMin: 60, weekdays: ['Tue', 'Wed', 'Fri'] })));
  });

  it('reorders day objects with stable IDs and leaves completed-session history unchanged', async () => {
    const history: WorkoutSession[] = [{ ...existingSession, state: 'done', planId: plan.id, dayId: 'stable-a', endedAt: Date.now() }];
    vi.mocked(db.getWorkoutSessions).mockResolvedValue(history);
    await mount(); fireEvent.click(screen.getByRole('button', { name: 'Move Workout A later' }));
    await screen.findByText('Schedule order saved. Completed history is unchanged.');
    expect(vi.mocked(db.savePlan).mock.calls[0][0].days.map((day) => day.id)).toEqual(['stable-b', 'stable-a']);
    expect(history[0].dayId).toBe('stable-a');
    expect(screen.getByRole('link', { name: 'Fri: Workout A, completed' })).toBeDefined();
  });

  it('rechecks active workout at start and resumes the exact existing session', async () => {
    const onStart = await mount();
    vi.mocked(db.getActiveWorkout).mockResolvedValue(existingSession);
    fireEvent.click(screen.getByRole('button', { name: 'Start next workout' }));
    await waitFor(() => expect(onStart).toHaveBeenCalledWith(existingSession));
    expect(onStart.mock.calls[0][0]).toBe(existingSession);
    expect(screen.getByRole('region', { name: 'Workout in progress' })).toBeDefined();
  });

  it('resumes instead of adapting or starting a routine when a session is already active', async () => {
    vi.mocked(db.getActiveWorkout).mockResolvedValue(existingSession);
    const onStart = await mount(); savedRoutines();
    fireEvent.click(screen.getByRole('button', { name: 'Resume workout instead of My repeat workout' }));
    await waitFor(() => expect(onStart).toHaveBeenCalledWith(existingSession));
    expect(db.savePlan).not.toHaveBeenCalled();
  });

  it('opens a routine draft from a day and saves only after an explicit Save', async () => {
    await mount(); fireEvent.click(screen.getAllByRole('button', { name: 'Save as routine' })[0]);
    expect(screen.getByRole('heading', { name: 'Save workout as a routine' })).toBeDefined();
    expect(screen.getByText('Unsaved changes')).toBeDefined(); expect(training.saveRoutine).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Routine name'), { target: { value: 'My new routine' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save routine' }));
    await screen.findByText('Routine saved on this device.');
    const saved = vi.mocked(training.saveRoutine).mock.calls[0][0];
    expect(saved.title).toBe('My new routine'); expect(saved.exercises).toEqual(plan.days[0].exercises);
    expect(saved.id).not.toBe(plan.id); expect(db.savePlan).not.toHaveBeenCalled();
  });

  it('creates a custom workout from scratch, adds an eligible exercise, and starts it empty', async () => {
    const onStart = await mount();
    savedRoutines();
    fireEvent.click(screen.getByRole('button', { name: 'Create custom workout' }));
    expect(screen.getByRole('heading', { name: 'Create custom workout' })).toBeDefined();
    expect(screen.getByText('Name your workout, then add your first exercise below.')).toBeDefined();
    fireEvent.change(screen.getByLabelText('Routine name'), { target: { value: 'Travel strength' } });
    fireEvent.change(screen.getByLabelText('Add an exercise'), { target: { value: 'push-up' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add exercise' }));
    expect(screen.getByText('Push-up')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Save routine' }));
    await screen.findByText('Routine saved on this device.');
    const saved = vi.mocked(training.saveRoutine).mock.calls[0][0];
    expect(saved.title).toBe('Travel strength');
    expect(saved.location).toBe('home');
    expect(saved.exercises).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Start Travel strength' }));
    await waitFor(() => expect(onStart).toHaveBeenCalledTimes(1));
    const session = onStart.mock.calls[0][0];
    expect(session.title).toBe('Travel strength');
    expect(session.items[0].sets.every((set: PerformedSet) => set.reps === null && set.loadKg === null && !set.done)).toBe(true);
  });

  it('keeps first-time routine guidance out of the open builder', async () => {
    vi.mocked(training.getRoutines).mockResolvedValue([]);
    await mount(); savedRoutines();
    expect(screen.getByText('No saved routines yet')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Create custom workout' }));
    expect(screen.queryByText('No saved routines yet')).toBeNull();
    expect(screen.getByText(/Exercises match your home equipment/)).toBeDefined();
    expect(screen.getByRole('button', { name: 'Save routine' }).hasAttribute('disabled')).toBe(true);
  });

  it('renames, reorders, edits, and removes exercises while preserving unedited metadata', async () => {
    await mount(); savedRoutines(); fireEvent.click(screen.getByRole('button', { name: 'Edit My repeat workout' }));
    fireEvent.change(screen.getByLabelText('Routine name'), { target: { value: 'Renamed routine' } });
    fireEvent.click(screen.getByRole('button', { name: 'Move Push-up down' }));
    fireEvent.change(screen.getByLabelText('Sets for Dumbbell press'), { target: { value: '5' } });
    expect(training.saveRoutine).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Save routine' }));
    await screen.findByText('Routine saved on this device.');
    const saved = vi.mocked(training.saveRoutine).mock.calls[0][0];
    expect(saved.id).toBe(routine.id); expect(saved.createdAt).toBe(routine.createdAt); expect(saved.title).toBe('Renamed routine');
    expect(saved.exercises[0]).toEqual({ ...routine.exercises[1], sets: 5 });
    expect(saved.exercises[1]).toEqual(routine.exercises[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Remove Dumbbell press' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save routine' }));
    await waitFor(() => expect(training.saveRoutine).toHaveBeenCalledTimes(2));
    expect(vi.mocked(training.saveRoutine).mock.calls[1][0].exercises).toEqual([routine.exercises[0]]);
  });

  it('keeps a failed routine save editable and does not show a saved status', async () => {
    vi.mocked(training.saveRoutine).mockRejectedValueOnce(new Error('Routine write failed'));
    await mount(); savedRoutines(); fireEvent.click(screen.getByRole('button', { name: 'Edit My repeat workout' }));
    fireEvent.change(screen.getByLabelText('Routine name'), { target: { value: 'Unsaved name' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save routine' }));
    expect((await screen.findByRole('alert')).textContent).toContain('Routine write failed');
    expect(screen.getByText('Unsaved changes')).toBeDefined();
    expect(screen.queryByText('Routine saved on this device.')).toBeNull();
  });

  it('duplicates a routine with fresh identity and preserves all prescription metadata', async () => {
    await mount(); savedRoutines(); fireEvent.click(screen.getByRole('button', { name: 'Duplicate My repeat workout' }));
    await screen.findByText('Routine duplicated and saved.');
    const duplicate = vi.mocked(training.saveRoutine).mock.calls[0][0];
    expect(duplicate.id).not.toBe(routine.id); expect(duplicate.title).toBe('My repeat workout (copy)');
    expect(duplicate.exercises).toEqual(routine.exercises); expect(routine.title).toBe('My repeat workout');
  });

  it('requires confirmation before deleting and never deletes completed history', async () => {
    await mount(); savedRoutines(); fireEvent.click(screen.getByRole('button', { name: 'Delete My repeat workout' }));
    expect(training.deleteRoutine).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Keep routine' }));
    expect(training.deleteRoutine).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Delete My repeat workout' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm delete routine' }));
    await screen.findByText('Routine deleted. Workout history is unchanged.');
    expect(training.deleteRoutine).toHaveBeenCalledWith(routine.id);
    expect(screen.queryByRole('heading', { name: routine.title })).toBeNull();
    expect(db.savePlan).not.toHaveBeenCalled();
  });

  it('starts a saved routine as a fresh session with preserved prescription metadata', async () => {
    const onStart = await mount(); savedRoutines(); fireEvent.click(screen.getByRole('button', { name: 'Start My repeat workout' }));
    await waitFor(() => expect(onStart).toHaveBeenCalledTimes(1));
    const session: WorkoutSession = onStart.mock.calls[0][0];
    expect(session.title).toBe(routine.title); expect(session.id).not.toBe(routine.id);
    expect(session.items[0].planned).toEqual(routine.exercises[0]); expect(session.items[0].sets).toHaveLength(4);
  });

  it('downloads media only on request and reports partial failures honestly', async () => {
    vi.mocked(media.downloadExerciseMedia).mockResolvedValue({ downloaded: 3, total: 4, failed: 1 });
    await mount(); expect(media.downloadExerciseMedia).not.toHaveBeenCalled();
    fireEvent.click(screen.getAllByRole('button', { name: 'Save offline images' })[0]);
    await screen.findByText(/3 of 4 images available offline\. 1 failed/);
    expect(media.downloadExerciseMedia).toHaveBeenCalledWith(['push-up', 'dumbbell-press'], expect.any(Function));
  });

  it('filters swaps by restrictions, feedback, exact equipment, difficulty, and duplicates', async () => {
    await mount(); fireEvent.click(screen.getByRole('button', { name: 'Swap Push-up in Workout A' }));
    const swap = screen.getByRole('region', { name: 'Swap exercise' });
    expect(within(swap).getByRole('button', { name: /Incline push-up/ })).toBeDefined();
    for (const name of ['Restricted press', 'Advanced press', 'Cable press', 'Chair press', 'Feedback press', 'Dumbbell press']) expect(within(swap).queryByRole('button', { name: new RegExp(name) })).toBeNull();
    fireEvent.change(screen.getByLabelText('Reason for swapping'), { target: { value: 'discomfort' } });
    expect(within(swap).getByText(/Stop if you feel pain/)).toBeDefined();
    fireEvent.click(within(swap).getByRole('button', { name: /Incline push-up/ }));
    await screen.findByText('Exercise swap saved.');
    expect(vi.mocked(db.savePlan).mock.calls[0][0].days[0].exercises[0].reason).toContain('avoiding discomfort');
  });

  it('lets equipment-related swaps exclude unavailable equipment without changing the saved inventory', async () => {
    await mount(); fireEvent.click(screen.getByRole('button', { name: 'Swap Push-up in Workout A' }));
    const swap = screen.getByRole('region', { name: 'Swap exercise' });
    expect(within(swap).getByRole('button', { name: /Bench press/ })).toBeDefined();
    fireEvent.change(screen.getByLabelText('Reason for swapping'), { target: { value: 'equipment' } });
    fireEvent.click(within(swap).getByRole('checkbox', { name: /Bench/i }));
    expect(within(swap).queryByRole('button', { name: /Bench press/ })).toBeNull();
    expect(db.saveUserProfile).not.toHaveBeenCalled();
  });

  it('keeps routine replacements as drafts, preserving sets, reps, and rest until Save', async () => {
    await mount(); savedRoutines(); fireEvent.click(screen.getByRole('button', { name: 'Edit My repeat workout' }));
    fireEvent.click(screen.getByRole('button', { name: 'Replace Push-up' }));
    fireEvent.click(within(screen.getByRole('region', { name: 'Swap exercise' })).getByRole('button', { name: /Incline push-up/ }));
    await screen.findByText('Replacement added to your draft. Save the routine to keep it.');
    expect(training.saveRoutine).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Save routine' }));
    await waitFor(() => expect(training.saveRoutine).toHaveBeenCalled());
    expect(vi.mocked(training.saveRoutine).mock.calls[0][0].exercises[0]).toEqual(expect.objectContaining({ exerciseId: 'incline-push-up', sets: 4, reps: '6–8 controlled', restSec: 125 }));
  });

  it('restores keyboard focus when cancelling a swap with Escape', async () => {
    await mount(); const trigger = screen.getByRole('button', { name: 'Swap Push-up in Workout A' }); fireEvent.click(trigger);
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Swap exercise' }));
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    expect(screen.queryByRole('region', { name: 'Swap exercise' })).toBeNull(); expect(document.activeElement).toBe(trigger);
  });

  it('shows a graceful fallback when an exercise thumbnail cannot load', async () => {
    await mount(); const row = screen.getByRole('heading', { name: 'Workout A' }).closest('section')!;
    fireEvent.error(row.querySelector('img')!);
    expect(within(row).getByText('No image')).toBeDefined();
  });

  it('keeps the weekly plan usable when saved routines fail to load', async () => {
    vi.mocked(training.getRoutines).mockRejectedValueOnce(new Error('Routines unavailable'));
    await mount(); expect(screen.getByRole('button', { name: 'Start next workout' })).toBeDefined(); savedRoutines();
    expect(screen.getByRole('alert').textContent).toContain('Saved routines could not be loaded');
    fireEvent.click(screen.getByRole('button', { name: 'Retry loading routines' }));
    await screen.findByRole('heading', { name: routine.title }); expect(screen.queryByRole('alert')).toBeNull();
  });
});
