import { describe, expect, it } from 'vitest';
import type { PerformedSet, TrainingBlockSettings, WorkoutSession } from '../../data/types';
import { applyTrainingBlockToSession, getTrainingBlockPhase } from './trainingBlocks';

const settings: TrainingBlockSettings = { enabled: true, lengthWeeks: 4, startDate: '2026-03-01', deloadLastWeek: true };
const localDate = (year: number, month: number, day: number, hour = 12) => new Date(year, month - 1, day, hour);
const emptySet = (): PerformedSet => ({ reps: null, loadKg: null, done: false, kind: 'working' });
function newSession(count = 5): WorkoutSession {
  return { id: 'new', title: 'Workout', location: 'home', state: 'active', startedAt: localDate(2026, 3, 22).getTime(),
    items: [{ exerciseId: 'push-up', planned: { exerciseId: 'push-up', sets: count, reps: '8–12', restSec: 90, reason: 'Usual targets.' },
      sets: [{ ...emptySet(), kind: 'warmup' }, ...Array.from({ length: count }, emptySet)] }] };
}
const deloadDate = localDate(2026, 3, 22);

describe('getTrainingBlockPhase', () => {
  it.each([4, 6, 8] as const)('follows a %s-week block from baseline to deload and completion', (lengthWeeks) => {
    const block = { ...settings, lengthWeeks };
    const start = getTrainingBlockPhase(block, localDate(2026, 3, 1));
    expect(start).toMatchObject({ phase: 'build', week: 1, totalWeeks: lengthWeeks, volumeFactor: 1, loadFactor: 1, repBonus: 0 });
    expect(start.note).toMatch(/baseline/);
    expect(getTrainingBlockPhase(block, localDate(2026, 3, 1 + (lengthWeeks - 1) * 7))).toMatchObject({
      phase: 'deload', week: lengthWeeks, volumeFactor: 0.5, loadFactor: 0.85, repBonus: 0,
    });
    const complete = getTrainingBlockPhase(block, localDate(2026, 3, 1 + lengthWeeks * 7));
    expect(complete).toMatchObject({ phase: 'complete', week: lengthWeeks, volumeFactor: 1, loadFactor: 1 });
    expect(complete.note).toMatch(/explicitly restart/);
    expect(getTrainingBlockPhase(block, localDate(2027, 1, 1)).phase).toBe('complete');
  });

  it('counts local calendar days at midnight, not elapsed 24-hour durations across DST', () => {
    const block = { ...settings, startDate: '2026-03-02' };
    expect(getTrainingBlockPhase(block, localDate(2026, 3, 8, 23)).week).toBe(1);
    expect(getTrainingBlockPhase(block, localDate(2026, 3, 9, 0)).week).toBe(2);
    const autumn = { ...block, startDate: '2026-10-26' };
    expect(getTrainingBlockPhase(autumn, localDate(2026, 11, 1, 23)).week).toBe(1);
    expect(getTrainingBlockPhase(autumn, localDate(2026, 11, 2, 0)).week).toBe(2);
  });

  it('starts on the whole local start date, including before noon', () => {
    expect(getTrainingBlockPhase(settings, localDate(2026, 3, 1, 0)).week).toBe(1);
    expect(getTrainingBlockPhase(settings, localDate(2026, 3, 21, 23)).phase).toBe('build');
    expect(getTrainingBlockPhase(settings, localDate(2026, 3, 22, 0)).phase).toBe('deload');
  });

  it('keeps future blocks at baseline until their start date', () => {
    expect(getTrainingBlockPhase(settings, localDate(2026, 2, 28))).toMatchObject({
      phase: 'not-started', week: 0, volumeFactor: 1, loadFactor: 1, repBonus: 0,
    });
  });

  it.each(['2026-99-00', '2026-02-29', '2026-04-31', '2026-00-01', '2026-13-01', '2026-01-00', '0000-01-01', '2026-1-01', '', 'bad'])('rejects invalid date %s', (startDate) => {
    expect(getTrainingBlockPhase({ ...settings, startDate }, deloadDate)).toMatchObject({ phase: 'off', volumeFactor: 1, loadFactor: 1 });
  });

  it('accepts a leap day and year boundaries', () => {
    expect(getTrainingBlockPhase({ ...settings, startDate: '2028-02-29' }, localDate(2028, 3, 7)).week).toBe(2);
    expect(getTrainingBlockPhase({ ...settings, startDate: '2026-12-28' }, localDate(2027, 1, 4)).week).toBe(2);
  });

  it('is off without enabled settings or a valid clock', () => {
    expect(getTrainingBlockPhase(undefined, deloadDate).phase).toBe('off');
    expect(getTrainingBlockPhase({ ...settings, enabled: false }, deloadDate).phase).toBe('off');
    expect(getTrainingBlockPhase(settings, new Date('bad')).phase).toBe('off');
  });

  it('provides multi-week history-led notes without forcing load or rep increases', () => {
    const block = { ...settings, lengthWeeks: 8 as const };
    for (let week = 2; week <= 7; week++) {
      const phase = getTrainingBlockPhase(block, localDate(2026, 3, 1 + (week - 1) * 7));
      expect(phase).toMatchObject({ week, phase: 'build', volumeFactor: 1, loadFactor: 1, repBonus: 0 });
      expect(phase.note).toMatch(/previous|logs/);
      expect(phase.note).toMatch(/only when/);
    }
  });

  it('makes the optional final week a build week without auto-repeating', () => {
    const block = { ...settings, deloadLastWeek: false };
    expect(getTrainingBlockPhase(block, deloadDate)).toMatchObject({ week: 4, phase: 'build', volumeFactor: 1, loadFactor: 1 });
    expect(getTrainingBlockPhase(block, localDate(2026, 3, 29)).phase).toBe('complete');
  });
});

