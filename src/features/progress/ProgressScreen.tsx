import { useEffect, useMemo, useState } from 'react';
import { liveQuery } from 'dexie';
import type { ExerciseFeedback, UserProfile, WorkoutSession } from '../../data/types';
import { CATALOG_BY_ID } from '../../data/catalog';
import { getAllFeedback, getUserProfile, getWorkoutSessions } from '../../data/db';
import { BodygraphScreen } from '../bodygraph/BodygraphScreen';
import { sessionWorkingSetCount, workingSets } from '../bodygraph/activity';
import { completedSessions, exerciseHistory, formatSet, localDay, progressionSuggestion, recordedPR } from './progressModel';
import './Progress.css';
import { displayLoad } from '../workout/workoutHelpers';

export interface ProgressScreenProps {
  onSelectExercise?: (id: string) => void;
  onRepeatSession?: (session: WorkoutSession) => void;
  onNavigateTab?: (tab: string) => void;
}

type ProgressView = 'history' | 'strength' | 'muscles';
const dateLabel = (timestamp: number) => new Date(timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

function Chevron({ direction = 'down' }: { direction?: 'left' | 'right' | 'up' | 'down' }) {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    className={`progress-chevron progress-chevron-${direction}`} aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>;
}

export function ProgressScreen({ onSelectExercise, onRepeatSession, onNavigateTab }: ProgressScreenProps) {
  const [view, setView] = useState<ProgressView>('history');
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [feedback, setFeedback] = useState<ExerciseFeedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reload, setReload] = useState(0);
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string[]>([]);
  const [exerciseId, setExerciseId] = useState('');
  const [today] = useState(() => localDay(Date.now()));

  useEffect(() => {
    let cancelled = false;
    getWorkoutSessions().then((data) => { if (!cancelled) setSessions(data); })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [reload]);

  useEffect(() => {
    // Stay current when the exercise sheet flags discomfort. Failure suppresses suggestions,
    // but never hides training history. Dexie tracks the reads inside this subscription.
    const subscription = liveQuery(() => Promise.all([getUserProfile(), getAllFeedback()])).subscribe({
      next: ([savedProfile, savedFeedback]) => { setProfile(savedProfile); setFeedback(savedFeedback); },
      error: () => setProfile(null),
    });
    return () => subscription.unsubscribe();
  }, [reload]);

  const completed = useMemo(() => completedSessions(sessions), [sessions]);
  const unit = profile?.weightUnit ?? 'kg';
  const days = useMemo(() => {
    const counts = new Map<string, number>();
    for (const session of completed) {
      const day = localDay(session.endedAt ?? session.startedAt);
      counts.set(day, (counts.get(day) ?? 0) + 1);
    }
    return counts;
  }, [completed]);
  const visibleSessions = selectedDay ? completed.filter((session) => localDay(session.endedAt ?? session.startedAt) === selectedDay) : completed;
  const exerciseIds = useMemo(() => [...new Set(completed.flatMap((session) => session.items
    .filter((item) => workingSets(item).length > 0).map((item) => item.exerciseId)))].sort((a, b) =>
    (CATALOG_BY_ID[a]?.name ?? a).localeCompare(CATALOG_BY_ID[b]?.name ?? b)), [completed]);
  const selectedExerciseId = exerciseIds.includes(exerciseId) ? exerciseId : exerciseIds[0] ?? '';
  const history = useMemo(() => exerciseHistory(completed, selectedExerciseId), [completed, selectedExerciseId]);
  const pr = useMemo(() => recordedPR(completed, selectedExerciseId), [completed, selectedExerciseId]);
  const suggestion = useMemo(() => progressionSuggestion(completed, selectedExerciseId, profile, feedback), [completed, selectedExerciseId, profile, feedback]);

  const monthDays = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const monthOffset = (month.getDay() + 6) % 7;
  const calendarLength = Math.ceil((monthOffset + monthDays) / 7) * 7;
  const changeMonth = (offset: number) => {
    setMonth(new Date(month.getFullYear(), month.getMonth() + offset, 1));
    setSelectedDay(null);
  };

  const emptyState = (title: string, message: string) => <div className="progress-empty">
    <h2>{title}</h2><p>{message}</p>
    {onNavigateTab && <button className="progress-action" type="button" onClick={() => onNavigateTab('plan')}>Open your plan</button>}
  </div>;

  return <div className="progress-screen">
    <header className="progress-header"><h1>Progress</h1><p>Review your workouts, weights, and muscles trained.</p></header>
    <nav className="progress-navigation" aria-label="Progress views">
      {(['history', 'strength', 'muscles'] as const).map((tab) => <button key={tab} type="button"
        aria-pressed={view === tab} onClick={() => setView(tab)}>{tab.charAt(0).toUpperCase() + tab.slice(1)}</button>)}
    </nav>
    <main className="progress-content" aria-busy={loading}>
      {loading ? <p className="progress-status" role="status">Opening your training history…</p>
        : error ? <section className="progress-empty" role="alert"><h2>History could not be loaded</h2><p>Your saved records have not been changed. Try again without clearing browser storage.</p><button className="progress-action" onClick={() => { setLoading(true); setError(false); setReload((value) => value + 1); }}>Try again</button></section>
        : view === 'muscles' ? <BodygraphScreen sessions={sessions} onSelectExercise={onSelectExercise} onNavigateTab={onNavigateTab} />
        : view === 'history' ? <section aria-label="Workout history">
          <div className="progress-calendar" aria-label="Completed workouts calendar">
            <div className="progress-calendar-heading">
              <button type="button" className="progress-icon-button" onClick={() => changeMonth(-1)} aria-label="Previous month"><Chevron direction="left" /></button>
              <h2>{month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</h2>
              <button type="button" className="progress-icon-button" onClick={() => changeMonth(1)} aria-label="Next month"><Chevron direction="right" /></button>
            </div>
            <div className="progress-calendar-grid">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => <span className="progress-weekday" key={day}>{day}</span>)}
              {Array.from({ length: calendarLength }, (_, index) => {
                const day = index - monthOffset + 1;
                if (day < 1 || day > monthDays) return <span key={index} aria-hidden="true" />;
                const date = new Date(month.getFullYear(), month.getMonth(), day);
                const key = localDay(date.getTime());
                const count = days.get(key) ?? 0;
                return <button type="button" key={index} className={`progress-calendar-day${count ? ' has-session' : ''}`}
                  aria-label={`${date.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}, ${count} completed ${count === 1 ? 'workout' : 'workouts'}`}
                  aria-pressed={selectedDay === key} aria-current={key === today ? 'date' : undefined}
                  onClick={() => setSelectedDay(selectedDay === key ? null : key)}><span>{day}</span>{count > 0 && <span className="progress-calendar-dot" aria-hidden="true" />}</button>;
              })}
            </div>
            <p className="progress-calendar-key"><span className="progress-calendar-dot" aria-hidden="true" />Completed workout · select a day to filter</p>
          </div>
          <div className="progress-section-heading"><h2>{selectedDay ? 'Selected day' : 'Completed workouts'}</h2>
            {selectedDay ? <button type="button" className="progress-text-button" onClick={() => setSelectedDay(null)}>Show all</button> : <span>{completed.length} total</span>}
          </div>
          {selectedDay && <p className="progress-filter-date">{new Date(`${selectedDay}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p>}
          {!visibleSessions.length ? selectedDay ? <div className="progress-empty"><h3>No completed workouts on this day</h3><p>Choose a marked day, or show all workouts.</p><button type="button" className="progress-action" onClick={() => setSelectedDay(null)}>Show all workouts</button></div>
            : emptyState('No completed workouts yet', 'Finish a workout to see it here. You’ll be able to review your sets and repeat it anytime.')
            : <div className="progress-session-list">{visibleSessions.map((session) => {
              const isExpanded = expanded.includes(session.id);
              const duration = session.endedAt && session.endedAt > session.startedAt ? Math.round(Math.max(0, session.endedAt - session.startedAt - (session.pausedMs ?? 0)) / 60000) : null;
              return <article className="progress-session" key={session.id}>
                <button type="button" className="progress-session-toggle" aria-expanded={isExpanded} aria-controls={`session-${session.id}`}
                  onClick={() => setExpanded(isExpanded ? expanded.filter((id) => id !== session.id) : [...expanded, session.id])}>
                  <span><strong>{session.title || 'Workout'}</strong><small>{dateLabel(session.endedAt ?? session.startedAt)} · {sessionWorkingSetCount(session)} working {sessionWorkingSetCount(session) === 1 ? 'set' : 'sets'}{duration !== null ? ` · ${duration} min` : ''}</small></span>
                  <Chevron direction={isExpanded ? 'up' : 'down'} />
                </button>
                {isExpanded && <div id={`session-${session.id}`} className="progress-session-detail">
                  <p className="progress-session-location">Location: {session.location}</p>
                  {session.items.map((item, index) => <div className="progress-exercise-detail" key={`${item.exerciseId}-${index}`}>
                    {onSelectExercise ? <button type="button" className="progress-exercise-link" onClick={() => onSelectExercise(item.exerciseId)}>{CATALOG_BY_ID[item.exerciseId]?.name ?? item.exerciseId}</button>
                      : <strong>{CATALOG_BY_ID[item.exerciseId]?.name ?? item.exerciseId}</strong>}
                    {item.discomfort && <p>Discomfort recorded · no progression suggestion</p>}
                    {item.skipped ? <p>Skipped · not counted</p> : <ul>{item.sets.map((set, setIndex) => <li key={setIndex}>
                      <span>{set.kind === 'warmup' ? 'Warm-up' : `Set ${setIndex + 1}`}</span>
                       <span>{formatSet(set, unit)}{!set.done ? ' · not completed' : set.kind === 'warmup' ? ' · excluded from working sets' : ''}{set.done && set.effort ? ` · ${set.effort === 1 ? 'Easy' : set.effort === 2 ? 'Right' : 'Hard'}` : ''}</span>
                    </li>)}</ul>}
                  </div>)}
                  {onRepeatSession && session.items.some((item) => !item.skipped && item.sets.length > 0) && <button type="button" className="progress-action" onClick={() => onRepeatSession(session)}>Repeat workout</button>}
                </div>}
              </article>;
            })}</div>}
        </section>
        : <section className="progress-strength" aria-label="Exercise strength history">
          {!exerciseIds.length ? emptyState('See your strength over time', 'Log weights and reps, then complete your sets. Your exercise history and best sets will appear here.') : <>
            <label className="progress-field-label" htmlFor="strength-exercise">Exercise</label>
            <select className="progress-select" id="strength-exercise" value={selectedExerciseId} onChange={(event) => setExerciseId(event.target.value)}>
              {exerciseIds.map((id) => <option key={id} value={id}>{CATALOG_BY_ID[id]?.name ?? id}</option>)}
            </select>
            <section className="progress-pr" aria-label="Recorded personal record">
              <h2>Recorded best</h2>
               {pr ? <><p className="progress-pr-value">{pr.loadKg > 0 ? `${displayLoad(pr.loadKg, unit)} ${unit}` : 'No added load'}<span> × {pr.reps} reps</span></p><p>{dateLabel(pr.timestamp)}</p></>
                : <p>No complete load-and-rep record yet.</p>}
              <p className="progress-definition">Your heaviest completed working set. At the same weight, more reps wins. Warm-ups and skipped exercises don’t count; this isn’t an estimated one-rep max.</p>
            </section>
            {suggestion && <section className="progress-suggestion"><h3>Next-session suggestion</h3><p>{suggestion}</p></section>}
            <div className="progress-section-heading"><h2>Load & reps history</h2><span>{history.length} {history.length === 1 ? 'session' : 'sessions'}</span></div>
            <p className="progress-definition">Completed working sets, newest first. If the weight was left blank, it’s shown as not recorded, not assumed to be bodyweight.</p>
            <ol className="progress-strength-history">{history.map(({ session, sets }) => <li key={session.id}>
              <div className="progress-history-date"><strong>{dateLabel(session.endedAt ?? session.startedAt)}</strong><span>{session.title}</span></div>
               <ul>{sets.map((set, index) => <li key={index}><span>Set {index + 1}</span><strong>{formatSet(set, unit)}</strong></li>)}</ul>
            </li>)}</ol>
            {onSelectExercise && <button type="button" className="progress-text-button" onClick={() => onSelectExercise(selectedExerciseId)}>View exercise instructions</button>}
          </>}
        </section>}
    </main>
  </div>;
}
