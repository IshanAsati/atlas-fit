import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { Exercise, MuscleId, WorkoutSession } from '../../data/types';
import { MUSCLES } from '../../data/muscles';
import { CATALOG, EXERCISE_BY_ID } from '../../data/catalog';
import { getWorkoutSessions } from '../../data/db';
import { BodygraphFigure, type HighlightValue } from './BodygraphFigure';
import { MuscleDrawer } from './MuscleDrawer';
import { calculateMuscleActivity } from './activity';
import './Bodygraph.css';

export type BodygraphMode = 'targets' | 'activity';
export type BodygraphView = 'front' | 'back';
export type TimeWindow = 'week' | 'month' | 'all';

export interface BodygraphProps {
  /** Mode: 'targets' (Mode A) or 'activity' (Mode B). Defaults to 'targets'. */
  mode?: BodygraphMode;
  /** Active view ('front' or 'back'). If omitted, managed internally. */
  view?: BodygraphView;
  /** Initial view if uncontrolled. Defaults to 'front'. */
  initialView?: BodygraphView;
  /** Callback when view changes. */
  onViewChange?: (view: BodygraphView) => void;
  /** In Mode A: Exercise or exercise ID whose muscle targets to highlight. */
  selectedExercise?: Exercise | string | null;
  /** In Mode A: Explicit target list if selectedExercise is not provided. */
  targetMuscles?: {
    primary?: MuscleId[];
    secondary?: MuscleId[];
  };
  /** In Mode B: Workout sessions for volume calculation (if omitted, loaded from db). */
  sessions?: WorkoutSession[];
  /** Exercise catalog for lookup (if omitted, CATALOG is used). */
  catalog?: Exercise[];
  /** Currently selected muscle in inspector. */
  selectedMuscle?: MuscleId | null;
  /** Callback when muscle is selected. */
  onSelectMuscle?: (muscleId: MuscleId | null) => void;
  /** Callback when exercise details are explicitly requested from the muscle drawer. */
  onSelectExercise?: (exerciseId: string) => void;
  /** Render compact thumbnail version (disables flipper/drawer by default). */
  compact?: boolean;
  /** Show the Mode A / Mode B toggle. Defaults to true when not compact. */
  showModeToggle?: boolean;
  /** Show the Front / Back toggle. Defaults to true when not compact. */
  showViewToggle?: boolean;
  /** Show the color legend. Defaults to true when not compact. */
  showLegend?: boolean;
  /** Time window for Mode B ('week' | 'month' | 'all'). */
  timeWindow?: TimeWindow;
  /** Callback when time window changes in Mode B. */
  onTimeWindowChange?: (timeWindow: TimeWindow) => void;
  /** Show the time window toggle in Mode B. Defaults to true when not compact. */
  showWindowToggle?: boolean;
  /** Show exercise dropdown selector in Mode A if none provided. Defaults to true. */
  showExercisePicker?: boolean;
  /** Optional custom CSS classes. */
  className?: string;
}

/**
 * Interactive Bodygraph Wrapper Component (§4.6, §5.1, §5.2, §8).
 *
 * Features:
 * - Front/Back toggle with one mounted view, avoiding duplicate IDs and hidden tab stops.
 * - Mode A ('targets'): highlights primary & secondary muscles for an exercise or target list.
 * - Mode B ('activity'): shades primary completed working sets from completed sessions.
 * - Muscle click triggers the MuscleDrawer bottom sheet inspector.
 */
