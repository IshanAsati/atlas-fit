import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { Exercise, MuscleId, UserProfile, WorkoutSession, SessionItem } from '../../data/types';
import { MUSCLE_BY_ID } from '../../data/muscles';
import { equipmentLabel, DEFAULT_EQUIPMENT } from '../../data/equipment';
import { getExerciseImageUrl, findSubstitutes } from '../../data/catalog';
import {
  getUserProfile,
  toggleFavourite,
  toggleRestriction,
  getActiveWorkout,
  saveActiveWorkout,
} from '../../data/db';
import { BodygraphFigure, type HighlightValue } from '../bodygraph';
import './ExerciseLibrary.css';

export interface ExerciseDetailSheetProps {
  exercise: Exercise | null;
  isOpen: boolean;
  onClose: () => void;
  /** Callback when user clicks to inspect a substitute or linked exercise */
  onSelectExercise?: (exerciseId: string) => void;
  userProfile?: UserProfile | null;
  onProfileUpdated?: (profile: UserProfile) => void;
  /** Workout mode integration (§4.5, §9) */
  workoutMode?: boolean;
  onAddToWorkout?: (exercise: Exercise) => void;
  onSubstitute?: (exercise: Exercise) => void;
}

export const ExerciseDetailSheet: React.FC<ExerciseDetailSheetProps> = ({
  exercise,
  isOpen,
  onClose,
  onSelectExercise,
  userProfile: initialProfile,
  onProfileUpdated,
  workoutMode = false,
  onAddToWorkout,
  onSubstitute,
}) => {
  const [pose, setPose] = useState<'start' | 'peak'>('start');
  const [imageError, setImageError] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(initialProfile ?? null);
  const [isFav, setIsFav] = useState(false);
  const [isAvoided, setIsAvoided] = useState(false);
  const [activeSession, setActiveSession] = useState<WorkoutSession | null>(null);
  const [actionSuccessNotice, setActionSuccessNotice] = useState<string | null>(null);

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

  // Reset pose and image error on exercise change
  useEffect(() => {
    setPose('start');
    setImageError(false);
    setActionSuccessNotice(null);
  }, [exercise?.id]);

  // Sync profile & active session from DB
  const refreshUserData = useCallback(async () => {
    try {
      const p = await getUserProfile();
      setProfile(p);
      if (exercise) {
        setIsFav((p.favourites ?? []).includes(exercise.id));
        setIsAvoided((p.restrictions ?? []).includes(exercise.id));
      }
      const s = await getActiveWorkout();
      setActiveSession(s);
    } catch (err) {
      console.warn('Failed to load user profile or active workout', err);
    }
  }, [exercise]);

  useEffect(() => {
    if (isOpen) {
      void refreshUserData();
    }
  }, [isOpen, refreshUserData]);

  // Highlight map for Mini Bodygraph: Primary in crimson (#FF4757), Secondary in cyan (#00D2FF)
  const highlightMap = useMemo<Record<MuscleId, HighlightValue>>(() => {
    const map = {} as Record<MuscleId, HighlightValue>;
    if (!exercise) return map;

    for (const m of exercise.secondary) {
      map[m] = 'secondary';
    }
    for (const m of exercise.primary) {
      map[m] = 'primary';
    }
    return map;
  }, [exercise]);

  // Available equipment for substitute finding
  const availableEquipment = useMemo(() => {
    const loc = profile?.activeLocation ?? 'home';
    return profile?.equipment?.[loc] ?? DEFAULT_EQUIPMENT[loc];
  }, [profile]);

  // Substitute exercises matching current available equipment
  const substitutes = useMemo(() => {
    if (!exercise) return [];
    return findSubstitutes(exercise.id, availableEquipment).slice(0, 5);
  }, [exercise, availableEquipment]);

  // Toggle Favourite
  const handleToggleFavourite = async () => {
    if (!exercise) return;
    try {
      const updatedState = await toggleFavourite(exercise.id);
      setIsFav(updatedState);
      const updatedProfile = await getUserProfile();
      setProfile(updatedProfile);
      onProfileUpdated?.(updatedProfile);
    } catch (err) {
      console.error('Failed to toggle favourite', err);
    }
  };

  // Toggle Avoid / Discomfort
  const handleToggleAvoid = async () => {
    if (!exercise) return;
    try {
      const updatedAvoidState = await toggleRestriction(exercise.id);
      setIsAvoided(updatedAvoidState);
      const updatedProfile = await getUserProfile();
      setProfile(updatedProfile);
      onProfileUpdated?.(updatedProfile);
      setActionSuccessNotice(
        updatedAvoidState
          ? 'Exercise added to restrictions (avoided)'
          : 'Exercise removed from restrictions',
      );
    } catch (err) {
      console.error('Failed to toggle restriction', err);
    }
  };

  // Handle Add To Workout
  const handleAddToWorkout = async () => {
    if (!exercise) return;

    if (onAddToWorkout) {
      onAddToWorkout(exercise);
      setActionSuccessNotice(`Added ${exercise.name} to workout!`);
      return;
    }

    if (activeSession) {
      const newItem: SessionItem = {
        exerciseId: exercise.id,
        sets: [
          { reps: null, loadKg: null, done: false },
          { reps: null, loadKg: null, done: false },
          { reps: null, loadKg: null, done: false },
        ],
      };
      const updatedSession: WorkoutSession = {
        ...activeSession,
        items: [...activeSession.items, newItem],
      };
      await saveActiveWorkout(updatedSession);
      setActiveSession(updatedSession);
      setActionSuccessNotice(`Added ${exercise.name} to active workout!`);
    }
  };

  // Handle Substitute
  const handleSubstitute = () => {
    if (!exercise || !onSubstitute) return;
    onSubstitute(exercise);
  };

  if (!isOpen || !exercise) {
    return null;
  }

  // Illustration URL calculation
  const repdbUrl = getExerciseImageUrl(exercise, pose);
  const fallbackUrl = `/repdb-images/flat/${exercise.id}-${pose}.webp`;
  const imageSrc = !imageError ? (repdbUrl ?? fallbackUrl) : null;

  const difficultyText =
    exercise.difficulty === 1 ? 'Beginner' : exercise.difficulty === 2 ? 'Intermediate' : 'Advanced';

  return (
    <>
      {/* Backdrop scrim */}
      <div
        className="scrim"
        onClick={onClose}
        role="presentation"
        aria-hidden="true"
      />

      {/* Bottom Sheet Dialog */}
      <section
        className="sheet detail-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="exercise-detail-title"
      >
        <div className="grab" onClick={onClose} role="button" aria-label="Dismiss detail sheet" />

        {/* Header with Title, Badges & Close Button */}
        <div className="detail-header">
          <div className="detail-title-wrap">
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginBottom: 4 }}>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.6px',
                  color: 'var(--action, #57B9FA)',
                  background: 'rgba(87, 185, 250, 0.14)',
                  padding: '2px 8px',
                  borderRadius: 6,
                }}
              >
                {exercise.movement.toUpperCase()}
              </span>
              <span className={`ex-badge ex-badge-difficulty diff-${exercise.difficulty}`}>
                {difficultyText}
              </span>
              {isAvoided && (
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: 'var(--danger, #F04455)',
                    background: 'rgba(240, 68, 85, 0.16)',
                    padding: '2px 8px',
                    borderRadius: 6,
                  }}
                >
                  ⚠️ Avoided
                </span>
              )}
            </div>
            <h2 id="exercise-detail-title" className="detail-title">
              {exercise.name}
            </h2>
            {exercise.aliases && exercise.aliases.length > 0 && (
              <div className="detail-aliases">
                Also known as: {exercise.aliases.join(', ')}
              </div>
            )}
          </div>

          <button
            type="button"
            className="detail-close-btn"
            onClick={onClose}
            aria-label="Close details"
          >
            ✕
          </button>
        </div>

        {/* Action Success Toast / Notice */}
        {actionSuccessNotice && (
          <div
            style={{
              background: 'rgba(95, 214, 138, 0.14)',
              border: '1px solid rgba(95, 214, 138, 0.35)',
              borderRadius: 10,
              padding: '8px 12px',
              fontSize: 13,
              color: 'var(--good, #5FD68A)',
              marginBottom: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span>✓ {actionSuccessNotice}</span>
            <button
              type="button"
              onClick={() => setActionSuccessNotice(null)}
              style={{ background: 'none', border: 0, color: 'inherit', cursor: 'pointer', fontSize: 13 }}
            >
              ✕
            </button>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* High-res RepDB Illustration with Start / Peak Pose Toggle (§4.5) */}
          <div className="detail-media-card">
            <div className="detail-pose-toggle" role="tablist" aria-label="Pose illustration selector">
              <button
                type="button"
                role="tab"
                aria-selected={pose === 'start'}
                className={`detail-pose-btn ${pose === 'start' ? 'active' : ''}`}
                onClick={() => setPose('start')}
              >
                1. Start Pose
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={pose === 'peak'}
                className={`detail-pose-btn ${pose === 'peak' ? 'active' : ''}`}
                onClick={() => setPose('peak')}
              >
                2. Peak Pose
              </button>
            </div>

            <div className="detail-img-box">
              {imageSrc ? (
                <img
                  src={imageSrc}
                  alt={`${exercise.name} - ${pose} pose`}
                  className="detail-img"
                  loading="eager"
                  onError={() => setImageError(true)}
                />
              ) : (
                <div style={{ textAlign: 'center', color: 'var(--text-2, #94A3B8)' }}>
                  <div style={{ fontSize: 32, marginBottom: 6 }}>🏋️‍♂️</div>
                  <div style={{ fontSize: 13 }}>Illustration preview for {pose} pose</div>
                  <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>{exercise.name}</div>
                </div>
              )}
            </div>
          </div>

          {/* Quick Action Buttons Bar */}
          <div className="detail-actions-row">
            <button
              type="button"
              className={`btn small-btn ${isFav ? 'accent' : 'ghost'}`}
              onClick={handleToggleFavourite}
              aria-label={isFav ? 'Remove from favourites' : 'Add to favourites'}
            >
              <span>{isFav ? '★ Favourited' : '☆ Add to Favs'}</span>
            </button>
            <button
              type="button"
              className={`btn small-btn ${isAvoided ? 'danger' : 'ghost'}`}
              onClick={handleToggleAvoid}
              aria-label={isAvoided ? 'Remove discomfort restriction' : 'Flag discomfort and avoid'}
            >
              <span>{isAvoided ? '⚠️ Avoided' : '🛡 Avoid Exercise'}</span>
            </button>
          </div>

          {/* Workout Mode Action: Substitute or Add to Workout */}
          {onSubstitute ? (
            <button
              type="button"
              className="btn primary block"
              onClick={handleSubstitute}
            >
              ⇄ Substitute Current Exercise
            </button>
          ) : workoutMode || onAddToWorkout || activeSession ? (
            <button
              type="button"
              className="btn primary block"
              onClick={handleAddToWorkout}
            >
              ＋ Add to Workout
            </button>
          ) : null}

          {/* Mini Bodygraph Section (§4.5, §4.6) */}
          <div className="detail-bodygraph-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="ex-filter-label">Anatomical Muscle Targets</span>
              <span style={{ fontSize: 11, color: 'var(--text-2, #94A3B8)' }}>RepDB Biomechanics</span>
            </div>

            <div className="detail-bodygraph-figures">
              <div className="detail-bodygraph-col">
                <span className="detail-bodygraph-col-label">Front</span>
                <BodygraphFigure view="front" highlightMap={highlightMap} compact />
              </div>
              <div className="detail-bodygraph-col">
                <span className="detail-bodygraph-col-label">Back</span>
                <BodygraphFigure view="back" highlightMap={highlightMap} compact />
              </div>
            </div>

            {/* Muscle Targets List & Legend */}
            <div className="detail-muscle-legend">
              <div className="detail-muscle-legend-row">
                <div className="detail-muscle-dot primary" aria-hidden="true" />
                <div>
                  <strong style={{ color: 'var(--text, #F8FAFC)' }}>Primary:</strong>{' '}
                  <span style={{ color: 'var(--text-2, #94A3B8)' }}>
                    {exercise.primary.length > 0
                      ? exercise.primary.map((id) => MUSCLE_BY_ID[id]?.short || id).join(', ')
                      : 'None specified'}
                  </span>
                </div>
              </div>
              <div className="detail-muscle-legend-row">
                <div className="detail-muscle-dot secondary" aria-hidden="true" />
                <div>
                  <strong style={{ color: 'var(--text, #F8FAFC)' }}>Secondary:</strong>{' '}
                  <span style={{ color: 'var(--text-2, #94A3B8)' }}>
                    {exercise.secondary.length > 0
                      ? exercise.secondary.map((id) => MUSCLE_BY_ID[id]?.short || id).join(', ')
                      : 'None specified'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Required Equipment */}
          <div>
            <span className="ex-filter-label" style={{ marginBottom: 6 }}>Equipment Required</span>
            <div className="chips">
              {exercise.equipmentIds.length > 0 ? (
                exercise.equipmentIds.map((eqId) => (
                  <span key={eqId} className="chip" style={{ cursor: 'default' }}>
                    {equipmentLabel(eqId)}
                  </span>
                ))
              ) : (
                <span className="chip" style={{ cursor: 'default' }}>
                  Bodyweight
                </span>
              )}
            </div>
          </div>

          {/* Step-by-Step Instructions */}
          <div>
            <span className="ex-filter-label" style={{ marginBottom: 8 }}>Step-by-Step Instructions</span>
            {exercise.instructions && exercise.instructions.length > 0 ? (
              <ol className="detail-instructions-list">
                {exercise.instructions.map((step, idx) => (
                  <li key={idx} className="detail-instruction-item">
                    <span className="detail-instruction-num">{idx + 1}</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <div className="empty" style={{ padding: 14 }}>
                No written instructions recorded for this exercise.
              </div>
            )}
          </div>

          {/* Coach Cues Callout (Green) */}
          {exercise.cues && exercise.cues.length > 0 && (
            <div className="callout-box cues">
              <div className="callout-title">
                <span>💡</span> Coach Cues
              </div>
              <ul className="callout-list">
                {exercise.cues.map((cue, idx) => (
                  <li key={idx}>{cue}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Common Mistakes to Avoid Callout (Warn) */}
          {exercise.mistakes && exercise.mistakes.length > 0 && (
            <div className="callout-box mistakes">
              <div className="callout-title">
                <span>⚠️</span> Common Mistakes to Avoid
              </div>
              <ul className="callout-list">
                {exercise.mistakes.map((mistake, idx) => (
                  <li key={idx}>{mistake}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Valid Substitutes List (§4.5, §6.4) */}
          <div>
            <div className="row between" style={{ marginBottom: 8 }}>
              <span className="ex-filter-label">Compatible Substitutes</span>
              <span style={{ fontSize: 11.5, color: 'var(--text-2, #94A3B8)' }}>
                Based on your {profile?.activeLocation ?? 'home'} equipment
              </span>
            </div>

            {substitutes.length > 0 ? (
              <div className="substitutes-list">
                {substitutes.map((sub) => {
                  const subImg = getExerciseImageUrl(sub, 'start') ?? `/repdb-images/flat/${sub.id}-start.webp`;
                  return (
                    <button
                      key={sub.id}
                      type="button"
                      className="substitute-row"
                      onClick={() => {
                        onSelectExercise?.(sub.id);
                      }}
                      title={`Inspect ${sub.name}`}
                    >
                      <div className="substitute-thumb">
                        <img
                          src={subImg}
                          alt=""
                          loading="lazy"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 650, color: 'var(--text, #F8FAFC)' }}>
                          {sub.name}
                        </div>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 3 }}>
                          <span className="ex-badge ex-badge-primary-muscle">
                            {sub.primary[0] ? MUSCLE_BY_ID[sub.primary[0]]?.short || sub.primary[0] : 'General'}
                          </span>
                          <span style={{ fontSize: 11.5, color: 'var(--text-2, #94A3B8)' }}>
                            {sub.equipmentIds.map((eq) => equipmentLabel(eq)).join(', ') || 'Bodyweight'}
                          </span>
                        </div>
                      </div>
                      <span style={{ fontSize: 12, color: 'var(--action, #00E5FF)', fontWeight: 600 }}>
                        Inspect →
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="empty" style={{ padding: 14 }}>
                No compatible substitutes found for your current equipment setup.
              </div>
            )}
          </div>

          {/* RepDB Attribution link */}
          <footer className="credit" style={{ textAlign: 'center', marginTop: 8 }}>
            Exercise data by{' '}
            <a href="https://repdb.co" target="_blank" rel="noopener noreferrer">
              RepDB (repdb.co)
            </a>
          </footer>
        </div>
      </section>
    </>
  );
};
