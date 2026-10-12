import { useState, useEffect, useCallback, useRef } from 'react';
import type { WorkoutSession, UserProfile } from './data/types';
import { getUserProfile, getActiveWorkout, saveActiveWorkout } from './data/db';
import { CATALOG_BY_ID } from './data/catalog';
import { HomeScreen } from './features/dashboard/HomeScreen';
import { PlanScreen } from './features/planner/PlanScreen';
import { ActiveWorkoutScreen } from './features/workout/ActiveWorkoutScreen';
import { ProgressScreen } from './features/progress/ProgressScreen';
import { DataScreen } from './features/data/DataScreen';
import { ExerciseDetailSheet } from './features/exercises/ExerciseDetailSheet';
import { ExerciseLibraryScreen } from './features/exercises/ExerciseLibraryScreen';
import { OnboardingScreen } from './features/onboarding/OnboardingScreen';
import { Icon, type IconName } from './design/Icon';
import { useThemePreference } from './design/theme';
import { registerSW } from 'virtual:pwa-register';

export type AppTab = 'home' | 'plan' | 'workout' | 'exercises' | 'muscles' | 'data';
function readRoute(): { tab: AppTab; exerciseId: string | null } {
  const [path, query] = location.hash.slice(1).split('?');
  const routes: Record<string,AppTab> = { today: 'home', plan: 'plan', workout: 'workout', library: 'exercises', progress: 'muscles', settings: 'data' };
  return { tab: routes[path?.replace(/^\//,'')] ?? 'home', exerciseId: new URLSearchParams(query).get('exercise') };
}
const routeNames: Record<AppTab,string> = { home: 'today', plan: 'plan', workout: 'workout', exercises: 'library', muscles: 'progress', data: 'settings' };
const tabs: { tab: AppTab; label: string; icon: IconName }[] = [
  { tab: 'home', label: 'Today', icon: 'home' }, { tab: 'plan', label: 'Plan', icon: 'plan' },
  { tab: 'exercises', label: 'Library', icon: 'library' }, { tab: 'muscles', label: 'Progress', icon: 'progress' },
];

export function App() {
  const [route, setRoute] = useState(readRoute);
  const [activeSession, setActiveSession] = useState<WorkoutSession | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [editingProfile, setEditingProfile] = useState(false);
  const [updateReady, setUpdateReady] = useState(false);
  const [themePreference, setThemePreference] = useThemePreference();
  const updateServiceWorker = useRef<((reloadPage?: boolean) => Promise<void>) | null>(null);
  const starting = useRef(false);
  const scrollPositions = useRef<Partial<Record<AppTab,number>>>({});
  const activeTab = route.tab;
  const selectedExercise = route.exerciseId ? CATALOG_BY_ID[route.exerciseId] ?? null : null;
  const refreshData = useCallback(async () => {
    try {
      const [savedProfile, savedActive] = await Promise.all([getUserProfile(), getActiveWorkout()]);
      setProfile(savedProfile);
      setActiveSession(savedActive?.state === 'active' ? savedActive : null);
      setError(null);
    } catch { setError('Could not open your saved data. Retry without clearing browser storage.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void refreshData(); }, [refreshData]);
  useEffect(() => {
    const update = () => setRoute(readRoute());
    window.addEventListener('hashchange', update);
    return () => window.removeEventListener('hashchange', update);
  }, []);
  useEffect(() => {
    window.scrollTo(0, scrollPositions.current[activeTab] ?? 0);
  }, [activeTab]);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    updateServiceWorker.current = registerSW({ onNeedRefresh: () => setUpdateReady(true) });
  }, []);

  const navigate = (tab: string) => {
    if (tab === 'onboarding') { setEditingProfile(true); return; }
    const mapped = tab === 'bodygraph' || tab === 'progress' ? 'muscles' : tab === 'library' ? 'exercises' : tab;
    if (!(mapped in routeNames)) return;
    scrollPositions.current[activeTab] = window.scrollY;
    location.hash = routeNames[mapped as AppTab];
  };
  const selectExercise = (id: string) => { location.hash = `${routeNames[activeTab]}?exercise=${encodeURIComponent(id)}`; };
  const closeExercise = () => { location.hash = routeNames[activeTab]; void refreshData(); };
  const startWorkout = async (requested: WorkoutSession) => {
    if (starting.current) return;
    starting.current = true;
    try {
      const existing = await getActiveWorkout();
      const session = existing?.state === 'active' ? existing : requested;
      if (!existing) await saveActiveWorkout(session);
      setActiveSession(session);
      navigate('workout');
      if (existing && existing.id !== requested.id) setToast('Resuming your unfinished workout. Finish it before starting another.');
    } catch { setToast('Workout could not be saved. Try again before training.'); }
    finally { starting.current = false; }
  };
  const repeatSession = (session: WorkoutSession) => {
    void startWorkout({ id: crypto.randomUUID(), title: session.title, location: session.location, startedAt: Date.now(), state: 'active',
      items: session.items.filter((item) => !item.skipped).map((item) => ({ exerciseId: item.exerciseId,
        planned: item.planned ? { ...item.planned } : undefined,
        sets: item.sets.map((set) => ({ reps: null, loadKg: null, done: false, kind: set.kind ?? 'working' })) })) });
  };

  if (loading) return <div className="shell"><main className="view" aria-busy="true" style={{ paddingTop: 64 }}><div className="skeleton" style={{ height: 40, width: '65%' }} /><div className="skeleton" style={{ height: 260 }} /><p className="small" role="status">Opening your training log…</p></main></div>;
  if (error) return <div className="shell"><main className="view"><h1 className="h-hero">Your training log</h1><p role="alert" className="error-message">{error}</p><button className="btn primary" onClick={() => void refreshData()}>Retry</button></main></div>;
  if (!profile?.onboarded || editingProfile) return <OnboardingScreen initialProfile={profile ?? undefined} onCancel={editingProfile ? () => { setEditingProfile(false); navigate('data'); } : undefined} onComplete={async () => { setEditingProfile(false); await refreshData(); navigate('home'); setToast('Your preferences and plan are saved.'); }} />;

  return <div className={`shell ${activeSession && activeTab !== 'workout' ? 'has-resume' : ''}`}>
    {toast && <aside role="status" className="toast-alert">{toast}</aside>}
    {updateReady && activeTab !== 'workout' && <div className="banner row between"><span>App update available. Your records stay on this device.</span><button className="btn small-btn" onClick={() => void updateServiceWorker.current?.(true)}>Update</button></div>}
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      {activeTab === 'home' && <HomeScreen onStartWorkout={(session) => void startWorkout(session)} onNavigateTab={navigate} onSelectExercise={selectExercise} />}
      {activeTab === 'plan' && <PlanScreen onStartSession={(session) => void startWorkout(session)} onSelectExercise={selectExercise} />}
      {activeTab === 'workout' && <ActiveWorkoutScreen session={activeSession ?? undefined} onFinishSession={async () => { await refreshData(); navigate('home'); }} onExitSession={async () => { await refreshData(); navigate('home'); }} onSelectExercise={selectExercise} />}
      {activeTab === 'exercises' && <ExerciseLibraryScreen onSelectExercise={selectExercise} />}
      {activeTab === 'muscles' && <ProgressScreen onSelectExercise={selectExercise} onRepeatSession={repeatSession} onNavigateTab={navigate} />}
      {activeTab === 'data' && <><header className="topbar row between"><h1>Settings</h1><button className="icon-btn" aria-label="Back to Today" onClick={() => navigate('home')}><Icon name="back" /></button></header><DataScreen onProfileUpdated={setProfile} onDataRestored={() => void refreshData()} themePreference={themePreference} onThemePreferenceChange={setThemePreference} /></>}
    </div>
    {activeTab !== 'workout' && <>
      {activeSession && <button className="resume-strip" onClick={() => navigate('workout')}><Icon name="play" /><span className="grow"><strong>Resume workout</strong><small>{activeSession.title}</small></span><Icon name="arrow" /></button>}
      <nav className="tabbar" aria-label="Main navigation">{tabs.map((tab) => <button type="button" className="tab" key={tab.tab} aria-current={activeTab === tab.tab ? 'page' : undefined} onClick={() => navigate(tab.tab)}><Icon name={tab.icon} /><span>{tab.label}</span></button>)}</nav>
    </>}
    <ExerciseDetailSheet exercise={selectedExercise} isOpen={Boolean(selectedExercise)} onClose={closeExercise} onSelectExercise={selectExercise} userProfile={profile} onProfileUpdated={setProfile} allowAddToActiveWorkout={activeTab !== 'workout'} />
  </div>;
}
export default App;
