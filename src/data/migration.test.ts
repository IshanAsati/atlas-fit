// @vitest-environment node
import 'fake-indexeddb/auto';
import { Dexie } from 'dexie';
import { expect, it } from 'vitest';
import { db, DEFAULT_PROFILE, getUserProfile } from './db';

it('upgrades existing Android/PWA storage without deleting profile or workout history', async () => {
  const old = new Dexie('AtlasFitDatabase');
  old.version(3).stores({ profiles: 'displayName', plans: 'id, createdAt, location, goal',
    sessions: 'id, startedAt, endedAt, state, planId', feedback: 'exerciseId, updatedAt',
    activeWorkout: 'id, updatedAt', routines: 'id, updatedAt, location', externalExercises: 'exerciseId, name, savedAt' });
  await old.table('profiles').put({ ...DEFAULT_PROFILE, displayName: 'Existing Lifter' });
  await old.table('sessions').put({ id: 'old-history', title: 'Old workout', location: 'home', state: 'done', startedAt: 1, items: [] });
  old.close();
  expect((await getUserProfile()).displayName).toBe('Existing Lifter');
  expect(await db.sessions.get('old-history')).toMatchObject({ title: 'Old workout' });
  expect(await db.cardio.count()).toBe(0);
  await db.transaction('rw', db.tables, async () => { for (const table of db.tables) await table.clear(); });
  db.close();
});
