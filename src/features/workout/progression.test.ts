import { describe, expect, it } from 'vitest';
import type { Exercise, PerformedSet, SessionItem, WorkoutSession } from '../../data/types';
import { canonicalLoad, displayLoad } from './workoutHelpers';
import { getProgressionSuggestion } from './progression';

const exercise: Exercise = {
  id: 'db-press', name: 'Dumbbell press', aliases: [], source: 'atlas', equipmentIds: ['dumbbells', 'bench'],
  movement: 'hpush', difficulty: 1, primary: ['chest'], secondary: [], instructions: [], cues: [], mistakes: [], substitutes: [],
};
const set = (reps = 10, loadKg: number | null = 20, effort: PerformedSet['effort'] = 2): PerformedSet =>
  ({ reps, loadKg, effort, done: true });
function item(sets: PerformedSet[] = [set(), set(), set()], reps = '8–12'): SessionItem {
  return { exerciseId: exercise.id, sets, planned: { exerciseId: exercise.id, sets: 3, reps, restSec: 90, reason: 'Test' } };
}
function session(previous = item(), startedAt = 100): WorkoutSession {
  return { id: String(startedAt), title: 'Test', location: 'gym', state: 'done', startedAt, items: [previous] };
}
const current = () => item([set(0, null), set(0, null), set(0, null)].map((entry) => ({ ...entry, reps: null, done: false })));
const suggest = (previous = item()) => getProgressionSuggestion(exercise,
  { ...current(), planned: previous.planned }, [session(previous)]);

