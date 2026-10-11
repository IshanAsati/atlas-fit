import type { MuscleId } from './types';

/** Canonical muscle metadata: stable IDs, display names, bodygraph view. */
export interface MuscleMeta {
  id: MuscleId;
  name: string;
  short: string;
  /** Which bodygraph view(s) render this muscle. */
  views: Array<'front' | 'back'>;
  blurb: string;
}

export const MUSCLES: MuscleMeta[] = [
  { id: 'chest', name: 'Chest (pectorals)', short: 'Chest', views: ['front'], blurb: 'Pushing muscles of the torso.' },
  { id: 'front_delts', name: 'Front deltoids', short: 'Front delts', views: ['front'], blurb: 'Front of the shoulder; raises the arm forward.' },
  { id: 'side_delts', name: 'Side deltoids', short: 'Side delts', views: ['front', 'back'], blurb: 'Side of the shoulder; lifts the arm out to the side.' },
  { id: 'rear_delts', name: 'Rear deltoids', short: 'Rear delts', views: ['back'], blurb: 'Back of the shoulder; pulls the arm back.' },
  { id: 'biceps', name: 'Biceps', short: 'Biceps', views: ['front'], blurb: 'Front of the upper arm; bends the elbow.' },
  { id: 'triceps', name: 'Triceps', short: 'Triceps', views: ['back'], blurb: 'Back of the upper arm; straightens the elbow.' },
  { id: 'forearms', name: 'Forearms', short: 'Forearms', views: ['front', 'back'], blurb: 'Grip and wrist muscles.' },
  { id: 'traps', name: 'Trapezius', short: 'Traps', views: ['back'], blurb: 'Upper back and neck; shrugs and stabilises the shoulder blade.' },
  { id: 'lats', name: 'Latissimus dorsi', short: 'Lats', views: ['back'], blurb: 'Broad back muscles; pull the arm down and back.' },
  { id: 'upper_back', name: 'Upper back (rhomboids)', short: 'Upper back', views: ['back'], blurb: 'Between the shoulder blades; rowing muscles.' },
  { id: 'erectors', name: 'Spinal erectors (lower back)', short: 'Lower back', views: ['back'], blurb: 'Muscles along the spine; keep the torso upright.' },
  { id: 'abs', name: 'Rectus abdominis', short: 'Abs', views: ['front'], blurb: 'Front of the trunk; braces the torso.' },
  { id: 'obliques', name: 'Obliques', short: 'Obliques', views: ['front'], blurb: 'Sides of the trunk; rotate and stabilise.' },
  { id: 'glutes', name: 'Gluteals', short: 'Glutes', views: ['back'], blurb: 'Hip muscles; drive standing, bridging and hip extension.' },
  { id: 'quads', name: 'Quadriceps', short: 'Quads', views: ['front'], blurb: 'Front of the thigh; straighten the knee.' },
  { id: 'hamstrings', name: 'Hamstrings', short: 'Hamstrings', views: ['back'], blurb: 'Back of the thigh; hinge and bend the knee.' },
  { id: 'calves', name: 'Calves', short: 'Calves', views: ['front', 'back'], blurb: 'Lower leg; push through the foot.' },
];

export const MUSCLE_BY_ID: Record<MuscleId, MuscleMeta> = Object.fromEntries(
  MUSCLES.map((m) => [m.id, m]),
) as Record<MuscleId, MuscleMeta>;

export const FRONT_MUSCLES: MuscleId[] = MUSCLES.filter((m) =>
  m.views.includes('front'),
).map((m) => m.id);

export const BACK_MUSCLES: MuscleId[] = MUSCLES.filter((m) =>
  m.views.includes('back'),
).map((m) => m.id);
