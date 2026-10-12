import type { Movement } from './types';

/** User-facing movement names; internal ids stay stable for plans and backups. */
export const MOVEMENT_LABELS: Record<Movement, string> = {
  squat: 'Squat',
  hinge: 'Hip hinge',
  hpush: 'Horizontal push',
  vpush: 'Overhead push',
  hpull: 'Row',
  vpull: 'Vertical pull',
  core: 'Core',
  carry: 'Carry',
  accessory: 'Accessory',
  mobility: 'Mobility',
};
