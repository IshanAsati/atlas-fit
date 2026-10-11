import type { BackupDoc } from './types';
import {
  clearUserData,
  db,
  listFeedback,
  listPlans,
  listSessions,
  loadProfile,
  putFeedback,
  putPlan,
  putSession,
  saveProfile,
} from './db';

/**
 * Explicit JSON export/import for user-owned workout data (§9).
 * The licensed exercise dataset itself is never repackaged — only the
 * user's own profile, plans, session history and feedback travel.
 */

export async function buildBackup(): Promise<BackupDoc> {
  const [profile, plans, sessions, feedback] = await Promise.all([
    loadProfile(),
    listPlans(),
    listSessions(),
    listFeedback(),
  ]);
  return { schema: 1, exportedAt: Date.now(), profile, plans, sessions, feedback };
}

export function downloadBackup(doc: BackupDoc): void {
  const blob = new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const date = new Date(doc.exportedAt).toISOString().slice(0, 10);
  a.href = url;
  a.download = `atlas-fit-backup-${date}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export interface ImportCheck {
  ok: boolean;
  error?: string;
  summary?: string;
}

export function inspectBackup(raw: unknown): ImportCheck {
  if (typeof raw !== 'object' || raw === null) return { ok: false, error: 'Not a JSON object.' };
  const doc = raw as Partial<BackupDoc>;
  if (doc.schema !== 1) return { ok: false, error: 'Unsupported backup version.' };
  const plans = Array.isArray(doc.plans) ? doc.plans.length : 0;
  const sessions = Array.isArray(doc.sessions) ? doc.sessions.length : 0;
  return {
    ok: true,
    summary: `${plans} plan(s), ${sessions} workout(s)${doc.profile ? ', profile settings' : ''}.`,
  };
}

/** Restore a validated backup. Caller must confirm overwrite first. */
export async function restoreBackup(doc: BackupDoc): Promise<void> {
  await clearUserData();
  await db.transaction('rw', db.keyval, db.plans, db.sessions, db.feedback, async () => {
    if (doc.profile) await saveProfile(doc.profile);
    for (const p of doc.plans ?? []) await putPlan(p);
    for (const s of doc.sessions ?? []) await putSession(s);
    for (const f of doc.feedback ?? []) await putFeedback(f);
  });
}
