// @vitest-environment node
import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { db } from './db';
import { deleteCardioSession, getCardioSessions, saveCardioSession } from './cardio';
import type { CardioSession } from './types';

const session: CardioSession = { id: 'cardio-1', activity: 'walk', durationMin: 25, distanceKm: 2, intensity: 'easy', completedAt: new Date(2024, 0, 15).getTime() };
afterEach(async () => { await db.cardio.clear(); });

describe('offline cardio records', () => {
  it('saves canonical cardio values, trims notes, and returns newest first', async () => {
    await saveCardioSession({ ...session, notes: '  A park walk  ' });
    await saveCardioSession({ ...session, id: 'cardio-2', completedAt: session.completedAt + 86400000 });
    expect((await getCardioSessions()).map((record) => record.id)).toEqual(['cardio-2', 'cardio-1']);
    expect(await db.cardio.get(session.id)).toEqual({ ...session, notes: 'A park walk' });
  });

  it('accepts fractional minutes and optional distance, and omits blank notes', async () => {
    const { distanceKm: _distance, ...withoutDistance } = session;
    await saveCardioSession({ ...withoutDistance, durationMin: 0.1, notes: '   ' });
    expect(await db.cardio.get(session.id)).toEqual({ ...withoutDistance, durationMin: 0.1 });
  });

  it('rejects invalid numbers, dates, enums, ids and notes before replacing a record', async () => {
    await saveCardioSession(session);
    const invalid: Record<string, unknown>[] = [
      { durationMin: 0 }, { durationMin: -1 }, { durationMin: NaN }, { durationMin: Infinity }, { durationMin: 1441 }, { durationMin: '20' },
      { distanceKm: 0 }, { distanceKm: -1 }, { distanceKm: Infinity }, { distanceKm: NaN }, { distanceKm: 10001 }, { distanceKm: '2' },
      { activity: 'hike' }, { activity: 'RUN' }, { intensity: 'intense' },
      { completedAt: NaN }, { completedAt: Infinity }, { completedAt: -1 }, { completedAt: Date.now() + 86400000 }, { completedAt: '2024-01-01' },
      { id: '' }, { notes: 'a'.repeat(501) }, { notes: 42 },
    ];
    for (const values of invalid) {
      await expect(saveCardioSession({ ...session, ...values } as CardioSession)).rejects.toThrow();
    }
    expect(await db.cardio.get(session.id)).toEqual(session);
  });

  it('allows valid upper limits and a trimmed 500-character note', async () => {
    await saveCardioSession({ ...session, durationMin: 1440, distanceKm: 10000, notes: ` ${'a'.repeat(500)} ` });
    expect((await db.cardio.get(session.id))?.notes?.length).toBe(500);
  });

  it('supports every listed activity and effort', async () => {
    const activities: CardioSession['activity'][] = ['walk', 'run', 'cycle', 'row', 'swim', 'other'];
    const efforts: CardioSession['intensity'][] = ['easy', 'moderate', 'hard'];
    for (const activity of activities) for (const intensity of efforts) {
      await saveCardioSession({ ...session, id: `${activity}-${intensity}`, activity, intensity });
    }
    expect(await db.cardio.count()).toBe(18);
  });

  it('upserts and deletes only cardio without changing strength history', async () => {
    const before = await db.sessions.toArray();
    await saveCardioSession(session);
    await saveCardioSession({ ...session, durationMin: 30 });
    expect(await db.cardio.count()).toBe(1);
    await deleteCardioSession(session.id);
    expect(await getCardioSessions()).toEqual([]);
    expect(await db.sessions.toArray()).toEqual(before);
  });
});
