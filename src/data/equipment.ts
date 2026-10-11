import type { LocationType } from './types';

/** Equipment taxonomy (§6.4). Every exercise references exact equipment ids;
 *  a generic "machine" flag is never enough for planning. */

export interface Equipment {
  id: string;
  label: string;
  category: string;
}

export const EQUIPMENT: Equipment[] = [
  // Home base
  { id: 'bodyweight', label: 'Bodyweight', category: 'Home' },
  { id: 'mat', label: 'Yoga / exercise mat', category: 'Home' },
  { id: 'chair', label: 'Sturdy chair / step', category: 'Home' },
  { id: 'bench', label: 'Flat bench', category: 'Home · Gym' },
  { id: 'dumbbells', label: 'Dumbbells', category: 'Home · Gym' },
  { id: 'adj-dumbbells', label: 'Adjustable dumbbells', category: 'Home' },
  { id: 'bands', label: 'Resistance bands / tubes', category: 'Home · Travel' },
  { id: 'kettlebell', label: 'Kettlebell', category: 'Home' },
  { id: 'pullup-bar', label: 'Pull-up bar', category: 'Home · Gym' },
  { id: 'ab-wheel', label: 'Ab wheel', category: 'Home' },
  { id: 'suspension', label: 'Suspension trainer', category: 'Home · Travel' },
  // Gym free weights
  { id: 'barbell', label: 'Barbell + plates', category: 'Gym · Free weights' },
  { id: 'squat-rack', label: 'Squat rack', category: 'Gym · Free weights' },
  { id: 'ez-bar', label: 'EZ / curl bar', category: 'Gym · Free weights' },
  { id: 'smith-machine', label: 'Smith machine', category: 'Gym · Free weights' },
  { id: 'hack-squat', label: 'Hack squat machine', category: 'Gym · Lower' },
  { id: 'stability-ball', label: 'Stability ball', category: 'Home' },
  { id: 'preacher', label: 'Preacher bench', category: 'Gym · Free weights' },
  // Gym cables
  { id: 'cable', label: 'Cable station', category: 'Gym · Cables' },
  { id: 'lat-pulldown', label: 'Lat pulldown', category: 'Gym · Cables' },
  { id: 'seated-row', label: 'Seated cable row', category: 'Gym · Cables' },
  // Gym push machines
  { id: 'chest-press', label: 'Chest press machine', category: 'Gym · Push' },
  { id: 'shoulder-press', label: 'Shoulder press machine', category: 'Gym · Push' },
  { id: 'pec-deck', label: 'Pec deck / fly machine', category: 'Gym · Push' },
  { id: 'dip-station', label: 'Dip station', category: 'Gym · Push' },
  // Gym lower machines
  { id: 'leg-press', label: 'Leg press', category: 'Gym · Lower' },
  { id: 'leg-extension', label: 'Leg extension', category: 'Gym · Lower' },
  { id: 'leg-curl', label: 'Seated / lying leg curl', category: 'Gym · Lower' },
  { id: 'calf-raise', label: 'Calf raise machine', category: 'Gym · Lower' },
  { id: 'hip-thrust', label: 'Hip thrust / glute machine', category: 'Gym · Lower' },
  { id: 'adductor', label: 'Adductor / abductor machine', category: 'Gym · Lower' },
  // Gym other
  { id: 'assisted-pullup', label: 'Assisted pull-up machine', category: 'Gym · Other' },
  { id: 'back-extension', label: 'Back extension bench', category: 'Gym · Other' },
  { id: 'tbar-row', label: 'T-bar row', category: 'Gym · Other' },
  // Cardio
  { id: 'treadmill', label: 'Treadmill', category: 'Cardio' },
  { id: 'rower', label: 'Rower', category: 'Cardio' },
  { id: 'cycle', label: 'Exercise cycle', category: 'Cardio' },
];

export const EQUIPMENT_BY_ID: Record<string, Equipment> = Object.fromEntries(
  EQUIPMENT.map((e) => [e.id, e]),
);

/** Sensible editable defaults — never assume a gym has every machine. */
export const DEFAULT_EQUIPMENT: Record<LocationType, string[]> = {
  home: ['bodyweight', 'mat', 'chair', 'dumbbells', 'bands'],
  gym: [
    'bench',
    'dumbbells',
    'barbell',
    'squat-rack',
    'pullup-bar',
    'cable',
    'lat-pulldown',
    'seated-row',
    'chest-press',
    'leg-press',
    'leg-extension',
    'leg-curl',
  ],
  travel: ['bodyweight', 'bands'],
};

export function equipmentLabel(id: string): string {
  return EQUIPMENT_BY_ID[id]?.label ?? id;
}
