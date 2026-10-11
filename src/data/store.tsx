import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  listFeedback,
  listPlans,
  listSessions,
  loadProfile,
  putFeedback,
  putSession,
  saveProfile,
} from './db';
import { CATALOG, EXERCISE_BY_ID } from './catalog';
import { loadRepdbCatalog, planningEligible } from './repdb';
import type {
  Exercise,
  ExerciseFeedback,
  Plan,
  PerformedSet,
  UserProfile,
  WorkoutSession,
} from './types';

/** Editable defaults shown before the first save (§4.1). */
export const DEFAULT_PROFILE: UserProfile = {
  displayName: '',
  goal: 'fitness',
  experience: 'new',
  activeLocation: 'home',
  equipment: {
    home: ['bodyweight', 'mat', 'chair', 'dumbbells', 'bands'],
    gym: [
      'bench',
      'dumbbells',
      'barbell',
      'squat-rack',
      'pullup-bar',
      'cable',
      'lat-pulldown',
      'seated-row',
      'chest-press',
      'leg-press',
      'leg-extension',
      'leg-curl',
    ],
    travel: ['bodyweight', 'bands'],
  },
  daysPerWeek: 3,
  durationMin: 45,
  weekdays: [],
  restrictions: [],
  discomfortNotes: '',
  otherSports: '',
  liked: [],
  disliked: [],
  pinned: [],
  favourites: [],
  onboarded: false,
};

interface StoreValue {
  profile: UserProfile | null;
  profileLoaded: boolean;
  updateProfile: (patch: Partial<UserProfile>) => Promise<void>;
  plans: Plan[];
  sessions: WorkoutSession[];
  feedback: ExerciseFeedback[];
  catalog: Exercise[];
  byId: (id: string) => Exercise | undefined;
  repdbLoaded: boolean;
  saveSession: (s: WorkoutSession) => Promise<void>;
  setFeedback: (fb: ExerciseFeedback) => Promise<void>;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [repdbLoaded, setRepdbLoaded] = useState(false);
  const [extraExercises, setExtraExercises] = useState<Exercise[]>([]);

  useEffect(() => {
    let cancelled = false;
    loadProfile()
      .then((p) => {
        if (!cancelled) {
          setProfile(p);
          setProfileLoaded(true);
        }
      })
      .catch(() => setProfileLoaded(true));
    return () => {
      cancelled = true;
    };
  }, []);

  // RepDB import is async and offline-safe (package is local).
  // Deferred until the browser is idle so first paint stays fast —
  // the 609-entry dataset chunk (~1.7 MB) loads in the background.
  useEffect(() => {
    let cancelled = false;
    const w = globalThis as unknown as {
      requestIdleCallback?: (cb: () => void) => number;
      cancelIdleCallback?: (id: number) => void;
      setTimeout: (cb: () => void, ms: number) => number;
      clearTimeout: (id: number) => void;
    };
    const load = () => {
      void loadRepdbCatalog()
        .then((entries) => {
          if (cancelled) return;
          setExtraExercises(planningEligible(entries));
          setRepdbLoaded(true);
        })
        .catch(() => setRepdbLoaded(true));
    };
    if (w.requestIdleCallback) {
      const idle = w.requestIdleCallback(load);
      return () => {
        cancelled = true;
        w.cancelIdleCallback?.(idle);
      };
    }
    const timer = w.setTimeout(load, 2500);
    return () => {
      cancelled = true;
      w.clearTimeout(timer);
    };
  }, []);

  const plans = useLiveQuery(() => listPlans(), []) ?? [];
  const sessions = useLiveQuery(() => listSessions(), []) ?? [];
  const feedback = useLiveQuery(() => listFeedback(), []) ?? [];

  const catalog = useMemo(() => {
    const map = new Map<string, Exercise>();
    for (const e of CATALOG) map.set(e.id, e);
    // RepDB entries never overwrite curated IDs; new IDs merge in.
    for (const e of extraExercises) if (!map.has(e.id)) map.set(e.id, e);
    return [...map.values()];
  }, [extraExercises]);

  const byId = useCallback(
    (id: string): Exercise | undefined =>
      EXERCISE_BY_ID[id] ?? catalog.find((e) => e.id === id),
    [catalog],
  );

  const updateProfile = useCallback(async (patch: Partial<UserProfile>) => {
    setProfile((prev) => {
      const next = { ...(prev ?? DEFAULT_PROFILE), ...patch };
      void saveProfile(next).catch(() => undefined);
      return next;
    });
  }, []);

  const saveSession = useCallback(async (s: WorkoutSession) => {
    await putSession(s);
  }, []);

  const setFeedback = useCallback(async (fb: ExerciseFeedback) => {
    await putFeedback(fb);
  }, []);

  const value: StoreValue = {
    profile,
    profileLoaded,
    updateProfile,
    plans,
    sessions,
    feedback,
    catalog,
    byId,
    repdbLoaded,
    saveSession,
    setFeedback,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside StoreProvider');
  return ctx;
}

/** Derive recent-history signals for the planner from real logs only. */
export function buildHistory(sessions: WorkoutSession[]) {
  const recentMuscleSets: Partial<Record<string, number>> = {};
  const recentExerciseCount: Record<string, number> = {};
  const cutoff = Date.now() - 14 * 24 * 60 * 60 * 1000;
  for (const s of sessions) {
    if ((s.endedAt ?? s.startedAt) < cutoff) continue;
    for (const item of s.items) {
      const ex = EXERCISE_BY_ID[item.exerciseId];
      const done = item.sets.filter((st: PerformedSet) => st.done).length;
      if (!ex || done === 0) continue;
      recentExerciseCount[ex.id] = (recentExerciseCount[ex.id] ?? 0) + 1;
      for (const m of ex.primary) recentMuscleSets[m] = (recentMuscleSets[m] ?? 0) + done;
      for (const m of ex.secondary) recentMuscleSets[m] = (recentMuscleSets[m] ?? 0) + done * 0.5;
    }
  }
  return { recentMuscleSets, recentExerciseCount };
}
