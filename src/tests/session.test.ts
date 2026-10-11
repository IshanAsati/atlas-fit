import { describe, expect, it } from 'vitest';
import { buildSession, buildEmptySession, doneSets, formatElapsed } from '../features/workout/session';
import type { Plan, PlanDay } from '../data/types';

const day: PlanDay = {
  id: 'day-1',
  label: 'Full body A',
  focus: 'Whole-body strength',
  movementTargets: ['squat', 'hpush'],
  exercises: [
    { exerciseId: 'bodyweight-squat', sets: 3, reps: '8–10', restSec: 90, reason: 'fits home gear' },
    { exerciseId: 'push-up', sets: 2, reps: '8', restSec: 60, reason: 'fresh' },
  ],
};

const plan: Plan = {
  id: 'plan-1',
  createdAt: 1000,
  location: 'home',
  split: 'Full-body',
  goal: 'fitness',
  experience: 'new',
  days: [day],
  explanation: ['3-day full-body split'],
};

describe('session building', () => {
  it('creates planned empty sets', () => {
    const s = buildSession(plan, day, 'fixed');
    expect(s.id).toBe('fixed');
    expect(s.state).toBe('active');
    expect(s.items[0].sets).toHaveLength(3);
    expect(s.items[1].sets).toHaveLength(2);
    expect(s.items.every((i) => i.sets.every((set) => !set.done))).toBe(true);
  });

  it('counts only completed sets', () => {
    const s = buildSession(plan, day, 'fixed');
    expect(doneSets(s)).toEqual({ done: 0, total: 5 });
    s.items[0].sets[0].done = true;
    s.items[0].sets[1].done = true;
    expect(doneSets(s)).toEqual({ done: 2, total: 5 });
  });

  it('skipped exercises drop out of progress totals', () => {
    const s = buildSession(plan, day, 'fixed');
    s.items[1].skipped = true;
    expect(doneSets(s)).toEqual({ done: 0, total: 3 });
  });

  it('empty session starts active with no invented items', () => {
    const s = buildEmptySession('Quick session');
    expect(s.items).toHaveLength(0);
    expect(s.state).toBe('active');
  });
});

describe('elapsed formatting', () => {
  it('formats as m:ss', () => {
    expect(formatElapsed(0)).toBe('0:00');
    expect(formatElapsed(65_000)).toBe('1:05');
    expect(formatElapsed(600_000)).toBe('10:00');
  });
});
