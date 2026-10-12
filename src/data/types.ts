/* Core domain types for Atlas Fit (§9 of spec).
   Note: no enums (erasableSyntaxOnly) — string unions only. */

export type Goal = 'strength' | 'fitness' | 'technique' | 'endurance' | 'mobility';

export type Experience = 'new' | 'some' | 'experienced';

export type LocationType = 'home' | 'gym' | 'travel';

/** Movement-pattern family. `accessory` covers single-joint isolation work
 *  (curls, extensions, raises) that the six classic patterns don't describe. */
export type Movement =
  | 'squat'
  | 'hinge'
  | 'hpush'
  | 'vpush'
  | 'hpull'
  | 'vpull'
  | 'core'
  | 'carry'
  | 'accessory'
  | 'mobility';

/** Canonical internal muscle IDs (§8.1). Stable — used by artwork, mapping and logs. */
export type MuscleId =
  | 'chest'
  | 'front_delts'
  | 'side_delts'
  | 'rear_delts'
  | 'biceps'
  | 'triceps'
  | 'forearms'
  | 'traps'
  | 'lats'
  | 'upper_back'
  | 'erectors'
  | 'abs'
  | 'obliques'
  | 'glutes'
  | 'quads'
  | 'hamstrings'
  | 'calves';

export interface Exercise {
  id: string;
  name: string;
  aliases: string[];
  /** 'atlas' = curated built-in entry; 'repdb' = imported RepDB Free entry. */
  source: 'atlas' | 'repdb';
  equipmentIds: string[];
  movement: Movement;
  /** 1 = beginner-friendly, 2 = some experience, 3 = experienced. */
  difficulty: 1 | 2 | 3;
  primary: MuscleId[];
  secondary: MuscleId[];
  instructions: string[];
  cues: string[];
  mistakes: string[];
  substitutes: string[];
}

export interface UserProfile {
  displayName: string;
  goal: Goal;
  experience: Experience;
  activeLocation: LocationType;
  equipment: Record<LocationType, string[]>;
  daysPerWeek: number;
  durationMin: 30 | 45 | 60;
  weekdays: string[];
  /** Exercise ids the user avoids (discomfort / professional advice). */
  restrictions: string[];
  discomfortNotes: string;
  otherSports: string;
  liked: string[];
  disliked: string[];
  pinned: string[];
  favourites: string[];
  onboarded: boolean;
}

export interface PlannedExercise {
  exerciseId: string;
  sets: number;
  reps: string;
  restSec: number;
  /** Plain-English reason, shown under "Why this plan?". */
  reason: string;
}

export interface PlanDay {
  id: string;
  label: string;
  focus: string;
  movementTargets: Movement[];
  exercises: PlannedExercise[];
}

export interface Plan {
  id: string;
  createdAt: number;
  location: LocationType;
  split: string;
  goal: Goal;
  experience: Experience;
  days: PlanDay[];
  explanation: string[];
}

export interface PerformedSet {
  reps: number | null;
  loadKg: number | null;
  done: boolean;
  /** 1 easy · 2 right · 3 hard */
  effort?: 1 | 2 | 3;
}

export interface SessionItem {
  exerciseId: string;
  planned?: PlannedExercise;
  sets: PerformedSet[];
  skipped?: boolean;
}

export interface WorkoutSession {
  id: string;
  title: string;
  planId?: string;
  dayId?: string;
  location: LocationType;
  startedAt: number;
  endedAt?: number;
  state: 'active' | 'done';
  items: SessionItem[];
}

export interface ExerciseFeedback {
  exerciseId: string;
  liked?: boolean;
  discomfort?: boolean;
  updatedAt: number;
}

export interface BackupDoc {
  schema: 1;
  exportedAt: number;
  profile: UserProfile | null;
  plans: Plan[];
  sessions: WorkoutSession[];
  feedback: ExerciseFeedback[];
}
