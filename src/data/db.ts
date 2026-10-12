import { Dexie, type EntityTable } from 'dexie';
import type {
  UserProfile,
  Plan,
  WorkoutSession,
  ExerciseFeedback,
} from './types';
import { DEFAULT_EQUIPMENT } from './equipment';

export interface ActiveWorkoutRecord {
  id: string;
  session: WorkoutSession;
  updatedAt: number;
}

export class AtlasFitDatabase extends Dexie {
  profiles!: EntityTable<UserProfile, 'displayName'>;
  plans!: EntityTable<Plan, 'id'>;
  sessions!: EntityTable<WorkoutSession, 'id'>;
  feedback!: EntityTable<ExerciseFeedback, 'exerciseId'>;
  activeWorkout!: EntityTable<ActiveWorkoutRecord, 'id'>;

  constructor() {
    super('AtlasFitDatabase');
    this.version(1).stores({
      profiles: 'displayName',
      plans: 'id, createdAt, location, goal',
      sessions: 'id, startedAt, endedAt, state, planId',
      feedback: 'exerciseId, updatedAt',
      activeWorkout: 'id, updatedAt',
    });
  }
}

export const db = new AtlasFitDatabase();

export const DEFAULT_PROFILE: UserProfile = {
  displayName: 'Lifter',
  goal: 'strength',
  experience: 'some',
  activeLocation: 'home',
  equipment: {
    home: [...DEFAULT_EQUIPMENT.home],
    gym: [...DEFAULT_EQUIPMENT.gym],
    travel: [...DEFAULT_EQUIPMENT.travel],
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
  onboarded: false,
};

function cloneProfile(profile: UserProfile): UserProfile {
  return {
    ...profile,
    equipment: {
      home: [...(profile.equipment?.home ?? DEFAULT_EQUIPMENT.home)],
      gym: [...(profile.equipment?.gym ?? DEFAULT_EQUIPMENT.gym)],
      travel: [...(profile.equipment?.travel ?? DEFAULT_EQUIPMENT.travel)],
    },
    weekdays: [...(profile.weekdays ?? DEFAULT_PROFILE.weekdays)],
    restrictions: [...(profile.restrictions ?? [])],
    liked: [...(profile.liked ?? [])],
    disliked: [...(profile.disliked ?? [])],
    pinned: [...(profile.pinned ?? [])],
    favourites: [...(profile.favourites ?? [])],
  };
}

export async function getUserProfile(): Promise<UserProfile> {
  const profile = await db.profiles.toCollection().first();
  if (!profile) {
    return cloneProfile(DEFAULT_PROFILE);
  }
  return cloneProfile(profile);
}

export async function saveUserProfile(profile: UserProfile): Promise<void> {
  const cleanProfile: UserProfile = {
    ...cloneProfile(profile),
    displayName: profile.displayName.trim() || DEFAULT_PROFILE.displayName,
  };
  await db.transaction('rw', db.profiles, async () => {
    await db.profiles.clear();
    await db.profiles.put(cleanProfile);
  });
}

export async function savePlan(plan: Plan): Promise<void> {
  await db.plans.put(plan);
}

export async function getLatestPlan(): Promise<Plan | undefined> {
  const latest = await db.plans.orderBy('createdAt').last();
  if (latest) {
    return latest;
  }
  const all = await db.plans.toArray();
  if (all.length === 0) {
    return undefined;
  }
  return all.sort((a, b) => b.createdAt - a.createdAt)[0];
}

export async function getAllPlans(): Promise<Plan[]> {
  return db.plans.orderBy('createdAt').reverse().toArray();
}

export async function saveWorkoutSession(session: WorkoutSession): Promise<void> {
  await db.sessions.put(session);
}

export async function getWorkoutSessions(limit?: number): Promise<WorkoutSession[]> {
  const query = db.sessions.orderBy('startedAt').reverse();
  if (typeof limit === 'number' && limit > 0) {
    return query.limit(limit).toArray();
  }
  return query.toArray();
}

const ACTIVE_WORKOUT_KEY = 'active';

export async function getActiveWorkout(): Promise<WorkoutSession | null> {
  const record = (await db.activeWorkout.get(ACTIVE_WORKOUT_KEY)) ?? (await db.activeWorkout.toCollection().first());
  return record ? record.session : null;
}

export async function saveActiveWorkout(session: WorkoutSession): Promise<void> {
  await db.activeWorkout.put({
    id: ACTIVE_WORKOUT_KEY,
    session,
    updatedAt: Date.now(),
  });
}

export async function clearActiveWorkout(): Promise<void> {
  await db.activeWorkout.clear();
}

export async function toggleFavourite(exerciseId: string): Promise<boolean> {
  const profile = await getUserProfile();
  const currentFavourites = profile.favourites ?? [];
  const exists = currentFavourites.includes(exerciseId);
  const updatedFavourites = exists
    ? currentFavourites.filter((id) => id !== exerciseId)
    : [...currentFavourites, exerciseId];

  profile.favourites = updatedFavourites;
  await saveUserProfile(profile);
  return !exists;
}

export async function toggleRestriction(exerciseId: string): Promise<boolean> {
  const profile = await getUserProfile();
  const currentRestrictions = profile.restrictions ?? [];
  const exists = currentRestrictions.includes(exerciseId);
  const updatedRestrictions = exists
    ? currentRestrictions.filter((id) => id !== exerciseId)
    : [...currentRestrictions, exerciseId];

  profile.restrictions = updatedRestrictions;
  await saveUserProfile(profile);
  await recordFeedback({
    exerciseId,
    discomfort: !exists,
    updatedAt: Date.now(),
  });
  return !exists;
}

export async function recordFeedback(feedback: ExerciseFeedback): Promise<void> {
  const existing = await db.feedback.get(feedback.exerciseId);
  const entry: ExerciseFeedback = {
    exerciseId: feedback.exerciseId,
    liked: feedback.liked !== undefined ? feedback.liked : existing?.liked,
    discomfort: feedback.discomfort !== undefined ? feedback.discomfort : existing?.discomfort,
    updatedAt: feedback.updatedAt || Date.now(),
  };
  await db.feedback.put(entry);
}

export async function getFeedback(exerciseId: string): Promise<ExerciseFeedback | undefined> {
  return db.feedback.get(exerciseId);
}

export async function getAllFeedback(): Promise<ExerciseFeedback[]> {
  return db.feedback.toArray();
}
