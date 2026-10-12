import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type {
  UserProfile,
  Plan,
  PlanDay,
  WorkoutSession,
  LocationType,
  MuscleId,
} from '../../data/types';
import {
  getUserProfile,
  saveUserProfile,
  getLatestPlan,
  savePlan,
  getWorkoutSessions,
  getActiveWorkout,
  saveActiveWorkout,
  saveWorkoutSession,
} from '../../data/db';
import { CATALOG, CATALOG_BY_ID } from '../../data/catalog';
import { generatePlan } from '../planner/engine';
import { BodygraphFigure, type HighlightValue } from '../bodygraph/BodygraphFigure';
import { MUSCLES } from '../../data/muscles';

export interface HomeScreenProps {
  /** Called when the user clicks "Start Workout" or "Resume Workout" */
  onStartWorkout?: (session: WorkoutSession) => void;
  /** Navigation callback to switch top-level tabs */
  onNavigateTab?: (tab: 'home' | 'plan' | 'workout' | 'exercises' | 'bodygraph') => void;
  /** Alias navigation callback for flexibility */
  onNavigate?: (tab: string) => void;
  /** Callback when user selects an exercise */
  onSelectExercise?: (exerciseId: string) => void;
  /** Optional custom CSS class */
  className?: string;
}

const MOVEMENT_LABELS: Record<string, string> = {
  squat: 'Squat',
  hinge: 'Hinge',
  hpush: 'Horizontal Push',
  vpush: 'Vertical Push',
  hpull: 'Horizontal Pull',
  vpull: 'Vertical Pull',
  core: 'Core & Trunk',
  carry: 'Carry',
  accessory: 'Accessory',
  mobility: 'Mobility',
};

