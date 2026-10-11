import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useStore } from '../../data/store';
import { MUSCLE_BY_ID } from '../../data/muscles';
import {
  ACTIVITY_LEGEND,
  Credit,
  EmptyState,
  Sheet,
  TARGET_LEGEND,
  TopBar,
} from '../../design/ui';
import { Bodygraph, type TargetState } from './Bodygraph';
import type { View } from './geometry';
import type { MuscleId } from '../../data/types';

/**
 * Screen 6 — Bodygraph & progress (§4.6).
 *
 * Mode A "Exercise targets": pick an exercise from the catalog and see the
 * muscles it classifies as primary / secondary.
 * Mode B "Training activity": shading derived from *real* logged working sets
 * over a 7 / 30 / 90-day window — an estimate, never a measured activation or
 * recovery score. No demo numbers are ever substituted for missing logs.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const WINDOW_OPTIONS: Array<7 | 30 | 90> = [7, 30, 90];

const BAR_COLOR = '#57B9FA';
const AXIS_TEXT = '#A9A2B2';
const AXIS_LINE = '#3d3549';

export function BodygraphScreen() {
  const { sessions, catalog, byId } = useStore();
  const navigate = useNavigate();

  const [mode, setMode] = useState<'targets' | 'activity'>('targets');
  const [view, setView] = useState<View>('front');
  const [query, setQuery] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  // Start with a clearly labelled example so the muscle color mapping is visible on first open.
  const [selectedId, setSelectedId] = useState<string | null>('push-up');
  const [windowDays, setWindowDays] = useState<7 | 30 | 90>(7);
  const [sheetMuscle, setSheetMuscle] = useState<MuscleId | null>(null);

  /* ---------- Mode A: searchable exercise selector ---------- */

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const sorted = [...catalog].sort((a, b) => a.name.localeCompare(b.name));
    const matched = q
      ? sorted.filter(
          (e) =>
            e.name.toLowerCase().includes(q) ||
            e.aliases.some((a) => a.toLowerCase().includes(q)),
        )
      : sorted;
    if (q) return matched.slice(0, 40);
    const selected = selectedId ? matched.find((exercise) => exercise.id === selectedId) : undefined;
    const rest = selected ? matched.filter((exercise) => exercise.id !== selected.id) : matched;
    return [...(selected ? [selected] : []), ...rest].slice(0, 12);
  }, [catalog, query, selectedId]);

  const selectedExercise = selectedId ? byId(selectedId) : undefined;

  const targets = useMemo(() => {
    const ex = selectedId ? byId(selectedId) : undefined;
    if (!ex) return undefined;
    const map: Partial<Record<MuscleId, TargetState>> = {};
    for (const m of ex.primary) map[m] = 'primary';
    for (const m of ex.secondary) if (map[m] !== 'primary') map[m] = 'secondary';
    return map;
  }, [selectedId, byId]);

  /* ---------- Mode B: activity from real logs only ---------- */

  const activity = useMemo(() => {
    const acc: Partial<Record<MuscleId, number>> = {};
    const cutoff = Date.now() - windowDays * DAY_MS;
    for (const s of sessions) {
      if (s.state !== 'done') continue;
      const at = s.endedAt ?? s.startedAt;
      if (at < cutoff) continue;
      for (const item of s.items) {
        const done = item.sets.filter((x) => x.done).length;
        if (done === 0) continue;
        const ex = byId(item.exerciseId);
        if (!ex) continue;
        for (const m of ex.primary) acc[m] = (acc[m] ?? 0) + done;
        for (const m of ex.secondary) acc[m] = (acc[m] ?? 0) + done * 0.5;
      }
    }
    // Round only at aggregation — fractional secondary credit is intentional.
    for (const id of Object.keys(acc) as MuscleId[]) {
      acc[id] = Math.round(acc[id] ?? 0);
    }
    return acc;
  }, [sessions, byId, windowDays]);

  /* ---------- Weekly chart: completed working sets per day (real data) ---------- */

  const chart = useMemo(() => {
    const now = new Date();
    const rows: Array<{ day: string; sets: number }> = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const start = new Date(d).setHours(0, 0, 0, 0);
      const end = start + DAY_MS;
      let sets = 0;
      for (const s of sessions) {
        if (s.state !== 'done') continue;
        const at = s.endedAt ?? s.startedAt;
        if (at < start || at >= end) continue;
        for (const item of s.items) sets += item.sets.filter((x) => x.done).length;
      }
      rows.push({ day: DAY_LABELS[(d.getDay() + 6) % 7], sets });
    }
    return rows;
  }, [sessions]);

  const recent = useMemo(
    () =>
      sessions
        .filter((s) => s.state === 'done')
        .sort((a, b) => (b.endedAt ?? b.startedAt) - (a.endedAt ?? a.startedAt))
        .slice(0, 5),
    [sessions],
  );

  /* ---------- Muscle detail sheet ---------- */

  const sheetExercises = useMemo(() => {
    if (!sheetMuscle) return [];
    const target: MuscleId = sheetMuscle;
    return catalog
      .filter((e) => e.primary.includes(target) || e.secondary.includes(target))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [sheetMuscle, catalog]);

  const sheetLogSets = useMemo(() => {
    if (!sheetMuscle) return 0;
    const target: MuscleId = sheetMuscle;
    const cutoff = Date.now() - 30 * DAY_MS;
    let n = 0;
    for (const s of sessions) {
      if (s.state !== 'done') continue;
      if ((s.endedAt ?? s.startedAt) < cutoff) continue;
      for (const item of s.items) {
        const ex = byId(item.exerciseId);
        if (!ex) continue;
        if (!ex.primary.includes(target) && !ex.secondary.includes(target)) continue;
        n += item.sets.filter((x) => x.done).length;
      }
    }
    return n;
  }, [sheetMuscle, sessions, byId]);

  const sheetMeta = sheetMuscle ? MUSCLE_BY_ID[sheetMuscle] : null;

  const isTargets = mode === 'targets';

  return (
    <>
      <TopBar title="Body & progress" sub="Original cartoon muscle map" />

      <main className="view">
        {/* Mode switch */}
        <div className="seg" role="group" aria-label="Bodygraph mode">
          <button
            type="button"
            aria-pressed={isTargets}
            style={{ minHeight: 44 }}
            onClick={() => setMode('targets')}
          >
            Exercise targets
          </button>
          <button
            type="button"
            aria-pressed={!isTargets}
            style={{ minHeight: 44 }}
            onClick={() => setMode('activity')}
          >
            Training activity
          </button>
        </div>

        {isTargets ? (
          <section className="panel">
            <div className="row between">
              <div className="grow">
                <p className="small" style={{ margin: '0 0 4px' }}>Exercise targets</p>
                <h2 className="h-sec">{selectedExercise?.name ?? 'Pick an exercise'}</h2>
              </div>
              <button type="button" className="btn ghost small-btn" onClick={() => setPickerOpen(true)}>Change</button>
            </div>
          </section>
        ) : (
          <section className="panel">
            <div className="row between" style={{ marginBottom: 10 }}>
              <h2 className="h-sec">Time window</h2>
              <span className="small">Your logs only</span>
            </div>
            <div className="chips" role="group" aria-label="Time window">
              {WINDOW_OPTIONS.map((w) => (
                <button
                  key={w}
                  type="button"
                  className="chip"
                  aria-pressed={windowDays === w}
                  style={{ minHeight: 44 }}
                  onClick={() => setWindowDays(w)}
                >
                  Last {w} days
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Figure */}
        <section className="panel">
          <div className="row between" style={{ marginBottom: 10 }}>
            <h2 className="h-sec">{isTargets ? 'Muscle map' : 'Training activity'}</h2>
            <div className="chips" role="group" aria-label="Body view">
              <button
                type="button"
                className="chip"
                aria-pressed={view === 'front'}
                style={{ minHeight: 44 }}
                onClick={() => setView('front')}
              >
                Front
              </button>
              <button
                type="button"
                className="chip"
                aria-pressed={view === 'back'}
                style={{ minHeight: 44 }}
                onClick={() => setView('back')}
              >
                Back
              </button>
            </div>
          </div>

          <div style={{ perspective: '900px' }}>
            <div
              className="bodywrap body-stage flip"
              style={{
                transform: view === 'back' ? 'rotateY(12deg)' : 'none',
              }}
            >
              <Bodygraph
                view={view}
                targets={isTargets ? targets : undefined}
                activity={isTargets ? undefined : activity}
                selected={sheetMuscle}
                onSelect={setSheetMuscle}
              />
            </div>
          </div>

          {isTargets ? (
            <>
              {TARGET_LEGEND}
              <p className="small" style={{ marginTop: 8 }}>
                Tap a muscle to explore. Colours classify targets, not measured activation.
              </p>
            </>
          ) : (
            <>
              {ACTIVITY_LEGEND}
              <p className="small" style={{ marginTop: 8 }}>
                Based on your logs — an estimate from recorded working sets, not recovery or
                hypertrophy measurement.
              </p>
            </>
          )}
        </section>

        {/* Weekly progress */}
        <section className="panel">
          <h2 className="h-sec" style={{ marginBottom: 8 }}>
            Working sets (last 7 days)
          </h2>
          <div style={{ width: '100%', height: 180 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart} margin={{ top: 6, right: 6, left: -22, bottom: 0 }}>
                <XAxis
                  dataKey="day"
                  stroke={AXIS_TEXT}
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: AXIS_LINE }}
                  interval={0}
                />
                <YAxis
                  stroke={AXIS_TEXT}
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                  width={44}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                  contentStyle={{
                    background: '#1a1522',
                    border: `1px solid ${AXIS_LINE}`,
                    borderRadius: 10,
                    fontSize: 12,
                    color: '#EDEAF5',
                  }}
                  labelStyle={{ color: AXIS_TEXT }}
                  formatter={(value) => [`${value} sets`, 'Working sets']}
                />
                <Bar dataKey="sets" fill={BAR_COLOR} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Recent sessions */}
        <section>
          <h2 className="h-sec" style={{ marginBottom: 8 }}>
            Recent sessions
          </h2>
          {recent.length > 0 ? (
            <div className="panel" style={{ padding: '4px 0' }}>
              {recent.map((s) => {
                const sets = s.items.reduce(
                  (n, it) => n + it.sets.filter((x) => x.done).length,
                  0,
                );
                const when = new Date(s.endedAt ?? s.startedAt).toLocaleDateString(undefined, {
                  day: 'numeric',
                  month: 'short',
                });
                return (
                  <div key={s.id} className="exrow" style={{ cursor: 'default' }}>
                    <span className="dot" aria-hidden="true" />
                    <span className="grow">{s.title}</span>
                    <span className="meta">
                      {when} · {sets} sets
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState
              title="No completed sessions yet"
              body="Your training activity will appear after you log workouts."
            />
          )}
        </section>

        <Credit />

        <Sheet open={pickerOpen} onClose={() => setPickerOpen(false)} title="Pick an exercise">
          <div className="field">
            <label htmlFor="body-exercise-search">Search exercises</label>
            <input id="body-exercise-search" className="input" type="search" value={query}
              placeholder="Name or alias" onChange={(event) => setQuery(event.target.value)} />
          </div>
          <p className="small">Choose a movement to see its primary and secondary targets.</p>
          {results.map((exercise) => (
            <button key={exercise.id} type="button" className="exrow"
              aria-pressed={exercise.id === selectedId}
              onClick={() => { setSelectedId(exercise.id); setPickerOpen(false); setQuery(''); }}>
              <span className="dot" aria-hidden="true" />
              <span className="grow">{exercise.name}</span>
              <span className="meta">{exercise.id === selectedId ? 'Selected' : 'View targets'}</span>
            </button>
          ))}
          {results.length === 0 ? <p className="small" role="status">No matches. Try another exercise name.</p> : null}
        </Sheet>

        {/* Muscle detail sheet */}
        <Sheet
          open={sheetMuscle !== null}
          onClose={() => setSheetMuscle(null)}
          title={sheetMeta ? sheetMeta.name : ''}
        >
          {sheetMeta ? (
            <>
              <p className="sub" style={{ margin: '0 0 12px' }}>
                {sheetMeta.blurb}
              </p>
              <p className="small" style={{ margin: '0 0 14px' }}>
                {sheetLogSets > 0
                  ? `Your training log: ${sheetLogSets} working sets in the last 30 days`
                  : 'No logged sets yet.'}
              </p>
              <h3 className="h-sec" style={{ margin: '0 0 6px' }}>
                Exercises in your library
              </h3>
              {sheetExercises.length > 0 ? (
                sheetExercises.map((ex) => (
                  <button
                    key={ex.id}
                    type="button"
                    className="exrow"
                    onClick={() => {
                      setSheetMuscle(null);
                      navigate(`/exercises/${ex.id}`);
                    }}
                  >
                    <span className="dot" aria-hidden="true" />
                    <span className="grow">{ex.name}</span>
                    <span className="meta">
                      {ex.primary.includes(sheetMeta.id) ? 'primary' : 'secondary'}
                    </span>
                  </button>
                ))
              ) : (
                <p className="small">No exercises in your library target this muscle.</p>
              )}
            </>
          ) : null}
        </Sheet>
      </main>
    </>
  );
}
