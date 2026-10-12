import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { Exercise, MuscleId, WorkoutSession } from '../../data/types';
import { MUSCLE_BY_ID } from '../../data/muscles';
import { CATALOG, CATALOG_BY_ID, searchExercises } from '../../data/catalog';
import { getWorkoutSessions } from '../../data/db';
import { downloadBackupFile, importBackupFile } from '../../data/backup';
import { Bodygraph, type BodygraphMode, type BodygraphView, type TimeWindow } from './Bodygraph';
import './Bodygraph.css';

export interface BodygraphScreenProps {
  /** Optional callback when an exercise is selected */
  onSelectExercise?: (exerciseId: string) => void;
  /** Navigation callback to switch top-level tabs */
  onNavigateTab?: (tab: string) => void;
  /** Optional custom CSS classes */
  className?: string;
}

export const BodygraphScreen: React.FC<BodygraphScreenProps> = ({
  onSelectExercise,
  onNavigateTab: _onNavigateTab,
  className = '',
}) => {
  // Mode state: 'targets' (Mode A) vs 'activity' (Mode B)
  const [mode, setMode] = useState<BodygraphMode>('targets');
  const [view, setView] = useState<BodygraphView>('front');
  const [timeWindow, setTimeWindow] = useState<TimeWindow>('week');

  // Exercise picker state for Mode A
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedExerciseId, setSelectedExerciseId] = useState<string>('push-up');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Sessions and data state
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [loading, setLoading] = useState(true);

  // History log expansion state
  const [expandedSessionIds, setExpandedSessionIds] = useState<Set<string>>(new Set());

  // Backup / Restore feedback & modal state
  const [backupStatus, setBackupStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch session history from Dexie
  const loadSessions = useCallback(async () => {
    try {
      const data = await getWorkoutSessions();
      setSessions(data);
    } catch (err) {
      console.error('Failed to load workout sessions for bodygraph:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  // Selected exercise resolution
  const selectedExercise = useMemo<Exercise | null>(() => {
    return CATALOG_BY_ID[selectedExerciseId] ?? CATALOG[0] ?? null;
  }, [selectedExerciseId]);

  // Exercise search filtering for Mode A
  const exerciseSearchResults = useMemo(() => {
    if (!searchQuery.trim()) {
      return CATALOG.slice(0, 15);
    }
    return searchExercises(searchQuery).slice(0, 20);
  }, [searchQuery]);

  // Handle exercise selection
  const handleSelectExercise = (exerciseId: string) => {
    setSelectedExerciseId(exerciseId);
    setSearchQuery('');
    setIsDropdownOpen(false);
    onSelectExercise?.(exerciseId);
  };

  // Toggle workout history item expansion
  const toggleSessionExpand = (sessionId: string) => {
    setExpandedSessionIds((prev) => {
      const next = new Set(prev);
      if (next.has(sessionId)) {
        next.delete(sessionId);
      } else {
        next.add(sessionId);
      }
      return next;
    });
  };

  // Completed sessions list
  const completedSessions = useMemo(() => {
    return sessions
      .filter((s) => s.state === 'done')
      .sort((a, b) => (b.endedAt ?? b.startedAt) - (a.endedAt ?? a.startedAt));
  }, [sessions]);

  // Calculate volume stats per muscle group for Weekly Volume Chart (§4.6)
  const volumeChartData = useMemo(() => {
    const now = Date.now();
    const cutoff =
      timeWindow === 'week'
        ? now - 7 * 24 * 60 * 60 * 1000
        : timeWindow === 'month'
          ? now - 30 * 24 * 60 * 60 * 1000
          : 0;

    const muscleSets: Partial<Record<MuscleId, number>> = {};

    for (const s of completedSessions) {
      const timestamp = s.endedAt ?? s.startedAt;
      if (cutoff > 0 && timestamp < cutoff) continue;

      for (const item of s.items) {
        const ex = CATALOG_BY_ID[item.exerciseId];
        if (!ex) continue;

        const doneSets = item.sets.filter((st) => st.done).length;
        if (doneSets === 0) continue;

        for (const p of ex.primary) {
          muscleSets[p] = (muscleSets[p] ?? 0) + doneSets;
        }
        for (const sec of ex.secondary) {
          muscleSets[sec] = (muscleSets[sec] ?? 0) + Math.round(doneSets * 0.5);
        }
      }
    }

    // Standard representative muscle groups to display in the chart
    const targetGroups: Array<{ label: string; id: MuscleId }> = [
      { label: 'Chest', id: 'chest' },
      { label: 'Lats/Back', id: 'lats' },
      { label: 'Upper Back', id: 'upper_back' },
      { label: 'Shoulders', id: 'front_delts' },
      { label: 'Triceps', id: 'triceps' },
      { label: 'Biceps', id: 'biceps' },
      { label: 'Quads', id: 'quads' },
      { label: 'Hamstrings', id: 'hamstrings' },
      { label: 'Glutes', id: 'glutes' },
      { label: 'Core', id: 'abs' },
      { label: 'Calves', id: 'calves' },
    ];

    return targetGroups.map((group) => ({
      name: group.label,
      sets: Math.round(muscleSets[group.id] ?? 0),
    }));
  }, [completedSessions, timeWindow]);

  const totalVolumeInWindow = useMemo(() => {
    return volumeChartData.reduce((acc, curr) => acc + curr.sets, 0);
  }, [volumeChartData]);

  // Backup Export Handler
  const handleExportBackup = async () => {
    try {
      await downloadBackupFile();
      setBackupStatus({
        type: 'success',
        message: 'Backup exported and downloaded successfully as JSON.',
      });
      setTimeout(() => setBackupStatus(null), 5000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setBackupStatus({
        type: 'error',
        message: `Failed to export backup: ${msg}`,
      });
    }
  };

  // Restore file selection handler
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingFile(file);
    setShowRestoreConfirm(true);
    // Reset file input so same file can be re-selected if needed
    e.target.value = '';
  };

  // Execute restore after user confirmation
  const handleConfirmRestore = async () => {
    if (!pendingFile) return;
    setShowRestoreConfirm(false);

    try {
      const res = await importBackupFile(pendingFile);
      if (res.success) {
        setBackupStatus({
          type: 'success',
          message: 'Database backup restored successfully! Reloading records…',
        });
        await loadSessions();
        setTimeout(() => setBackupStatus(null), 5000);
      } else {
        setBackupStatus({
          type: 'error',
          message: `Restore failed: ${res.error || 'Unknown error'}`,
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setBackupStatus({
        type: 'error',
        message: `Error reading backup file: ${msg}`,
      });
    } finally {
      setPendingFile(null);
    }
  };

  const handleCancelRestore = () => {
    setShowRestoreConfirm(false);
    setPendingFile(null);
  };

  if (loading) {
    return (
      <main className="view" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <p className="small">Loading muscle map & tracking data…</p>
      </main>
    );
  }

  return (
    <div className={`bodygraph-screen ${className}`}>
      {/* Top Header */}
      <header className="topbar">
        <h1>Body & Progress</h1>
        <p>Interactive 2D cartoon muscle map & volume tracking</p>
      </header>

      <main className="view">
        {/* Mode Switcher Segmented Pills (§4.6) */}
        <div className="seg" role="group" aria-label="Bodygraph Mode Selector">
          <button
            type="button"
            aria-pressed={mode === 'targets'}
            onClick={() => setMode('targets')}
          >
            Exercise Targets (Mode A)
          </button>
          <button
            type="button"
            aria-pressed={mode === 'activity'}
            onClick={() => setMode('activity')}
          >
            Training Activity Heatmap (Mode B)
          </button>
        </div>

        {/* Mode A: Exercise Search & Picker (§4.6) */}
        {mode === 'targets' && (
          <section className="panel" aria-label="Exercise muscle target picker">
            <h2 className="h-sec" style={{ marginBottom: 8 }}>
              Select Exercise to Highlight Targets
            </h2>

            <div style={{ position: 'relative' }}>
              <input
                type="search"
                className="input"
                placeholder="Search exercise (e.g. Bench Press, Squat, Pull-up)..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setIsDropdownOpen(true);
                }}
                onFocus={() => setIsDropdownOpen(true)}
                aria-label="Search exercises to inspect targets"
              />

              {/* Autocomplete Results Dropdown */}
              {isDropdownOpen && exerciseSearchResults.length > 0 && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    zIndex: 25,
                    background: 'var(--surface)',
                    border: '1px solid var(--hairline)',
                    borderRadius: 'var(--radius-s)',
                    maxHeight: 240,
                    overflowY: 'auto',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                    marginTop: 4,
                  }}
                >
                  {exerciseSearchResults.map((ex) => (
                    <button
                      key={ex.id}
                      type="button"
                      style={{
                        display: 'block',
                        width: '100%',
                        textAlign: 'left',
                        padding: '10px 14px',
                        background: ex.id === selectedExerciseId ? 'var(--surface-2)' : 'transparent',
                        border: 0,
                        borderBottom: '1px solid var(--hairline)',
                        color: 'var(--text)',
                        fontFamily: 'inherit',
                        cursor: 'pointer',
                        fontSize: 14,
                      }}
                      onClick={() => handleSelectExercise(ex.id)}
                    >
                      <div style={{ fontWeight: 650 }}>{ex.name}</div>
                      <div className="small" style={{ fontSize: 11, color: 'var(--text-2)' }}>
                        Primary: {ex.primary.map((p) => MUSCLE_BY_ID[p]?.short || p).join(', ')}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Selected Exercise Badge Details */}
            {selectedExercise && (
              <div
                style={{
                  marginTop: 12,
                  padding: '10px 12px',
                  background: 'var(--bg-raised)',
                  borderRadius: 'var(--radius-s)',
                  border: '1px solid var(--hairline)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong style={{ fontSize: 15, color: 'var(--text)' }}>
                    {selectedExercise.name}
                  </strong>
                  <span
                    className="chip"
                    style={{
                      fontSize: 10,
                      padding: '2px 8px',
                      minHeight: 20,
                      textTransform: 'uppercase',
                    }}
                  >
                    {selectedExercise.movement}
                  </span>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-2)', alignSelf: 'center' }}>
                    Primary:
                  </span>
                  {selectedExercise.primary.map((p) => (
                    <span
                      key={p}
                      style={{
                        fontSize: 11,
                        background: '#FF4757',
                        color: '#ffffff',
                        padding: '2px 7px',
                        borderRadius: 6,
                        fontWeight: 700,
                      }}
                    >
                      {MUSCLE_BY_ID[p]?.short || p}
                    </span>
                  ))}

                  {selectedExercise.secondary.length > 0 && (
                    <>
                      <span
                        style={{
                          fontSize: 11,
                          color: 'var(--text-2)',
                          alignSelf: 'center',
                          marginLeft: 6,
                        }}
                      >
                        Secondary:
                      </span>
                      {selectedExercise.secondary.map((s) => (
                        <span
                          key={s}
                          style={{
                            fontSize: 11,
                            background: '#00D2FF',
                            color: '#021217',
                            padding: '2px 7px',
                            borderRadius: 6,
                            fontWeight: 700,
                          }}
                        >
                          {MUSCLE_BY_ID[s]?.short || s}
                        </span>
                      ))}
                    </>
                  )}
                </div>
              </div>
            )}
          </section>
        )}

        {/* Mode B: Time Window Selector (§4.6) */}
        {mode === 'activity' && (
          <section className="panel" aria-label="Heatmap time window selection">
            <div className="row between" style={{ marginBottom: 6 }}>
              <h2 className="h-sec">Activity Time Window</h2>
              <span className="small">{totalVolumeInWindow} total sets logged</span>
            </div>
            <p className="small" style={{ margin: '0 0 10px', color: 'var(--text-2)' }}>
              Training activity estimate based on logged sets (§4.6)
            </p>

            <div className="bodygraph-window-seg" role="group" aria-label="Heatmap time window">
              <button
                type="button"
                aria-pressed={timeWindow === 'week'}
                onClick={() => setTimeWindow('week')}
              >
                Last 7 Days
              </button>
              <button
                type="button"
                aria-pressed={timeWindow === 'month'}
                onClick={() => setTimeWindow('month')}
              >
                Last 30 Days
              </button>
              <button
                type="button"
                aria-pressed={timeWindow === 'all'}
                onClick={() => setTimeWindow('all')}
              >
                All Time
              </button>
            </div>
          </section>
        )}

        {/* Interactive 3D Cartoon Bodygraph (§4.6, §5.1, §5.2, §8) */}
        <section
          className="panel"
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}
          aria-label="Interactive Cartoon Bodygraph"
        >
          <Bodygraph
            mode={mode}
            view={view}
            onViewChange={setView}
            timeWindow={timeWindow}
            onTimeWindowChange={setTimeWindow}
            showWindowToggle={false}
            selectedExercise={mode === 'targets' ? selectedExercise : null}
            sessions={sessions}
            catalog={CATALOG}
            showModeToggle={false} // Mode handled by outer screen pills
            showViewToggle={true} // 3D flip Front/Back toggle
            showLegend={true}
            onSelectExercise={(exId) => {
              setSelectedExerciseId(exId);
              setMode('targets');
              onSelectExercise?.(exId);
            }}
          />
          <p className="small" style={{ textAlign: 'center', marginTop: 10 }}>
            Tap any muscle on the cartoon figure to inspect targeting exercises and history.
          </p>
        </section>

        {/* Weekly Volume Chart (using recharts) (§4.6) */}
        <section className="panel" aria-label="Muscle volume chart">
          <div className="row between" style={{ marginBottom: 8 }}>
            <h2 className="h-sec">Muscle Volume Distribution</h2>
            <span className="small">
              {timeWindow === 'week' ? 'Last 7 Days' : timeWindow === 'month' ? 'Last 30 Days' : 'All Time'}
            </span>
          </div>
          <p className="small" style={{ margin: '0 0 14px' }}>
            Completed working sets per muscle group.
          </p>

          {totalVolumeInWindow === 0 ? (
            <div className="empty" style={{ padding: '20px 14px' }}>
              <p style={{ margin: 0, fontWeight: 600 }}>No logged working sets in this period.</p>
              <p className="small" style={{ margin: '4px 0 0' }}>
                Complete a workout to view your muscle volume chart.
              </p>
            </div>
          ) : (
            <div style={{ width: '100%', height: 230, minHeight: 230 }}>
              <ResponsiveContainer width="100%" height={230}>
                <BarChart
                  data={volumeChartData}
                  margin={{ top: 10, right: 10, left: -24, bottom: 24 }}
                >
                  <XAxis
                    dataKey="name"
                    tick={{ fill: '#94A3B8', fontSize: 10 }}
                    axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                    tickLine={false}
                    interval={0}
                    angle={-30}
                    textAnchor="end"
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fill: '#94A3B8', fontSize: 11 }}
                    axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                    tickLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: 'rgba(0, 229, 255, 0.06)' }}
                    contentStyle={{
                      backgroundColor: '#161A23',
                      borderColor: 'rgba(255,255,255,0.12)',
                      borderRadius: 10,
                      color: '#F8FAFC',
                      fontSize: 12,
                      boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                    }}
                    itemStyle={{ color: '#00E5FF' }}
                    formatter={(value: any) => [`${value} sets`, 'Working Sets']}
                  />
                  <Bar dataKey="sets" fill="#00E5FF" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        {/* Workout History Log (§4.6) */}
        <section className="panel" aria-label="Workout history logs">
          <div className="row between" style={{ marginBottom: 10 }}>
            <h2 className="h-sec">Workout History Log</h2>
            <span className="small">{completedSessions.length} sessions</span>
          </div>

          {completedSessions.length === 0 ? (
            <div className="empty">
              <p style={{ fontWeight: 650, margin: '0 0 4px', color: 'var(--text)' }}>
                No completed workouts yet.
              </p>
              <p className="small" style={{ margin: 0 }}>
                Finish a workout session to see your full exercise history and load logs here.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {completedSessions.map((session) => {
                const isExpanded = expandedSessionIds.has(session.id);
                const dateStr = new Date(session.endedAt ?? session.startedAt).toLocaleDateString(
                  undefined,
                  {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  },
                );

                const totalCompletedSets = session.items.reduce(
                  (total, item) => total + item.sets.filter((s) => s.done).length,
                  0,
                );

                const totalLoadKg = session.items.reduce((total, item) => {
                  return (
                    total +
                    item.sets
                      .filter((s) => s.done && s.loadKg && s.reps)
                      .reduce((sub, s) => sub + (s.loadKg || 0) * (s.reps || 0), 0)
                  );
                }, 0);

                const durationMs =
                  session.endedAt && session.startedAt
                    ? session.endedAt - session.startedAt
                    : 0;
                const durationMin = Math.max(1, Math.round(durationMs / 60000));

                return (
                  <div
                    key={session.id}
                    style={{
                      background: 'var(--bg-raised)',
                      borderRadius: 'var(--radius-s)',
                      border: '1px solid var(--hairline)',
                      overflow: 'hidden',
                    }}
                  >
                    {/* Header Row (Click to Expand/Collapse) */}
                    <button
                      type="button"
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        background: 'transparent',
                        border: 0,
                        padding: '12px 14px',
                        cursor: 'pointer',
                        color: 'var(--text)',
                        fontFamily: 'inherit',
                      }}
                      onClick={() => toggleSessionExpand(session.id)}
                      aria-expanded={isExpanded}
                    >
                      <div className="row between">
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 15 }}>{session.title}</div>
                          <div className="small" style={{ marginTop: 2 }}>
                            {dateStr} · {durationMin} min · {totalCompletedSets} sets
                            {totalLoadKg > 0 ? ` · ${Math.round(totalLoadKg)} kg load` : ''}
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span
                            className="chip"
                            style={{
                              fontSize: 10,
                              padding: '2px 6px',
                              minHeight: 20,
                              textTransform: 'uppercase',
                            }}
                          >
                            {session.location}
                          </span>
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            style={{
                              transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                              transition: 'transform 200ms ease',
                            }}
                            aria-hidden="true"
                          >
                            <path d="M6 9l6 6 6-6" />
                          </svg>
                        </div>
                      </div>
                    </button>

                    {/* Expanded Exercise Breakdown */}
                    {isExpanded && (
                      <div
                        style={{
                          borderTop: '1px solid var(--hairline)',
                          padding: '12px 14px',
                          background: 'rgba(0,0,0,0.2)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 12,
                        }}
                      >
                        {session.items.map((item, itemIdx) => {
                          const ex = CATALOG_BY_ID[item.exerciseId];
                          const completedSets = item.sets.filter((s) => s.done);

                          return (
                            <div key={itemIdx} style={{ fontSize: 13 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <strong style={{ color: 'var(--text)' }}>
                                  {ex?.name || item.exerciseId}
                                </strong>
                                <span className="small">{completedSets.length} sets completed</span>
                              </div>

                              <div
                                style={{
                                  display: 'flex',
                                  flexWrap: 'wrap',
                                  gap: 6,
                                  marginTop: 6,
                                }}
                              >
                                {item.sets.map((set, setIdx) => (
                                  <span
                                    key={setIdx}
                                    style={{
                                      fontSize: 11,
                                      padding: '3px 8px',
                                      borderRadius: 6,
                                      background: set.done ? 'var(--surface-2)' : 'transparent',
                                      border: '1px solid var(--hairline)',
                                      color: set.done ? 'var(--text)' : 'var(--text-2)',
                                      opacity: set.done ? 1 : 0.6,
                                    }}
                                  >
                                    Set {setIdx + 1}:{' '}
                                    {set.reps !== null ? `${set.reps} reps` : '—'}{' '}
                                    {set.loadKg !== null && set.loadKg > 0 ? `@ ${set.loadKg} kg` : '(BW)'}
                                    {set.effort === 1 ? ' · Easy' : set.effort === 3 ? ' · Hard' : ''}
                                  </span>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Data Backup & Restore Section (§9) */}
        <section className="panel" aria-label="Database backup and restore">
          <h2 className="h-sec" style={{ marginBottom: 4 }}>
            Data Backup & Restore
          </h2>
          <p className="small" style={{ margin: '0 0 14px' }}>
            All your training data, history, and generated routines live purely in your local browser
            database. Export a JSON backup file to prevent data loss or restore to another device.
          </p>

          {/* Feedback banner */}
          {backupStatus && (
            <div
              className="banner"
              style={{
                marginBottom: 12,
                borderLeftColor: backupStatus.type === 'success' ? 'var(--good)' : 'var(--danger)',
              }}
            >
              {backupStatus.message}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn primary grow"
              onClick={handleExportBackup}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Export Backup (JSON)
            </button>

            <button
              type="button"
              className="btn ghost grow"
              onClick={() => fileInputRef.current?.click()}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              Restore Backup
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
          </div>
        </section>

        {/* Confirmation Modal for Database Restore */}
        {showRestoreConfirm && (
          <div className="scrim" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div
              className="panel"
              style={{
                width: '90%',
                maxWidth: 400,
                background: 'var(--bg-raised)',
                border: '1.5px solid var(--accent)',
                boxShadow: '0 12px 32px rgba(0,0,0,0.8)',
              }}
              role="dialog"
              aria-modal="true"
              aria-labelledby="restore-modal-title"
            >
              <h3 id="restore-modal-title" style={{ margin: '0 0 8px', fontSize: 18 }}>
                Confirm Backup Restore
              </h3>
              <p className="small" style={{ margin: '0 0 16px', lineHeight: 1.5 }}>
                Restoring <strong style={{ color: 'var(--text)' }}>{pendingFile?.name}</strong> will overwrite
                your existing local workout plans, user preferences, and logged sessions with the data in the
                file. This action cannot be undone.
              </p>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn ghost small-btn"
                  onClick={handleCancelRestore}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn danger small-btn"
                  onClick={handleConfirmRestore}
                >
                  Confirm & Restore
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Visible Attribution (§6.1, §4.6) */}
        <footer className="credit" style={{ textAlign: 'center', marginTop: 14 }}>
          <p>
            Exercise data by{' '}
            <a href="https://repdb.co" target="_blank" rel="noopener noreferrer">
              RepDB (repdb.co)
            </a>{' '}
            · Offline-first personal training
          </p>
        </footer>
      </main>
    </div>
  );
};
