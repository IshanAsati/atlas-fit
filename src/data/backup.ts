import { db } from './db';
import { MUSCLE_BY_ID } from './muscles';
import { shareNativeBackup } from '../native/backupShare';
import { isNutritionPreferences, isTrainingBlockSettings, isWorkoutReminderSettings } from './trainingSettings';
import type {
  BackupDoc,
  UserProfile,
  Plan,
  WorkoutSession,
  ExerciseFeedback,
  Routine,
  CardioSession,
} from './types';

const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === 'string' && !!value.trim();
const stringList = (value: unknown): value is string[] => Array.isArray(value) && value.every((entry) => typeof entry === 'string');
const location = (value: unknown) => typeof value === 'string' && ['home', 'gym', 'travel'].includes(value);
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const optionalBoolean = (value: unknown) => value === undefined || typeof value === 'boolean';
const optionalTimestamp = (value: unknown) => value === undefined || (finite(value) && value >= 0);
function validPlannedExercise(value: unknown): boolean {
  return isRecord(value) && text(value.exerciseId) && finite(value.sets) && Number.isInteger(value.sets) && value.sets >= 1 && value.sets <= 30 &&
    text(value.reps) && finite(value.restSec) && value.restSec >= 0 && value.restSec <= 1800 && typeof value.reason === 'string';
}
function validSession(value: unknown): boolean {
  return isRecord(value) && text(value.id) && typeof value.title === 'string' && location(value.location) && finite(value.startedAt) &&
    ['active', 'done'].includes(String(value.state)) && optionalTimestamp(value.endedAt) && optionalTimestamp(value.pausedAt) && optionalTimestamp(value.pausedMs) &&
    (value.blockContext === undefined || (isRecord(value.blockContext) && finite(value.blockContext.week) && Number.isInteger(value.blockContext.week) &&
      finite(value.blockContext.lengthWeeks) && [4,6,8].includes(value.blockContext.lengthWeeks) && value.blockContext.week >= 1 && value.blockContext.week <= value.blockContext.lengthWeeks &&
      ['build','deload'].includes(String(value.blockContext.phase)) && finite(value.blockContext.loadFactor) && value.blockContext.loadFactor > 0 && value.blockContext.loadFactor <= 1)) &&
    (value.planId === undefined || typeof value.planId === 'string') && (value.dayId === undefined || typeof value.dayId === 'string') &&
    Array.isArray(value.items) && value.items.every((item) => isRecord(item) && text(item.exerciseId) && optionalBoolean(item.skipped) && optionalBoolean(item.discomfort) &&
      (item.planned === undefined || validPlannedExercise(item.planned)) && Array.isArray(item.sets) && item.sets.every((set) => isRecord(set) && typeof set.done === 'boolean' &&
        (set.loadKg === null || (finite(set.loadKg) && set.loadKg >= 0)) && (set.reps === null || (finite(set.reps) && Number.isInteger(set.reps) && set.reps >= 0)) &&
        (set.kind === undefined || set.kind === 'warmup' || set.kind === 'working') && (set.effort === undefined || (finite(set.effort) && [1, 2, 3].includes(set.effort)))));
}

function validCardioSession(value: unknown): boolean {
  return isRecord(value) && text(value.id) && ['walk','run','cycle','row','swim','other'].includes(String(value.activity)) &&
    finite(value.durationMin) && value.durationMin > 0 && value.durationMin <= 1440 &&
    (value.distanceKm === undefined || (finite(value.distanceKm) && value.distanceKm > 0 && value.distanceKm <= 10000)) &&
    ['easy','moderate','hard'].includes(String(value.intensity)) && finite(value.completedAt) && value.completedAt >= 0 && value.completedAt <= 8.64e15 &&
    (value.notes === undefined || (typeof value.notes === 'string' && value.notes.length <= 500));
}

export async function exportBackup(): Promise<string> {
  return db.transaction('r', [db.profiles, db.plans, db.sessions, db.feedback, db.routines, db.activeWorkout, db.cardio], async () => {
    const profile = (await db.profiles.toCollection().first()) ?? null;
    const plans = await db.plans.toArray();
    const sessions = await db.sessions.toArray();
    const feedback = await db.feedback.toArray();
    const routines = await db.routines.toArray();
    const activeWorkout = (await db.activeWorkout.get('active'))?.session ?? null;
    const cardio = await db.cardio.toArray();

    const backupDoc: BackupDoc = { schema: 1, exportedAt: Date.now(), profile, plans, sessions, feedback, routines, activeWorkout, cardio };

    return JSON.stringify(backupDoc, null, 2);
  });
}