export const Bodygraph: React.FC<BodygraphProps> = ({
  mode: propMode,
  view: propView,
  initialView = 'front',
  onViewChange,
  selectedExercise: propSelectedExercise,
  targetMuscles,
  sessions: propSessions,
  catalog = CATALOG,
  selectedMuscle: propSelectedMuscle,
  onSelectMuscle,
  onSelectExercise,
  compact = false,
  showModeToggle = !compact,
  showViewToggle = !compact,
  showLegend = !compact,
  showExercisePicker = !compact,
  timeWindow: propTimeWindow,
  onTimeWindowChange,
  showWindowToggle = !compact,
  className = '',
}) => {
  // View state (front / back)
  const [internalView, setInternalView] = useState<BodygraphView>(initialView);
  const view = propView ?? internalView;

  const setView = useCallback(
    (nextView: BodygraphView) => {
      setInternalView(nextView);
      onViewChange?.(nextView);
    },
    [onViewChange],
  );

  // Mode state (targets / activity)
  const [internalMode, setInternalMode] = useState<BodygraphMode>(propMode ?? 'targets');
  const currentMode = propMode ?? internalMode;

  // Selected muscle inspector state
  const [internalSelectedMuscle, setInternalSelectedMuscle] = useState<MuscleId | null>(null);
  const activeMuscle = propSelectedMuscle !== undefined ? propSelectedMuscle : internalSelectedMuscle;

  // Drawer open state
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Mode B time window state
  const [internalTimeWindow, setInternalTimeWindow] = useState<TimeWindow>(propTimeWindow ?? 'week');
  const timeWindow = propTimeWindow ?? internalTimeWindow;
  const setTimeWindow = useCallback(
    (nextWindow: TimeWindow) => {
      setInternalTimeWindow(nextWindow);
      onTimeWindowChange?.(nextWindow);
    },
    [onTimeWindowChange],
  );

  // Exercise selection inside Mode A if uncontrolled
  const [pickerExerciseId, setPickerExerciseId] = useState<string>('push-up');

  // Database sessions fallback
  const [dbSessions, setDbSessions] = useState<WorkoutSession[]>([]);

  useEffect(() => {
    if (propSessions) return;
    let isCancelled = false;
    getWorkoutSessions()
      .then((data) => {
        if (!isCancelled) setDbSessions(data);
      })
      .catch(() => {
        // Fallback gracefully to empty history
      });
    return () => {
      isCancelled = true;
    };
  }, [propSessions]);

  const effectiveSessions = propSessions ?? dbSessions;

  // Resolve active exercise for Mode A
  const activeExercise = useMemo<Exercise | null>(() => {
    if (propSelectedExercise) {
      if (typeof propSelectedExercise === 'string') {
        return EXERCISE_BY_ID[propSelectedExercise] ?? catalog.find((e) => e.id === propSelectedExercise) ?? null;
      }
      return propSelectedExercise;
    }
    if (targetMuscles) return null;
    return EXERCISE_BY_ID[pickerExerciseId] ?? catalog.find((e) => e.id === pickerExerciseId) ?? catalog[0] ?? null;
  }, [propSelectedExercise, targetMuscles, pickerExerciseId, catalog]);

  // Compute highlight map
  const highlightMap = useMemo<Record<MuscleId, HighlightValue>>(() => {
    const map = {} as Record<MuscleId, HighlightValue>;

    // Default all muscles to neutral
    for (const m of MUSCLES) {
      map[m.id] = 'neutral';
    }

    if (currentMode === 'targets') {
      let primary: MuscleId[] = [];
      let secondary: MuscleId[] = [];

      if (activeExercise) {
        primary = activeExercise.primary;
        secondary = activeExercise.secondary;
      } else if (targetMuscles) {
        primary = targetMuscles.primary ?? [];
        secondary = targetMuscles.secondary ?? [];
      }

      for (const m of primary) {
        map[m] = 'primary';
      }
      for (const m of secondary) {
        if (map[m] !== 'primary') {
          map[m] = 'secondary';
        }
      }
    } else {
      const activity = calculateMuscleActivity(effectiveSessions, catalog, timeWindow);
      for (const m of MUSCLES) {
        map[m.id] = activity.primary[m.id] ?? 0;
      }
    }

    return map;
  }, [currentMode, activeExercise, targetMuscles, timeWindow, effectiveSessions, catalog]);

  // Handle muscle selection
  const handleMuscleClick = useCallback(
    (muscleId: MuscleId) => {
      setInternalSelectedMuscle(muscleId);
      onSelectMuscle?.(muscleId);
      if (!compact) {
        setIsDrawerOpen(true);
      }
    },
    [onSelectMuscle, compact],
  );

  const handleCloseDrawer = useCallback(() => {
    setIsDrawerOpen(false);
    setInternalSelectedMuscle(null);
    onSelectMuscle?.(null);
  }, [onSelectMuscle]);

  // In compact mode, render just a static figure without flipper or controls
  if (compact) {
    return (
      <div className={`bodygraph-container compact ${className}`}>
        <BodygraphFigure
          view={view}
          highlightMap={highlightMap}
          selectedMuscle={activeMuscle}
          onSelectMuscle={handleMuscleClick}
          compact={true}
        />
      </div>
    );
  }

  return (
    <div className={`bodygraph-container ${className}`}>
      {/* Mode A vs Mode B Segmented Toggle */}
      {showModeToggle && (
        <div className="seg bodygraph-mode-toggle" role="group" aria-label="Bodygraph mode selector">
          <button
            type="button"
            aria-pressed={currentMode === 'targets'}
            onClick={() => setInternalMode('targets')}
          >
            Exercise targets
          </button>
          <button
            type="button"
            aria-pressed={currentMode === 'activity'}
            onClick={() => setInternalMode('activity')}
          >
            Training activity
          </button>
        </div>
      )}

      {/* Mode A Exercise Picker when no fixed exercise provided */}
      {currentMode === 'targets' && showExercisePicker && !propSelectedExercise && !targetMuscles && (
        <div className="bodygraph-picker">
          <label htmlFor="bodygraph-exercise-select">Inspect Exercise Targets</label>
          <select
            id="bodygraph-exercise-select"
            value={pickerExerciseId}
            onChange={(e) => {
              setPickerExerciseId(e.target.value);
            }}
          >
            {catalog.map((ex) => (
              <option key={ex.id} value={ex.id}>
                {ex.name} ({ex.primary.join(', ')})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Mode B Time Window Toggle */}
      {currentMode === 'activity' && showWindowToggle && (
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
      )}

      {/* Only the visible view is mounted: no hidden tab stops or duplicate muscle IDs. */}
      <div className="bodygraph-card">
        <div
          className={`bodygraph-flipper ${view === 'back' ? 'is-back' : ''}`}
          role="region"
          aria-label={`Interactive bodygraph, showing ${view} view`}
        >
          <div className="bodygraph-face">
            <BodygraphFigure
              view={view}
              highlightMap={highlightMap}
              selectedMuscle={activeMuscle}
              onSelectMuscle={handleMuscleClick}
            />
          </div>

        </div>
      </div>

      {/* Front / Back view buttons */}
      {showViewToggle && (
        <div className="seg bodygraph-view-toggle" role="group" aria-label="Anatomical view selector">
          <button
            type="button"
            aria-pressed={view === 'front'}
            onClick={() => setView('front')}
          >
            Front View
          </button>
          <button
            type="button"
            aria-pressed={view === 'back'}
            onClick={() => setView('back')}
          >
            Back View
          </button>
        </div>
      )}

      {/* Color Legend */}
      {showLegend && (
        <div className="bodygraph-legend" aria-label="Color classification legend">
          {currentMode === 'targets' ? (
            <>
              <div className="bodygraph-legend-item">
                <span className="bodygraph-legend-dot" style={{ background: 'var(--muscle-primary)' }} />
                <span>Primary Target</span>
              </div>
              <div className="bodygraph-legend-item">
                <span className="bodygraph-legend-dot" style={{ background: 'var(--muscle-secondary)' }} />
                <span>Secondary Target</span>
              </div>
              <div className="bodygraph-legend-item">
                <span className="bodygraph-legend-dot" style={{ background: 'var(--muscle-neutral)' }} />
                <span>Not Targeted</span>
              </div>
            </>
          ) : (
            <>
              <div className="bodygraph-legend-item">
                <span className="bodygraph-legend-dot" style={{ background: 'var(--muscle-neutral)' }} />
                <span>0 sets</span>
              </div>
              <div className="bodygraph-legend-item">
                <span className="bodygraph-legend-dot" style={{ background: 'var(--muscle-activity-low)' }} />
                <span>1–3 sets</span>
              </div>
              <div className="bodygraph-legend-item">
                <span className="bodygraph-legend-dot" style={{ background: 'var(--muscle-activity-mid)' }} />
                <span>4–7 sets</span>
              </div>
              <div className="bodygraph-legend-item">
                <span className="bodygraph-legend-dot" style={{ background: 'var(--muscle-activity-high)' }} />
                <span>8+ sets</span>
              </div>
            </>
          )}
        </div>
      )}

      <details className="bodygraph-muscle-list">
        <summary>Choose a muscle from a list</summary>
        <div className="bodygraph-muscle-buttons">
          {MUSCLES.map((muscle) => (
            <button type="button" key={muscle.id} aria-pressed={activeMuscle === muscle.id}
              onClick={() => handleMuscleClick(muscle.id)}>{muscle.short}</button>
          ))}
        </div>
      </details>

      {/* Muscle Inspector Bottom Sheet Drawer */}
      <MuscleDrawer
        muscleId={activeMuscle}
        isOpen={isDrawerOpen}
        onClose={handleCloseDrawer}
        sessions={effectiveSessions}
        catalog={catalog}
        onSelectExercise={onSelectExercise}
      />
    </div>
  );
};
