import { describe, expect, it } from 'vitest';
import { calculatePlates } from './plateCalculator';

describe('calculatePlates', () => {
  it('loads equal pairs using the fewest plates for a canonical kg target', () => {
    expect(calculatePlates(100, 20, [25, 20, 15, 10, 5, 2.5, 1.25, 0.5])).toEqual({
      perSide: [{ weight: 25, count: 1 }, { weight: 15, count: 1 }],
      achievedTotal: 100, remaining: 0, exact: true,
    });
  });

  it('uses pounds as display weights without converting them to kilograms', () => {
    expect(calculatePlates(225, 45, [45, 35, 25, 10, 5, 2.5], 'lb')).toEqual({
      perSide: [{ weight: 45, count: 2 }], achievedTotal: 225, remaining: 0, exact: true,
    });
  });

  it('finds an exact non-greedy combination with the fewest plates', () => {
    expect(calculatePlates(32, 20, [4, 3, 1]).perSide).toEqual([{ weight: 3, count: 2 }]);
  });

  it('prefers the largest lower total over a lighter load with fewer plates', () => {
    expect(calculatePlates(35, 20, [5, 3, 2])).toEqual({
      perSide: [{ weight: 5, count: 1 }, { weight: 2, count: 1 }],
      achievedTotal: 34, remaining: 1, exact: false,
    });
  });

  it('supports fractional plates and floating-point target tolerance', () => {
    expect(calculatePlates(20.75, 20, [0.125]).perSide).toEqual([{ weight: 0.125, count: 3 }]);
    expect(calculatePlates(0.1 + 0.2, 0.1, [0.1]).exact).toBe(true);
  });

  it('does not round a target up to an unavailable pair', () => {
    const result = calculatePlates(22.499, 20, [1.25]);
    expect(result).toMatchObject({ perSide: [], achievedTotal: 20, exact: false });
    expect(result.remaining).toBeCloseTo(2.499, 8);
  });

  it('returns the bar alone when there are no available sizes', () => {
    expect(calculatePlates(20, 20, [])).toEqual({ perSide: [], achievedTotal: 20, remaining: 0, exact: true });
    expect(calculatePlates(30, 20, []).remaining).toBe(10);
  });

  it('allows a zero-weight bar and ignores duplicate or oversized sizes', () => {
    expect(calculatePlates(10, 0, [5, 5, 25])).toEqual({
      perSide: [{ weight: 5, count: 1 }], achievedTotal: 10, remaining: 0, exact: true,
    });
  });

  it('rejects a target below the bar instead of suggesting an overshoot', () => {
    expect(calculatePlates(15, 20, [5]).error).toContain('at least the bar weight');
  });

  it.each<[number, number, number[]]>([
    [NaN, 20, [5]], [Infinity, 20, [5]], [0, 0, []], [-1, 20, [5]],
    [20, -1, [5]], [20, NaN, [5]], [20, Infinity, [5]],
    [30, 20, [-5]], [30, 20, [0]], [30, 20, [NaN]], [30, 20, [Infinity]],
    [30, 20, [0.0001]], [30, 20, [1.2345]], [10_001, 20, [5]],
    [30, 20, [10_001]], [30, 20, Array.from({ length: 33 }, (_, index) => index + 1)],
  ])('rejects invalid or excessive inputs safely (%s, %s, %s)', (target, bar, plates) => {
    const result = calculatePlates(target, bar, plates);
    expect(result.error).toBeTruthy();
    expect(Number.isFinite(result.achievedTotal)).toBe(true);
    expect(Number.isFinite(result.remaining)).toBe(true);
  });

  it('bounds unusually precise searches with a labelled non-overshooting estimate', () => {
    const result = calculatePlates(10_000, 20, [3.001, 0.001]);
    expect(result.approximate).toBe(true);
    expect(result.achievedTotal).toBeCloseTo(10_000, 8);
    expect(result.achievedTotal).toBeLessThanOrEqual(10_000);
  });
  it('does not claim the greedy fallback is the closest possible lower load', () => {
    const result = calculatePlates(1000, 0, [300.001, 250, 0.003]);
    expect(result.approximate).toBe(true);
    expect(result.exact).toBe(false);
    expect(result.achievedTotal).toBeCloseTo(999.998, 8);
    expect(result.remaining).toBeCloseTo(0.002, 8);
  });
});
