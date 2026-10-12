import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Exercise, Movement, PerformedSet, SessionItem, UserProfile, WorkoutSession } from '../../data/types';
import { finishSession, getActiveWorkout, getUserProfile, getWorkoutSessions, saveActiveWorkout, saveUserProfile } from '../../data/db';
import { CATALOG_BY_ID, findSubstitutes, getExerciseImageUrl, searchExercises } from '../../data/catalog';
import { saveRoutineFromSession } from '../../data/training';
import { MUSCLE_BY_ID } from '../../data/muscles';
import { RestTimer } from './RestTimer';
import { canonicalLoad, copySource, displayLoad, elapsedWorkoutSeconds, formatDuration, formatPerformance, hasRealPerformance, previousSet, workingMetrics } from './workoutHelpers';
import type { WeightUnit } from './workoutHelpers';
import './ActiveWorkout.css';
import { Modal } from '../../design/Modal';
import { ExercisePicture } from '../../design/ExercisePicture';
import { Icon } from '../../design/Icon';

export interface ActiveWorkoutScreenProps {
  session?: WorkoutSession;
  onFinishSession: () => void;
  onExitSession: () => void;
  onSelectExercise?: (exerciseId: string) => void;
}

function WorkoutModal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return <Modal open title={title} onClose={onClose}>{children}</Modal>;
}

function ExerciseFigure({ exercise }: { exercise: Exercise | undefined }) {
  const [pose, setPose] = useState<'start' | 'peak'>('start');
  const [failedImages, setFailedImages] = useState<string[]>([]);
  const url = exercise ? getExerciseImageUrl(exercise, pose) : null;
  return <figure className="workout-figure">
    <div className="workout-pose-controls" aria-label="Exercise image position">
      <button type="button" aria-pressed={pose === 'start'} onClick={() => setPose('start')}>Start position</button>
      <button type="button" aria-pressed={pose === 'peak'} onClick={() => setPose('peak')}>End position</button>
    </div>
    {url && !failedImages.includes(url)
      ? <img src={url} alt={`${exercise?.name}, ${pose === 'start' ? 'start' : 'end'} position`} onError={() => setFailedImages((old) => [...old, url])} />
      : <div className="workout-image-fallback"><strong>Illustration unavailable</strong><span>{url ? 'This image could not load. Use the written form cues below.' : 'No illustration is available for this exercise. Use the written form cues below.'}</span></div>}
    <figcaption>{pose === 'start' ? 'Start position' : 'End position'} · Reference illustration, not a form assessment.</figcaption>
  </figure>;
}

const SWAP_REASONS = ['Machine busy', 'Equipment missing', 'Prefer another', 'Discomfort'] as const;
type SwapReason = typeof SWAP_REASONS[number];

