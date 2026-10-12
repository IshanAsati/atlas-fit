import { db } from './db';
import type {
  BackupDoc,
  UserProfile,
  Plan,
  WorkoutSession,
  ExerciseFeedback,
} from './types';

export async function exportBackup(): Promise<string> {
  const profile = (await db.profiles.toCollection().first()) ?? null;
  const plans = await db.plans.toArray();
  const sessions = await db.sessions.toArray();
  const feedback = await db.feedback.toArray();

  const backupDoc: BackupDoc = {
    schema: 1,
    exportedAt: Date.now(),
    profile,
    plans,
    sessions,
    feedback,
  };

  return JSON.stringify(backupDoc, null, 2);
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

  if (typeof raw.exportedAt !== 'number' || Number.isNaN(raw.exportedAt)) {
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
  }

  const validatedProfile = (raw.profile ? (raw.profile as UserProfile) : null);
  const validatedPlans = raw.plans as Plan[];
  const validatedSessions = raw.sessions as WorkoutSession[];
  const validatedFeedback = raw.feedback as ExerciseFeedback[];

  try {
    await db.transaction('rw', [db.profiles, db.plans, db.sessions, db.feedback, db.activeWorkout], async () => {
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
