import { describe, expect, it } from 'vitest';
import type { WorkoutSession } from '../../data/types';
import { CATALOG } from '../../data/catalog';
import { calculateMuscleActivity, sessionWorkingSetCount } from './activity';

const now = Date.now();
const session: WorkoutSession = { id: 'one', title: 'Test', state: 'done', location: 'home', startedAt: now - 10000,
  items: [{ exerciseId: 'push-up', sets: [
    { done: true, reps: 10, loadKg: 0 },
    { done: false, reps: 10, loadKg: 0 },
    { done: true, reps: 5, loadKg: 0, kind: 'warmup' },
  ] }, { exerciseId: 'push-up', skipped: true, sets: [{ done: true, reps: 10, loadKg: 0 }] }] };

describe('muscle activity accounting', () => {
  it('excludes skipped, incomplete and warm-up sets, and keeps half-set estimates fractional and separate', () => {
    const activity = calculateMuscleActivity([session], CATALOG, 'week', now);
    expect(activity.actualWorkingSets).toBe(1);
    expect(activity.primary.chest).toBe(1);
    expect(activity.secondaryEstimate.triceps).toBe(0.5);
    expect(activity.primary.triceps ?? 0).toBe(0);
    expect(sessionWorkingSetCount(session)).toBe(1);
  });

  it('never falls back to all planned sets for done sessions with no checked sets', () => {
    const unchecked = { ...session, items: [{ exerciseId: 'push-up', sets: [{ done: false, reps: 10, loadKg: 0 }] }] };
    expect(calculateMuscleActivity([unchecked], CATALOG, 'all', now).actualWorkingSets).toBe(0);
  });

  it('excludes active sessions, future records and records outside the chosen window', () => {
    expect(calculateMuscleActivity([
      { ...session, state: 'active' }, { ...session, startedAt: now + 10000 },
      { ...session, startedAt: now - 8 * 86400000 },
    ], CATALOG, 'week', now).actualWorkingSets).toBe(0);
    expect(calculateMuscleActivity([{ ...session, startedAt: now - 8 * 86400000 }], CATALOG, 'month', now).actualWorkingSets).toBe(1);
  });
});
