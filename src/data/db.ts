import Dexie, { type Table } from 'dexie';
import type {
  ExerciseFeedback,
  Plan,
  UserProfile,
  WorkoutSession,
} from './types';

/**
 * Offline storage (§9): Dexie over IndexedDB for plans + structured history.
 * localStorage is only for lightweight UI prefs. Schema-versioned (v1).
 *
 * Privacy: local by default, never uploaded. iOS may evict website storage,
 * so export reminders + import/restore flow live in `backup.ts`.
 */

interface KeyVal {
  key: string;
  value: unknown;
}

class AtlasDB extends Dexie {
  keyval!: Table<KeyVal, string>;
  plans!: Table<Plan, string>;
  sessions!: Table<WorkoutSession, string>;
  feedback!: Table<ExerciseFeedback, string>;

  constructor() {
    super('atlas-fit');
    this.version(1).stores({
      keyval: 'key',
      plans: 'id, createdAt',
      sessions: 'id, startedAt, state',
      feedback: 'exerciseId, updatedAt',
    });
  }
}

export const db = new AtlasDB();

const PROFILE_KEY = 'profile:v1';

export async function loadProfile(): Promise<UserProfile | null> {
  const row = await db.keyval.get(PROFILE_KEY);
  return (row?.value as UserProfile | undefined) ?? null;
}

export async function saveProfile(profile: UserProfile): Promise<void> {
  await db.keyval.put({ key: PROFILE_KEY, value: profile });
}

export async function listPlans(): Promise<Plan[]> {
  return db.plans.orderBy('createdAt').reverse().toArray();
}

export async function putPlan(plan: Plan): Promise<void> {
  await db.plans.put(plan);
}

export async function deletePlan(id: string): Promise<void> {
  await db.plans.delete(id);
}

export async function listSessions(): Promise<WorkoutSession[]> {
  return db.sessions.orderBy('startedAt').reverse().toArray();
}

export async function putSession(session: WorkoutSession): Promise<void> {
  await db.sessions.put(session);
}

export async function listFeedback(): Promise<ExerciseFeedback[]> {
  return db.feedback.toArray();
}

export async function putFeedback(fb: ExerciseFeedback): Promise<void> {
  await db.feedback.put(fb);
}

export async function clearUserData(): Promise<void> {
  await db.transaction('rw', db.keyval, db.plans, db.sessions, db.feedback, async () => {
    await db.keyval.delete(PROFILE_KEY);
    await db.plans.clear();
    await db.sessions.clear();
    await db.feedback.clear();
  });
}
