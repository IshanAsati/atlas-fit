import type { Experience, Movement } from '../../data/types';

export interface SplitDayDef {
  id: string;
  label: string;
  focus: string;
  movementTargets: Movement[];
}

export interface SplitDef {
  id: string;
  name: string;
  days: SplitDayDef[];
}

export const FULL_BODY_2_DAY: SplitDef = {
  id: 'full-body-2',
  name: 'Full Body (2-Day)',
  days: [
    {
      id: 'day-1',
      label: 'Full Body A',
      focus: 'Full Body',
      movementTargets: ['squat', 'hpush', 'hpull', 'hinge', 'core', 'accessory'],
    },
    {
      id: 'day-2',
      label: 'Full Body B',
      focus: 'Full Body',
      movementTargets: ['hinge', 'vpush', 'vpull', 'squat', 'core', 'accessory'],
    },
  ],
};

export const FULL_BODY_3_DAY: SplitDef = {
  id: 'full-body-3',
  name: 'Full Body (3-Day)',
  days: [
    {
      id: 'day-1',
      label: 'Full Body A',
      focus: 'Full Body',
      movementTargets: ['squat', 'hpush', 'hpull', 'hinge', 'core', 'accessory'],
    },
    {
      id: 'day-2',
      label: 'Full Body B',
      focus: 'Full Body',
      movementTargets: ['hinge', 'vpush', 'vpull', 'squat', 'core', 'accessory'],
    },
    {
      id: 'day-3',
      label: 'Full Body C',
      focus: 'Full Body',
      movementTargets: ['squat', 'hpush', 'vpull', 'carry', 'accessory', 'core'],
    },
  ],
};

export const PPL_3_DAY: SplitDef = {
  id: 'ppl-3',
  name: 'Push, Pull, Legs (3-Day)',
  days: [
    {
      id: 'day-1',
      label: 'Push',
      focus: 'Push',
      movementTargets: ['hpush', 'vpush', 'hpush', 'accessory', 'core', 'accessory'],
    },
    {
      id: 'day-2',
      label: 'Pull',
      focus: 'Pull',
      movementTargets: ['hpull', 'vpull', 'hpull', 'hinge', 'accessory', 'core'],
    },
    {
      id: 'day-3',
      label: 'Legs',
      focus: 'Legs',
      movementTargets: ['squat', 'hinge', 'squat', 'accessory', 'core', 'accessory'],
    },
  ],
};

export const UPPER_LOWER_4_DAY: SplitDef = {
  id: 'upper-lower-4',
  name: 'Upper / Lower (4-Day)',
  days: [
    {
      id: 'day-1',
      label: 'Upper A',
      focus: 'Upper Body',
      movementTargets: ['hpush', 'hpull', 'vpush', 'accessory', 'core', 'accessory'],
    },
    {
      id: 'day-2',
      label: 'Lower A',
      focus: 'Lower Body',
      movementTargets: ['squat', 'hinge', 'accessory', 'core', 'carry', 'accessory'],
    },
    {
      id: 'day-3',
      label: 'Upper B',
      focus: 'Upper Body',
      movementTargets: ['vpush', 'vpull', 'hpush', 'accessory', 'core', 'accessory'],
    },
    {
      id: 'day-4',
      label: 'Lower B',
      focus: 'Lower Body',
      movementTargets: ['hinge', 'squat', 'carry', 'core', 'accessory', 'squat'],
    },
  ],
};

export const FIVE_DAY_SPLIT: SplitDef = {
  id: 'five-day-split',
  name: 'Push, Pull, Legs, Upper, Lower (5-Day)',
  days: [
    {
      id: 'day-1',
      label: 'Push',
      focus: 'Push',
      movementTargets: ['hpush', 'vpush', 'hpush', 'accessory', 'core', 'accessory'],
    },
    {
      id: 'day-2',
      label: 'Pull',
      focus: 'Pull',
      movementTargets: ['hpull', 'vpull', 'hpull', 'accessory', 'core', 'hinge'],
    },
    {
      id: 'day-3',
      label: 'Legs',
      focus: 'Legs',
      movementTargets: ['squat', 'hinge', 'squat', 'accessory', 'core', 'accessory'],
    },
    {
      id: 'day-4',
      label: 'Upper',
      focus: 'Upper Body',
      movementTargets: ['hpush', 'hpull', 'vpush', 'vpull', 'accessory', 'core'],
    },
    {
      id: 'day-5',
      label: 'Lower',
      focus: 'Lower Body',
      movementTargets: ['squat', 'hinge', 'carry', 'core', 'accessory', 'squat'],
    },
  ],
};

/**
 * Determine training split based on available days per week and user experience level (§7.2).
 * - <= 2 days: Full Body A, Full Body B
 * - 3 days: Full Body A, Full Body B, Full Body C (or Push, Pull, Legs for experienced)
 * - 4 days: Upper A, Lower A, Upper B, Lower B
 * - >= 5 days: Push, Pull, Legs, Upper, Lower
 */
export function determineSplit(daysPerWeek: number, experience?: Experience): SplitDef {
  if (daysPerWeek <= 2) {
    return FULL_BODY_2_DAY;
  }
  if (daysPerWeek === 3) {
    if (experience === 'experienced') {
      return PPL_3_DAY;
    }
    return FULL_BODY_3_DAY;
  }
  if (daysPerWeek === 4) {
    return UPPER_LOWER_4_DAY;
  }
  return FIVE_DAY_SPLIT;
}

export const getSplit = determineSplit;
