/**
 * Smoke tests: every screen renders without crashing (§14 end-to-end sanity).
 * The store is mocked with a realistic onboarded profile; Dexie/IndexedDB is
 * never touched. Recharts needs a ResizeObserver stub under jsdom.
 */
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import type { UserProfile, WorkoutSession } from '../data/types';
import { CATALOG } from '../data/catalog';

const profile: UserProfile = {
  displayName: 'Ishan',
  goal: 'fitness',
  experience: 'some',
  activeLocation: 'home',
  equipment: {
    home: ['bodyweight', 'mat', 'chair', 'dumbbells', 'bands'],
    gym: ['bench', 'dumbbells', 'barbell', 'squat-rack'],
    travel: ['bodyweight', 'bands'],
  },
  daysPerWeek: 3,
  durationMin: 45,
  weekdays: ['Mon', 'Wed', 'Fri'],
  restrictions: [],
  discomfortNotes: '',
  otherSports: '',
  liked: [],
  disliked: [],
  pinned: [],
  favourites: [],
  onboarded: true,
};

const session: WorkoutSession = {
  id: 'session-1',
  title: 'Full body A',
  planId: 'plan-1',
  dayId: 'day-1',
  location: 'home',
  startedAt: Date.now() - 600_000,
  state: 'active',
  items: [
    {
      exerciseId: 'push-up',
      planned: { exerciseId: 'push-up', sets: 2, reps: '8–12', restSec: 90, reason: 'test' },
      sets: [
        { reps: 10, loadKg: null, done: true },
        { reps: null, loadKg: null, done: false },
      ],
    },
  ],
};

vi.mock('../data/store', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../data/store')>();
  return {
    ...actual,
    useStore: () => ({
      profile,
      profileLoaded: true,
      updateProfile: vi.fn(),
      plans: [],
      sessions: [session],
      feedback: [],
      catalog: CATALOG,
      byId: (id: string) => CATALOG.find((e) => e.id === id),
      repdbLoaded: true,
      saveSession: vi.fn(),
      setFeedback: vi.fn(),
    }),
    buildHistory: () => ({ recentMuscleSets: {}, recentExerciseCount: {} }),
  };
});

vi.mock('../data/db', () => ({
  db: {},
  putPlan: vi.fn(),
  putSession: vi.fn(),
}));

vi.mock('../data/backup', () => ({
  buildBackup: vi.fn(),
  downloadBackup: vi.fn(),
  inspectBackup: vi.fn(),
  restoreBackup: vi.fn(),
}));

vi.mock('recharts', () => ({
  Bar: () => null,
  BarChart: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  ResponsiveContainer: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Tooltip: () => null,
  XAxis: () => null,
  YAxis: () => null,
}));

beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe() { /* stub */ }
    unobserve() { /* stub */ }
    disconnect() { /* stub */ }
  } as unknown as typeof ResizeObserver;
});

function renderAt(path: string, ui: React.ReactElement) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="*" element={ui} />
        <Route path="/exercises/:id" element={ui} />
        <Route path="/workout/:id" element={ui} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('screen smoke tests', () => {
  it('Onboarding renders step 1', async () => {
    const { Onboarding } = await import('../features/onboarding/Onboarding');
    renderAt('/onboarding', <Onboarding />);
    expect(screen.getByText('What should we call you?')).toBeTruthy();
  });

  it('Home renders hero + strip', async () => {
    const { Home } = await import('../features/dashboard/Home');
    renderAt('/home', <Home />);
    expect(screen.getByText(/Hi, Ishan/)).toBeTruthy();
    expect(screen.getByText('Last 7 days')).toBeTruthy();
  });

  it('Plan generator renders config', async () => {
    const { PlanScreen } = await import('../features/planner/PlanScreen');
    renderAt('/plan', <PlanScreen />);
    expect(screen.getByText('Plan generator')).toBeTruthy();
    expect(screen.getByText('Generate plan')).toBeTruthy();
  });

  it('Active workout renders current exercise', async () => {
    const { ActiveWorkout } = await import('../features/workout/ActiveWorkout');
    renderAt('/workout/session-1', <ActiveWorkout />);
    expect(screen.getAllByText('Push-up').length).toBeGreaterThan(0);
    expect(screen.getByText(/elapsed/)).toBeTruthy();
  });

  it('Library renders results', async () => {
    const { Library } = await import('../features/exercises/Library');
    renderAt('/exercises', <Library />);
    expect(screen.getByText('Exercise library')).toBeTruthy();
    expect(screen.getAllByText('Push-up').length).toBeGreaterThan(0);
  });

  it('Exercise detail renders instructions', async () => {
    const { ExerciseDetail } = await import('../features/exercises/ExerciseDetail');
    renderAt('/exercises/push-up', <ExerciseDetail />);
    expect(screen.getAllByText('Push-up').length).toBeGreaterThan(0);
  });

  it('Bodygraph screen renders modes + chart', async () => {
    const { BodygraphScreen } = await import('../features/bodygraph/BodygraphScreen');
    renderAt('/bodygraph', <BodygraphScreen />);
    expect(screen.getByText('Body & progress')).toBeTruthy();
    expect(screen.getByText('Working sets (last 7 days)')).toBeTruthy();
  });
});
