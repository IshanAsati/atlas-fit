import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Exercise, ExerciseFeedback, LocationType, Plan, PlanDay, PlannedExercise, Routine, UserProfile, WorkoutSession } from '../../data/types';
import { db, getActiveWorkout, getAllFeedback, getLatestPlan, getUserProfile, getWorkoutSessions, savePlan, saveUserProfile } from '../../data/db';
import { CATALOG, CATALOG_BY_ID, findSubstitutes, getExerciseImageUrl } from '../../data/catalog';
import { deleteRoutine, getRoutines, routineFromDay, saveRoutine, sessionFromRoutine } from '../../data/training';
import { downloadExerciseMedia } from '../../data/media';
import { EQUIPMENT_BY_ID } from '../../data/equipment';
import { generatePlan, swapExerciseInPlan } from './engine';
import { isExerciseEligible } from './validator';
import { TrainingBlockControls } from './TrainingBlockSettings';
import { getTrainingBlockPhase } from './trainingBlocks';
import { isTrainingBlockSettings } from '../../data/trainingSettings';
import './PlanScreen.css';

interface PlanScreenProps {
  onStartSession: (session: WorkoutSession) => void;
  onSelectExercise?: (exerciseId: string) => void;
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const LOCATIONS: LocationType[] = ['home', 'gym', 'travel'];
const locationLabel = (location: LocationType) => location[0].toUpperCase() + location.slice(1);
const exerciseName = (id: string) => CATALOG_BY_ID[id]?.name ?? id;
const copyRoutine = (routine: Routine): Routine => ({ ...routine, exercises: routine.exercises.map((exercise) => ({ ...exercise })) });

function orderedWeekdays(days: string[]): string[] {
  return WEEKDAYS.filter((day) => days.some((value) => value.slice(0, 3).toLowerCase() === day.toLowerCase()));
}

function moveItem<T>(items: T[], index: number, offset: number): T[] {
  const next = [...items];
  const destination = index + offset;
  if (destination < 0 || destination >= items.length) return next;
  [next[index], next[destination]] = [next[destination], next[index]];
  return next;
}

function Thumbnail({ exerciseId }: { exerciseId: string }) {
  const exercise = CATALOG_BY_ID[exerciseId];
  const src = exercise ? getExerciseImageUrl(exercise, 'start') : null;
  const [failed, setFailed] = useState(false);
  return <span className="plan-thumbnail" aria-hidden="true">{src && !failed ? <img src={src} alt="" loading="lazy" onError={() => setFailed(true)} /> : <span className="plan-thumbnail-fallback">No image</span>}</span>;
}

function ExerciseSummary({ exercise, onSelectExercise }: { exercise: PlannedExercise; onSelectExercise?: (id: string) => void }) {
  const content = <><Thumbnail key={exercise.exerciseId} exerciseId={exercise.exerciseId} /><span className="plan-exercise-name">{exerciseName(exercise.exerciseId)}</span></>;
  return <div className="plan-exercise-summary">
    {onSelectExercise ? <button type="button" className="plan-exercise-link" onClick={() => onSelectExercise(exercise.exerciseId)} aria-label={`View ${exerciseName(exercise.exerciseId)}`}>{content}</button> : <div className="plan-exercise-link">{content}</div>}
    <p className="plan-prescription">{exercise.sets} sets · {exercise.reps} reps · {exercise.restSec}s rest</p>
    {exercise.reason && <details className="plan-exercise-reason"><summary>Why this exercise?</summary><p>{exercise.reason}</p></details>}
  </div>;
}

export const PlanScreen: React.FC<PlanScreenProps> = ({ onStartSession, onSelectExercise }) => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [draft, setDraft] = useState<UserProfile | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [history, setHistory] = useState<WorkoutSession[]>([]);
  const [feedback, setFeedback] = useState<ExerciseFeedback[]>([]);
  const [activeWorkout, setActiveWorkout] = useState<WorkoutSession | null>(null);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [routinesError, setRoutinesError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [view, setView] = useState<'schedule' | 'routines'>('schedule');
  const [editor, setEditor] = useState<Routine | null>(null);
  const [editorBaseline, setEditorBaseline] = useState<Routine | null>(null);
  const [editorFromPlan, setEditorFromPlan] = useState(false);
  const editorHeading = useRef<HTMLHeadingElement>(null);
  const swapHeading = useRef<HTMLHeadingElement>(null);
  const swapTrigger = useRef<HTMLElement | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [swapTarget, setSwapTarget] = useState<{ dayId?: string; index: number; exerciseId: string } | null>(null);
  const [swapReason, setSwapReason] = useState('preference');
  const [unavailableEquipment, setUnavailableEquipment] = useState<string[]>([]);
  const [addExerciseId, setAddExerciseId] = useState('');
  const [todayDate] = useState(() => new Date());
  const editorDirty = Boolean(editor && JSON.stringify(editor) !== JSON.stringify(editorBaseline));

  async function loadData() {
    try {
      const [user, storedPlan, sessions, active, allFeedback] = await Promise.all([getUserProfile(), getLatestPlan(), getWorkoutSessions(), getActiveWorkout(), getAllFeedback()]);
      const currentPlan = storedPlan ?? generatePlan(user, CATALOG, sessions, { feedback: allFeedback, createdAt: Date.now() });
      if (!storedPlan) await savePlan(currentPlan);
      setProfile(user);
      setDraft({ ...user, weekdays: orderedWeekdays(user.weekdays) });
      setPlan(currentPlan);
      setHistory(sessions);
      setFeedback(allFeedback);
      setActiveWorkout(active?.state === 'active' ? active : null);
      try { setRoutines(await getRoutines()); setRoutinesError(''); }
      catch { setRoutinesError('Saved routines could not be loaded. Retry to see your saved workouts.'); }
    } catch { setError('Your plan could not be loaded or saved. Check device storage and retry.'); }
    finally { setLoading(false); }
  }

  useEffect(() => { void loadData(); }, []);
  const editorId = editor?.id;
  useEffect(() => { if (editorId && view === 'routines') editorHeading.current?.focus(); }, [editorId, view]);
  useEffect(() => { if (swapTarget) swapHeading.current?.focus(); }, [swapTarget]);

  async function perform(action: () => Promise<void>, success?: string) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true); setError(''); setStatus('');
    try { await action(); if (success) setStatus(success); }
    catch (err) { setError(err instanceof Error ? `${err.message} Try again when you’re ready.` : 'Couldn’t complete this action. Try again.'); }
    finally { busyRef.current = false; setBusy(false); }
  }

  const configChanged = Boolean(profile && draft && (plan?.location !== draft.activeLocation || profile.activeLocation !== draft.activeLocation || profile.daysPerWeek !== draft.daysPerWeek || profile.durationMin !== draft.durationMin || orderedWeekdays(profile.weekdays).join() !== draft.weekdays.join()));
  const scheduleValid = Boolean(draft && draft.weekdays.length === draft.daysPerWeek);
  const preview = useMemo(() => {
    if (!draft || !plan || !configChanged || !scheduleValid) return null;
    try { return { plan: generatePlan(draft, CATALOG, history, { existingPlan: plan, feedback }), error: '' }; }
    catch { return { plan: null, error: 'A preview could not be created with these settings. Adjust your choices and try again.' }; }
  }, [draft, plan, configChanged, scheduleValid, history, feedback]);

  const completedDayIds = useMemo(() => {
    const weekStart = new Date(todayDate);
    weekStart.setHours(0, 0, 0, 0);
    weekStart.setDate(weekStart.getDate() - (weekStart.getDay() + 6) % 7);
    return new Set(history.filter((session) => session.state === 'done' && session.planId === plan?.id && (session.endedAt ?? session.startedAt) >= weekStart.getTime()).map((session) => session.dayId));
  }, [history, plan?.id, todayDate]);
  const weekdays = orderedWeekdays(profile?.weekdays ?? []);
  const today = WEEKDAYS[(todayDate.getDay() + 6) % 7];
  const todayIndex = weekdays.indexOf(today);
  const nextDay = plan?.days.find((day, index) => index === todayIndex && !completedDayIds.has(day.id)) ?? plan?.days.find((day) => !completedDayIds.has(day.id)) ?? plan?.days[0];

  async function startSession(makeSession: () => WorkoutSession) {
    // Recheck at start time: another screen may have saved a workout since mounting.
    const existing = await getActiveWorkout();
    if (existing?.state === 'active') { setActiveWorkout(existing); onStartSession(existing); return; }
    onStartSession(makeSession());
  }

  function daySession(day: PlanDay, location: LocationType): WorkoutSession {
    return { ...sessionFromRoutine(routineFromDay(day, location)), planId: plan?.id, dayId: day.id };
  }

  const updateWeeklyPlan = () => perform(async () => {
    if (!draft || !plan || !scheduleValid) return;
    const sessions = await getWorkoutSessions();
    const next = generatePlan(draft, CATALOG, sessions, { existingPlan: plan, feedback, planId: `plan-${crypto.randomUUID()}`, createdAt: Date.now() });
    if (next.days.some((day) => day.exercises.length === 0)) throw new Error('Some days have no eligible exercises. Review your equipment and restrictions.');
    if (next.split === plan.split) next.days = next.days.map((day, index) => ({ ...day, id: plan.days[index]?.id ?? day.id }));
    // Both records commit together: a storage failure must not leave settings ahead of the plan.
    await db.transaction('rw', db.profiles, db.plans, async () => {
      await saveUserProfile(draft);
      await savePlan(next);
    });
    setProfile(draft); setPlan(next); setHistory(sessions);
  }, 'Weekly plan saved on this device. Completed workouts are unchanged.');

  const adaptToday = () => perform(async () => {
    if (!draft || !plan || !nextDay) return;
    await startSession(() => {
      const adapted = generatePlan(draft, CATALOG, history, { existingPlan: plan, feedback });
      const day = adapted.days[plan.days.findIndex((item) => item.id === nextDay.id)] ?? adapted.days[0];
      if (!day?.exercises.length) throw new Error('No eligible exercises for this location. Review your equipment and restrictions.');
      return daySession({ ...day, id: nextDay.id }, draft.activeLocation);
    });
  });

  function openEditor(routine: Routine, saved: boolean, fromPlan = false) {
    if (editorDirty && !window.confirm('Discard unsaved routine changes?')) return;
    setEditor(copyRoutine(routine)); setEditorBaseline(saved ? copyRoutine(routine) : null);
    setEditorFromPlan(fromPlan);
    setView('routines'); setSwapTarget(null); setAddExerciseId(''); setStatus('');
  }

  function createCustomWorkout() {
    if (!profile) return;
    const now = Date.now();
    openEditor({
      id: `routine-${crypto.randomUUID()}`,
      title: 'Custom workout',
      createdAt: now,
      updatedAt: now,
      location: profile.activeLocation,
      exercises: [],
    }, false);
  }

  const saveEditedRoutine = () => perform(async () => {
    if (!editor) return;
    if (!editor.title.trim() || !editor.exercises.length) throw new Error('Give your routine a name and at least one exercise.');
    if (editor.exercises.some((exercise) => !Number.isInteger(exercise.sets) || exercise.sets < 1 || exercise.sets > 30 || !exercise.reps.trim() || !Number.isFinite(exercise.restSec) || exercise.restSec < 0 || exercise.restSec > 1800)) throw new Error('Use 1–30 sets, a rep target, and 0–1800 seconds of rest.');
    const saved = { ...copyRoutine(editor), title: editor.title.trim(), updatedAt: Date.now() };
    await saveRoutine(saved);
    setRoutines((current) => [saved, ...current.filter((routine) => routine.id !== saved.id)]);
    setEditor(saved); setEditorBaseline(copyRoutine(saved));
  }, 'Routine saved on this device.');

  function editExercise(index: number, patch: Partial<PlannedExercise>) {
    setEditor((current) => current ? { ...current, exercises: current.exercises.map((exercise, i) => i === index ? { ...exercise, ...patch } : exercise) } : current);
  }

  function openSwap(target: NonNullable<typeof swapTarget>, trigger: HTMLElement) {
    swapTrigger.current = trigger; setSwapReason('preference'); setUnavailableEquipment([]); setSwapTarget(target);
  }
  function closeSwap() { setSwapTarget(null); swapTrigger.current?.focus(); }

  const swapLocation = swapTarget?.dayId ? plan?.location : editor?.location;
  const swapCandidates = useMemo(() => {
    if (!swapTarget || !profile || !swapLocation) return [];
    const used = swapTarget.dayId ? plan?.days.find((day) => day.id === swapTarget.dayId)?.exercises : editor?.exercises;
    const available = (profile.equipment[swapLocation] ?? []).filter((id) => swapReason !== 'equipment' || !unavailableEquipment.includes(id));
    const swapProfile = { ...profile, equipment: { ...profile.equipment, [swapLocation]: available } };
    return findSubstitutes(swapTarget.exerciseId, available).filter((exercise) => isExerciseEligible(exercise, swapProfile, swapLocation, feedback) && !used?.some((item) => item.exerciseId === exercise.id));
  }, [swapTarget, profile, swapLocation, plan, editor, feedback, swapReason, unavailableEquipment]);
  const addCandidates = useMemo(() => !editor || !profile ? [] : CATALOG.filter((exercise) => isExerciseEligible(exercise, profile, editor.location, feedback) && !editor.exercises.some((item) => item.exerciseId === exercise.id)), [editor, profile, feedback]);

  const executeSwap = (candidate: Exercise) => perform(async () => {
    if (!swapTarget) return;
    const reason = `Replaced ${exerciseName(swapTarget.exerciseId)}: ${swapReason === 'equipment' ? 'different equipment' : swapReason === 'discomfort' ? 'avoiding discomfort' : 'your preference'}. ${CATALOG_BY_ID[swapTarget.exerciseId]?.movement === candidate.movement ? 'Same movement pattern.' : 'Related muscle target.'}`;
    if (swapTarget.dayId && plan) {
      const updated = swapExerciseInPlan(plan, swapTarget.dayId, swapTarget.exerciseId, candidate.id, CATALOG);
      const exercise = updated.days.find((day) => day.id === swapTarget.dayId)?.exercises[swapTarget.index];
      if (exercise) exercise.reason = reason;
      await savePlan(updated); setPlan(updated); setStatus('Exercise swap saved.');
    } else { editExercise(swapTarget.index, { exerciseId: candidate.id, reason }); setStatus('Replacement added to your draft. Save the routine to keep it.'); }
    closeSwap();
  });

  const downloadPack = (exercises: PlannedExercise[]) => perform(async () => {
    setStatus('Downloading exercise images for offline use… Keep this screen open.');
    const result = await downloadExerciseMedia([...new Set(exercises.map((exercise) => exercise.exerciseId))], (done, total) => setStatus(`Downloading offline images: ${done} of ${total} checked…`));
    setStatus(`${result.downloaded} of ${result.total} images available offline.${result.failed ? ` ${result.failed} failed; connect to the internet and retry.` : ' Workout instructions and logs remain on this device.'}`);
  });

  if (loading) return <div className="view plan-screen"><p role="status">Loading your training plan…</p></div>;
  if (!profile || !draft || !plan) return <div className="view plan-screen"><h1 className="h-hero">Training plan</h1><p role="alert">{error || 'No training plan is available.'}</p><button type="button" className="btn primary" onClick={() => { setLoading(true); setError(''); void loadData(); }}>Retry loading plan</button></div>;

  return <div className="view plan-screen" aria-busy={busy}>
    <header className="plan-current-card" aria-labelledby="current-plan-title">
      <p className="plan-current-label">Current plan</p>
      <div>
        <h1 className="h-hero" id="current-plan-title">{plan.split}</h1>
        <p className="sub">Built around your goal, available equipment, and schedule.</p>
      </div>
      <div className="plan-current-tags" role="group" aria-label="Plan details">
        <span><strong>{plan.days.length}</strong> {plan.days.length === 1 ? 'workout' : 'workouts'} / week</span>
        <span><strong>{profile.durationMin}</strong> min / session</span>
        <span>{locationLabel(plan.location)} equipment</span>
      </div>
    </header>
    {error && <p className="plan-error" role="alert">{error}</p>}
    <p className="plan-status" role="status" aria-live="polite">{status || (busy ? 'Saving changes…' : '')}</p>
    {activeWorkout && <section className="panel plan-resume" aria-label="Workout in progress"><div><h2 className="h-sec">Workout in progress</h2><p>{activeWorkout.title}. Starting any workout will resume this session.</p></div><button type="button" className="btn primary" disabled={busy} onClick={() => void perform(() => startSession(() => activeWorkout))}>Resume workout</button></section>}
    <nav className="seg" aria-label="Plan views"><button type="button" aria-pressed={view === 'schedule'} onClick={() => { setView('schedule'); setSwapTarget(null); }}>Weekly schedule</button><button type="button" aria-pressed={view === 'routines'} onClick={() => { setView('routines'); setSwapTarget(null); }}>Saved routines{routines.length ? ` (${routines.length})` : ''}</button></nav>

    {view === 'schedule' && <>
      <section className="plan-schedule" aria-labelledby="schedule-heading">
        <div className="plan-section-heading"><h2 id="schedule-heading" className="h-sec">Your week</h2><p className="small">{profile.durationMin}-minute target · {weekdays.join(', ') || 'No preferred weekdays'}</p></div>
        <ol className="plan-week-strip" aria-label="Preferred weekly schedule">{WEEKDAYS.map((weekday) => {
          const index = weekdays.indexOf(weekday); const day = index >= 0 ? plan.days[index] : null;
          return <li key={weekday} className={day ? 'is-training-day' : ''} aria-current={weekday === today ? 'date' : undefined}><strong>{weekday}</strong>{day ? <a href={`#plan-day-${day.id}`} onClick={(event) => { event.preventDefault(); document.getElementById(`plan-day-${day.id}`)?.scrollIntoView({ block: 'start' }); }} aria-label={`${weekday}: ${day.label}${completedDayIds.has(day.id) ? ', completed' : ''}`}><span className="plan-week-full-label">{day.label}{completedDayIds.has(day.id) ? ' · Done' : ''}</span><span className="plan-week-short-label" aria-hidden="true">{completedDayIds.has(day.id) ? 'Done' : 'Train'}</span></a> : <span>Rest</span>}</li>;
        })}</ol>
        {nextDay && <div className="plan-next"><div><h3>{completedDayIds.size >= plan.days.length ? 'This week is complete' : 'Up next'}</h3><p>{nextDay.label} · {nextDay.exercises.length} exercises</p></div><button type="button" className="btn primary" disabled={busy || !nextDay.exercises.length} onClick={() => void perform(() => startSession(() => daySession(nextDay, plan.location)))}>{activeWorkout ? 'Resume workout' : 'Start next workout'}</button></div>}
      </section>

      <details className="panel plan-adjust"><summary>Training block{profile.trainingBlock?.enabled ? ` · ${getTrainingBlockPhase(profile.trainingBlock).title}` : ''}</summary><TrainingBlockControls value={profile.trainingBlock} disabled={busy} onSave={async (trainingBlock) => {
        if (!isTrainingBlockSettings(trainingBlock)) throw new Error('Choose a valid training block and start date.');
        const latest = await getUserProfile();
        const updated = { ...latest, trainingBlock };
        await saveUserProfile(updated);
        setProfile(updated);
        setDraft((current) => current ? { ...current, trainingBlock } : current);
        setStatus('Training block saved. Applies to new workouts; history and unfinished workouts are unchanged.');
      }} /></details>

      <details className="panel plan-adjust"><summary>Adjust plan</summary><div className="plan-adjust-body">
        <p className="small">Short on time or training somewhere else? Preview your changes, then use them for one workout or save a new weekly plan.</p>
        <fieldset disabled={busy}><legend>Training location</legend><div className="seg">{LOCATIONS.map((location) => <button type="button" key={location} aria-pressed={draft.activeLocation === location} onClick={() => setDraft({ ...draft, activeLocation: location })}>{locationLabel(location)}</button>)}</div></fieldset>
        <div className="plan-settings-grid"><label>Days per week<select value={draft.daysPerWeek} disabled={busy} onChange={(event) => { const count = Number(event.target.value); const chosen = [...draft.weekdays, ...WEEKDAYS.filter((day) => !draft.weekdays.includes(day))].slice(0, count); setDraft({ ...draft, daysPerWeek: count, weekdays: orderedWeekdays(chosen) }); }}>{[2, 3, 4, 5, 6].map((count) => <option key={count} value={count}>{count} days</option>)}</select></label><label>Workout duration<select value={draft.durationMin} disabled={busy} onChange={(event) => setDraft({ ...draft, durationMin: Number(event.target.value) as UserProfile['durationMin'] })}>{[30, 45, 60].map((duration) => <option key={duration} value={duration}>{duration} minutes</option>)}</select></label></div>
        <fieldset disabled={busy}><legend>Preferred weekdays</legend><div className="plan-weekday-options">{WEEKDAYS.map((weekday) => <label key={weekday}><input type="checkbox" checked={draft.weekdays.includes(weekday)} onChange={() => setDraft({ ...draft, weekdays: orderedWeekdays(draft.weekdays.includes(weekday) ? draft.weekdays.filter((day) => day !== weekday) : [...draft.weekdays, weekday]) })} />{weekday}</label>)}</div><p className="small">Choose {draft.daysPerWeek} days. Selected: {draft.weekdays.length}.</p></fieldset>
        {configChanged && <section className="plan-preview" aria-labelledby="preview-heading"><h3 id="preview-heading">Change preview</h3><p>{locationLabel(plan.location)} → {locationLabel(draft.activeLocation)} · {plan.days.length} → {draft.daysPerWeek} days · {profile.durationMin} → {draft.durationMin} minutes</p><p className="small">Preferred days: {draft.weekdays.join(', ') || 'None'}. Pinned exercises stay when they fit your settings. Past workouts won’t change.</p>
          {!scheduleValid && <p role="alert">Select exactly {draft.daysPerWeek} preferred weekdays to preview and save.</p>}
          {preview?.error && <p role="alert">{preview.error}</p>}
          {preview?.plan && <ul className="plan-preview-days">{preview.plan.days.map((day, index) => { const original = plan.days[index]; const changes = day.exercises.filter((exercise) => !original?.exercises.some((item) => item.exerciseId === exercise.exerciseId && item.sets === exercise.sets && item.reps === exercise.reps && item.restSec === exercise.restSec)); return <li key={day.id}><strong>{draft.weekdays[index]} · {day.label}</strong><span>{changes.length ? `${changes.length} new or adjusted exercises` : 'Exercises unchanged'}</span><span className="small">{day.exercises.map((exercise) => exerciseName(exercise.exerciseId)).join(' · ') || 'No eligible exercises'}</span></li>; })}</ul>}
          <div className="plan-actions"><button type="button" className="btn" disabled={busy || !scheduleValid || !preview?.plan || !nextDay} onClick={() => void adaptToday()}>{activeWorkout ? 'Resume workout' : "Adapt today's workout"}</button><button type="button" className="btn primary" disabled={busy || !scheduleValid || !preview?.plan} onClick={() => void updateWeeklyPlan()}>Update weekly plan</button><button type="button" className="btn ghost" disabled={busy} onClick={() => setDraft({ ...profile, weekdays: orderedWeekdays(profile.weekdays) })}>Discard changes</button></div>
        </section>}
      </div></details>

      <div className="plan-days">{plan.days.map((day, dayIndex) => <section className="panel plan-day" key={day.id} id={`plan-day-${day.id}`} aria-labelledby={`day-heading-${day.id}`}>
        <header className="plan-day-header"><div><p className="small">{weekdays[dayIndex] ?? `Session ${dayIndex + 1}`}{completedDayIds.has(day.id) ? ' · Completed this week' : ''}</p><h2 className="h-sec" id={`day-heading-${day.id}`}>{day.label}</h2><p className="small">{day.focus}</p></div><button type="button" className="btn primary" disabled={busy || !day.exercises.length} onClick={() => void perform(() => startSession(() => daySession(day, plan.location)))}>{activeWorkout ? 'Resume workout' : 'Start workout'}</button></header>
        <ol className="plan-exercises">{day.exercises.map((exercise, index) => <li className="plan-exercise" key={`${exercise.exerciseId}-${index}`}><ExerciseSummary exercise={exercise} onSelectExercise={onSelectExercise} /><div className="plan-exercise-actions"><button type="button" className="btn ghost" disabled={busy} aria-label={`${profile.pinned.includes(exercise.exerciseId) ? 'Unpin' : 'Pin'} ${exerciseName(exercise.exerciseId)}`} aria-pressed={profile.pinned.includes(exercise.exerciseId)} onClick={() => void perform(async () => { const pinned = profile.pinned.includes(exercise.exerciseId) ? profile.pinned.filter((id) => id !== exercise.exerciseId) : [...profile.pinned, exercise.exerciseId]; const updated = { ...profile, pinned }; await saveUserProfile(updated); setProfile(updated); setDraft((current) => current ? { ...current, pinned } : current); }, 'Pin preference saved.')}>{profile.pinned.includes(exercise.exerciseId) ? 'Pinned' : 'Pin'}</button><button type="button" className="btn ghost" disabled={busy} aria-label={`Swap ${exerciseName(exercise.exerciseId)} in ${day.label}`} onClick={(event) => openSwap({ dayId: day.id, index, exerciseId: exercise.exerciseId }, event.currentTarget)}>Swap</button></div></li>)}</ol>
        <footer className="plan-day-footer"><div className="plan-actions"><button type="button" className="btn" disabled={busy} onClick={() => openEditor(routineFromDay(day, plan.location), false, true)}>Save as routine</button><button type="button" className="btn ghost" disabled={busy || !day.exercises.length} onClick={() => void downloadPack(day.exercises)}>Save offline images</button></div><div className="plan-actions" aria-label={`Move ${day.label}`}><button type="button" className="btn ghost" disabled={busy || dayIndex === 0} aria-label={`Move ${day.label} earlier`} onClick={() => void perform(async () => { const updated = { ...plan, days: moveItem(plan.days, dayIndex, -1) }; await savePlan(updated); setPlan(updated); }, 'Schedule order saved. Completed history is unchanged.')}>Move earlier</button><button type="button" className="btn ghost" disabled={busy || dayIndex === plan.days.length - 1} aria-label={`Move ${day.label} later`} onClick={() => void perform(async () => { const updated = { ...plan, days: moveItem(plan.days, dayIndex, 1) }; await savePlan(updated); setPlan(updated); }, 'Schedule order saved. Completed history is unchanged.')}>Move later</button></div></footer>
      </section>)}</div>
      <details className="panel plan-explanation"><summary>Why this plan?</summary><p className="small">Your plan uses your equipment, experience, and restrictions. Pin an exercise to keep it in future plan updates when it still fits your settings.</p><ul>{plan.explanation.map((reason, index) => <li key={index}>{reason}</li>)}</ul></details>
    </>}

    {view === 'routines' && <section className="plan-routines" aria-labelledby="routines-heading"><div className="plan-section-heading"><div><h2 id="routines-heading" className="h-sec">Saved routines</h2><p className="sub">A routine is a workout you can repeat. Build your own or save one from your plan.</p></div><button type="button" className="btn primary" disabled={busy} onClick={createCustomWorkout}>Create custom workout</button></div>
      {routinesError && <div className="plan-error"><p role="alert">{routinesError}</p><button type="button" className="btn" disabled={busy} onClick={() => void perform(async () => { setRoutines(await getRoutines()); setRoutinesError(''); })}>Retry loading routines</button></div>}
       {editor && <section className="panel plan-routine-editor" aria-labelledby="routine-editor-heading"><h3 id="routine-editor-heading" ref={editorHeading} tabIndex={-1}>{editorBaseline ? 'Edit routine' : editorFromPlan ? 'Save workout as a routine' : 'Create custom workout'}</h3><p className="small">{!editor.exercises.length ? 'Name your workout, then add your first exercise below.' : editorDirty ? 'Unsaved changes' : 'Saved on this device'}</p><div className="plan-settings-grid"><label>Routine name<input value={editor.title} maxLength={120} disabled={busy} onChange={(event) => setEditor({ ...editor, title: event.target.value })} /></label><label>Routine location<select value={editor.location} disabled={busy} onChange={(event) => { setEditor({ ...editor, location: event.target.value as LocationType }); setAddExerciseId(''); setSwapTarget(null); }}>{LOCATIONS.map((location) => <option key={location} value={location}>{locationLabel(location)}</option>)}</select></label></div>
        <ol className="plan-exercises">{editor.exercises.map((exercise, index) => <li className="plan-routine-exercise" key={`${exercise.exerciseId}-${index}`}><ExerciseSummary exercise={exercise} onSelectExercise={onSelectExercise} />
          {CATALOG_BY_ID[exercise.exerciseId] && !isExerciseEligible(CATALOG_BY_ID[exercise.exerciseId], profile, editor.location, feedback) && <p className="plan-error small">This exercise does not match your equipment, experience, or restrictions. Swap or remove it before training.</p>}
          <div className="plan-prescription-inputs"><label>Sets<input aria-label={`Sets for ${exerciseName(exercise.exerciseId)}`} type="number" min="1" max="30" value={exercise.sets} disabled={busy} onChange={(event) => editExercise(index, { sets: Number(event.target.value) })} /></label><label>Reps<input aria-label={`Reps for ${exerciseName(exercise.exerciseId)}`} value={exercise.reps} disabled={busy} onChange={(event) => editExercise(index, { reps: event.target.value })} /></label><label>Rest (seconds)<input aria-label={`Rest seconds for ${exerciseName(exercise.exerciseId)}`} type="number" min="0" max="1800" value={exercise.restSec} disabled={busy} onChange={(event) => editExercise(index, { restSec: Number(event.target.value) })} /></label></div>
          <div className="plan-actions"><button type="button" className="btn ghost" disabled={busy || index === 0} aria-label={`Move ${exerciseName(exercise.exerciseId)} up`} onClick={() => { setEditor({ ...editor, exercises: moveItem(editor.exercises, index, -1) }); setSwapTarget(null); }}>Move up</button><button type="button" className="btn ghost" disabled={busy || index === editor.exercises.length - 1} aria-label={`Move ${exerciseName(exercise.exerciseId)} down`} onClick={() => { setEditor({ ...editor, exercises: moveItem(editor.exercises, index, 1) }); setSwapTarget(null); }}>Move down</button><button type="button" className="btn ghost" disabled={busy} aria-label={`Replace ${exerciseName(exercise.exerciseId)}`} onClick={(event) => openSwap({ index, exerciseId: exercise.exerciseId }, event.currentTarget)}>Replace</button><button type="button" className="btn ghost" disabled={busy} aria-label={`Remove ${exerciseName(exercise.exerciseId)}`} onClick={() => { setEditor({ ...editor, exercises: editor.exercises.filter((_, i) => i !== index) }); setSwapTarget(null); }}>Remove</button></div>
        </li>)}</ol>
        <div className="plan-add-exercise"><label>Add an exercise<select value={addExerciseId} disabled={busy || !addCandidates.length} aria-describedby="routine-exercise-help" onChange={(event) => setAddExerciseId(event.target.value)}><option value="">Choose an exercise</option>{addCandidates.map((exercise) => <option key={exercise.id} value={exercise.id}>{exercise.name}</option>)}</select></label><button type="button" className="btn" disabled={busy || !addExerciseId} onClick={() => { setEditor({ ...editor, exercises: [...editor.exercises, { exerciseId: addExerciseId, sets: 3, reps: '8–12', restSec: 90, reason: 'Added by you.' }] }); setAddExerciseId(''); }}>Add exercise</button></div>
        <p id="routine-exercise-help" className="small">{addCandidates.length ? `Exercises match your ${locationLabel(editor.location).toLowerCase()} equipment, experience, and restrictions. Change your equipment in Settings if something is missing.` : 'No more exercises match these settings. Choose another location or review your equipment and restrictions in Settings.'}</p>
        <div className="plan-actions"><button type="button" className="btn primary" disabled={busy || !editorDirty || !editor.title.trim() || !editor.exercises.length} onClick={() => void saveEditedRoutine()}>{busy ? 'Saving…' : 'Save routine'}</button><button type="button" className="btn ghost" disabled={busy} onClick={() => { if (!editorDirty || window.confirm('Discard unsaved routine changes?')) { setEditor(null); setSwapTarget(null); } }}>Close editor</button></div>
      </section>}
      {!routines.length && !routinesError && !editor && <div className="plan-empty"><h3>No saved routines yet</h3><p>Use “Create custom workout” above to start from scratch, or save a workout from your weekly schedule.</p><button type="button" className="btn" onClick={() => setView('schedule')}>View weekly schedule</button></div>}
      <ul className="plan-routine-list">{routines.map((routine) => <li className="plan-routine" key={routine.id}><div><h3>{routine.title}</h3><p className="small">{locationLabel(routine.location)} · {routine.exercises.length} exercises · Saved on this device</p><p className="small">{routine.exercises.map((exercise) => exerciseName(exercise.exerciseId)).join(' · ')}</p></div><div className="plan-actions"><button type="button" className="btn primary" disabled={busy || !routine.exercises.length} aria-label={`${activeWorkout ? 'Resume workout instead of' : 'Start'} ${routine.title}`} onClick={() => void perform(() => startSession(() => sessionFromRoutine(routine)))}>{activeWorkout ? 'Resume workout' : 'Start routine'}</button><button type="button" className="btn" disabled={busy} aria-label={`Edit ${routine.title}`} onClick={() => openEditor(routine, true)}>Edit</button><button type="button" className="btn ghost" disabled={busy} aria-label={`Duplicate ${routine.title}`} onClick={() => void perform(async () => { const now = Date.now(); const duplicate = { ...copyRoutine(routine), id: `routine-${crypto.randomUUID()}`, title: `${routine.title} (copy)`, createdAt: now, updatedAt: now }; await saveRoutine(duplicate); setRoutines((current) => [duplicate, ...current]); }, 'Routine duplicated and saved.')}>Duplicate</button><button type="button" className="btn ghost" disabled={busy} onClick={() => void downloadPack(routine.exercises)} aria-label={`Download media for ${routine.title}`}>Download media</button><button type="button" className="btn ghost" disabled={busy} aria-label={`Delete ${routine.title}`} onClick={() => setDeleteTarget(routine.id)}>Delete</button></div>
        {deleteTarget === routine.id && <div className="plan-delete-confirm" role="group" aria-label={`Confirm deleting ${routine.title}`}><p>Delete “{routine.title}”? Completed workout history will stay.</p><div className="plan-actions"><button type="button" className="btn" disabled={busy} onClick={() => void perform(async () => { await deleteRoutine(routine.id); setRoutines((current) => current.filter((item) => item.id !== routine.id)); if (editor?.id === routine.id) { setEditor(null); setSwapTarget(null); } setDeleteTarget(null); }, 'Routine deleted. Workout history is unchanged.')}>Confirm delete routine</button><button type="button" className="btn ghost" disabled={busy} onClick={() => setDeleteTarget(null)}>Keep routine</button></div></div>}
      </li>)}</ul>
    </section>}

    {swapTarget && <section className="panel plan-swap" aria-labelledby="swap-heading" onKeyDown={(event) => { if (event.key === 'Escape' && !busy) closeSwap(); }}><div className="plan-section-heading"><div><h2 className="h-sec" id="swap-heading" ref={swapHeading} tabIndex={-1}>Swap exercise</h2><p>Replacing {exerciseName(swapTarget.exerciseId)}</p></div><button type="button" className="btn ghost" disabled={busy} onClick={closeSwap}>Cancel swap</button></div><label>Reason for swapping<select value={swapReason} disabled={busy} onChange={(event) => setSwapReason(event.target.value)}><option value="preference">I prefer a different exercise</option><option value="equipment">Equipment is unavailable</option><option value="discomfort">This exercise is uncomfortable</option></select></label><p className="small">Only alternatives matching your {swapLocation} equipment, restrictions, and experience are shown. No duplicate exercises.</p>{swapReason === 'discomfort' && <p className="small">Stop if you feel pain. A substitute is not medical advice; review persistent discomfort with a qualified professional.</p>}
      {swapReason === 'equipment' && <fieldset disabled={busy}><legend>Which equipment is unavailable today?</legend><div className="plan-weekday-options">{(profile.equipment[swapLocation ?? plan.location] ?? []).filter((id) => id !== 'bodyweight').map((id) => <label key={id}><input type="checkbox" checked={unavailableEquipment.includes(id)} onChange={() => setUnavailableEquipment((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])} />{EQUIPMENT_BY_ID[id]?.label ?? id}</label>)}</div></fieldset>}
      {!swapCandidates.length ? <p>No eligible alternatives. Review your equipment or restrictions; they have not been bypassed.</p> : <ul className="plan-swap-options">{swapCandidates.map((candidate) => <li key={candidate.id}><button type="button" className="plan-swap-option" disabled={busy} onClick={() => void executeSwap(candidate)}><Thumbnail exerciseId={candidate.id} /><span><strong>{candidate.name}</strong><span className="small">{candidate.equipmentIds.map((id) => EQUIPMENT_BY_ID[id]?.label ?? id).join(' · ') || 'No equipment'} · Difficulty {candidate.difficulty}</span><span className="small">{CATALOG_BY_ID[swapTarget.exerciseId]?.movement === candidate.movement ? 'Same movement pattern' : 'Related muscle target'} · Fits your equipment choices and restrictions</span></span><span>Select</span></button></li>)}</ul>}
    </section>}
    <footer className="credit plan-credit">Exercise data by <a href="https://repdb.co" target="_blank" rel="noopener noreferrer">RepDB (repdb.co)</a>.</footer>
  </div>;
};

export default PlanScreen;
