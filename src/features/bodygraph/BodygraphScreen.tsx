import { useEffect, useMemo, useState } from 'react';
import type { WorkoutSession } from '../../data/types';
import { CATALOG, CATALOG_BY_ID, searchExercises } from '../../data/catalog';
import { MUSCLES, MUSCLE_BY_ID } from '../../data/muscles';
import { getWorkoutSessions } from '../../data/db';
import { Bodygraph, type BodygraphMode, type TimeWindow } from './Bodygraph';
import { calculateMuscleActivity } from './activity';
import './Bodygraph.css';

export interface BodygraphScreenProps {
  onSelectExercise?: (exerciseId: string) => void;
  onNavigateTab?: (tab: string) => void;
  className?: string;
  /** Progress supplies already-loaded history to avoid a second database read. */
  sessions?: WorkoutSession[];
}

export function BodygraphScreen({ onSelectExercise, onNavigateTab, className = '', sessions: suppliedSessions }: BodygraphScreenProps) {
  const [mode, setMode] = useState<BodygraphMode>('targets');
  const [window, setWindow] = useState<TimeWindow>('week');
  const [exerciseId, setExerciseId] = useState('push-up');
  const [search, setSearch] = useState('');
  const [showPicker, setShowPicker] = useState(false);
  const [showSecondary, setShowSecondary] = useState(false);
  const [storedSessions, setStoredSessions] = useState<WorkoutSession[]>([]);
  const [loading, setLoading] = useState(!suppliedSessions);
  const [error, setError] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (suppliedSessions) return;
    let cancelled = false;
    getWorkoutSessions().then((sessions) => {
      if (!cancelled) setStoredSessions(sessions);
    }).catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [suppliedSessions, reload]);

  const sessions = suppliedSessions ?? storedSessions;
  const exercise = CATALOG_BY_ID[exerciseId] ?? CATALOG[0];
  const results = useMemo(() => (search.trim() ? searchExercises(search) : CATALOG).slice(0, 20), [search]);
  const activity = useMemo(() => calculateMuscleActivity(sessions, CATALOG, window), [sessions, window]);

  return (
    <section className={`bodygraph-screen ${className}`} aria-label="Muscles">
      <div className="bodygraph-screen-seg" role="group" aria-label="Muscle map mode">
        <button type="button" aria-pressed={mode === 'targets'} onClick={() => setMode('targets')}>Exercise targets</button>
        <button type="button" aria-pressed={mode === 'activity'} onClick={() => setMode('activity')}>Training activity</button>
      </div>

      {mode === 'targets' ? (
        <div className="bodygraph-target-picker">
          <button type="button" className="bodygraph-selected-exercise" aria-expanded={showPicker}
            onClick={() => setShowPicker(!showPicker)}>
            <span><small>Showing targets for</small><strong>{exercise?.name ?? 'Choose an exercise'}</strong></span>
            <span className="bodygraph-change">Change</span>
          </button>
          {showPicker && <div className="bodygraph-search-panel">
            <label htmlFor="muscle-exercise-search">Find an exercise</label>
            <input id="muscle-exercise-search" type="search" autoFocus placeholder="Search exercises…"
              value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => {
                if (event.key === 'Escape') setShowPicker(false);
              }} />
            <div className="bodygraph-search-results">
              {results.map((result) => <button type="button" key={result.id}
                onClick={() => { setExerciseId(result.id); setSearch(''); setShowPicker(false); }}>
                <strong>{result.name}</strong><small>{result.primary.map((id) => MUSCLE_BY_ID[id].short).join(', ')}</small>
              </button>)}
              {!results.length && <p>No matching exercises. Try another name.</p>}
            </div>
          </div>}
        </div>
      ) : (
        <div className="bodygraph-activity-controls">
          <div className="bodygraph-window-seg" role="group" aria-label="Activity time window">
            {([['week', 'Last 7 days'], ['month', 'Last 30 days'], ['all', 'All time']] as const).map(([value, label]) => (
              <button type="button" key={value} aria-pressed={window === value} onClick={() => setWindow(value)}>{label}</button>
            ))}
          </div>
          {!loading && !error && <p>{activity.actualWorkingSets} completed working sets in this period</p>}
        </div>
      )}

      <Bodygraph mode={mode} selectedExercise={exercise} sessions={sessions} timeWindow={window}
        showModeToggle={false} showWindowToggle={false} showExercisePicker={false}
        onSelectExercise={onSelectExercise} />
      <p className="bodygraph-explanation">{mode === 'targets'
        ? 'Tap a muscle to explore. Colours show exercise targets, not measured activation.'
        : 'Colours show primary working sets from completed sessions, not recovery or readiness.'}</p>

      {mode === 'activity' && <section className="bodygraph-activity-breakdown" aria-label="Working sets by muscle">
        <h2>Working sets by muscle</h2>
        {loading ? <p role="status">Loading your activity…</p> : error ? <div role="alert">
          <p>Activity could not be loaded. Your history has not been changed.</p>
          <button type="button" onClick={() => { setLoading(true); setError(false); setReload((value) => value + 1); }}>Try again</button>
        </div> : activity.actualWorkingSets === 0 ? <div className="bodygraph-empty">
          <strong>No completed working sets in this period</strong>
          <p>Finish a workout and mark the sets you complete to see activity here.</p>
          {onNavigateTab && <button type="button" onClick={() => onNavigateTab('plan')}>Open your plan</button>}
        </div> : <>
          <label className="bodygraph-secondary-option"><input type="checkbox" checked={showSecondary}
            onChange={(event) => setShowSecondary(event.target.checked)} />Show supporting contribution estimate</label>
          <p className="bodygraph-explanation">Each primary target gets credit for a set. Muscle counts overlap and must not be added as actual sets. Warm-ups and skipped exercises are excluded.</p>
          {showSecondary && <p className="bodygraph-explanation">Supporting estimate = 0.5 × working sets for secondary targets. This heuristic is shown separately, not added to the map.</p>}
          <div className="bodygraph-volume-head"><span>Muscle</span><span>Primary sets</span>{showSecondary && <span>Supporting estimate</span>}</div>
          {MUSCLES.map((muscle) => <div key={muscle.id} className="bodygraph-volume-row">
            <span>{muscle.short}</span><strong>{activity.primary[muscle.id] ?? 0}</strong>
            {showSecondary && <span>{activity.secondaryEstimate[muscle.id] ?? 0}</span>}
          </div>)}
        </>}
      </section>}
    </section>
  );
}
