import { useState, useEffect, useCallback } from 'react';
import type { WorkoutSession, UserProfile } from './data/types';
import {
  getUserProfile,
  getActiveWorkout,
} from './data/db';
import { CATALOG_BY_ID } from './data/catalog';
import { HomeScreen } from './features/dashboard/HomeScreen';
import { PlanScreen } from './features/planner/PlanScreen';
import { ActiveWorkoutScreen } from './features/workout/ActiveWorkoutScreen';
import { BodygraphScreen } from './features/bodygraph/BodygraphScreen';
import { DataScreen } from './features/data/DataScreen';
import { ExerciseDetailSheet } from './features/exercises/ExerciseDetailSheet';
import { ExerciseLibraryScreen } from './features/exercises/ExerciseLibraryScreen';
import { OnboardingScreen } from './features/onboarding/OnboardingScreen';

export type AppTab = 'home' | 'plan' | 'workout' | 'exercises' | 'muscles' | 'data';

export function App() {
  const [activeTab, setActiveTab] = useState<AppTab>('home');
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(null);
  const [activeSession, setActiveSession] = useState<WorkoutSession | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showOnboardingModal, setShowOnboardingModal] = useState(false);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((cur) => (cur === msg ? null : cur));
    }, 3500);
  }, []);

  const refreshData = useCallback(async () => {
    try {
      const p = await getUserProfile();
      setProfile(p);
      const active = await getActiveWorkout();
      if (active && active.state === 'active') {
        setActiveSession(active);
      } else {
        setActiveSession(null);
      }
    } catch (err) {
      console.error('Failed to load initial data in App:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshData();
  }, [refreshData]);

  const handleSelectExercise = (exerciseId: string) => {
    setSelectedExerciseId(exerciseId);
  };

  const handleStartWorkout = (session: WorkoutSession) => {
    setActiveSession(session);
    setActiveTab('workout');
    showToast(`Started: ${session.title}`);
  };

  const handleFinishWorkout = async () => {
    setActiveSession(null);
    setActiveTab('home');
    await refreshData();
    showToast('🎉 Workout complete & saved!');
  };

  const handleExitWorkout = async () => {
    setActiveTab('home');
    await refreshData();
  };

  const handleNavigateTab = (tab: string) => {
    if (tab === 'home' || tab === 'plan' || tab === 'workout' || tab === 'exercises' || tab === 'muscles' || tab === 'data') {
      setActiveTab(tab as AppTab);
    } else if (tab === 'bodygraph') {
      setActiveTab('muscles');
    } else if (tab === 'library') {
      setActiveTab('exercises');
    } else if (tab === 'onboarding') {
      setShowOnboardingModal(true);
    }
  };

  const handleOnboardingComplete = async () => {
    setShowOnboardingModal(false);
    await refreshData();
    setActiveTab('home');
    showToast('✨ Profile & initial plan ready!');
  };

  if (loading) {
    return (
      <div className="shell" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <p className="sub">Loading Atlas Fit...</p>
      </div>
    );
  }

  // Display Onboarding Screen if user has not completed onboarding or requested replay
  if ((profile && !profile.onboarded) || showOnboardingModal) {
    return (
      <OnboardingScreen
        onComplete={handleOnboardingComplete}
        initialProfile={profile ?? undefined}
      />
    );
  }

  const inspectedExercise = selectedExerciseId ? CATALOG_BY_ID[selectedExerciseId] ?? null : null;

  return (
    <div className="shell">
      {/* Toast Alert */}
      {toastMessage && (
        <aside
          aria-live="polite"
          className="toast-alert"
          style={{
            position: 'fixed',
            top: 16,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'var(--surface-2)',
            color: 'var(--text)',
            border: '1px solid var(--hairline)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
            padding: '10px 18px',
            borderRadius: '999px',
            fontSize: 14,
            fontWeight: 600,
            zIndex: 100,
            pointerEvents: 'none',
          }}
        >
          {toastMessage}
        </aside>
      )}

      {/* Screen Views */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {activeTab === 'home' && (
          <HomeScreen
            onStartWorkout={handleStartWorkout}
            onNavigateTab={handleNavigateTab}
            onSelectExercise={handleSelectExercise}
          />
        )}

        {activeTab === 'plan' && (
          <PlanScreen
            onStartSession={handleStartWorkout}
            onSelectExercise={handleSelectExercise}
          />
        )}

        {activeTab === 'workout' && (
          <ActiveWorkoutScreen
            session={activeSession ?? undefined}
            onFinishSession={handleFinishWorkout}
            onExitSession={handleExitWorkout}
            onSelectExercise={handleSelectExercise}
          />
        )}

        {activeTab === 'exercises' && (
          <ExerciseLibraryScreen
            onSelectExercise={handleSelectExercise}
          />
        )}

        {activeTab === 'muscles' && (
          <BodygraphScreen
            onSelectExercise={handleSelectExercise}
            onNavigateTab={handleNavigateTab}
          />
        )}

        {activeTab === 'data' && (
          <div className="view">
            <header className="row between" style={{ marginBottom: 12 }}>
              <div className="row" style={{ gap: 10 }}>
                <button
                  type="button"
                  className="btn small-btn ghost"
                  onClick={() => setActiveTab('home')}
                >
                  ← Back
                </button>
                <h1 className="h-sec">Data & Settings</h1>
              </div>
              <button
                type="button"
                className="btn small-btn ghost"
                onClick={() => setShowOnboardingModal(true)}
              >
                Replay Onboarding
              </button>
            </header>
            <DataScreen
              onProfileUpdated={(updated) => setProfile(updated)}
              onDataRestored={refreshData}
            />
          </div>
        )}
      </main>

      {/* Persistent Bottom Tab Bar (5 Tabs) */}
      <nav className="tabbar" aria-label="Main Navigation">
        {/* 1. Today (Home) */}
        <button
          type="button"
          className="tab"
          aria-current={activeTab === 'home' ? 'page' : undefined}
          onClick={() => setActiveTab('home')}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
          <span>Today</span>
        </button>

        {/* 2. Plan */}
        <button
          type="button"
          className="tab"
          aria-current={activeTab === 'plan' ? 'page' : undefined}
          onClick={() => setActiveTab('plan')}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
            <line x1="16" x2="16" y1="2" y2="6" />
            <line x1="8" x2="8" y1="2" y2="6" />
            <line x1="3" x2="21" y1="10" y2="10" />
            <path d="m9 16 2 2 4-4" />
          </svg>
          <span>Plan</span>
        </button>

        {/* 3. Workout */}
        <button
          type="button"
          className="tab"
          aria-current={activeTab === 'workout' ? 'page' : undefined}
          onClick={() => setActiveTab('workout')}
          style={{ position: 'relative' }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 4v16" />
            <path d="M18 4v16" />
            <path d="M2 9h4" />
            <path d="M18 9h4" />
            <path d="M2 15h4" />
            <path d="M18 15h4" />
            <path d="M6 12h12" />
          </svg>
          <span>Workout</span>
          {activeSession && (
            <span
              style={{
                position: 'absolute',
                top: 6,
                right: '25%',
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: 'var(--action)',
              }}
            />
          )}
        </button>

        {/* 4. Library */}
        <button
          type="button"
          className="tab"
          aria-current={activeTab === 'exercises' ? 'page' : undefined}
          onClick={() => setActiveTab('exercises')}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m16 6 4 14" />
            <path d="M12 6v14" />
            <path d="M8 8v12" />
            <path d="M4 4v16" />
          </svg>
          <span>Library</span>
        </button>

        {/* 5. Muscles */}
        <button
          type="button"
          className="tab"
          aria-current={activeTab === 'muscles' ? 'page' : undefined}
          onClick={() => setActiveTab('muscles')}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="5" r="3" />
            <path d="M12 8v8" />
            <path d="m9 12-4-2" />
            <path d="m15 12 4-2" />
            <path d="m9 20 3-4 3 4" />
          </svg>
          <span>Muscles</span>
        </button>
      </nav>

      {/* Global Exercise Detail Bottom Sheet */}
      <ExerciseDetailSheet
        exercise={inspectedExercise}
        isOpen={Boolean(inspectedExercise)}
        onClose={() => setSelectedExerciseId(null)}
        onSelectExercise={handleSelectExercise}
        userProfile={profile}
        onProfileUpdated={(updated) => setProfile(updated)}
      />
    </div>
  );
}

export default App;