describe('getProgressionSuggestion', () => {
  it('returns no target with no history', () => {
    expect(getProgressionSuggestion(exercise, current(), [])).toBeNull();
  });

  it('adds one rep within the range at the same load', () => {
    expect(suggest()).toMatchObject({ loadKg: 20, reps: 11, action: 'reps' });
  });

  it('uses the weakest working-set rep count, not the best set', () => {
    expect(suggest(item([set(12), set(9), set(11)]))).toMatchObject({ reps: 10, loadKg: 20, action: 'reps' });
  });

  it('increases load only after every required set reaches the upper bound', () => {
    expect(suggest(item([set(12), set(12), set(12)]))).toMatchObject({ reps: 8, loadKg: 20.5, action: 'load' });
    expect(suggest(item([set(12), set(11), set(12)]))).toMatchObject({ reps: 12, loadKg: 20, action: 'reps' });
  });

  it('does not promote hard effort', () => {
    expect(suggest(item([set(12), set(12, 20, 3), set(12)]))).toMatchObject({ loadKg: 20, action: 'hold' });
  });

  it('does not promote failed lower targets or inflate failed reps', () => {
    expect(suggest(item([set(7), set(12), set(12)]))).toMatchObject({ reps: 7, action: 'hold' });
  });

  it('respects the previous lower target even if the new range is easier', () => {
    expect(getProgressionSuggestion(exercise, current(), [session(item([set(9), set(9), set(9)], '10–12'))]))
      .toMatchObject({ reps: 9, action: 'hold' });
  });

  it('holds both rep and load progression when effort is missing', () => {
    const missing = { ...set(12), effort: undefined };
    expect(suggest(item([missing, set(12), set(12)]))).toMatchObject({ action: 'hold', loadKg: 20 });
    expect(suggest(item([{ ...set(10), effort: undefined }, set(), set()]))).toMatchObject({ action: 'hold', reps: 10 });
  });

  it('does not use active or unrelated sessions', () => {
    expect(getProgressionSuggestion(exercise, current(), [
      { ...session(), state: 'active' }, session({ ...item(), exerciseId: 'other' }, 200),
    ])).toBeNull();
  });

  it('selects the latest completed relevant session without mutating order', () => {
    const history = [session(item([set(12), set(12), set(12)]), 50), session(item([set(8), set(8), set(8)]), 200), session(item(), 100)];
    const before = structuredClone(history);
    expect(getProgressionSuggestion(exercise, current(), history)).toMatchObject({ loadKg: 20, reps: 9, action: 'reps' });
    expect(history).toEqual(before);
  });

  it('ignores skipped attempts, but does not bypass recent discomfort', () => {
    expect(getProgressionSuggestion(exercise, current(), [session(), session({ ...item(), skipped: true }, 200)]))
      .toMatchObject({ action: 'reps' });
    expect(getProgressionSuggestion(exercise, current(), [session(), session({ ...item(), discomfort: true }, 200)]))
      .toBeNull();
  });

  it('returns no target for current discomfort, skip or mismatched exercise', () => {
    expect(getProgressionSuggestion(exercise, { ...current(), discomfort: true }, [session()])).toBeNull();
    expect(getProgressionSuggestion(exercise, { ...current(), skipped: true }, [session()])).toBeNull();
    expect(getProgressionSuggestion(exercise, { ...current(), exerciseId: 'other' }, [session()])).toBeNull();
  });

  it('never falls back to an older success when the latest attempt is incomplete', () => {
    const history = [session(item([set(12), set(12), set(12)])), session(item([set(12), { ...set(12), done: false }, set(12)]), 200)];
    expect(getProgressionSuggestion(exercise, current(), history)).toMatchObject({ action: 'hold', loadKg: 20 });
    expect(getProgressionSuggestion(exercise, current(), [session(), session(item([]), 300)])).toBeNull();
  });

  it.each([0, -1, NaN, Infinity, 1.5])('excludes invalid reps %s from completion', (reps) => {
    expect(suggest(item([set(12), set(reps), set(12)]))).toMatchObject({ action: 'hold' });
    expect(suggest(item([set(reps), set(reps), set(reps)]))).toBeNull();
  });

  it.each([NaN, Infinity, -1])('excludes invalid loads %s from completion', (load) => {
    expect(suggest(item([set(12), set(12, load), set(12)]))).toMatchObject({ action: 'hold' });
  });

  it('ignores warmup reps, loads and effort when deciding progression', () => {
    expect(suggest(item([{ ...set(2, 5, 3), kind: 'warmup' }, set(12), set(12), set(12)])))
      .toMatchObject({ loadKg: 20.5, action: 'load' });
  });

  it('does not count warmups toward required working sets', () => {
    expect(suggest(item([{ ...set(12), kind: 'warmup' }, set(12), set(12)]))).toMatchObject({ action: 'hold' });
  });

  it('requires every currently planned set, including newly added working rows', () => {
    expect(getProgressionSuggestion(exercise, { ...current(), sets: [...current().sets, set()] }, [session(item([set(12), set(12), set(12)]))]))
      .toMatchObject({ action: 'hold' });
  });

  it('holds mixed loads instead of combining unmatched performance', () => {
    expect(suggest(item([set(12, 20), set(12, 22), set(12, 21)]))).toMatchObject({ loadKg: 20, action: 'hold' });
  });

  it('never invents a load for unweighted or zero-load history', () => {
    expect(suggest(item([set(12, null), set(12, null), set(12, null)]))).toMatchObject({ loadKg: null, action: 'hold' });
    expect(suggest(item([set(12, 0), set(12, 0), set(12, 0)]))).toMatchObject({ loadKg: null, action: 'hold' });
  });

  it('progresses bodyweight reps only, even when a historical load was entered', () => {
    const bodyweight = { ...exercise, equipmentIds: ['bodyweight', 'bench'] };
    expect(getProgressionSuggestion(bodyweight, current(), [session()])).toMatchObject({ loadKg: null, reps: 11, action: 'reps' });
    expect(getProgressionSuggestion(bodyweight, current(), [session(item([set(12), set(12), set(12)]))]))
      .toMatchObject({ loadKg: null, reps: 12, action: 'hold' });
  });

  it.each(['8-12', '8 – 12 controlled', '8—12 reps', '8–12 per side'])('parses %s safely', (range) => {
    expect(suggest(item(undefined, range))).toMatchObject({ action: 'reps', reps: 11 });
  });

  it('supports fixed-rep plans', () => {
    expect(suggest(item([set(10), set(10), set(10)], '10'))).toMatchObject({ action: 'load', reps: 10 });
  });

  it.each(['20–30s hold', '8–12 seconds', 'AMRAP', '12-8', '0–12', '8/12', '8–120', '3 sets of 8', ''])
    ('does not fabricate targets from %s', (range) => expect(suggest(item(undefined, range))).toBeNull());

  it('returns no target when no rep prescription is available', () => {
    expect(getProgressionSuggestion(exercise, { ...current(), planned: undefined }, [session({ ...item(), planned: undefined })])).toBeNull();
  });

  it('does not suggest reps for holds or mobility even with a numeric plan', () => {
    for (const changed of [{ ...exercise, name: 'Plank', equipmentIds: ['dumbbells'] },
      { ...exercise, name: 'Wall sit' }, { ...exercise, movement: 'mobility' as const }]) {
      expect(getProgressionSuggestion(changed, current(), [session()])).toBeNull();
    }
  });

  it('caps increases at 5% and 2.5 kg rather than forcing equipment jumps', () => {
    expect(suggest(item([set(12, 5), set(12, 5), set(12, 5)]))).toMatchObject({ action: 'hold', loadKg: 5 });
    expect(suggest(item([set(12, 200), set(12, 200), set(12, 200)]))).toMatchObject({ action: 'load', loadKg: 202.5 });
    expect(getProgressionSuggestion({ ...exercise, equipmentIds: ['barbell'] }, current(),
      [session(item([set(12), set(12), set(12)]))])).toMatchObject({ action: 'hold', loadKg: 20 });
  });

  it('rounds pound-mode suggestions in display units while retaining canonical kg', () => {
    const load = canonicalLoad(40, 'lb');
    const result = getProgressionSuggestion(exercise, current(), [session(item([set(12, load), set(12, load), set(12, load)]))], 'lb');
    expect(result?.action).toBe('load');
    expect(displayLoad(result!.loadKg!, 'lb')).toBe(41);
    expect(result!.loadKg! / load).toBeLessThanOrEqual(1.05);
  });

  it('deloads the prior load without first adding reps or load', () => {
    expect(getProgressionSuggestion(exercise, current(), [session()], 'kg', 0.85))
      .toMatchObject({ loadKg: 17, reps: 10, action: 'deload' });
    expect(getProgressionSuggestion(exercise, current(), [session(item([set(12), set(12), set(12)]))], 'kg', 0.85))
      .toMatchObject({ loadKg: 17, reps: 12, action: 'deload' });
  });

  it('keeps bodyweight deloads load-free and does not increase reps', () => {
    expect(getProgressionSuggestion({ ...exercise, equipmentIds: ['bodyweight'] }, current(), [session()], 'kg', 0.85))
      .toMatchObject({ loadKg: null, reps: 10, action: 'deload' });
  });

  it.each([0, -1, NaN, Infinity, 1.1])('rejects unsafe loadFactor %s', (factor) => {
    expect(getProgressionSuggestion(exercise, current(), [session()], 'kg', factor)).toBeNull();
  });
});
