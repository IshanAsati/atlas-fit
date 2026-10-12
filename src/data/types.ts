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
  /** Display only; stored loads always remain kilograms. */
  weightUnit?: 'kg' | 'lb';
  /** Muscles to emphasise without excluding the rest of the body. */
  targetMuscles?: MuscleId[];
  /** Equipment the user would rather not touch, even when it is available
   *  (e.g. barbells, Smith machine). A hard constraint, including for pins. */
  avoidEquipment?: string[];
  trainingBlock?: TrainingBlockSettings;
  reminders?: WorkoutReminderSettings;
  nutrition?: NutritionPreferences;
}

export interface NutritionPreferences {
  diet: 'vegetarian' | 'eggetarian' | 'non-vegetarian';
  age: number;
  equationSex: 'female' | 'male';
  weightKg: number;
  heightCm: number;
  activity: 'sedentary' | 'light' | 'moderate' | 'high';
  goal: 'maintain' | 'lose' | 'gain';
  foodExclusions: string[];
  /** Stable offline meal-plan seed; changing it is an explicit regenerate action. */
  planSeed?: string;
}

export interface TrainingBlockSettings {
  enabled: boolean;
  lengthWeeks: 4 | 6 | 8;
  /** Local calendar date, YYYY-MM-DD. */
  startDate: string;
  deloadLastWeek: boolean;
}

export interface WorkoutReminderSettings {
  enabled: boolean;
  /** Local clock time, HH:mm, using the profile's preferred weekdays. */
  time: string;
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
  kind?: 'warmup' | 'working';
}

export interface SessionItem {
  exerciseId: string;
  planned?: PlannedExercise;
  sets: PerformedSet[];
  skipped?: boolean;
  discomfort?: boolean;
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
  pausedAt?: number;
  pausedMs?: number;
  /** Immutable block phase at session start; never re-applied on resume. */
  blockContext?: {
    week: number;
    lengthWeeks: 4 | 6 | 8;
    phase: 'build' | 'deload';
    loadFactor: number;
  };
}

export interface Routine {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  location: LocationType;
  exercises: PlannedExercise[];
}

export interface ExerciseFeedback {
  exerciseId: string;
  liked?: boolean;
  discomfort?: boolean;
  updatedAt: number;
}

/** Cardio is logged separately and never counted as strength working sets. */
export interface CardioSession {
  id: string;
  activity: 'walk' | 'run' | 'cycle' | 'row' | 'swim' | 'other';
  durationMin: number;
  distanceKm?: number;
  intensity: 'easy' | 'moderate' | 'hard';
  completedAt: number;
  notes?: string;
}

export interface BackupDoc {
  schema: 1;
  exportedAt: number;
  profile: UserProfile | null;
  plans: Plan[];
  sessions: WorkoutSession[];
  feedback: ExerciseFeedback[];
  routines?: Routine[];
  activeWorkout?: WorkoutSession | null;
  cardio?: CardioSession[];
}
