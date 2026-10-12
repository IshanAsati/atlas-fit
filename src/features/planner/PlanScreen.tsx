import React, { useEffect, useState, useMemo } from 'react';
import type { Plan, PlanDay, UserProfile, LocationType, WorkoutSession } from '../../data/types';
import { getUserProfile, saveUserProfile, getLatestPlan, savePlan, getWorkoutSessions } from '../../data/db';
import { CATALOG, CATALOG_BY_ID, findSubstitutes, getExerciseImageUrl } from '../../data/catalog';
import { generatePlan, swapExerciseInPlan } from './engine';
import { EQUIPMENT_BY_ID } from '../../data/equipment';

interface PlanScreenProps {
  onStartSession: (session: WorkoutSession) => void;
  onSelectExercise?: (exerciseId: string) => void;
}

export const PlanScreen: React.FC<PlanScreenProps> = ({
  onStartSession,
  onSelectExercise,
}) => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(true);
  const [showExplanation, setShowExplanation] = useState(false);
  const [swapTarget, setSwapTarget] = useState<{ dayId: string; exerciseId: string } | null>(null);

  // Load profile and plan on mount
  useEffect(() => {
    async function loadData() {
      try {
        const userProf = await getUserProfile();
        setProfile(userProf);

        let currentPlan = await getLatestPlan();
        if (!currentPlan) {
          const sessions = await getWorkoutSessions();
          currentPlan = generatePlan(userProf, CATALOG, sessions);
          await savePlan(currentPlan);
        }
        setPlan(currentPlan);
      } catch (err) {
        console.error('Failed to load plan data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Handle location switch
  const handleLocationSwitch = async (newLocation: LocationType) => {
    if (!profile) return;
    const updatedProf: UserProfile = { ...profile, activeLocation: newLocation };
    setProfile(updatedProf);
    await saveUserProfile(updatedProf);

    // Regenerate plan for new location
    const sessions = await getWorkoutSessions();
    const newPlan = generatePlan(updatedProf, CATALOG, sessions, {
      existingPlan: plan ?? undefined,
      planId: `plan-${newLocation}-${Date.now()}`,
      createdAt: Date.now(),
    });
    setPlan(newPlan);
    await savePlan(newPlan);
  };

  // Handle plan regeneration
  const handleRegenerate = async () => {
    if (!profile) return;
    const sessions = await getWorkoutSessions();
    const newPlan = generatePlan(profile, CATALOG, sessions, {
      existingPlan: plan ?? undefined,
      planId: `plan-${profile.activeLocation}-${Date.now()}`,
      createdAt: Date.now(),
    });
    setPlan(newPlan);
    await savePlan(newPlan);
  };

  // Toggle pinned state for an exercise
  const handleTogglePin = async (exerciseId: string) => {
    if (!profile) return;
    const isPinned = profile.pinned?.includes(exerciseId);
    const updatedPinned = isPinned
      ? profile.pinned.filter((id) => id !== exerciseId)
      : [...(profile.pinned || []), exerciseId];
    
    const updatedProf: UserProfile = { ...profile, pinned: updatedPinned };
    setProfile(updatedProf);
    await saveUserProfile(updatedProf);
  };

  // Start workout from a specific day
  const handleStartDayWorkout = (day: PlanDay) => {
    if (!profile) return;
    const session: WorkoutSession = {
      id: `session-${Date.now()}`,
      title: day.label,
      planId: plan?.id,
      dayId: day.id,
      location: profile.activeLocation,
      startedAt: Date.now(),
      state: 'active',
      items: day.exercises.map((pEx) => ({
        exerciseId: pEx.exerciseId,
        planned: pEx,
        sets: Array.from({ length: pEx.sets }, () => ({
          reps: null,
          loadKg: null,
          done: false,
        })),
      })),
    };
    onStartSession(session);
  };

  // Execute swap
  const handleExecuteSwap = async (newExerciseId: string) => {
    if (!plan || !swapTarget) return;
    try {
      const updatedPlan = swapExerciseInPlan(
        plan,
        swapTarget.dayId,
        swapTarget.exerciseId,
        newExerciseId,
        CATALOG
      );
      setPlan(updatedPlan);
      await savePlan(updatedPlan);
    } catch (err) {
      console.error('Failed to swap exercise:', err);
    } finally {
      setSwapTarget(null);
    }
  };

  // Eligible substitute candidates for current swap target
  const swapCandidates = useMemo(() => {
    if (!swapTarget || !profile) return [];
    const availableEquipment = profile.equipment[profile.activeLocation] || [];
    return findSubstitutes(swapTarget.exerciseId, availableEquipment);
  }, [swapTarget, profile]);

  if (loading) {
    return (
      <div className="view" style={{ alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <p className="sub">Assembling your training plan...</p>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="view">
        <div className="empty">
          <p>No training plan available yet.</p>
          <button type="button" className="btn primary" onClick={handleRegenerate} style={{ marginTop: 12 }}>
            Generate Adaptive Plan
          </button>
        </div>
      </div>
    );
  }

  const targetExerciseForSwap = swapTarget ? CATALOG_BY_ID[swapTarget.exerciseId] : null;

  return (
    <div className="view">
      {/* Top Header */}
      <div className="row between">
        <div>
          <h1 className="h-hero">Training Plan</h1>
          <p className="sub">{plan.split} · {plan.days.length} Days/wk</p>
        </div>
        <button
          type="button"
          className="btn small-btn ghost"
          onClick={handleRegenerate}
          title="Regenerate plan with current constraints"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 2v6h-6" />
            <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
            <path d="M3 22v-6h6" />
            <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
          </svg>
          Regenerate
        </button>
      </div>

      {/* Location Selector Tabs */}
      <div className="seg" role="tablist" aria-label="Training Location">
        {(['home', 'gym', 'travel'] as LocationType[]).map((loc) => {
          const isActive = profile?.activeLocation === loc;
          const label = loc === 'home' ? 'Home' : loc === 'gym' ? 'Gym' : 'Travel';
          return (
            <button
              key={loc}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-pressed={isActive}
              onClick={() => handleLocationSwitch(loc)}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* "Why this plan?" plain-English card */}
      <div className="panel" style={{ borderLeft: '3.5px solid var(--action)' }}>
        <div
          className="row between"
          style={{ cursor: 'pointer' }}
          onClick={() => setShowExplanation(!showExplanation)}
        >
          <div className="row" style={{ gap: 8 }}>
            <span style={{ color: 'var(--action)', fontWeight: 700, fontSize: 13.5 }}>WHY THIS PLAN?</span>
            <span className="small">({plan.explanation.length} design decisions)</span>
          </div>
          <span style={{ fontSize: 13, color: 'var(--text-2)' }}>
            {showExplanation ? '▲ Hide' : '▼ Details'}
          </span>
        </div>
        {showExplanation && (
          <ul style={{ margin: '10px 0 0', paddingLeft: 18, color: 'var(--text-2)', fontSize: 13, lineHeight: 1.6 }}>
            {plan.explanation.map((item, idx) => (
              <li key={idx} style={{ marginBottom: 4 }}>{item}</li>
            ))}
          </ul>
        )}
      </div>

      {/* Weekly Plan Day Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {plan.days.map((day) => (
          <div key={day.id} className="daycard">
            <header className="row between" style={{ background: 'var(--surface-2)' }}>
              <div>
                <div className="d">{day.label}</div>
                <div className="f">{day.focus}</div>
              </div>
              <button
                type="button"
                className="btn small-btn primary"
                onClick={() => handleStartDayWorkout(day)}
              >
                Start Workout
              </button>
            </header>

            <div style={{ padding: '4px 0' }}>
              {day.exercises.map((plannedEx, exIdx) => {
                const ex = CATALOG_BY_ID[plannedEx.exerciseId];
                const isPinned = profile?.pinned?.includes(plannedEx.exerciseId);
                const thumb = ex ? getExerciseImageUrl(ex, 'start') : null;

                return (
                  <div
                    key={`${plannedEx.exerciseId}-${exIdx}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '10px 14px',
                      borderBottom: exIdx < day.exercises.length - 1 ? '1px solid var(--hairline)' : 'none',
                    }}
                  >
                    {/* Thumbnail */}
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 8,
                        background: 'var(--surface-2)',
                        overflow: 'hidden',
                        flexShrink: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: onSelectExercise ? 'pointer' : 'default',
                      }}
                      onClick={() => onSelectExercise && onSelectExercise(plannedEx.exerciseId)}
                    >
                      {thumb ? (
                        <img
                          src={thumb}
                          alt={ex?.name ?? ''}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          loading="lazy"
                        />
                      ) : (
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--accent)' }} />
                      )}
                    </div>

                    {/* Exercise Info */}
                    <div
                      style={{ flex: 1, minWidth: 0, cursor: onSelectExercise ? 'pointer' : 'default' }}
                      onClick={() => onSelectExercise && onSelectExercise(plannedEx.exerciseId)}
                    >
                      <div style={{ fontWeight: 650, fontSize: 14.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {ex?.name ?? plannedEx.exerciseId}
                      </div>
                      <div className="small" style={{ marginTop: 2 }}>
                        <span style={{ color: 'var(--action)', fontWeight: 600 }}>{plannedEx.sets} sets</span>
                        {' · '}
                        <span>{plannedEx.reps} reps</span>
                        {' · '}
                        <span>{plannedEx.restSec}s rest</span>
                      </div>
                      {plannedEx.reason && (
                        <div style={{ fontSize: 11, color: 'var(--text-2)', marginTop: 2, fontStyle: 'italic' }}>
                          {plannedEx.reason}
                        </div>
                      )}
                    </div>

                    {/* Action buttons */}
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      {/* Pin button */}
                      <button
                        type="button"
                        onClick={() => handleTogglePin(plannedEx.exerciseId)}
                        title={isPinned ? 'Pinned in plan' : 'Pin to prevent replacement'}
                        style={{
                          background: isPinned ? 'rgba(0, 229, 255, 0.16)' : 'transparent',
                          border: `1px solid ${isPinned ? 'var(--accent)' : 'var(--hairline)'}`,
                          color: isPinned ? 'var(--accent)' : 'var(--text-2)',
                          borderRadius: 8,
                          width: 34,
                          height: 34,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          transition: 'transform 180ms cubic-bezier(0.34, 1.4, 0.64, 1), background 200ms ease, border-color 200ms ease',
                        }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill={isPinned ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                          <line x1="12" y1="17" x2="12" y2="22" />
                          <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z" />
                        </svg>
                      </button>

                      {/* Swap button */}
                      <button
                        type="button"
                        onClick={() => setSwapTarget({ dayId: day.id, exerciseId: plannedEx.exerciseId })}
                        title="Swap exercise"
                        style={{
                          background: 'transparent',
                          border: '1px solid var(--hairline)',
                          color: 'var(--text-2)',
                          borderRadius: 8,
                          width: 34,
                          height: 34,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          transition: 'transform 180ms cubic-bezier(0.34, 1.4, 0.64, 1), background 200ms ease, border-color 200ms ease',
                        }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="m16 3 4 4-4 4" />
                          <path d="M20 7H4" />
                          <path d="m8 21-4-4 4-4" />
                          <path d="M4 17h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Swap Exercise Modal Sheet */}
      {swapTarget && (
        <>
          <div className="scrim" onClick={() => setSwapTarget(null)} />
          <div className="sheet">
            <div className="grab" />
            <div className="row between" style={{ marginBottom: 12 }}>
              <div>
                <div className="h-sec">Swap Exercise</div>
                <div className="small">
                  Replacing <strong style={{ color: 'var(--text)' }}>{targetExerciseForSwap?.name ?? swapTarget.exerciseId}</strong>
                </div>
              </div>
              <button
                type="button"
                className="btn small-btn ghost"
                onClick={() => setSwapTarget(null)}
              >
                Cancel
              </button>
            </div>

            {swapCandidates.length === 0 ? (
              <div className="empty" style={{ margin: '14px 0' }}>
                <p>No valid alternatives found matching your available {profile?.activeLocation} equipment.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: '55vh', overflowY: 'auto' }}>
                {swapCandidates.map((cand) => {
                  const candThumb = getExerciseImageUrl(cand, 'start');
                  return (
                    <div
                      key={cand.id}
                      onClick={() => handleExecuteSwap(cand.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: '10px 12px',
                        background: 'var(--surface)',
                        border: '1px solid var(--hairline)',
                        borderRadius: 10,
                        cursor: 'pointer',
                      }}
                    >
                      <div
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: 8,
                          background: 'var(--surface-2)',
                          overflow: 'hidden',
                          flexShrink: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {candThumb ? (
                          <img src={candThumb} alt={cand.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--action)' }} />
                        )}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 650, fontSize: 14 }}>{cand.name}</div>
                        <div className="small" style={{ marginTop: 2 }}>
                          {cand.equipmentIds.map((eq) => EQUIPMENT_BY_ID[eq]?.label ?? eq).join(' · ')}
                        </div>
                      </div>
                      <span style={{ fontSize: 12, color: 'var(--action)', fontWeight: 600 }}>
                        Select →
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* RepDB Attribution */}
      <footer className="credit" style={{ textAlign: 'center', marginTop: 12 }}>
        Exercise data by <a href="https://repdb.co" target="_blank" rel="noopener noreferrer">RepDB (repdb.co)</a>.
      </footer>
    </div>
  );
};
export default PlanScreen;
