import { describe, expect, it } from 'vitest';
import { prepareNewWorkout } from './prepareWorkout';
import { DEFAULT_PROFILE } from './db';
import type { UserProfile, WorkoutSession } from './types';

const profile: UserProfile = { ...DEFAULT_PROFILE,
  trainingBlock: { enabled: true, lengthWeeks: 4, startDate: '2026-10-01', deloadLastWeek: true },
};
const fresh = (): WorkoutSession => ({ id: 'new', title: 'Session', location: 'gym',
  startedAt: new Date(2026, 9, 23, 12).getTime(), state: 'active',
  items: [{ exerciseId: 'db-row', planned: { exerciseId: 'db-row', sets: 4, reps: '8–12', restSec: 90, reason: 'Base plan' },
    sets: Array.from({ length: 4 }, () => ({ loadKg: null, reps: null, done: false, kind: 'working' })) }],
});

describe('New workout block integration', () => {
  it('applies a deload once and snapshots it for resume', () => {
    const original = fresh();
    const prepared = prepareNewWorkout(original, profile);
    expect(prepared.blockContext).toEqual({ week: 4, lengthWeeks: 4, phase: 'deload', loadFactor: .85 });
    expect(prepared.items[0].sets.length).toBeLessThan(4);
    expect(original.items[0].sets).toHaveLength(4);
    expect(prepareNewWorkout(prepared, profile)).toBe(prepared);
  });
  it('never rewrites started performance, finished history or disabled blocks', () => {
    const started = fresh(); started.items[0].sets[0].loadKg = 20;
    expect(prepareNewWorkout(started, profile)).toBe(started);
    const completed = { ...fresh(), state: 'done' as const };
    expect(prepareNewWorkout(completed, profile)).toBe(completed);
    const empty = fresh();
    expect(prepareNewWorkout(empty, DEFAULT_PROFILE)).toBe(empty);
  });
});
