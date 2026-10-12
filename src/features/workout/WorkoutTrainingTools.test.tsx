// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { CATALOG_BY_ID } from '../../data/catalog';
import type { SessionItem, WorkoutSession } from '../../data/types';
import { WorkoutTrainingTools, applySuggestedTarget, prependWarmups } from './WorkoutTrainingTools';

afterEach(cleanup);
const item: SessionItem = { exerciseId: 'db-row', planned: { exerciseId: 'db-row', sets: 2, reps: '8–12', restSec: 90, reason: '' },
  sets: [{ loadKg: null, reps: null, done: false }, { loadKg: null, reps: null, done: false }] };
const history: WorkoutSession[] = [{ id: 'previous', title: 'Previous', location: 'home', state: 'done', startedAt: 1,
  items: [{ ...item, sets: [{ loadKg: 20, reps: 10, done: true, effort: 2 }, { loadKg: 20, reps: 10, done: true, effort: 2 }] }] }];

describe('Workout training tool integration', () => {
  it('fills only empty unmarked working targets without touching user input', () => {
    const source: SessionItem = { ...item, sets: [
      { loadKg: 10, reps: 5, done: true },
      { loadKg: 17, reps: null, done: false },
      { loadKg: null, reps: null, done: false },
      { loadKg: null, reps: null, done: false, kind: 'warmup' },
    ] };
    const next = applySuggestedTarget(source, { loadKg: 20, reps: 11, action: 'reps', reason: '' });
    expect(next.sets[0]).toBe(source.sets[0]);
    expect(next.sets[1]).toBe(source.sets[1]);
    expect(next.sets[2]).toEqual({ loadKg: 20, reps: 11, done: false });
    expect(next.sets[3]).toBe(source.sets[3]);
    expect(source.sets[2].loadKg).toBeNull();
  });
  it('never inserts warmups after completed sets or duplicates existing warmups', () => {
    const warmups = [{ loadKg: 10, reps: 8, done: false, kind: 'warmup' as const }];
    const next = prependWarmups(item, warmups);
    expect(next.sets[0]).toEqual(warmups[0]);
    expect(prependWarmups(next, warmups)).toBe(next);
    const started = { ...item, sets: [{ loadKg: 20, reps: 8, done: true }] };
    expect(prependWarmups(started, warmups)).toBe(started);
  });
  it('provides explicit actions without silently recording suggestions', () => {
    const onUse = vi.fn(), onWarmups = vi.fn();
    render(<WorkoutTrainingTools exercise={CATALOG_BY_ID['db-row']} item={item} history={history} unit="kg" onUseSuggestion={onUse} onAddWarmups={onWarmups} />);
    expect(onUse).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Use suggested target' }));
    expect(onUse).toHaveBeenCalledWith(expect.objectContaining({ loadKg: 20, reps: 11 }));
    fireEvent.click(screen.getByRole('button', { name: 'Add warm-up sets' }));
    expect(onWarmups.mock.calls[0][0]).toHaveLength(3);
    expect(onWarmups.mock.calls[0][0].every((set: { done: boolean; kind: string }) => !set.done && set.kind === 'warmup')).toBe(true);
  });
  it('does not use reduced deload loads as the next build baseline', () => {
    const onUse = vi.fn();
    const deload: WorkoutSession = { ...history[0], id: 'deload', startedAt: 2,
      blockContext: { week: 4, lengthWeeks: 4, phase: 'deload', loadFactor: .85 },
      items: [{ ...item, sets: [{ loadKg: 10, reps: 10, done: true, effort: 2 }] }] };
    render(<WorkoutTrainingTools exercise={CATALOG_BY_ID['db-row']} item={item} history={[...history, deload]} unit="kg" onUseSuggestion={onUse} onAddWarmups={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Use suggested target' }));
    expect(onUse).toHaveBeenCalledWith(expect.objectContaining({ loadKg: 20 }));
  });
});