export const ActiveWorkoutScreen: React.FC<ActiveWorkoutScreenProps> = ({ session: initialPropSession, onFinishSession, onExitSession, onSelectExercise }) => {
  const [activeSession, setActiveSession] = useState<WorkoutSession | null>(initialPropSession ?? null);
  const sessionRef = useRef<WorkoutSession | null>(initialPropSession ?? null);
  const initialSessionRef = useRef(initialPropSession);
  useEffect(() => { initialSessionRef.current = initialPropSession; }, [initialPropSession]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const profileRef = useRef<UserProfile | null>(null);
  const [pastSessions, setPastSessions] = useState<WorkoutSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [error, setError] = useState('');
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');
  const saveQueue = useRef<Promise<void>>(Promise.resolve());
  const saveRevision = useRef(0);
  const failedWrites = useRef(new Set<'session' | 'profile'>());
  const mounted = useRef(false);
  const locked = useRef(false);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [overview, setOverview] = useState(false);
  const [restSeconds, setRestSeconds] = useState(90);
  const [restOpen, setRestOpen] = useState(false);
  const [restKey, setRestKey] = useState(0);
  const [swapIndex, setSwapIndex] = useState<number | null>(null);
  const [swapReason, setSwapReason] = useState<SwapReason>('Machine busy');
  const [blockedEquipment, setBlockedEquipment] = useState<string[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [addQuery, setAddQuery] = useState('');
  const [movement, setMovement] = useState<Movement | ''>('');
  const [finishOpen, setFinishOpen] = useState(false);
  const [completedSession, setCompletedSession] = useState<WorkoutSession | null>(null);
  const completionHeading = useRef<HTMLHeadingElement>(null);
  const [routineTitle, setRoutineTitle] = useState('');
  const [routineSaved, setRoutineSaved] = useState(false);
  const [routineBusy, setRoutineBusy] = useState(false);

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { if (completedSession) completionHeading.current?.focus(); }, [completedSession]);

  // One ordered queue also handles unit preference writes. Side effects never run
  // inside React state updaters; refs are the latest editable source of truth.
  const enqueueSave = useCallback((write: () => Promise<void>, scope: 'session' | 'profile' | 'both' = 'session') => {
    const revision = ++saveRevision.current;
    const scopes = scope === 'both' ? ['session', 'profile'] as const : [scope];
    setSaveStatus('saving');
    const pending = saveQueue.current.catch(() => undefined).then(write);
    saveQueue.current = pending;
    void pending.then(() => {
      for (const entry of scopes) failedWrites.current.delete(entry);
      if (mounted.current && revision === saveRevision.current) {
        setSaveStatus(failedWrites.current.size ? 'error' : 'saved');
        if (failedWrites.current.size) setError('Some changes could not be saved on this device. Keep this screen open and retry saving.');
      }
    }, () => {
      for (const entry of scopes) failedWrites.current.add(entry);
      if (mounted.current && revision === saveRevision.current) {
        setSaveStatus('error');
        setError('Changes could not be saved on this device. Keep this screen open and retry saving.');
      }
    });
    return pending;
  }, []);

  const updateSession = useCallback((updater: (session: WorkoutSession) => WorkoutSession) => {
    const current = sessionRef.current;
    if (!current || locked.current || current.state !== 'active') return;
    const updated = updater(current);
    sessionRef.current = updated;
    setActiveSession(updated);
    setError('');
    void enqueueSave(() => saveActiveWorkout(updated));
  }, [enqueueSave]);

  useEffect(() => {
    let cancelled = false;
    async function restore() {
      try {
        const [userProfile, history, saved] = await Promise.all([getUserProfile(), getWorkoutSessions(), getActiveWorkout()]);
        if (cancelled) return;
        profileRef.current = userProfile;
        setProfile(userProfile);
        setPastSessions(history);
        const provided = initialSessionRef.current;
        const session = saved?.state === 'active' ? saved : provided?.state === 'active' ? provided : null;
        sessionRef.current = session;
        setActiveSession(session);
        setFocusedIndex(Math.max(0, session?.items.findIndex((item) => !item.skipped && item.sets.some((set) => !set.done)) ?? 0));
        setNow(Date.now());
        if (session && !saved) void enqueueSave(() => saveActiveWorkout(session));
        setError('');
      } catch {
        if (!cancelled) setError('Your workout could not be restored. Retry before starting or changing a session.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void restore();
    return () => { cancelled = true; };
  }, [initialPropSession?.id, reloadKey, enqueueSave]);

  const timerRunning = !!activeSession && !activeSession.pausedAt && !completedSession;
  useEffect(() => {
    if (!timerRunning) return;
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [timerRunning]);

  const unit: WeightUnit = profile?.weightUnit ?? 'kg';
  const metrics = activeSession ? workingMetrics(activeSession) : { total: 0, completed: 0, percent: 0, volumeKg: 0 };
  const elapsed = activeSession ? formatDuration(elapsedWorkoutSeconds(activeSession, now)) : '0:00';
  const maxDifficulty = profile?.experience === 'new' ? 1 : profile?.experience === 'some' ? 2 : 3;
  const location = activeSession?.location ?? profile?.activeLocation ?? 'home';

  const swapCandidates = useMemo(() => {
    if (swapIndex === null || !activeSession || !profile) return [];
    const unavailable = swapReason === 'Machine busy' || swapReason === 'Equipment missing' ? blockedEquipment : [];
    const equipment = profile.equipment[activeSession.location].filter((id) => !unavailable.includes(id));
    const original = CATALOG_BY_ID[activeSession.items[swapIndex].exerciseId];
    const candidates = findSubstitutes(activeSession.items[swapIndex].exerciseId, equipment)
      .filter((exercise) => !profile.restrictions.includes(exercise.id) && !profile.disliked.includes(exercise.id) && exercise.difficulty <= maxDifficulty)
      .filter((exercise) => !exercise.equipmentIds.some((id) => unavailable.includes(id)));
    // Discomfort is a stop signal, not an invitation to progress difficulty.
    return (swapReason === 'Discomfort'
      ? candidates.filter((exercise) => exercise.difficulty <= (original?.difficulty ?? 1)).sort((a, b) => a.difficulty - b.difficulty)
      : candidates).slice(0, 20);
  }, [swapIndex, activeSession, profile, swapReason, blockedEquipment, maxDifficulty]);

  const addResults = useMemo(() => !addOpen ? [] : searchExercises(addQuery, {
    location, equipment: profile?.equipment[location], movement: movement || undefined,
  }).filter((exercise) => !profile?.restrictions.includes(exercise.id) && !profile?.disliked.includes(exercise.id) && exercise.difficulty <= maxDifficulty).slice(0, 30),
  [addOpen, addQuery, location, profile, movement, maxDifficulty]);

  const updateItem = (index: number, updater: (item: SessionItem) => SessionItem) => updateSession((session) => ({
    ...session, items: session.items.map((item, itemIndex) => itemIndex === index ? updater(item) : item),
  }));
  const updateSet = (itemIndex: number, setIndex: number, patch: Partial<PerformedSet>) => updateItem(itemIndex, (item) => ({
    ...item, sets: item.sets.map((set, index) => index === setIndex ? { ...set, ...patch } : set),
  }));

  const changeUnit = (weightUnit: WeightUnit) => {
    const current = profileRef.current;
    if (!current || locked.current) return;
    const updated = { ...current, weightUnit };
    profileRef.current = updated;
    setProfile(updated);
    setError('');
    void enqueueSave(() => saveUserProfile(updated), 'profile');
  };

  const togglePause = () => {
    const timestamp = Date.now();
    setNow(timestamp);
    updateSession((session) => session.pausedAt
      ? { ...session, pausedMs: (session.pausedMs ?? 0) + timestamp - session.pausedAt, pausedAt: undefined }
      : { ...session, pausedAt: timestamp });
  };

  const retrySave = async () => {
    if (locked.current) return;
    setError('');
    const latest = sessionRef.current;
    const latestProfile = profileRef.current;
    try {
      await enqueueSave(async () => {
        if (latestProfile) await saveUserProfile(latestProfile);
        if (latest?.state === 'active') await saveActiveWorkout(latest);
      }, 'both');
    } catch { /* The queue displays an actionable error. */ }
  };

  const finishWorkout = async () => {
    if (!sessionRef.current || locked.current) return;
    locked.current = true;
    setBusy(true);
    setError('');
    try {
      // Drain all pending writes; retry the newest snapshot even after a failed
      // older autosave. Never let an active write race the clear operation.
      await saveQueue.current.catch(() => undefined);
      const current = sessionRef.current;
      await saveActiveWorkout(current);
      if (profileRef.current) await saveUserProfile(profileRef.current);
      const timestamp = Date.now();
      const finished: WorkoutSession = {
        ...current, state: 'done', endedAt: timestamp,
        pausedMs: (current.pausedMs ?? 0) + (current.pausedAt ? timestamp - current.pausedAt : 0), pausedAt: undefined,
      };
      await finishSession(finished);
      sessionRef.current = finished;
      setActiveSession(finished);
      setCompletedSession(finished);
      setRoutineTitle(finished.title);
      setRestOpen(false);
      setFinishOpen(false);
      failedWrites.current.clear();
      setSaveStatus('saved');
    } catch {
      locked.current = false;
      setSaveStatus('error');
      setError('Workout could not be finished. Your session is still here. Retry Save & Finish Session.');
    } finally { setBusy(false); }
  };

  const leaveWorkout = async () => {
    if (locked.current) return;
    const current = sessionRef.current;
    if (!current) { onExitSession(); return; }
    const paused = current.pausedAt ? current : { ...current, pausedAt: Date.now() };
    updateSession(() => paused);
    locked.current = true;
    setBusy(true);
    try {
      await saveQueue.current;
      const latestProfile = profileRef.current;
      if (latestProfile && failedWrites.current.has('profile')) {
        await enqueueSave(() => saveUserProfile(latestProfile), 'profile');
      }
      onExitSession();
    } catch {
      locked.current = false;
      setError('Your paused session could not be saved. Retry saving before leaving.');
    } finally { setBusy(false); }
  };

  const openExerciseDetails = async (exerciseId: string) => {
    if (!onSelectExercise || locked.current) return;
    locked.current = true;
    setBusy(true);
    try {
      await saveQueue.current;
      if (failedWrites.current.size) throw new Error('Unsaved changes');
      onSelectExercise(exerciseId);
    } catch {
      setError('Save your latest changes before leaving to view exercise details. Retry saving, then open details again.');
    } finally {
      locked.current = false;
      if (mounted.current) setBusy(false);
    }
  };

  const saveRoutine = async () => {
    if (!completedSession || routineBusy || routineSaved) return;
    setRoutineBusy(true);
    setError('');
    try { await saveRoutineFromSession(completedSession, routineTitle.trim() || undefined); setRoutineSaved(true); }
    catch { setError('Routine could not be saved. Your completed workout is saved; try saving the routine again.'); }
    finally { setRoutineBusy(false); }
  };

  const errorBanner = error && <div className="workout-error" role="alert"><p>{error}</p>
    {!completedSession && !finishOpen && <button type="button" disabled={busy} onClick={() => {
      if (profile) void retrySave();
      else { setLoading(true); setReloadKey((value) => value + 1); }
    }}>Retry</button>}
  </div>;

  if (loading) return <div className="active-workout-container workout-empty" role="status">Loading your workout…</div>;
  if (!profile || !activeSession) return <div className="active-workout-container workout-empty">
    <h1>{error ? 'Workout unavailable' : 'No workout in progress'}</h1>
    {errorBanner || <p>Choose a plan, a saved routine, or exercises to start training.</p>}
    <button type="button" className="workout-primary" onClick={onExitSession}>Back to training</button>
  </div>;

  if (completedSession) {
    const summary = workingMetrics(completedSession);
    return <div className="active-workout-container workout-completion">
      <h1 ref={completionHeading} tabIndex={-1}>Workout saved</h1><p>{completedSession.title}</p>{errorBanner}
      <div className="workout-summary-stats"><span><strong>{formatDuration(elapsedWorkoutSeconds(completedSession))}</strong>Training time</span><span><strong>{summary.completed}</strong>Working sets</span><span><strong>{displayLoad(summary.volumeKg, unit).toLocaleString()} {unit}</strong>Working volume</span></div>
      <h2>Your actual performance</h2>
      {completedSession.items.map((item, index) => <section className="workout-summary-exercise" key={`${item.exerciseId}-${index}`}>
        <h3>{CATALOG_BY_ID[item.exerciseId]?.name ?? item.exerciseId}</h3>
        {item.skipped ? <p>Skipped · not counted</p> : <>
          <ul>{item.sets.map((set, setIndex) => hasRealPerformance(set) ? <li key={setIndex}>{set.kind === 'warmup' ? 'Warm-up' : 'Working'} set {setIndex + 1}: {formatPerformance(set, unit)}{set.effort ? ` · ${['Easy', 'Right', 'Hard'][set.effort - 1]} effort` : ''}</li> : null)}</ul>
          {!item.sets.some(hasRealPerformance) && <p>No completed sets logged.</p>}
          {item.sets.some((set) => !hasRealPerformance(set)) && <p>Unfinished sets left unmarked.</p>}
        </>}{item.discomfort && <p>Discomfort reported</p>}
      </section>)}
      <div className="workout-routine-save"><h2>Use this workout again</h2><label htmlFor="routine-title">Routine name</label><input id="routine-title" value={routineTitle} maxLength={120} onChange={(event) => setRoutineTitle(event.target.value)} />
        <button type="button" disabled={routineBusy || routineSaved || summary.completed === 0} onClick={() => void saveRoutine()}>{routineSaved ? 'Routine saved' : routineBusy ? 'Saving routine…' : 'Save as routine'}</button>
        {summary.completed === 0 && <p>Complete a working set to save a reusable routine.</p>}
      </div>
      <button type="button" className="workout-primary" disabled={routineBusy} onClick={onFinishSession}>Done · Back to training</button>
    </div>;
  }

  return <div className="active-workout-container">
    <header className="active-header">
      <div className="active-header-top"><div><h1 className="active-title">{activeSession.title}</h1><span className="workout-location">{activeSession.location}</span></div>
        <button type="button" className="timer-pill" aria-label={activeSession.pausedAt ? 'Resume workout timer' : 'Pause workout timer'} onClick={togglePause} disabled={busy}>{elapsed} · {activeSession.pausedAt ? 'Resume' : 'Pause'}</button>
      </div>
      <div className="workout-progress" role="progressbar" aria-label="Working sets completed" aria-valuenow={metrics.completed} aria-valuemin={0} aria-valuemax={Math.max(1, metrics.total)}><div style={{ width: `${metrics.percent}%` }} /></div>
      <div className="workout-progress-info"><span>{metrics.completed} / {metrics.total} working sets completed</span><span role="status" aria-live="polite">{saveStatus === 'saving' ? 'Saving…' : saveStatus === 'error' ? 'Not saved' : 'Saved on device'}</span></div>
      <div className="workout-view-controls"><button type="button" aria-pressed={!overview} onClick={() => setOverview(false)}>Focused exercise</button><button type="button" aria-pressed={overview} onClick={() => setOverview(true)}>Workout overview</button>
        <label><span className="sr-only">Load unit</span><select aria-label="Load unit" value={unit} disabled={busy} onChange={(event) => changeUnit(event.target.value as WeightUnit)}><option value="kg">kg</option><option value="lb">lb</option></select></label>
      </div>
    </header>
    {!finishOpen && errorBanner}
    {activeSession.pausedAt && <div className="workout-paused" role="status">Workout timer paused. Tap Resume when you’re ready.</div>}
    {!activeSession.items.length && <div className="workout-empty"><h2>Add your first exercise</h2><p>Choose an exercise below to begin logging.</p></div>}
    {activeSession.items.length > 0 && !overview && <nav className="workout-exercise-nav" aria-label="Exercise navigation"><button type="button" disabled={focusedIndex === 0} onClick={() => { setFocusedIndex((index) => index - 1); setError(''); }}>Previous</button><span>Exercise {focusedIndex + 1} of {activeSession.items.length}</span><button type="button" disabled={focusedIndex >= activeSession.items.length - 1} onClick={() => { setFocusedIndex((index) => index + 1); setError(''); }}>Next</button></nav>}
    <main className="workout-exercises">
      {activeSession.items.map((item, itemIndex) => {
        const exercise = CATALOG_BY_ID[item.exerciseId];
        const name = exercise?.name ?? item.exerciseId;
        if (overview) {
          const done = item.skipped ? 0 : item.sets.filter((set) => set.kind !== 'warmup' && hasRealPerformance(set)).length;
          const total = item.sets.filter((set) => set.kind !== 'warmup').length;
          return <button type="button" className="workout-overview-item" key={`${item.exerciseId}-${itemIndex}`} onClick={() => { setFocusedIndex(itemIndex); setOverview(false); }}><strong>{name}</strong><span>{item.skipped ? 'Skipped' : `${done} / ${total} working sets`}</span><span>Open exercise</span></button>;
        }
        if (itemIndex !== focusedIndex) return null;
        const loadRequired = exercise ? exercise.equipmentIds.some((id) => !['bodyweight', 'mat', 'chair', 'bench', 'pull-up-bar', 'dip-bars'].includes(id)) : true;
        return <article className={`workout-exercise-card ${item.skipped ? 'skipped' : ''}`} key={`${item.exerciseId}-${itemIndex}`}>
          <div className="exercise-header-row">{exercise && <ExercisePicture exercise={exercise} />}<h2>{name}</h2>{onSelectExercise && <button type="button" disabled={busy} onClick={() => void openExerciseDetails(item.exerciseId)}>Exercise details</button>}
            {item.skipped && <span>Skipped · not counted</span>}
            <p className="target-specs">{item.planned?.sets ?? item.sets.filter((set) => set.kind !== 'warmup').length} sets × {item.planned?.reps ?? 'your target'} · {item.planned?.restSec ?? 90}s rest</p>
            {exercise && <div className="muscle-chips-row">{exercise.primary.map((muscle) => <span key={muscle}>{MUSCLE_BY_ID[muscle]?.short ?? muscle}</span>)}</div>}
          </div>
          <details className="workout-demonstration"><summary>Illustrations & form guidance</summary><ExerciseFigure exercise={exercise} />
          {exercise && <div className="workout-form-cues">
            <h3>How to perform</h3><ol>{exercise.instructions.map((instruction, index) => <li key={index}>{instruction}</li>)}</ol>
            <h3>Form cues</h3><ul>{exercise.cues.map((cue, index) => <li key={index}>{cue}</li>)}</ul>
            <h3>Mistakes to avoid</h3><ul>{exercise.mistakes.map((mistake, index) => <li key={index}>{mistake}</li>)}</ul>
          </div>}</details>
          {!item.skipped && <div className="set-table">
            <div className="set-table-header" aria-hidden="true"><span>Set</span><span>Previous / target</span><span>{unit}</span><span>Reps</span><span>Done</span></div>
            {item.sets.map((set, setIndex) => {
              const previous = previousSet(pastSessions, item, setIndex);
              const source = copySource(pastSessions, item, setIndex);
              const validLoad = set.loadKg !== null && Number.isFinite(set.loadKg) && set.loadKg >= 0;
              const canComplete = set.reps !== null && Number.isInteger(set.reps) && set.reps > 0 && (loadRequired ? validLoad : set.loadKg === null || validLoad);
              return <div className={`set-table-row-container ${set.done ? 'done' : ''}`} key={setIndex}>
                <div className="set-table-row"><span className="set-num-badge">{setIndex + 1}</span><span className="set-guidance">{previous ? <><small>Previous</small>{formatPerformance(previous, unit)}</> : <><small>Target</small>{item.planned?.reps ?? 'Not set'}</>}</span>
                  <input aria-label={`${name} set ${setIndex + 1} load ${unit}`} type="number" inputMode="decimal" step="any" min="0" placeholder={loadRequired ? '—' : 'BW'} className="set-input" disabled={busy} value={set.loadKg === null ? '' : displayLoad(set.loadKg, unit)} onChange={(event) => {
                    const raw = event.target.value;
                    const value = raw === '' ? null : Number(raw);
                    updateSet(itemIndex, setIndex, { loadKg: value !== null && Number.isFinite(value) && value >= 0 ? canonicalLoad(value, unit) : null, done: false });
                  }} />
                  <input aria-label={`${name} set ${setIndex + 1} reps`} type="number" inputMode="numeric" min="1" step="1" placeholder="—" className="set-input" disabled={busy} value={set.reps ?? ''} onChange={(event) => {
                    const raw = event.target.value;
                    const value = raw === '' ? null : Number(raw);
                    updateSet(itemIndex, setIndex, { reps: value !== null && Number.isInteger(value) && value > 0 ? value : null, done: false });
                  }} />
                  <button type="button" className="set-check-btn" aria-label={`${set.done ? 'Mark incomplete' : 'Complete'} ${name} set ${setIndex + 1}`} aria-pressed={set.done} title={set.done ? 'Mark set incomplete' : 'Mark set done'} disabled={busy} onClick={(event) => {
                    if (!set.done && !canComplete) { setError(loadRequired ? 'Enter reps and a load before completing this set. Use 0 for an unloaded set.' : 'Enter reps before completing this set.'); return; }
                    updateSet(itemIndex, setIndex, { done: !set.done });
                    if (!set.done) {
                      const options = event.currentTarget.closest('.set-table-row-container')?.querySelector('details');
                      if (options) options.open = false;
                      setRestSeconds(item.planned?.restSec ?? 90); setRestKey((key) => key + 1); setRestOpen(true);
                    }
                  }}><Icon name={set.done ? 'check' : 'circle'} size={24} /></button>
                </div>
                <details className="workout-set-details"><summary aria-label={`Options for ${name} set ${setIndex + 1}`}>{set.kind === 'warmup' ? 'Warm-up' : 'Working'}{set.effort ? ` · ${['Easy', 'Right', 'Hard'][set.effort - 1]}` : ''} · Set options</summary>
                <div className="workout-set-options"><label>Set type<select aria-label={`${name} set ${setIndex + 1} type`} disabled={busy} value={set.kind ?? 'working'} onChange={(event) => updateSet(itemIndex, setIndex, { kind: event.target.value as 'warmup' | 'working' })}><option value="working">Working</option><option value="warmup">Warm-up</option></select></label>
                  <button type="button" disabled={!source || busy} aria-label={`Copy last set into ${name} set ${setIndex + 1}`} onClick={() => source && updateSet(itemIndex, setIndex, { loadKg: source.loadKg, reps: source.reps, done: false, effort: undefined })}>Copy last set</button>
                </div>
                <div className="effort-pills-row" role="group" aria-label={`${name} set ${setIndex + 1} effort`}><span>Effort</span>{([1, 2, 3] as const).map((effort) => <button type="button" key={effort} disabled={busy} aria-pressed={set.effort === effort} onClick={() => updateSet(itemIndex, setIndex, { effort: set.effort === effort ? undefined : effort })}>{['Easy', 'Right', 'Hard'][effort - 1]}</button>)}</div>
                </details>
              </div>;
            })}
          </div>}
          <div className="exercise-controls-bar"><button type="button" disabled={busy || item.skipped} onClick={() => updateItem(itemIndex, (current) => ({ ...current, sets: [...current.sets, { loadKg: null, reps: null, done: false, kind: 'working' }] }))}>+ Add Set</button><button type="button" disabled={busy || item.sets.length <= 1 || item.skipped} onClick={() => updateItem(itemIndex, (current) => ({ ...current, sets: current.sets.slice(0, -1) }))}>- Remove Set</button>
            <button type="button" disabled={busy} onClick={() => { setSwapIndex(itemIndex); setSwapReason(item.discomfort ? 'Discomfort' : 'Machine busy'); setBlockedEquipment(exercise?.equipmentIds.filter((id) => id !== 'bodyweight' && id !== 'mat') ?? []); }}>Swap exercise</button>
            <button type="button" disabled={busy} onClick={() => updateItem(itemIndex, (current) => ({ ...current, skipped: !current.skipped }))}>{item.skipped ? 'Unskip exercise' : 'Skip exercise'}</button>
          </div>
          <label className="workout-discomfort"><input type="checkbox" disabled={busy} checked={item.discomfort ?? false} onChange={(event) => updateItem(itemIndex, (current) => ({ ...current, discomfort: event.target.checked }))} />Discomfort with this exercise</label>
          {item.discomfort && <p className="workout-safety-note">Stop if this movement hurts. Skip or choose another exercise; a substitute is not a guarantee of comfort.</p>}
        </article>;
      })}
    </main>
    <RestTimer key={restKey} initialSeconds={restSeconds} isOpen={restOpen} onDismiss={() => setRestOpen(false)} />
    <footer className="action-toolbar"><button type="button" disabled={busy} onClick={() => setAddOpen(true)}>Add exercise</button><button type="button" disabled={busy} onClick={() => void leaveWorkout()}>Pause / Exit</button><button type="button" className="workout-primary" disabled={busy} onClick={() => setFinishOpen(true)}>Finish Workout</button></footer>
    {swapIndex !== null && <WorkoutModal title={`Swap ${CATALOG_BY_ID[activeSession.items[swapIndex].exerciseId]?.name ?? 'exercise'}`} onClose={() => setSwapIndex(null)}>
      <label>Why swap?<select value={swapReason} onChange={(event) => setSwapReason(event.target.value as SwapReason)}>{SWAP_REASONS.map((reason) => <option key={reason}>{reason}</option>)}</select></label>
      {(swapReason === 'Machine busy' || swapReason === 'Equipment missing') && <fieldset><legend>Unavailable for this exercise</legend>{(CATALOG_BY_ID[activeSession.items[swapIndex].exerciseId]?.equipmentIds ?? []).filter((id) => id !== 'bodyweight').map((id) => <label className="workout-checkbox" key={id}><input type="checkbox" checked={blockedEquipment.includes(id)} onChange={(event) => setBlockedEquipment((old) => event.target.checked ? [...old, id] : old.filter((value) => value !== id))} />{id.replaceAll('-', ' ')}</label>)}{!blockedEquipment.length && <p>Select equipment to avoid, if any.</p>}</fieldset>}
      <p>{swapReason === 'Discomfort' ? 'Stop painful movements. These alternatives respect your restrictions and experience, but are not medical advice.' : `Alternatives matched to your ${location} equipment, restrictions, and experience.`}</p>
      <p>Completed sets stay with the original exercise. The substitute starts with empty, unmarked sets.</p>
      {!swapCandidates.length && <p>No suitable substitutes found. Skip the exercise or update your equipment later.</p>}
      {swapCandidates.map((candidate) => <button type="button" className="workout-candidate" key={candidate.id} onClick={() => {
        const index = swapIndex;
        updateSession((session) => {
          const original = session.items[index];
          const performed = original.sets.filter(hasRealPerformance);
          const replacement: SessionItem = { exerciseId: candidate.id, planned: original.planned ? { ...original.planned, exerciseId: candidate.id, reason: `Swapped: ${swapReason.toLowerCase()}` } : undefined,
            sets: Array.from({ length: Math.max(1, original.sets.filter((set) => set.kind !== 'warmup' && !set.done).length || original.planned?.sets || 3) }, () => ({ loadKg: null, reps: null, done: false, kind: 'working' })) };
          const items = [...session.items];
          if (performed.length || swapReason === 'Discomfort') {
            items.splice(index, 1, { ...original, sets: performed, skipped: performed.length ? original.skipped : true, discomfort: original.discomfort || swapReason === 'Discomfort' }, replacement);
            setFocusedIndex(index + 1);
          } else items[index] = replacement;
          return { ...session, items };
        });
        setSwapIndex(null);
      }}><strong>{candidate.name}</strong><span>{candidate.equipmentIds.join(', ')} · {candidate.difficulty === 1 ? 'Beginner-friendly' : candidate.difficulty === 2 ? 'Some experience' : 'Experienced'}</span></button>)}
    </WorkoutModal>}
    {addOpen && <WorkoutModal title="Add exercise" onClose={() => setAddOpen(false)}>
      <label>Find an exercise<input type="search" placeholder="Name or alias" value={addQuery} onChange={(event) => setAddQuery(event.target.value)} /></label>
      <label>Movement<select value={movement} onChange={(event) => setMovement(event.target.value as Movement | '')}><option value="">All movements</option>{(['squat', 'hinge', 'hpush', 'vpush', 'hpull', 'vpull', 'core', 'carry', 'accessory', 'mobility'] as Movement[]).map((value) => <option key={value}>{value}</option>)}</select></label>
      {!addResults.length && <p>No exercises match your equipment, restrictions, experience, and search.</p>}
      {addResults.map((exercise) => <button type="button" className="workout-candidate" key={exercise.id} onClick={() => {
        const index = sessionRef.current?.items.length ?? 0;
        updateSession((session) => ({ ...session, items: [...session.items, { exerciseId: exercise.id, planned: { exerciseId: exercise.id, sets: 3, reps: '8–12', restSec: 90, reason: 'Added during training' }, sets: Array.from({ length: 3 }, () => ({ loadKg: null, reps: null, done: false, kind: 'working' })) }] }));
        setFocusedIndex(index); setOverview(false); setAddOpen(false); setAddQuery('');
      }}><strong>{exercise.name}</strong><span>{exercise.primary.map((muscle) => MUSCLE_BY_ID[muscle]?.short ?? muscle).join(', ')}</span></button>)}
    </WorkoutModal>}
    {finishOpen && <WorkoutModal title="Finish workout" onClose={() => { if (!busy) setFinishOpen(false); }}>
      <h3>Save what you actually logged</h3><p>{metrics.completed} of {metrics.total} working sets completed in {elapsed}. Warm-ups and skipped exercises are excluded from working volume.</p>
      <p>{displayLoad(metrics.volumeKg, unit).toLocaleString()} {unit} working volume. Unfinished sets will stay unmarked.</p>
      {errorBanner}<button type="button" className="workout-primary" disabled={busy} onClick={() => void finishWorkout()}>{busy ? 'Saving workout…' : 'Save & Finish Session'}</button><button type="button" disabled={busy} onClick={() => setFinishOpen(false)}>Resume Workout</button>
    </WorkoutModal>}
  </div>;
};