export async function importBackup(
  jsonString: string,
): Promise<{ success: boolean; error?: string }> {
  if (typeof jsonString !== 'string' || !jsonString.trim()) {
    return { success: false, error: 'Empty or invalid JSON payload' };
  }

  let doc: unknown;
  try {
    doc = JSON.parse(jsonString);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: `JSON parsing error: ${msg}` };
  }

  if (typeof doc !== 'object' || doc === null || Array.isArray(doc)) {
    return { success: false, error: 'Backup data must be an object' };
  }

  const raw = doc as Record<string, unknown>;

  if (raw.schema !== 1) {
    return {
      success: false,
      error: `Unsupported backup schema: ${String(raw.schema)}. Expected schema 1.`,
    };
  }

  if (!finite(raw.exportedAt)) {
    return { success: false, error: 'Invalid or missing exportedAt timestamp' };
  }

  if (raw.profile !== null && raw.profile !== undefined) {
    if (typeof raw.profile !== 'object' || Array.isArray(raw.profile)) {
      return { success: false, error: 'Invalid profile: expected an object or null' };
    }
    const prof = raw.profile as Record<string, unknown>;
    if (typeof prof.displayName !== 'string' || !prof.displayName.trim()) {
      return { success: false, error: 'Invalid profile: missing displayName' };
    }
    if (!['strength','fitness','technique','endurance','mobility'].includes(String(prof.goal)) ||
      !['new','some','experienced'].includes(String(prof.experience)) || !location(prof.activeLocation) ||
      !isRecord(prof.equipment) || !['home','gym','travel'].every((place) => stringList((prof.equipment as Record<string,unknown>)[place])) ||
      !finite(prof.daysPerWeek) || !Number.isInteger(prof.daysPerWeek) || prof.daysPerWeek < 2 || prof.daysPerWeek > 6 || !finite(prof.durationMin) || ![30,45,60].includes(prof.durationMin) ||
      !stringList(prof.weekdays) || !prof.weekdays.every((day) => ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].includes(day)) ||
      !['restrictions','liked','disliked','pinned','favourites','avoidEquipment','targetMuscles'].every((key) => prof[key] === undefined || stringList(prof[key])) ||
      (Array.isArray(prof.targetMuscles) && !prof.targetMuscles.every((id) => Object.hasOwn(MUSCLE_BY_ID, String(id)))) ||
      (prof.trainingBlock !== undefined && !isTrainingBlockSettings(prof.trainingBlock)) ||
      (prof.reminders !== undefined && !isWorkoutReminderSettings(prof.reminders)) ||
      (prof.nutrition !== undefined && !isNutritionPreferences(prof.nutrition)) ||
      typeof prof.discomfortNotes !== 'string' || typeof prof.otherSports !== 'string' || typeof prof.onboarded !== 'boolean' ||
      (prof.weightUnit !== undefined && prof.weightUnit !== 'kg' && prof.weightUnit !== 'lb')) {
      return { success: false, error: 'Invalid profile preferences or equipment' };
    }
  }

  if (!Array.isArray(raw.plans)) {
    return { success: false, error: 'Invalid plans: expected an array' };
  }

  for (let i = 0; i < raw.plans.length; i++) {
    const plan = raw.plans[i];
    if (typeof plan !== 'object' || plan === null || Array.isArray(plan)) {
      return { success: false, error: `Invalid plan at index ${i}: expected an object` };
    }
    const p = plan as Record<string, unknown>;
    if (typeof p.id !== 'string' || !p.id.trim()) {
      return { success: false, error: `Invalid plan at index ${i}: missing valid id` };
    }
    if (!finite(p.createdAt) || !location(p.location) || !['strength','fitness','technique','endurance','mobility'].includes(String(p.goal)) ||
      !['new','some','experienced'].includes(String(p.experience)) || typeof p.split !== 'string' || !stringList(p.explanation) ||
      !Array.isArray(p.days) || !p.days.every((day) => isRecord(day) && text(day.id) && typeof day.label === 'string' && typeof day.focus === 'string' &&
        stringList(day.movementTargets) && Array.isArray(day.exercises) && day.exercises.every(validPlannedExercise))) {
      return { success: false, error: `Invalid plan structure at index ${i}` };
    }
  }

  if (!Array.isArray(raw.sessions)) {
    return { success: false, error: 'Invalid sessions: expected an array' };
  }

  for (let i = 0; i < raw.sessions.length; i++) {
    const session = raw.sessions[i];
    if (typeof session !== 'object' || session === null || Array.isArray(session)) {
      return { success: false, error: `Invalid session at index ${i}: expected an object` };
    }
    const s = session as Record<string, unknown>;
    if (typeof s.id !== 'string' || !s.id.trim()) {
      return { success: false, error: `Invalid session at index ${i}: missing valid id` };
    }
    if (!validSession(s)) return { success: false, error: `Invalid session structure at index ${i}` };
  }

  if (!Array.isArray(raw.feedback)) {
    return { success: false, error: 'Invalid feedback: expected an array' };
  }

  for (let i = 0; i < raw.feedback.length; i++) {
    const fb = raw.feedback[i];
    if (typeof fb !== 'object' || fb === null || Array.isArray(fb)) {
      return { success: false, error: `Invalid feedback at index ${i}: expected an object` };
    }
    const f = fb as Record<string, unknown>;
    if (typeof f.exerciseId !== 'string' || !f.exerciseId.trim()) {
      return { success: false, error: `Invalid feedback at index ${i}: missing valid exerciseId` };
    }
    if (!finite(f.updatedAt) || !optionalBoolean(f.liked) || !optionalBoolean(f.discomfort)) return { success: false, error: `Invalid feedback at index ${i}` };
  }

  const validatedProfile = (raw.profile ? (raw.profile as UserProfile) : null);
  const validatedPlans = raw.plans as Plan[];
  const validatedSessions = raw.sessions as WorkoutSession[];
  const validatedFeedback = raw.feedback as ExerciseFeedback[];
  if (raw.routines !== undefined && (!Array.isArray(raw.routines) || raw.routines.some((entry) => {
    if (!entry || typeof entry !== 'object') return true;
    const routine = entry as Routine;
    return typeof routine.id !== 'string' || !routine.id || typeof routine.title !== 'string' || !routine.title.trim() ||
      !['home', 'gym', 'travel'].includes(routine.location) || !Number.isFinite(routine.createdAt) || !Number.isFinite(routine.updatedAt) ||
      !Array.isArray(routine.exercises) || !routine.exercises.length || !routine.exercises.every(validPlannedExercise);
  }))) return { success: false, error: 'Invalid saved routines in backup' };
  const validatedRoutines = (raw.routines ?? []) as Routine[];
  if (raw.cardio !== undefined && (!Array.isArray(raw.cardio) || !raw.cardio.every(validCardioSession))) {
    return { success: false, error: 'Invalid cardio sessions in backup' };
  }
  const validatedCardio = (raw.cardio ?? []) as CardioSession[];
  const restoredActive = raw.activeWorkout as WorkoutSession | null | undefined;
  if (restoredActive !== undefined && restoredActive !== null && (!validSession(restoredActive) || restoredActive.state !== 'active')) {
    return { success: false, error: 'Invalid active workout in backup' };
  }

  try {
    await db.transaction('rw', [db.profiles, db.plans, db.sessions, db.feedback, db.activeWorkout, db.routines, db.cardio], async () => {
      await db.profiles.clear();
      if (validatedProfile) {
        await db.profiles.put(validatedProfile);
      }

      await db.plans.clear();
      if (validatedPlans.length > 0) {
        await db.plans.bulkAdd(validatedPlans);
      }

      await db.sessions.clear();
      if (validatedSessions.length > 0) {
        await db.sessions.bulkAdd(validatedSessions);
      }

      await db.feedback.clear();
      if (validatedFeedback.length > 0) {
        await db.feedback.bulkAdd(validatedFeedback);
      }

      await db.activeWorkout.clear();
      if (restoredActive) {
        await db.activeWorkout.put({ id: 'active', session: restoredActive, updatedAt: Date.now() });
        await db.sessions.put(restoredActive);
      }
      await db.routines.clear();
      if (validatedRoutines.length) await db.routines.bulkAdd(validatedRoutines);
      await db.cardio.clear();
      if (validatedCardio.length) await db.cardio.bulkAdd(validatedCardio);
    });

    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: `Failed to restore database: ${msg}` };
  }
}

export async function downloadBackupFile(): Promise<void> {
  const jsonString = await exportBackup();
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const filename = `atlas-fit-backup-${year}-${month}-${day}.json`;

  if (await shareNativeBackup(filename, jsonString)) return;

  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }

  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export async function importBackupFile(file: File): Promise<{ success: boolean; error?: string }> {
  try {
    const text = await file.text();
    return await importBackup(text);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: `Failed to read file: ${msg}` };
  }
}
