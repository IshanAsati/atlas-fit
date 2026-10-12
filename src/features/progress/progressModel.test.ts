import { describe, expect, it } from 'vitest';
import type { PerformedSet, UserProfile, WorkoutSession } from '../../data/types';
import { DEFAULT_PROFILE } from '../../data/db';
import { completedSessions, exerciseHistory, formatSet, localDay, progressionSuggestion, recordedPR } from './progressModel';

const session = (id: string, sets: PerformedSet[], startedAt = Date.now()): WorkoutSession => ({
  id, title: 'Workout', startedAt, location: 'gym', state: 'done', items: [{ exerciseId: 'push-up', sets }],
});
const profile: UserProfile = { ...DEFAULT_PROFILE, restrictions: [], discomfortNotes: '' };

describe('progress records', () => {
  it('uses completed sessions and local calendar days', () => {
    const records = [session('one', []), { ...session('active', []), state: 'active' as const }];
    expect(completedSessions(records).map((record) => record.id)).toEqual(['one']);
    expect(localDay(new Date(2026, 0, 2, 23, 30).getTime())).toBe('2026-01-02');
  });

  it('defines PR as maximum load, then maximum reps at that exact load, not volume or e1RM', () => {
    const sets: PerformedSet[] = [
      { done: true, loadKg: 20, reps: 20 }, { done: true, loadKg: 25, reps: 6 },
      { done: true, loadKg: 25, reps: 9 }, { done: true, loadKg: 25, reps: 7 },
      { done: false, loadKg: 50, reps: 5 }, { done: true, loadKg: 60, reps: 4, kind: 'warmup' },
    ];
    const record = session('one', sets);
    expect(recordedPR([record], 'push-up')).toEqual({ loadKg: 25, reps: 9, timestamp: record.startedAt });
    expect(exerciseHistory([record], 'push-up')[0].sets).toHaveLength(4);
    expect(recordedPR([{ ...record, items: [{ ...record.items[0], skipped: true }] }], 'push-up')).toBeNull();
  });

  it('never assumes a missing load is zero or missing reps is a completed strength record', () => {
    expect(recordedPR([session('one', [{ done: true, reps: 10, loadKg: null }, { done: true, reps: null, loadKg: 50 }])], 'push-up')).toBeNull();
    expect(formatSet({ done: true, reps: 10, loadKg: null })).toBe('10 reps · load not recorded');
    expect(recordedPR([session('one', [{ done: true, reps: 12, loadKg: 0 }])], 'push-up')?.reps).toBe(12);
  });

  it('offers optional conservative suggestions only with recorded effort and no known discomfort', () => {
    const easy = session('one', [{ done: true, reps: 10, loadKg: 20, effort: 1 }, { done: true, reps: 10, loadKg: 20, effort: 1 }]);
    expect(progressionSuggestion([easy], 'push-up', profile, [])).toContain('one extra rep on one set');
    expect(progressionSuggestion([easy], 'push-up', profile, [])).toContain('no discomfort');
    expect(progressionSuggestion([easy], 'push-up', null, [])).toBeNull();
    expect(progressionSuggestion([easy], 'push-up', { ...profile, restrictions: ['push-up'] }, [])).toBeNull();
    expect(progressionSuggestion([easy], 'push-up', { ...profile, discomfortNotes: 'Shoulder discomfort' }, [])).toBeNull();
    expect(progressionSuggestion([easy], 'push-up', profile, [{ exerciseId: 'push-up', discomfort: true, updatedAt: Date.now() }])).toBeNull();
    expect(progressionSuggestion([{ ...easy, items: [{ ...easy.items[0], discomfort: true }] }], 'push-up', profile, [])).toBeNull();
    expect(progressionSuggestion([session('hard', easy.items[0].sets.map((set) => ({ ...set, effort: 3 })))], 'push-up', profile, [])).toBeNull();
    expect(progressionSuggestion([session('unrated', easy.items[0].sets.map((set) => ({ ...set, effort: undefined })))], 'push-up', profile, [])).toBeNull();
  });
});
