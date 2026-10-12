import type { WeightUnit } from './workoutHelpers';

export interface PlateCalculationResult {
  perSide: Array<{ weight: number; count: number }>;
  achievedTotal: number;
  remaining: number;
  exact: boolean;
  error?: string;
  /** Large searches use a lower-load estimate, not a guaranteed optimum. */
  approximate?: boolean;
}

export const DEFAULT_PLATES: Record<WeightUnit, number[]> = {
  kg: [25, 20, 15, 10, 5, 2.5, 1.25, 0.5],
  lb: [45, 35, 25, 10, 5, 2.5],
};
export const DEFAULT_BAR_WEIGHT: Record<WeightUnit, number> = { kg: 20, lb: 45 };

const SCALE = 1000;
const MAX_WEIGHT = 10_000;
const MAX_SIZES = 32;
const MAX_SEARCH = 200_000;
const TOLERANCE = 1e-8;

function gcd(a: number, b: number): number {
  while (b) [a, b] = [b, a % b];
  return a;
}

/**
 * All inputs/outputs are in the supplied display unit; sizes represent unlimited
 * matched pairs. Supports up to 32 sizes, each 0.001–10,000 with at most three
 * decimal places, and total/bar weights up to 10,000. The bounded integer search
 * maximizes load without overshooting, then minimizes plate count per side.
 * Above 200,000 search states, returns a labelled greedy estimate instead.
 */
export function calculatePlates(
  target: number, barWeight: number, availablePlates: number[], unit: WeightUnit = 'kg',
): PlateCalculationResult {
  const invalid = (error: string): PlateCalculationResult => ({
    perSide: [], achievedTotal: 0, remaining: 0, exact: false, error,
  });
  if (!Number.isFinite(target) || target <= 0 || target > MAX_WEIGHT) {
    return invalid(`Enter a target greater than 0 and no more than ${MAX_WEIGHT.toLocaleString('en-US')} ${unit}.`);
  }
  if (!Number.isFinite(barWeight) || barWeight < 0 || barWeight > MAX_WEIGHT) {
    return invalid(`Enter a bar weight from 0 to ${MAX_WEIGHT.toLocaleString('en-US')} ${unit}.`);
  }
  if (target < barWeight - TOLERANCE) return invalid('Target must be at least the bar weight. Lower the bar weight or raise the target.');
  if (availablePlates.length > MAX_SIZES) return invalid(`Choose no more than ${MAX_SIZES} plate sizes.`);
  if (availablePlates.some((weight) => !Number.isFinite(weight) || weight < 0.001 || weight > MAX_WEIGHT
    || Math.abs(weight * SCALE - Math.round(weight * SCALE)) > TOLERANCE * SCALE)) {
    return invalid(`Plate sizes must be 0.001–${MAX_WEIGHT.toLocaleString('en-US')} ${unit}, with at most three decimal places.`);
  }

  const sizes = [...new Set(availablePlates.map((weight) => Math.round(weight * SCALE)))].sort((a, b) => b - a);
  const capacity = Math.max(0, Math.floor((target - barWeight + TOLERANCE) * SCALE / 2));
  const usable = sizes.filter((weight) => weight <= capacity);
  const counts = new Map<number, number>();
  let approximate = false;
  if (usable.length) {
    const divisor = usable.reduce(gcd);
    const limit = Math.floor(capacity / divisor);
    if (limit > MAX_SEARCH) {
      approximate = true;
      let left = capacity;
      for (const weight of usable) {
        const count = Math.floor(left / weight);
        if (count) counts.set(weight, count);
        left -= count * weight;
      }
    } else {
      const steps = usable.map((weight) => weight / divisor);
      const fewest = new Int32Array(limit + 1).fill(MAX_SEARCH + 1);
      const chosen = new Int16Array(limit + 1).fill(-1);
      fewest[0] = 0;
      for (let load = 1; load <= limit; load++) {
        for (let index = 0; index < steps.length; index++) {
          const previous = load - steps[index];
          if (previous >= 0 && fewest[previous] + 1 < fewest[load]) {
            fewest[load] = fewest[previous] + 1;
            chosen[load] = index;
          }
        }
      }
      let load = limit;
      while (load > 0 && chosen[load] === -1) load--;
      while (load > 0) {
        const index = chosen[load];
        const weight = usable[index];
        counts.set(weight, (counts.get(weight) ?? 0) + 1);
        load -= steps[index];
      }
    }
  }
  const perSide = usable.filter((weight) => counts.has(weight)).map((weight) => ({
    weight: weight / SCALE, count: counts.get(weight)!,
  }));
  const platesTotal = [...counts].reduce((sum, [weight, count]) => sum + weight * count * 2, 0) / SCALE;
  const achievedTotal = barWeight + platesTotal;
  const difference = target - achievedTotal;
  return {
    perSide, achievedTotal, remaining: difference <= TOLERANCE ? 0 : difference,
    exact: Math.abs(difference) <= TOLERANCE, ...(approximate ? { approximate: true } : {}),
  };
}