const GOAL_BADGES: Record<string, string> = {
  strength: 'Strength Focus',
  fitness: 'General Fitness',
  technique: 'Technique & Form',
  endurance: 'Muscular Endurance',
  mobility: 'Mobility & Range',
};

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onStartWorkout,
  onNavigateTab,
  onNavigate,
  onSelectExercise: _onSelectExercise,
  className = '',
}) => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [activeWorkout, setActiveWorkout] = useState<WorkoutSession | null>(null);
  const [loading, setLoading] = useState(true);

  const goToTab = useCallback(
    (tab: 'home' | 'plan' | 'workout' | 'exercises' | 'bodygraph') => {
      if (onNavigateTab) {
        onNavigateTab(tab);
      } else if (onNavigate) {
        onNavigate(tab);
      }
    },
    [onNavigateTab, onNavigate],
  );

  // Load initial data
  const loadData = useCallback(async () => {
    try {
      const userProfile = await getUserProfile();
      setProfile(userProfile);

      const allSessions = await getWorkoutSessions();
      setSessions(allSessions);

      const active = await getActiveWorkout();
      setActiveWorkout(active);

      let currentPlan = await getLatestPlan();
      if (!currentPlan) {
        currentPlan = generatePlan(userProfile, CATALOG, allSessions);
        await savePlan(currentPlan);
      }
      setPlan(currentPlan);
    } catch (err) {
      console.error('Error loading dashboard data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle location switch (Home / Gym / Travel)
  const handleSwitchLocation = async (newLocation: LocationType) => {
    if (!profile) return;
    if (profile.activeLocation === newLocation) return;

    try {
      const updatedProfile: UserProfile = {
        ...profile,
        activeLocation: newLocation,
      };
      setProfile(updatedProfile);
      await saveUserProfile(updatedProfile);

      // Regenerate plan for the new location profile
      const newPlan = generatePlan(updatedProfile, CATALOG, sessions, {
        planId: `plan-${newLocation}-${Date.now()}`,
        createdAt: Date.now(),
      });
      setPlan(newPlan);
      await savePlan(newPlan);
    } catch (err) {
      console.error('Error switching location:', err);
    }
  };

  // Determine current scheduled day
  const currentDay = useMemo<PlanDay | null>(() => {
    if (!plan || !plan.days || plan.days.length === 0) return null;

    // Check which days have been completed in the current week
    const now = new Date();
    const dayOfWeek = (now.getDay() + 6) % 7; // Mon = 0
    const monday = new Date(now);
    monday.setDate(now.getDate() - dayOfWeek);
    monday.setHours(0, 0, 0, 0);
    const startOfWeek = monday.getTime();

    const recentCompletedDayIds = new Set(
      sessions
        .filter((s) => s.state === 'done' && (s.endedAt ?? s.startedAt) >= startOfWeek && s.dayId)
        .map((s) => s.dayId),
    );

    // Pick first uncompleted day in the plan
    const uncompletedDay = plan.days.find((d) => !recentCompletedDayIds.has(d.id));
    return uncompletedDay ?? plan.days[0];
  }, [plan, sessions]);

  // Focus movements summary string
  const focusMovementsSummary = useMemo(() => {
    if (!currentDay) return 'General Strength';
    if (currentDay.movementTargets && currentDay.movementTargets.length > 0) {
      return currentDay.movementTargets
        .map((m) => MOVEMENT_LABELS[m] || m)
        .join(' · ');
    }
    const movementSet = new Set<string>();
    for (const item of currentDay.exercises) {
      const ex = CATALOG_BY_ID[item.exerciseId];
      if (ex) {
        movementSet.add(MOVEMENT_LABELS[ex.movement] || ex.movement);
      }
    }
    return Array.from(movementSet).slice(0, 3).join(' · ');
  }, [currentDay]);

  // Estimated duration
  const estimatedDuration = useMemo(() => {
    if (profile?.durationMin) return `~${profile.durationMin} min`;
    const count = currentDay?.exercises.length ?? 4;
    return `~${count * 10 + 5} min`;
  }, [profile, currentDay]);

  // Start or resume workout session
  const handleStartWorkout = async () => {
    if (activeWorkout) {
      onStartWorkout?.(activeWorkout);
      goToTab('workout');
      return;
    }

    if (!currentDay) {
      goToTab('plan');
      return;
    }

    const session: WorkoutSession = {
      id: `session-${Date.now()}`,
      title: `${currentDay.label} · ${currentDay.focus}`,
      planId: plan?.id,
      dayId: currentDay.id,
      location: profile?.activeLocation ?? 'home',
      startedAt: Date.now(),
      state: 'active',
      items: currentDay.exercises.map((pEx) => ({
        exerciseId: pEx.exerciseId,
        planned: pEx,
        sets: Array.from({ length: pEx.sets }, () => ({
          reps: null,
          loadKg: null,
          done: false,
        })),
      })),
    };

    await saveActiveWorkout(session);
    await saveWorkoutSession(session);
    setActiveWorkout(session);
    onStartWorkout?.(session);
    goToTab('workout');
  };

  // 7-Day Activity Strip (Mon - Sun of current week)
  const weekStrip = useMemo(() => {
    const now = new Date();
    const currentDayIdx = (now.getDay() + 6) % 7; // Mon = 0, Sun = 6
    const monday = new Date(now);
    monday.setDate(now.getDate() - currentDayIdx);
    monday.setHours(0, 0, 0, 0);

    const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const doneSessions = sessions.filter((s) => s.state === 'done');

    return labels.map((label, idx) => {
      const dayStart = new Date(monday);
      dayStart.setDate(monday.getDate() + idx);
      const startMs = dayStart.getTime();
      const endMs = startMs + 24 * 60 * 60 * 1000;

      const isHit = doneSessions.some((s) => {
        const timestamp = s.endedAt ?? s.startedAt;
        return timestamp >= startMs && timestamp < endMs;
      });

      return {
        label,
        dayNum: dayStart.getDate(),
        isHit,
        isToday: idx === currentDayIdx,
      };
    });
  }, [sessions]);

  const completedDaysThisWeekCount = useMemo(
    () => weekStrip.filter((d) => d.isHit).length,
    [weekStrip],
  );

  // Muscle Activity Heatmap Map for the mini widget (Last 7 Days)
  const weekActivityMap = useMemo<Record<MuscleId, HighlightValue>>(() => {
    const map = {} as Record<MuscleId, HighlightValue>;
    for (const m of MUSCLES) {
      map[m.id] = 0;
    }

    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const muscleVolume: Partial<Record<MuscleId, number>> = {};

    for (const s of sessions) {
      if (s.state !== 'done') continue;
      const timestamp = s.endedAt ?? s.startedAt;
      if (timestamp < cutoff) continue;

      for (const item of s.items) {
        const ex = CATALOG_BY_ID[item.exerciseId];
        if (!ex) continue;
        const doneSets = item.sets.filter((st) => st.done).length;
        if (doneSets === 0) continue;

        for (const p of ex.primary) {
          muscleVolume[p] = (muscleVolume[p] ?? 0) + doneSets;
        }
        for (const sec of ex.secondary) {
          muscleVolume[sec] = (muscleVolume[sec] ?? 0) + Math.round(doneSets * 0.5);
        }
      }
    }

    for (const m of MUSCLES) {
      map[m.id] = muscleVolume[m.id] ?? 0;
    }

    return map;
  }, [sessions]);

  // Sets logged summary in last 7 days
  const weeklyMuscleStats = useMemo(() => {
    let totalSets = 0;
    let activeMuscleCount = 0;

    for (const m of MUSCLES) {
      const count = Number(weekActivityMap[m.id] || 0);
      if (count > 0) {
        totalSets += count;
        activeMuscleCount++;
      }
    }

    return { totalSets, activeMuscleCount };
  }, [weekActivityMap]);

  // Recent completed sessions (up to 3)
  const recentSessions = useMemo(() => {
    return sessions
      .filter((s) => s.state === 'done')
      .sort((a, b) => (b.endedAt ?? b.startedAt) - (a.endedAt ?? a.startedAt))
      .slice(0, 3);
  }, [sessions]);

  if (loading) {
    return (
      <main className="view" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <p className="small">Loading your training dashboard…</p>
      </main>
    );
  }

  const displayName = profile?.displayName?.trim() || 'Lifter';
  const goalBadge = GOAL_BADGES[profile?.goal ?? 'strength'] || 'Strength Focus';
  const activeLocation = profile?.activeLocation ?? 'home';

  return (
    <div className={`dashboard-screen ${className}`}>
      {/* Top Header / Greeting */}
      <header className="topbar" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Hey, {displayName}</h1>
            <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--text-2)' }}>
              {profile?.daysPerWeek ?? 3} days/week · {profile?.durationMin ?? 45} min workouts
            </p>
          </div>
          <span
            className="chip"
            style={{
              padding: '6px 12px',
              fontSize: 12,
              fontWeight: 650,
              color: 'var(--accent)',
              borderColor: 'var(--accent)',
              backgroundColor: 'rgba(0, 229, 255, 0.12)',
            }}
          >
            {goalBadge}
          </span>
        </div>
      </header>

      <main className="view">
        {/* Next Workout Hero Surface (§4.2) */}
        <section className="hero" aria-label="Next scheduled workout">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="eyebrow">
              {activeWorkout ? 'Workout In Progress' : 'Next Workout'}
            </span>
            <span
              style={{
                fontSize: 11,
                textTransform: 'uppercase',
                letterSpacing: 0.8,
                fontWeight: 700,
                color: 'var(--text-2)',
              }}
            >
              {activeLocation}
            </span>
          </div>

          <div className="title" style={{ fontSize: 20 }}>
            {activeWorkout
              ? activeWorkout.title
              : currentDay
                ? `${currentDay.label} · ${currentDay.focus}`
                : 'Full Body Program'}
          </div>

          <div className="sub" style={{ margin: 0 }}>
            {focusMovementsSummary}
          </div>

          <div className="small" style={{ color: 'var(--text-2)' }}>
            {currentDay ? `${currentDay.exercises.length} exercises` : '4 exercises'} · {estimatedDuration}
          </div>

          {/* Big Prominent Start/Resume Button */}
          <button
            type="button"
            className="btn primary block"
            style={{ minHeight: 50, fontSize: 16 }}
            onClick={handleStartWorkout}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M8 5v14l11-7z" />
            </svg>
            {activeWorkout ? 'Resume Workout' : 'Start Workout'}
          </button>

          {/* Location Switcher Toggle */}
          <div style={{ marginTop: 4 }}>
            <label
              htmlFor="location-selector"
              style={{
                display: 'block',
                fontSize: 11,
                fontWeight: 650,
                color: 'var(--text-2)',
                textTransform: 'uppercase',
                letterSpacing: 0.6,
                marginBottom: 6,
              }}
            >
              Switch Location
            </label>
            <div className="seg" id="location-selector" role="group" aria-label="Switch workout location">
              <button
                type="button"
                aria-pressed={activeLocation === 'home'}
                onClick={() => handleSwitchLocation('home')}
              >
                Home
              </button>
              <button
                type="button"
                aria-pressed={activeLocation === 'gym'}
                onClick={() => handleSwitchLocation('gym')}
              >
                Gym
              </button>
              <button
                type="button"
                aria-pressed={activeLocation === 'travel'}
                onClick={() => handleSwitchLocation('travel')}
              >
                Travel
              </button>
            </div>
          </div>
        </section>

        {/* 7-Day Activity Strip (§4.2) */}
        <section className="panel" aria-label="Weekly activity strip">
          <div className="row between" style={{ marginBottom: 10 }}>
            <h2 className="h-sec">This Week's Activity</h2>
            <span className="small">
              {completedDaysThisWeekCount > 0
                ? `${completedDaysThisWeekCount} of 7 days completed`
                : '0 days completed'}
            </span>
          </div>

          <div className="strip" role="list" aria-label="Days of current week">
            {weekStrip.map((day) => (
              <div
                key={day.label}
                role="listitem"
                className={`cell${day.isHit ? ' hit' : ''}`}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                  outline: day.isToday ? '1px solid var(--action)' : undefined,
                }}
                aria-label={`${day.label} ${day.dayNum}, ${day.isHit ? 'workout completed' : 'no workout'}`}
              >
                <span style={{ fontSize: 10, color: 'var(--text-2)' }}>{day.label}</span>
                <span style={{ fontSize: 13, fontWeight: 700 }}>{day.dayNum}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Mini Bodygraph Widget (§4.2) */}
        <section className="panel" aria-label="Muscle recovery and activity widget">
          <div className="row between" style={{ marginBottom: 12 }}>
            <div>
              <h2 className="h-sec">Muscle Recovery & Activity</h2>
              <p className="small" style={{ margin: '2px 0 0' }}>
                Training activity estimate based on logged sets
              </p>
            </div>
            <button
              type="button"
              className="btn ghost small-btn"
              onClick={() => goToTab('bodygraph')}
            >
              Explore Bodygraph
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              background: 'var(--bg-raised)',
              borderRadius: 'var(--radius)',
              padding: 12,
              border: '1px solid var(--hairline)',
            }}
          >
            {/* Compact figure thumbnail */}
            <div style={{ width: 110, flexShrink: 0, display: 'flex', justifyContent: 'center' }}>
              <BodygraphFigure
                view="front"
                highlightMap={weekActivityMap}
                compact={true}
              />
            </div>

            {/* Stats summary */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  color: 'var(--accent)',
                  letterSpacing: 0.6,
                }}
              >
                Last 7 Days
              </span>
              <div style={{ fontSize: 20, fontWeight: 700, marginTop: 2, color: 'var(--text)' }}>
                {weeklyMuscleStats.totalSets} Sets Logged
              </div>
              <p className="small" style={{ margin: '4px 0 0' }}>
                {weeklyMuscleStats.totalSets > 0
                  ? `Active across ${weeklyMuscleStats.activeMuscleCount} muscle groups this week.`
                  : 'Complete a workout session to see your muscular activity heatmap!'}
              </p>
            </div>
          </div>
        </section>

        {/* Recent Sessions Section (§4.2) */}
        <section aria-label="Recent workout sessions">
          <div className="row between" style={{ marginBottom: 8 }}>
            <h2 className="h-sec">Recent Workouts</h2>
            {recentSessions.length > 0 && (
              <span className="small">{recentSessions.length} logged</span>
            )}
          </div>

          {recentSessions.length === 0 ? (
            <div className="empty">
              <svg
                width="36"
                height="36"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--text-2)"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ margin: '0 auto 8px', display: 'block', opacity: 0.8 }}
                aria-hidden="true"
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
              <p style={{ fontWeight: 650, fontSize: 15, color: 'var(--text)', margin: '0 0 4px' }}>
                No logged workouts yet.
              </p>
              <p style={{ margin: 0, color: 'var(--text-2)' }}>
                Complete your first session to see real activity trends!
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {recentSessions.map((session) => {
                const totalCompletedSets = session.items.reduce(
                  (total, item) => total + item.sets.filter((s) => s.done).length,
                  0,
                );
                const durationMs =
                  session.endedAt && session.startedAt
                    ? session.endedAt - session.startedAt
                    : 0;
                const durationMin = Math.max(1, Math.round(durationMs / 60000));
                const dateStr = new Date(session.endedAt ?? session.startedAt).toLocaleDateString(
                  undefined,
                  {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                  },
                );

                return (
                  <div key={session.id} className="panel" style={{ padding: '12px 14px' }}>
                    <div className="row between">
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 15 }}>{session.title}</div>
                        <div className="small" style={{ marginTop: 3 }}>
                          {dateStr} · {durationMin} min · {totalCompletedSets} sets
                        </div>
                      </div>
                      <span
                        className="chip"
                        style={{
                          fontSize: 11,
                          padding: '3px 8px',
                          minHeight: 24,
                          textTransform: 'uppercase',
                        }}
                      >
                        {session.location}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Quick Actions (§4.2) */}
        <section aria-label="Quick actions" style={{ display: 'flex', gap: 10 }}>
          <button
            type="button"
            className="btn ghost grow"
            onClick={() => goToTab('plan')}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            Adjust Plan
          </button>

          <button
            type="button"
            className="btn ghost grow"
            onClick={() => goToTab('exercises')}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            Browse Exercise Library
          </button>
        </section>

        {/* Visible Attribution (§6.1, §4.2) */}
        <footer className="credit" style={{ textAlign: 'center', marginTop: 12 }}>
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