describe('applyTrainingBlockToSession', () => {
  it('clones a new deload session, halves working sets rounded up and preserves warmups/reps/rest', () => {
    const session = newSession();
    const original = JSON.stringify(session);
    Object.freeze(session.items[0].planned);
    session.items[0].sets.forEach(Object.freeze);
    Object.freeze(session.items[0].sets);
    Object.freeze(session.items[0]);
    Object.freeze(session.items);
    Object.freeze(session);
    const result = applyTrainingBlockToSession(session, settings, deloadDate);
    expect(result).not.toBe(session);
    expect(result.items[0].planned).toMatchObject({ sets: 3, reps: '8–12', restSec: 90 });
    expect(result.items[0].planned?.reason).toMatch(/Usual targets\. Training block deload:/);
    expect(result.items[0].sets).toHaveLength(4);
    expect(result.items[0].sets[0].kind).toBe('warmup');
    expect(result.items[0].sets.every((set) => !set.done && set.reps === null && set.loadKg === null)).toBe(true);
    expect(JSON.stringify(session)).toBe(original);
    expect(applyTrainingBlockToSession(result, settings, deloadDate)).toBe(result);
  });

  it.each([1, 2, 3, 4, 6])('keeps at least one working set for %s usual sets', (count) => {
    const result = applyTrainingBlockToSession(newSession(count), settings, deloadDate);
    expect(result.items[0].planned?.sets).toBe(Math.max(1, Math.ceil(count / 2)));
    expect(result.items[0].sets.filter((set) => set.kind !== 'warmup')).toHaveLength(Math.max(1, Math.ceil(count / 2)));
  });

  it('supports unplanned exercises and legacy working rows without adding performance', () => {
    const session = newSession(4);
    delete session.items[0].planned;
    session.items[0].sets.forEach((set) => { if (set.kind === 'working') delete set.kind; });
    const result = applyTrainingBlockToSession(session, settings, deloadDate);
    expect(result.items[0].planned).toBeUndefined();
    expect(result.items[0].sets).toHaveLength(3);
  });

  it('does not invent rows when none exist', () => {
    const session = newSession();
    session.items[0].sets = [];
    expect(applyTrainingBlockToSession(session, settings, deloadDate).items[0].sets).toEqual([]);
  });

  it.each([undefined, { ...settings, enabled: false }, { ...settings, startDate: 'bad' }, { ...settings, deloadLastWeek: false }])('returns the original session when deload does not apply', (block) => {
    const session = newSession();
    expect(applyTrainingBlockToSession(session, block, deloadDate)).toBe(session);
  });

  it.each([localDate(2026, 2, 28), localDate(2026, 3, 1), localDate(2026, 3, 29)])('never changes future, build, or complete sessions', (now) => {
    const session = newSession();
    expect(applyTrainingBlockToSession(session, settings, now)).toBe(session);
  });

  it.each([{ done: true }, { reps: 0 }, { loadKg: 0 }, { effort: 1 as const }])('refuses any real performance, including zero-valued entries', (performance) => {
    const session = newSession();
    session.items[0].sets[0] = { ...session.items[0].sets[0], ...performance };
    const before = JSON.stringify(session);
    expect(applyTrainingBlockToSession(session, settings, deloadDate)).toBe(session);
    expect(JSON.stringify(session)).toBe(before);
  });

  it.each([{ state: 'done' as const }, { endedAt: 0 }, { pausedAt: 0 }, { pausedMs: 1 }])('preserves completed or resumed sessions without rewriting history', (existing) => {
    const session = { ...newSession(), ...existing };
    expect(applyTrainingBlockToSession(session, settings, deloadDate)).toBe(session);
  });

  it('refuses sessions containing skipped exercises or discomfort', () => {
    for (const flag of ['skipped', 'discomfort'] as const) {
      const session = newSession();
      session.items[0][flag] = true;
      expect(applyTrainingBlockToSession(session, settings, deloadDate)).toBe(session);
    }
  });
});
