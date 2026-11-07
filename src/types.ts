// Core domain types. All weights are pounds, all lengths inches.

export type Goal =
  | 'muscle'
  | 'fatLoss'
  | 'strength'
  | 'athletic'
  | 'endurance'
  | 'general'
  | 'physique'
  | 'maintain';

export type Experience = 'beginner' | 'intermediate' | 'advanced';
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = Sunday
export type Location = 'commercial' | 'home' | 'limited' | 'multiple';
export type Equipment =
  | 'barbell'
  | 'rack'
  | 'bench'
  | 'dumbbell'
  | 'cable'
  | 'machine'
  | 'smith'
  | 'pullupBar'
  | 'dipStation'
  | 'kettlebell'
  | 'band'
  | 'bodyweight';
export type StylePref = 'freeWeights' | 'machines' | 'cables' | 'bodyweight' | 'mixed';
export type SplitPref = 'auto' | 'fullBody' | 'upperLower' | 'ppl' | 'bro' | 'hybrid';
export type Limitation = 'shoulder' | 'lowBack' | 'knee' | 'elbow' | 'wrist' | 'hip' | 'neck';
export type Muscle =
  | 'chest'
  | 'back'
  | 'shoulders'
  | 'biceps'
  | 'triceps'
  | 'quads'
  | 'hamstrings'
  | 'glutes'
  | 'calves'
  | 'abs';

export interface Profile {
  id: 'me';
  createdAt: string;
  updatedAt: string;
  // Personal
  name?: string;
  age: number;
  heightIn: number;
  weightLbs: number;
  sex?: 'male' | 'female' | 'unspecified';
  bodyFatPct?: number;
  measurements?: Partial<Record<MeasurementKey, number>>;
  // Goals
  goals: Goal[]; // ordered by priority, first = highest
  idealPhysique?: string;
  targetWeightLbs?: number;
  targetBodyFatPct?: number;
  milestone?: string;
  // Experience
  experience: Experience;
  trainingYears: number;
  exerciseComfort?: string;
  // Schedule
  daysPerWeek: number;
  preferredDays: Weekday[];
  sessionMinutes: number;
  minutesByDay?: Partial<Record<Weekday, number>>;
  scheduledRest: boolean;
  splitPref: SplitPref;
  // Equipment
  location: Location;
  equipment: Equipment[];
  // Preferences
  favoriteExercises: string[]; // exercise ids
  dislikedExercises: string[];
  cannotPerform: string[];
  style: StylePref;
  trainingStyles?: string;
  // Health
  limitations: Limitation[];
  limitationNotes?: string;
  // Nutrition
  nutritionGoal: 'gain' | 'lose' | 'maintain';
  dietPreferences?: string;
  foodRestrictions?: string;
  trackMacros: boolean;
  // Recovery
  sleepHours: number;
  recovery: 1 | 2 | 3 | 4 | 5;
  stress: 1 | 2 | 3 | 4 | 5;
  outsideActivity: 'sedentary' | 'light' | 'moderate' | 'high';
}

export type MeasurementKey =
  | 'waist'
  | 'chest'
  | 'hips'
  | 'neck'
  | 'shoulders'
  | 'armL'
  | 'armR'
  | 'thighL'
  | 'thighR'
  | 'calf';

export interface ExerciseDef {
  id: string;
  name: string;
  muscle: Muscle;
  secondary: Muscle[];
  pattern: Pattern;
  equipment: Equipment[]; // all required
  compound: boolean;
  /** Smallest sensible load jump in lbs (0 = bodyweight, progress reps). */
  increment: number;
  /** True when logged weight is per dumbbell / per hand. */
  perHand?: boolean;
  stresses: Limitation[];
  cues: string[];
  /** Typical seconds of work per set, used for time estimates. */
  setSeconds?: number;
}

export type Pattern =
  | 'squat'
  | 'hinge'
  | 'lunge'
  | 'kneeExt'
  | 'kneeFlex'
  | 'calf'
  | 'hPush'
  | 'inclinePush'
  | 'vPush'
  | 'hPull'
  | 'vPull'
  | 'fly'
  | 'lateral'
  | 'rearDelt'
  | 'biceps'
  | 'triceps'
  | 'core'
  | 'glute';

export interface ProgramExercise {
  id: string; // unique within program
  exerciseId: string;
  sets: number;
  repMin: number;
  repMax: number;
  restSec: number;
  priority: 1 | 2 | 3; // 1 = main lift, 3 = accessory
  warmup: boolean; // include ramp-up warm-up sets
  notes?: string;
}

export interface ProgramDay {
  id: string;
  name: string; // e.g. "Upper A"
  focus: string; // e.g. "Chest, back, shoulders, arms"
  muscles: Muscle[];
  exercises: ProgramExercise[];
}

export interface Program {
  id: string;
  name: string;
  split: string;
  rationale: string[];
  createdAt: string;
  status: 'draft' | 'active' | 'archived';
  days: ProgramDay[];
  /** Day id trained on each weekday; null = rest. */
  schedule: Record<Weekday, string | null>;
}

export interface ProgramChange {
  id: string;
  programId: string;
  at: string;
  kind: 'created' | 'activated' | 'edit' | 'swap' | 'add' | 'remove' | 'reorder' | 'sets' | 'schedule';
  summary: string;
  reason?: string;
}

export interface LoggedSet {
  id: string;
  kind: 'warmup' | 'work';
  targetWeight?: number;
  targetReps?: number;
  weight?: number;
  reps?: number;
  rpe?: number;
  status: 'pending' | 'done' | 'skipped';
  completedAt?: string;
  restSec?: number; // actual rest taken before this set
}

export interface SessionExercise {
  id: string;
  exerciseId: string;
  programExerciseId?: string;
  repMin: number;
  repMax: number;
  restSec: number;
  sets: LoggedSet[];
  notes?: string;
  recommendation?: string;
  /** A suggested load change awaiting the user's confirmation. */
  pending?: { kind: 'increase' | 'deload' | string; from?: number; to?: number; reps?: number; resolved?: 'accepted' | 'declined' };
}

export interface Session {
  id: string;
  programId?: string;
  dayId?: string;
  dayName: string;
  startedAt: string;
  endedAt?: string;
  status: 'active' | 'done' | 'discarded';
  pausedAt?: string;
  pausedMs: number;
  exercises: SessionExercise[];
  notes?: string;
  feeling?: string;
  restEndsAt?: string; // running rest timer, survives reloads
}

export interface BodyWeight {
  id: string;
  date: string; // YYYY-MM-DD
  lbs: number;
}

export interface Measurement {
  id: string;
  date: string;
  values: Partial<Record<MeasurementKey, number>>;
  bodyFatPct?: number;
}
