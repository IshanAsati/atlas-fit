import React, { useEffect, useMemo } from 'react';
import type { Exercise, MuscleId, WorkoutSession } from '../../data/types';
import { MUSCLE_BY_ID } from '../../data/muscles';
import { CATALOG } from '../../data/catalog';

export interface MuscleDrawerProps {
  /** Currently selected muscle, or null if no selection. */
  muscleId: MuscleId | null;
  /** Whether the drawer bottom sheet is visible. */
  isOpen: boolean;
  /** Callback to close the drawer. */
  onClose: () => void;
  /** Session history for volume calculations. */
  sessions?: WorkoutSession[];
  /** Exercise catalog. Defaults to built-in CATALOG if omitted. */
  catalog?: Exercise[];
  /** Callback when user clicks an exercise in the drawer. */
  onSelectExercise?: (exerciseId: string) => void;
}

/**
 * Bottom Sheet Inspector Drawer for a selected muscle (§4.6, §8).
 *
 * Shows:
 * 1. Muscle display name and educational blurb from `src/data/muscles.ts`.
 * 2. Number of working sets logged this week and this month.
 * 3. Categorized list of exercises targeting this muscle (Primary & Secondary).
 */
export const MuscleDrawer: React.FC<MuscleDrawerProps> = ({
  muscleId,
  isOpen,
  onClose,
  sessions = [],
  catalog = CATALOG,
  onSelectExercise,
}) => {
  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const meta = muscleId ? MUSCLE_BY_ID[muscleId] : null;

  // Compute working sets for this muscle over time windows
  const volumeStats = useMemo(() => {
    if (!muscleId) return { week: 0, month: 0, total: 0 };

    const now = Date.now();
    const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;
    const oneMonthAgo = now - 30 * 24 * 60 * 60 * 1000;

    let week = 0;
    let month = 0;
    let total = 0;

    const catalogMap = new Map<string, Exercise>();
    for (const ex of catalog) {
      catalogMap.set(ex.id, ex);
    }

    for (const s of sessions) {
      const time = s.endedAt ?? s.startedAt;
      const isWeek = time >= oneWeekAgo;
      const isMonth = time >= oneMonthAgo;

      for (const item of s.items) {
        const ex = catalogMap.get(item.exerciseId);
        if (!ex) continue;

        const isPrimary = ex.primary.includes(muscleId);
        const isSecondary = ex.secondary.includes(muscleId);
        if (!isPrimary && !isSecondary) continue;

        // Completed working sets
        const completedCount =
          item.sets.filter((st) => st.done).length ||
          (s.state === 'done' ? item.sets.length : 0);

        if (completedCount === 0) continue;

        // Primary counts as 1 per set, secondary as 0.5 per set
        const weight = isPrimary ? 1 : 0.5;
        const volume = Math.round(completedCount * weight);

        total += volume;
        if (isMonth) month += volume;
        if (isWeek) week += volume;
      }
    }

    return { week, month, total };
  }, [muscleId, sessions, catalog]);

  // Find targeting exercises in the catalog
  const { primaryExercises, secondaryExercises } = useMemo(() => {
    if (!muscleId) return { primaryExercises: [], secondaryExercises: [] };

    const primary: Exercise[] = [];
    const secondary: Exercise[] = [];

    for (const ex of catalog) {
      if (ex.primary.includes(muscleId)) {
        primary.push(ex);
      } else if (ex.secondary.includes(muscleId)) {
        secondary.push(ex);
      }
    }

    return { primaryExercises: primary, secondaryExercises: secondary };
  }, [muscleId, catalog]);

  if (!isOpen || !meta || !muscleId) {
    return null;
  }

  const difficultyLabel = (d: 1 | 2 | 3) => {
    if (d === 1) return 'Beginner';
    if (d === 2) return 'Intermediate';
    return 'Advanced';
  };

  return (
    <>
      {/* Backdrop scrim */}
      <div
        className="scrim"
        onClick={onClose}
        role="presentation"
        aria-hidden="true"
      />

      {/* Bottom sheet */}
      <section
        className="sheet muscle-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="muscle-drawer-title"
      >
        <div className="grab" onClick={onClose} role="button" aria-label="Dismiss sheet" />

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.6px',
                  color: 'var(--action, #00E5FF)',
                  background: 'rgba(0, 229, 255, 0.12)',
                  padding: '2px 8px',
                  borderRadius: 6,
                }}
              >
                {meta.views.join(' & ')} View
              </span>
            </div>
            <h2
              id="muscle-drawer-title"
              style={{
                fontSize: 22,
                fontWeight: 700,
                margin: 0,
                color: 'var(--text, #F7F5FA)',
                letterSpacing: '-0.3px',
              }}
            >
              {meta.name}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close muscle details"
            style={{
              appearance: 'none',
              background: 'var(--surface-2, #322B3D)',
              border: '1px solid var(--hairline, #3D3549)',
              color: 'var(--text-2, #A9A2B2)',
              fontSize: 16,
              lineHeight: 1,
              width: 34,
              height: 34,
              borderRadius: 17,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            ✕
          </button>
        </div>

        {/* Anatomical Blurb */}
        <p
          style={{
            margin: '10px 0 16px',
            fontSize: 14,
            lineHeight: 1.5,
            color: 'var(--text-2, #A9A2B2)',
          }}
        >
          {meta.blurb}
        </p>

        {/* Training Activity Stats (§4.6, §8.3) */}
        <div
          style={{
            background: 'var(--surface, #161A23)',
            border: '1px solid var(--hairline, rgba(255, 255, 255, 0.08))',
            borderRadius: 'var(--radius, 14px)',
            padding: '12px 14px',
            marginBottom: 18,
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              color: 'var(--text-2, #94A3B8)',
              marginBottom: 10,
            }}
          >
            Training Activity
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 10,
            }}
          >
            <div
              style={{
                background: 'var(--surface-2, #1E2430)',
                padding: '10px 12px',
                borderRadius: 'var(--radius-s, 10px)',
                border: '1px solid var(--hairline, rgba(255, 255, 255, 0.08))',
              }}
            >
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 750,
                  color: volumeStats.week > 0 ? 'var(--action, #00E5FF)' : 'var(--text, #F8FAFC)',
                }}
              >
                {volumeStats.week}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-2, #94A3B8)', marginTop: 2 }}>
                Working sets this week
              </div>
            </div>

            <div
              style={{
                background: 'var(--surface-2, #1E2430)',
                padding: '10px 12px',
                borderRadius: 'var(--radius-s, 10px)',
                border: '1px solid var(--hairline, rgba(255, 255, 255, 0.08))',
              }}
            >
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 750,
                  color: volumeStats.month > 0 ? 'var(--action, #00E5FF)' : 'var(--text, #F8FAFC)',
                }}
              >
                {volumeStats.month}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-2, #94A3B8)', marginTop: 2 }}>
                Working sets this month
              </div>
            </div>
          </div>
          <div
            style={{
              fontSize: 11,
              color: 'var(--text-2, #A9A2B2)',
              marginTop: 8,
              lineHeight: 1.4,
            }}
          >
            Derived from completed working sets logged in your workout history.
          </div>
        </div>

        {/* Exercises Section */}
        <div>
          <h3
            style={{
              fontSize: 15,
              fontWeight: 700,
              margin: '0 0 10px',
              color: 'var(--text, #F7F5FA)',
            }}
          >
            Targeting Exercises ({primaryExercises.length + secondaryExercises.length})
          </h3>

          {/* Primary Exercises */}
          {primaryExercises.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  marginBottom: 8,
                  fontSize: 12,
                  fontWeight: 650,
                  color: 'var(--muscle-primary, #FF4757)',
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: 'var(--muscle-primary, #FF4757)',
                    display: 'inline-block',
                  }}
                />
                Primary Target ({primaryExercises.length})
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {primaryExercises.map((ex) => (
                  <button
                    key={ex.id}
                    type="button"
                    onClick={() => onSelectExercise?.(ex.id)}
                    style={{
                      appearance: 'none',
                      textAlign: 'left',
                      background: 'var(--surface, #161A23)',
                      border: '1px solid var(--hairline, rgba(255, 255, 255, 0.08))',
                      borderRadius: 'var(--radius-s, 10px)',
                      padding: '10px 12px',
                      cursor: onSelectExercise ? 'pointer' : 'default',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 8,
                      color: 'inherit',
                      transition: 'background var(--ease, 200ms ease), border-color var(--ease, 200ms ease)',
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontWeight: 600,
                          fontSize: 14,
                          color: 'var(--text, #F8FAFC)',
                        }}
                      >
                        {ex.name}
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          color: 'var(--text-2, #94A3B8)',
                          marginTop: 2,
                          display: 'flex',
                          gap: 6,
                          alignItems: 'center',
                        }}
                      >
                        <span>{difficultyLabel(ex.difficulty)}</span>
                        <span>•</span>
                        <span>{ex.equipmentIds.join(', ')}</span>
                      </div>
                    </div>

                    <span
                      style={{
                        color: 'var(--action, #00E5FF)',
                        fontSize: 13,
                        fontWeight: 600,
                      }}
                    >
                      View →
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Secondary Exercises */}
          {secondaryExercises.length > 0 && (
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  marginBottom: 8,
                  fontSize: 12,
                  fontWeight: 650,
                  color: 'var(--muscle-secondary, #00D2FF)',
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: 'var(--muscle-secondary, #00D2FF)',
                    display: 'inline-block',
                  }}
                />
                Secondary / Supporting Target ({secondaryExercises.length})
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {secondaryExercises.map((ex) => (
                  <button
                    key={ex.id}
                    type="button"
                    onClick={() => onSelectExercise?.(ex.id)}
                    style={{
                      appearance: 'none',
                      textAlign: 'left',
                      background: 'var(--surface, #161A23)',
                      border: '1px solid var(--hairline, rgba(255, 255, 255, 0.08))',
                      borderRadius: 'var(--radius-s, 10px)',
                      padding: '10px 12px',
                      cursor: onSelectExercise ? 'pointer' : 'default',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 8,
                      color: 'inherit',
                      transition: 'background var(--ease, 200ms ease), border-color var(--ease, 200ms ease)',
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontWeight: 600,
                          fontSize: 14,
                          color: 'var(--text, #F8FAFC)',
                        }}
                      >
                        {ex.name}
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          color: 'var(--text-2, #94A3B8)',
                          marginTop: 2,
                          display: 'flex',
                          gap: 6,
                          alignItems: 'center',
                        }}
                      >
                        <span>{difficultyLabel(ex.difficulty)}</span>
                        <span>•</span>
                        <span>{ex.equipmentIds.join(', ')}</span>
                      </div>
                    </div>

                    <span
                      style={{
                        color: 'var(--action, #00E5FF)',
                        fontSize: 13,
                        fontWeight: 600,
                      }}
                    >
                      View →
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {primaryExercises.length === 0 && secondaryExercises.length === 0 && (
            <div className="empty">No catalog exercises targeting this muscle group yet.</div>
          )}
        </div>
      </section>
    </>
  );
};
