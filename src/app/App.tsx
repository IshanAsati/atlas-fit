import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { StoreProvider, useStore } from '../data/store';
import { BodyIcon, BookIcon, HomeIcon, PlanIcon, TimerIcon } from '../design/icons';
import { Onboarding } from '../features/onboarding/Onboarding';
import { Home } from '../features/dashboard/Home';
import { PlanScreen } from '../features/planner/PlanScreen';
import { ActiveWorkout } from '../features/workout/ActiveWorkout';
import { Library } from '../features/exercises/Library';
import { ExerciseDetail } from '../features/exercises/ExerciseDetail';
import { BodygraphScreen } from '../features/bodygraph/BodygraphScreen';

const TABS = [
  { to: '/home', label: 'Home', icon: HomeIcon },
  { to: '/plan', label: 'Plan', icon: PlanIcon },
  { to: '/workout', label: 'Workout', icon: TimerIcon },
  { to: '/exercises', label: 'Library', icon: BookIcon },
  { to: '/bodygraph', label: 'Body', icon: BodyIcon },
];

function TabBar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { sessions, plans } = useStore();

  const active = sessions.find((s) => s.state === 'active');
  const planned = plans.length > 0;

  const go = (to: string) => {
    if (to === '/workout') {
      if (active) navigate(`/workout/${active.id}`);
      else navigate(planned ? '/plan' : '/home');
      return;
    }
    navigate(to);
  };

  return (
    <nav className="tabbar" aria-label="Main">
      {TABS.map((t) => {
        const Icon = t.icon;
        const isActive =
          t.to === '/workout'
            ? pathname.startsWith('/workout')
            : pathname === t.to ||
              (t.to === '/exercises' && pathname.startsWith('/exercises'));
        return (
          <button
            key={t.to}
            type="button"
            className="tab"
            aria-current={isActive ? 'page' : undefined}
            onClick={() => go(t.to)}
          >
            <Icon />
            {t.label}
            {t.to === '/workout' && active ? <span aria-hidden="true" style={{ width: 5, height: 5, borderRadius: 99, background: 'var(--action)' }} /> : null}
          </button>
        );
      })}
    </nav>
  );
}

function Gate() {
  const { profile, profileLoaded } = useStore();
  const { pathname, search } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [pathname]);

  if (!profileLoaded) {
    return (
      <div className="shell">
        <div className="view" style={{ paddingTop: 64 }}>
          <div className="skeleton" style={{ height: 28, width: '55%' }} role="status" aria-label="Loading Atlas Fit" />
          <div className="skeleton" style={{ height: 190, borderRadius: 22 }} role="status" aria-label="Loading Atlas Fit" />
          <div className="skeleton" style={{ height: 110 }} role="status" aria-label="Loading Atlas Fit" />
          <div className="skeleton" style={{ height: 110 }} role="status" aria-label="Loading Atlas Fit" />
        </div>
      </div>
    );
  }

  const onboarded = profile?.onboarded === true;
  const onOnboarding = pathname.startsWith('/onboarding');

  if (!onboarded && !onOnboarding) return <Navigate to="/onboarding" replace />;
  if (onboarded && onOnboarding && new URLSearchParams(search).get('edit') !== '1') {
    return <Navigate to="/home" replace />;
  }

  return (
    <div className="shell">
      <Routes>
        <Route path="/" element={<Navigate to={onboarded ? '/home' : '/onboarding'} replace />} />
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/home" element={<Home />} />
        <Route path="/plan" element={<PlanScreen />} />
        <Route path="/workout" element={<ActiveWorkout />} />
        <Route path="/workout/:id" element={<ActiveWorkout />} />
        <Route path="/exercises" element={<Library />} />
        <Route path="/exercises/:id" element={<ExerciseDetail />} />
        <Route path="/bodygraph" element={<BodygraphScreen />} />
        <Route path="*" element={<Navigate to="/home" replace />} />
      </Routes>
      {onboarded && !onOnboarding ? <TabBar /> : null}
    </div>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <StoreProvider>
        <Gate />
      </StoreProvider>
    </BrowserRouter>
  );
}
