import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type {
  WorkoutSession,
  SessionItem,
  PerformedSet,
  UserProfile,
  Exercise,
  Movement,
} from '../../data/types';
import {
  getActiveWorkout,
  saveActiveWorkout,
  clearActiveWorkout,
  saveWorkoutSession,
  getUserProfile,
  getWorkoutSessions,
} from '../../data/db';
import {
  CATALOG_BY_ID,
  findSubstitutes,
  getExerciseImageUrl,
  searchExercises,
} from '../../data/catalog';
import { MUSCLE_BY_ID } from '../../data/muscles';
import { RestTimer } from './RestTimer';
import './ActiveWorkout.css';

export interface ActiveWorkoutScreenProps {
  session?: WorkoutSession;
  onFinishSession: () => void;
  onExitSession: () => void;
  onSelectExercise?: (exerciseId: string) => void;
}

export const ActiveWorkoutScreen: React.FC<ActiveWorkoutScreenProps> = ({
  session: initialPropSession,
  onFinishSession,
  onExitSession,
  onSelectExercise,
}) => {
  const [activeSession, setActiveSession] = useState<WorkoutSession | null>(
    initialPropSession ?? null
  );
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [pastSessions, setPastSessions] = useState<WorkoutSession[]>([]);
  const [loading, setLoading] = useState(true);

  // Elapsed Timer state
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isWorkoutPaused, setIsWorkoutPaused] = useState(false);

  // Rest Timer state
  const [restTimerSeconds, setRestTimerSeconds] = useState(90);
  const [isRestTimerOpen, setIsRestTimerOpen] = useState(false);

  // Expandable form cues per exercise
  const [expandedCues, setExpandedCues] = useState<Record<string, boolean>>({});

  // Image pose toggle (start vs peak) per exercise
  const [imagePoses, setImagePoses] = useState<Record<string, 'start' | 'peak'>>({});

  // Modals state
  const [swapModalItemIdx, setSwapModalItemIdx] = useState<number | null>(null);
  const [isAddExerciseModalOpen, setIsAddExerciseModalOpen] = useState(false);
  const [isFinishModalOpen, setIsFinishModalOpen] = useState(false);

  // Add exercise search & filter
  const [addSearchQuery, setAddSearchQuery] = useState('');
  const [addMovementFilter, setAddMovementFilter] = useState<Movement | ''>('');

  // 1. Mount & Restore Active Workout (§4.4 & §9)
  useEffect(() => {
    async function initSession() {
      try {
        const [userProf, pastWorkouts, savedActive] = await Promise.all([
          getUserProfile(),
          getWorkoutSessions(15),
          getActiveWorkout(),
        ]);

        setProfile(userProf);
        setPastSessions(pastWorkouts);

        if (savedActive && savedActive.state === 'active') {
          // Restore active session automatically so reloading never loses state
          setActiveSession(savedActive);
          const initialElapsed = Math.max(
            0,
            Math.floor((Date.now() - savedActive.startedAt) / 1000)
          );
          setElapsedSeconds(initialElapsed);
        } else if (initialPropSession) {
          // Use provided session and immediately save to DB
          setActiveSession(initialPropSession);
          await saveActiveWorkout(initialPropSession);
          setElapsedSeconds(0);
        } else {
          // Fallback session if none active or provided
          const fallbackSession: WorkoutSession = {
            id: `session-${Date.now()}`,
            title: 'Full Body Quick Workout',
            location: userProf.activeLocation ?? 'home',
            startedAt: Date.now(),
            state: 'active',
            items: [
              {
                exerciseId: 'push-up',
                planned: {
                  exerciseId: 'push-up',
                  sets: 3,
                  reps: '8-12',
                  restSec: 90,
                  reason: 'Full body foundational push',
                },
                sets: [
                  { reps: null, loadKg: null, done: false },
                  { reps: null, loadKg: null, done: false },
                  { reps: null, loadKg: null, done: false },
                ],
              },
              {
                exerciseId: 'bodyweight-squat',
                planned: {
                  exerciseId: 'bodyweight-squat',
                  sets: 3,
                  reps: '10-15',
                  restSec: 90,
                  reason: 'Lower body knee-dominant compound',
                },
                sets: [
                  { reps: null, loadKg: null, done: false },
                  { reps: null, loadKg: null, done: false },
                  { reps: null, loadKg: null, done: false },
                ],
              },
            ],
          };
          setActiveSession(fallbackSession);
          await saveActiveWorkout(fallbackSession);
          setElapsedSeconds(0);
        }
      } catch (err) {
        console.error('Failed to restore active workout session:', err);
      } finally {
        setLoading(false);
      }
    }

    initSession();
  }, [initialPropSession]);

  // 2. Elapsed workout timer interval
  useEffect(() => {
    if (loading || isWorkoutPaused || isFinishModalOpen) return;

    const timer = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [loading, isWorkoutPaused, isFinishModalOpen]);

  // Helper to persist session changes immediately to DB
  const updateSessionState = useCallback((updater: (prev: WorkoutSession) => WorkoutSession) => {
    setActiveSession((prev) => {
      if (!prev) return prev;
      const updated = updater(prev);
      // Autosave immediately (§4.4 & §9)
      saveActiveWorkout(updated).catch((err) => {
        console.error('Autosave failed:', err);
      });
      return updated;
    });
  }, []);

  // Format MM:SS or H:MM:SS
  const formattedElapsed = useMemo(() => {
    const hours = Math.floor(elapsedSeconds / 3600);
    const mins = Math.floor((elapsedSeconds % 3600) / 60);
    const secs = elapsedSeconds % 60;
    const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);

    if (hours > 0) {
      return `${hours}:${pad(mins)}:${pad(secs)}`;
    }
    return `${pad(mins)}:${pad(secs)}`;
  }, [elapsedSeconds]);

  // Progress metrics: completed sets / total sets across non-skipped exercises
  const { completedSetsCount, totalSetsCount, progressPercent } = useMemo(() => {
    if (!activeSession) return { completedSetsCount: 0, totalSetsCount: 0, progressPercent: 0 };
    let done = 0;
    let total = 0;
    for (const item of activeSession.items) {
      if (item.skipped) continue;
      for (const s of item.sets) {
        total++;
        if (s.done) done++;
      }
    }
    const percent = total > 0 ? Math.round((done / total) * 100) : 0;
    return { completedSetsCount: done, totalSetsCount: total, progressPercent: percent };
  }, [activeSession]);

  // Lookup previous session performance for exercise and set index
  const getPreviousPerformance = useCallback(
    (exerciseId: string, setIndex: number): string | null => {
      for (const past of pastSessions) {
        if (past.state !== 'done') continue;
        const matchingItem = past.items.find((it) => it.exerciseId === exerciseId && !it.skipped);
        if (matchingItem && matchingItem.sets[setIndex]?.done) {
          const s = matchingItem.sets[setIndex];
          if (s.loadKg !== null && s.loadKg !== undefined && s.reps !== null) {
            return `${s.loadKg}kg × ${s.reps}`;
          } else if (s.loadKg !== null && s.loadKg !== undefined) {
            return `${s.loadKg}kg`;
          } else if (s.reps !== null) {
            return `${s.reps} reps`;
          }
        }
      }
      return null;
    },
    [pastSessions]
  );

  // Set row update handlers
  const handleUpdateSetField = (
    itemIdx: number,
    setIdx: number,
    field: 'loadKg' | 'reps',
    valueStr: string
  ) => {
    const num = valueStr === '' ? null : Math.max(0, parseFloat(valueStr));
    updateSessionState((session) => {
      const newItems = [...session.items];
      const targetItem = { ...newItems[itemIdx] };
      const newSets = [...targetItem.sets];
      newSets[setIdx] = {
        ...newSets[setIdx],
        [field]: isNaN(num as number) ? null : num,
      };
      targetItem.sets = newSets;
      newItems[itemIdx] = targetItem;
      return { ...session, items: newItems };
    });
  };

  const handleToggleSetDone = (itemIdx: number, setIdx: number) => {
    if (!activeSession) return;
    const currentItem = activeSession.items[itemIdx];
    const targetSet = currentItem.sets[setIdx];
    const willBeDone = !targetSet.done;

    updateSessionState((session) => {
      const newItems = [...session.items];
      const targetItem = { ...newItems[itemIdx] };
      const newSets = [...targetItem.sets];
      newSets[setIdx] = {
        ...newSets[setIdx],
        done: willBeDone,
      };
      targetItem.sets = newSets;
      newItems[itemIdx] = targetItem;
      return { ...session, items: newItems };
    });

    // When marked done, automatically triggers the Rest Timer (§4.4)
    if (willBeDone) {
      const plannedRest = currentItem.planned?.restSec ?? 90;
      setRestTimerSeconds(plannedRest);
      setIsRestTimerOpen(true);
    }
  };

  const handleSetEffort = (itemIdx: number, setIdx: number, effort: 1 | 2 | 3) => {
    updateSessionState((session) => {
      const newItems = [...session.items];
      const targetItem = { ...newItems[itemIdx] };
      const newSets = [...targetItem.sets];
      const currentEffort = newSets[setIdx].effort;
      newSets[setIdx] = {
        ...newSets[setIdx],
        effort: currentEffort === effort ? undefined : effort,
      };
      targetItem.sets = newSets;
      newItems[itemIdx] = targetItem;
      return { ...session, items: newItems };
    });
  };

  // Add & Remove set
  const handleAddSet = (itemIdx: number) => {
    updateSessionState((session) => {
      const newItems = [...session.items];
      const targetItem = { ...newItems[itemIdx] };
      const lastSet = targetItem.sets[targetItem.sets.length - 1];
      const newSet: PerformedSet = {
        loadKg: lastSet ? lastSet.loadKg : null,
        reps: lastSet ? lastSet.reps : null,
        done: false,
      };
      targetItem.sets = [...targetItem.sets, newSet];
      newItems[itemIdx] = targetItem;
      return { ...session, items: newItems };
    });
  };

  const handleRemoveSet = (itemIdx: number) => {
    updateSessionState((session) => {
      const newItems = [...session.items];
      const targetItem = { ...newItems[itemIdx] };
      if (targetItem.sets.length <= 1) return session;
      targetItem.sets = targetItem.sets.slice(0, -1);
      newItems[itemIdx] = targetItem;
      return { ...session, items: newItems };
    });
  };

  // Skip / Unskip exercise
  const handleToggleSkip = (itemIdx: number) => {
    updateSessionState((session) => {
      const newItems = [...session.items];
      const targetItem = { ...newItems[itemIdx] };
      targetItem.skipped = !targetItem.skipped;
      newItems[itemIdx] = targetItem;
      return { ...session, items: newItems };
    });
  };

  // Swap exercise
  const handleExecuteSwap = (newExerciseId: string) => {
    if (swapModalItemIdx === null) return;
    updateSessionState((session) => {
      const newItems = [...session.items];
      const targetItem = { ...newItems[swapModalItemIdx] };
      targetItem.exerciseId = newExerciseId;
      if (targetItem.planned) {
        targetItem.planned = {
          ...targetItem.planned,
          exerciseId: newExerciseId,
        };
      }
      newItems[swapModalItemIdx] = targetItem;
      return { ...session, items: newItems };
    });
    setSwapModalItemIdx(null);
  };

  // Add new exercise from catalog
  const handleAddExerciseFromCatalog = (exerciseId: string) => {
    updateSessionState((session) => {
      const newItem: SessionItem = {
        exerciseId,
        planned: {
          exerciseId,
          sets: 3,
          reps: '8-12',
          restSec: 90,
          reason: 'Added during active workout',
        },
        sets: [
          { loadKg: null, reps: null, done: false },
          { loadKg: null, reps: null, done: false },
          { loadKg: null, reps: null, done: false },
        ],
      };
      return { ...session, items: [...session.items, newItem] };
    });
    setIsAddExerciseModalOpen(false);
    setAddSearchQuery('');
  };

  // Toggle cue accordion
  const toggleCues = (exerciseId: string) => {
    setExpandedCues((prev) => ({
      ...prev,
      [exerciseId]: !prev[exerciseId],
    }));
  };

  // Toggle pose (start vs peak)
  const toggleImagePose = (exerciseId: string) => {
    setImagePoses((prev) => ({
      ...prev,
      [exerciseId]: prev[exerciseId] === 'peak' ? 'start' : 'peak',
    }));
  };

  // Finish session
  const handleConfirmFinish = async () => {
    if (!activeSession) return;
    try {
      const completedSession: WorkoutSession = {
        ...activeSession,
        state: 'done',
        endedAt: Date.now(),
      };
      await saveWorkoutSession(completedSession);
      await clearActiveWorkout();
      setIsFinishModalOpen(false);
      onFinishSession();
    } catch (err) {
      console.error('Failed to complete workout session:', err);
    }
  };

  // Leave / Pause session
  const handleLeaveSession = async () => {
    if (activeSession) {
      await saveActiveWorkout(activeSession);
    }
    onExitSession();
  };

  // Substitute candidates for current swap modal target
  const swapCandidates = useMemo(() => {
    if (swapModalItemIdx === null || !activeSession || !profile) return [];
    const item = activeSession.items[swapModalItemIdx];
    const availableEquipment = profile.equipment[profile.activeLocation] || [];
    const substitutes = findSubstitutes(item.exerciseId, availableEquipment);
    return substitutes;
  }, [swapModalItemIdx, activeSession, profile]);

  // Catalog filtered items for Add Exercise modal
  const addExerciseResults = useMemo(() => {
    if (!isAddExerciseModalOpen) return [];
    return searchExercises(addSearchQuery, {
      location: profile?.activeLocation ?? 'home',
      equipment: profile ? profile.equipment[profile.activeLocation] : undefined,
      movement: addMovementFilter || undefined,
    }).slice(0, 30);
  }, [isAddExerciseModalOpen, addSearchQuery, addMovementFilter, profile]);

  // Volume calculation for finish modal
  const totalVolumeKg = useMemo(() => {
    if (!activeSession) return 0;
    let totalKg = 0;
    for (const item of activeSession.items) {
      if (item.skipped) continue;
      for (const s of item.sets) {
        if (s.done && s.loadKg && s.reps) {
          totalKg += s.loadKg * s.reps;
        }
      }
    }
    return Math.round(totalKg);
  }, [activeSession]);

  if (loading || !activeSession) {
    return (
      <div className="active-workout-container" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ color: '#a9a2b2', fontSize: '15px' }}>Loading active workout session...</div>
      </div>
    );
  }

  return (
    <div className="active-workout-container">
      {/* 1. Header (§4.4) */}
      <header className="active-header">
        <div className="active-header-top">
          <div className="active-title-group">
            <h1 className="active-title">{activeSession.title}</h1>
            <div className="active-badges">
              <span className="location-badge">
                📍 {activeSession.location}
              </span>
              <button
                type="button"
                className={`timer-pill ${isWorkoutPaused ? 'paused' : ''}`}
                onClick={() => setIsWorkoutPaused((p) => !p)}
                title={isWorkoutPaused ? 'Resume workout timer' : 'Pause workout timer'}
              >
                <span className="timer-pause-icon">
                  {isWorkoutPaused ? '▶' : '⏸'}
                </span>
                <span>{formattedElapsed}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div>
          <div className="pbar">
            <div style={{ width: `${progressPercent}%` }} />
          </div>
          <div className="progress-info">
            <span>
              {completedSetsCount} / {totalSetsCount} sets completed
            </span>
            <span>{progressPercent}%</span>
          </div>
        </div>
      </header>

      {/* 2. Exercise List */}
      <main style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {activeSession.items.map((item, itemIdx) => {
          const ex: Exercise | undefined = CATALOG_BY_ID[item.exerciseId];
          const exName = ex?.name ?? item.exerciseId;
          const pose = imagePoses[item.exerciseId] || 'start';
          const imgUrl = ex ? getExerciseImageUrl(ex, pose) : null;
          const isCuesExpanded = !!expandedCues[item.exerciseId];

          return (
            <article
              key={`${item.exerciseId}-${itemIdx}`}
              className={`workout-exercise-card ${item.skipped ? 'skipped' : ''}`}
            >
              {/* Exercise Header Row */}
              <div className="exercise-header-row">
                {/* RepDB thumbnail with start/peak pose support */}
                {imgUrl ? (
                  <img
                    src={imgUrl}
                    alt={exName}
                    className="exercise-thumb"
                    onClick={() => toggleImagePose(item.exerciseId)}
                    title="Tap to toggle start/peak illustration"
                  />
                ) : (
                  <div
                    className="exercise-thumb-placeholder"
                    onClick={() => onSelectExercise?.(item.exerciseId)}
                  >
                    🏋️
                  </div>
                )}

                <div className="exercise-meta-col">
                  <button
                    type="button"
                    className="exercise-name-btn"
                    onClick={() => onSelectExercise?.(item.exerciseId)}
                    title="Tap to view exercise details"
                  >
                    <span>{exName}</span>
                    {item.skipped && (
                      <span style={{ fontSize: '12px', color: '#f5a524', fontWeight: 650 }}>
                        (Skipped)
                      </span>
                    )}
                  </button>

                  <div className="target-specs">
                    <span>
                      {item.planned?.sets ?? item.sets.length} sets ×{' '}
                      {item.planned?.reps ?? '8-10 reps'}
                    </span>
                    <span>•</span>
                    <span>⏱ {item.planned?.restSec ?? 90}s rest</span>
                  </div>

                  {/* Muscle target chips */}
                  {ex && (
                    <div className="muscle-chips-row">
                      {ex.primary.map((m) => (
                        <span key={m} className="muscle-chip-primary">
                          {MUSCLE_BY_ID[m]?.short ?? m}
                        </span>
                      ))}
                      {ex.secondary.map((m) => (
                        <span key={m} className="muscle-chip-secondary">
                          {MUSCLE_BY_ID[m]?.short ?? m}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Expandable Form Cues and Mistakes */}
              {ex && (ex.cues?.length > 0 || ex.mistakes?.length > 0) && (
                <>
                  <button
                    type="button"
                    className="cues-toggle-btn"
                    onClick={() => toggleCues(item.exerciseId)}
                  >
                    <span>{isCuesExpanded ? '▲ Hide Form & Mistakes' : '▼ Form Cues & Mistakes to Avoid'}</span>
                  </button>

                  {isCuesExpanded && (
                    <div className="cues-content">
                      {ex.cues && ex.cues.length > 0 && (
                        <div>
                          <div className="cue-group-title" style={{ color: 'var(--action, #00e5ff)' }}>
                            ✓ Form Cues:
                          </div>
                          <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                            {ex.cues.map((cue, cIdx) => (
                              <li key={cIdx}>{cue}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {ex.mistakes && ex.mistakes.length > 0 && (
                        <div>
                          <div className="cue-group-title" style={{ color: 'var(--muscle-primary, #ff4757)' }}>
                            ⚠ Common Mistakes:
                          </div>
                          <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                            {ex.mistakes.map((mis, mIdx) => (
                              <li key={mIdx}>{mis}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              {/* Set Rows Table (§4.4) */}
              {!item.skipped && (
                <div className="set-table">
                  <div className="set-table-header">
                    <div>SET</div>
                    <div>PREV / TARGET</div>
                    <div>KG</div>
                    <div>REPS</div>
                    <div>CHECK</div>
                  </div>

                  {item.sets.map((set, setIdx) => {
                    const prevPerformance = getPreviousPerformance(item.exerciseId, setIdx);
                    const targetGuidance =
                      prevPerformance || item.planned?.reps || '8-10 reps';

                    return (
                      <div
                        key={setIdx}
                        className={`set-table-row-container ${set.done ? 'done' : ''}`}
                      >
                        <div className="set-table-row">
                          <div className="set-num-badge">{setIdx + 1}</div>

                          <div className="set-guidance">
                            {prevPerformance ? (
                              <>
                                <span className="prev-tag">Prev</span>
                                <span>{prevPerformance}</span>
                              </>
                            ) : (
                              <span>{targetGuidance}</span>
                            )}
                          </div>

                          <div>
                            <input
                              type="number"
                              step="0.5"
                              min="0"
                              placeholder="0"
                              className="set-input"
                              value={set.loadKg !== null ? set.loadKg : ''}
                              onChange={(e) =>
                                handleUpdateSetField(itemIdx, setIdx, 'loadKg', e.target.value)
                              }
                            />
                          </div>

                          <div>
                            <input
                              type="number"
                              step="1"
                              min="0"
                              placeholder="0"
                              className="set-input"
                              value={set.reps !== null ? set.reps : ''}
                              onChange={(e) =>
                                handleUpdateSetField(itemIdx, setIdx, 'reps', e.target.value)
                              }
                            />
                          </div>

                          <div>
                            <button
                              type="button"
                              className="set-check-btn"
                              aria-pressed={set.done}
                              onClick={() => handleToggleSetDone(itemIdx, setIdx)}
                              title={set.done ? 'Mark set incomplete' : 'Mark set done'}
                            >
                              {set.done ? '✓' : '○'}
                            </button>
                          </div>
                        </div>

                        {/* Effort rating pills (1: Easy, 2: Good, 3: Hard) */}
                        <div className="effort-pills-row">
                          <span style={{ fontSize: '11px', color: 'var(--text-2, #94a3b8)' }}>Effort:</span>
                          <button
                            type="button"
                            className={`effort-pill ${set.effort === 1 ? 'selected-1' : ''}`}
                            onClick={() => handleSetEffort(itemIdx, setIdx, 1)}
                          >
                            1 Easy
                          </button>
                          <button
                            type="button"
                            className={`effort-pill ${set.effort === 2 ? 'selected-2' : ''}`}
                            onClick={() => handleSetEffort(itemIdx, setIdx, 2)}
                          >
                            2 Good
                          </button>
                          <button
                            type="button"
                            className={`effort-pill ${set.effort === 3 ? 'selected-3' : ''}`}
                            onClick={() => handleSetEffort(itemIdx, setIdx, 3)}
                          >
                            3 Hard
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Controls per exercise */}
              <div className="exercise-controls-bar">
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    type="button"
                    className="exercise-control-btn"
                    onClick={() => handleAddSet(itemIdx)}
                    title="Add another set"
                  >
                    + Add Set
                  </button>
                  <button
                    type="button"
                    className="exercise-control-btn"
                    disabled={item.sets.length <= 1}
                    onClick={() => handleRemoveSet(itemIdx)}
                    title="Remove last set"
                  >
                    - Remove Set
                  </button>
                </div>

                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    type="button"
                    className="exercise-control-btn"
                    onClick={() => setSwapModalItemIdx(itemIdx)}
                    title="Swap for substitute exercise"
                  >
                    ⇄ Swap
                  </button>
                  <button
                    type="button"
                    className="exercise-control-btn"
                    onClick={() => handleToggleSkip(itemIdx)}
                    title={item.skipped ? 'Unskip exercise' : 'Skip exercise'}
                  >
                    {item.skipped ? '↺ Unskip' : '↷ Skip'}
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </main>

      {/* 3. Floating / Docked Rest Timer */}
      <RestTimer
        initialSeconds={restTimerSeconds}
        isOpen={isRestTimerOpen}
        onDismiss={() => setIsRestTimerOpen(false)}
      />

      {/* 4. Action Toolbar (Bottom) */}
      <footer className="action-toolbar">
        <button
          type="button"
          className="btn-add-exercise"
          onClick={() => setIsAddExerciseModalOpen(true)}
        >
          + Add Exercise
        </button>
        <button
          type="button"
          className="btn-leave"
          onClick={handleLeaveSession}
          title="Pause and leave workout"
        >
          Pause / Exit
        </button>
        <button
          type="button"
          className="btn-finish"
          onClick={() => setIsFinishModalOpen(true)}
        >
          Finish Workout
        </button>
      </footer>

      {/* Modal: Substitute Picker */}
      {swapModalItemIdx !== null && (
        <div className="modal-overlay" onClick={() => setSwapModalItemIdx(null)}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">
                Swap {CATALOG_BY_ID[activeSession.items[swapModalItemIdx].exerciseId]?.name ?? 'Exercise'}
              </h2>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setSwapModalItemIdx(null)}
              >
                ✕
              </button>
            </div>

            <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-2, #94a3b8)' }}>
              Choose a biomechanically equivalent exercise compatible with your {profile?.activeLocation} equipment:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
              {swapCandidates.length === 0 ? (
                <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-2, #94a3b8)' }}>
                  No direct substitutes found for this equipment profile.
                </div>
              ) : (
                swapCandidates.map((cand) => (
                  <button
                    key={cand.id}
                    type="button"
                    className="tile"
                    onClick={() => handleExecuteSwap(cand.id)}
                    style={{ width: '100%' }}
                  >
                    <span className="t">{cand.name}</span>
                    <span className="d">
                      {cand.equipmentIds.join(', ')} • {cand.primary.map((m) => MUSCLE_BY_ID[m]?.short ?? m).join(', ')}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal: Add Exercise from Library */}
      {isAddExerciseModalOpen && (
        <div className="modal-overlay" onClick={() => setIsAddExerciseModalOpen(false)}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Add Exercise to Workout</h2>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setIsAddExerciseModalOpen(false)}
              >
                ✕
              </button>
            </div>

            <input
              type="search"
              placeholder="Search exercises by name or muscle..."
              className="input"
              value={addSearchQuery}
              onChange={(e) => setAddSearchQuery(e.target.value)}
              autoFocus
            />

            {/* Movement Filter Chips */}
            <div className="chips">
              {(['squat', 'hinge', 'hpush', 'vpush', 'hpull', 'vpull', 'core'] as Movement[]).map((mv) => (
                <button
                  key={mv}
                  type="button"
                  className="chip"
                  aria-pressed={addMovementFilter === mv}
                  onClick={() => setAddMovementFilter(addMovementFilter === mv ? '' : mv)}
                >
                  {mv}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
              {addExerciseResults.length === 0 ? (
                <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-2, #94a3b8)' }}>
                  No matching exercises found.
                </div>
              ) : (
                addExerciseResults.map((exItem) => (
                  <div
                    key={exItem.id}
                    className="panel"
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px' }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '15px' }}>{exItem.name}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-2, #94a3b8)', marginTop: '2px' }}>
                        {exItem.primary.map((m) => MUSCLE_BY_ID[m]?.short ?? m).join(', ')}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn primary small-btn"
                      onClick={() => handleAddExerciseFromCatalog(exItem.id)}
                    >
                      + Add
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal: Finish Workout Summary (§4.4) */}
      {isFinishModalOpen && (
        <div className="modal-overlay" onClick={() => setIsFinishModalOpen(false)}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Finish Workout</h2>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setIsFinishModalOpen(false)}
              >
                ✕
              </button>
            </div>

            <div style={{ textAlign: 'center', padding: '12px 0 4px' }}>
              <div style={{ fontSize: '42px', marginBottom: '8px' }}>🎉</div>
              <h3 style={{ margin: '0 0 6px', fontSize: '20px', fontWeight: 700 }}>
                Workout Crushed!
              </h3>
              <p style={{ margin: 0, fontSize: '13.5px', color: 'var(--text-2, #94a3b8)' }}>
                Great work on completing today&apos;s session. Ready to log your performance?
              </p>
            </div>

            {/* Summary statistics */}
            <div className="summary-stats-grid">
              <div className="summary-stat-box">
                <div className="summary-stat-val">{formattedElapsed}</div>
                <div className="summary-stat-lbl">Duration</div>
              </div>
              <div className="summary-stat-box">
                <div className="summary-stat-val">
                  {completedSetsCount}/{totalSetsCount}
                </div>
                <div className="summary-stat-lbl">Sets Done</div>
              </div>
              <div className="summary-stat-box">
                <div className="summary-stat-val">{totalVolumeKg.toLocaleString()}</div>
                <div className="summary-stat-lbl">KG Lifted</div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
              <button
                type="button"
                className="btn primary block"
                onClick={handleConfirmFinish}
              >
                Save & Finish Session
              </button>
              <button
                type="button"
                className="btn ghost block"
                onClick={() => setIsFinishModalOpen(false)}
              >
                Resume Workout
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
