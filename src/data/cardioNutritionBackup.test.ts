// @vitest-environment node
import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { db, DEFAULT_PROFILE, getUserProfile, saveUserProfile } from './db';
import { exportBackup, importBackup } from './backup';
import type { CardioSession, NutritionPreferences } from './types';

afterEach(async () => {
  await db.transaction('rw', db.tables, async () => { for (const table of db.tables) await table.clear(); });
});
const cardio: CardioSession = { id: 'cardio-test', activity: 'walk', durationMin: 30, distanceKm: 2,
  intensity: 'easy', completedAt: 1700000000000, notes: 'Evening walk' };
const nutrition: NutritionPreferences = { diet: 'eggetarian', age: 30, equationSex: 'male', weightKg: 70, heightCm: 170,
  activity: 'light', goal: 'maintain', foodExclusions: [], planSeed: 'saved-week' };

describe('Cardio and nutrition backups', () => {
  it('round-trips separate cardio records and diet preferences without inventing strength sessions', async () => {
    await saveUserProfile({ ...DEFAULT_PROFILE, nutrition });
    await db.cardio.put(cardio);
    const backup = await exportBackup();
    await db.cardio.clear();
    await db.profiles.clear();
    expect(await importBackup(backup)).toEqual({ success: true });
    expect(await db.cardio.get(cardio.id)).toEqual(cardio);
    expect((await getUserProfile()).nutrition).toEqual(nutrition);
    expect(await db.sessions.count()).toBe(0);
  });
  it('rejects malformed cardio before clearing existing records', async () => {
    await db.cardio.put(cardio);
    const doc = { schema: 1, exportedAt: 1, profile: DEFAULT_PROFILE, plans: [], sessions: [], feedback: [], cardio: [{ ...cardio, durationMin: -3 }] };
    expect((await importBackup(JSON.stringify(doc))).success).toBe(false);
    expect(await db.cardio.get(cardio.id)).toEqual(cardio);
  });
  it('rejects minor or invalid diet calculator inputs before writing', async () => {
    await saveUserProfile(DEFAULT_PROFILE);
    const doc = { schema: 1, exportedAt: 1, profile: { ...DEFAULT_PROFILE, nutrition: { ...nutrition, age: 15 } }, plans: [], sessions: [], feedback: [] };
    expect((await importBackup(JSON.stringify(doc))).success).toBe(false);
    expect((await getUserProfile()).nutrition).toBeUndefined();
  });
});
