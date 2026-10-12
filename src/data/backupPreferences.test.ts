// @vitest-environment node
import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { exportBackup, importBackup } from './backup';
import { db, DEFAULT_PROFILE, getUserProfile, saveUserProfile } from './db';

afterEach(async () => {
  await db.transaction('rw', db.tables, async () => {
    for (const table of db.tables) await table.clear();
  });
});

describe('Training preferences backups', () => {
  it('round-trips muscle targets, avoided gear and exercises through real storage', async () => {
    const profile = {
      ...DEFAULT_PROFILE,
      targetMuscles: ['abs', 'calves'] as const,
      avoidEquipment: ['barbell', 'smith-machine'],
      restrictions: ['push-up'],
    };
    await saveUserProfile({ ...profile, targetMuscles: [...profile.targetMuscles] });
    const backup = await exportBackup();
    await db.profiles.clear();
    expect(await importBackup(backup)).toEqual({ success: true });
    expect(await getUserProfile()).toMatchObject(profile);
  });

  it('accepts old backups without the optional preference fields', async () => {
    const doc = {
      schema: 1, exportedAt: 1700000000000,
      profile: DEFAULT_PROFILE, plans: [], sessions: [], feedback: [],
    };
    expect(await importBackup(JSON.stringify(doc))).toEqual({ success: true });
    expect(await getUserProfile()).toMatchObject({ targetMuscles: [], avoidEquipment: [] });
  });

  it.each([
    { targetMuscles: ['made-up-muscle'] },
    { targetMuscles: 'abs' },
    { avoidEquipment: [4] },
  ])('rejects malformed preferences without replacing existing records: %j', async (invalid) => {
    await saveUserProfile(DEFAULT_PROFILE);
    const doc = {
      schema: 1, exportedAt: 1700000000000,
      profile: { ...DEFAULT_PROFILE, displayName: 'Replacement', ...invalid },
      plans: [], sessions: [], feedback: [],
    };
    expect((await importBackup(JSON.stringify(doc))).success).toBe(false);
    expect((await getUserProfile()).displayName).toBe(DEFAULT_PROFILE.displayName);
  });
});
