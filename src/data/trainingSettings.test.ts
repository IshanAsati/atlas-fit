// @vitest-environment node
import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { db, DEFAULT_PROFILE, getUserProfile, saveUserProfile } from './db';
import { exportBackup, importBackup } from './backup';
import { isLocalCalendarDate, isTrainingBlockSettings, isWorkoutReminderSettings } from './trainingSettings';
import type { UserProfile } from './types';

afterEach(async () => {
  await db.transaction('rw', db.tables, async () => {
    for (const table of db.tables) await table.clear();
  });
});

describe('Block and reminder persistence', () => {
  it('round-trips optional preferences through a real backup', async () => {
    const profile: UserProfile = { ...DEFAULT_PROFILE,
      trainingBlock: { enabled: true, lengthWeeks: 6, startDate: '2026-10-12', deloadLastWeek: true },
      reminders: { enabled: true, time: '18:30' },
    };
    await saveUserProfile(profile);
    const backup = await exportBackup();
    await db.profiles.clear();
    expect(await importBackup(backup)).toEqual({ success: true });
    expect(await getUserProfile()).toMatchObject(profile);
  });

  it('keeps retrieved settings detached from stored records', async () => {
    await saveUserProfile({ ...DEFAULT_PROFILE, reminders: { enabled: true, time: '09:00' } });
    const retrieved = await getUserProfile();
    retrieved.reminders!.time = '10:00';
    expect((await getUserProfile()).reminders?.time).toBe('09:00');
  });

  it.each([
    { trainingBlock: { enabled: true, lengthWeeks: 5, startDate: '2026-10-12', deloadLastWeek: true } },
    { trainingBlock: { enabled: true, lengthWeeks: 4, startDate: '2026-02-30', deloadLastWeek: true } },
    { trainingBlock: { enabled: 'yes', lengthWeeks: 4, startDate: '2026-10-12', deloadLastWeek: true } },
    { reminders: { enabled: true, time: '24:00' } },
    { reminders: { enabled: true, time: '09:60' } },
    { reminders: ['18:30'] },
  ])('rejects invalid new settings before replacing storage: %j', async (invalid) => {
    await saveUserProfile(DEFAULT_PROFILE);
    const backup = { schema: 1, exportedAt: 1, profile: { ...DEFAULT_PROFILE, ...invalid }, plans: [], sessions: [], feedback: [] };
    expect((await importBackup(JSON.stringify(backup))).success).toBe(false);
    expect((await getUserProfile()).displayName).toBe(DEFAULT_PROFILE.displayName);
  });

  it('validates local dates and settings without coercing strings', () => {
    expect(isLocalCalendarDate('2024-02-29')).toBe(true);
    expect(isLocalCalendarDate('2025-02-29')).toBe(false);
    expect(isLocalCalendarDate('2026-13-01')).toBe(false);
    expect(isTrainingBlockSettings({ enabled: true, lengthWeeks: '4', startDate: '2026-10-12', deloadLastWeek: true })).toBe(false);
    expect(isWorkoutReminderSettings({ enabled: false, time: '00:00' })).toBe(true);
  });
});
