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
  | 'trapBar'
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
  | 'abs'
  | 'traps'
  | 'forearms';

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
  // Phase 3
  nutritionTargets?: NutritionTargets;
  adapt?: AdaptSettings;
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
  /** "Reps" are logged as seconds (planks, carries, holds). */
  timed?: boolean;
  /** Created by the user in the app. */
  custom?: boolean;
  /** User's own description, shown to the coach. */
  notes?: string;
  createdAt?: string;
  /** Removed by the user: hidden from pickers, kept so history still resolves. */
  archived?: boolean;
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
  | 'glute'
  | 'shrug'
  | 'forearm'
  | 'carry'
  | 'other';

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
  /** Deload week in effect through this date (YYYY-MM-DD). */
  deloadUntil?: string;
}

export interface ProgramChange {
  id: string;
  programId: string;
  at: string;
  kind: 'created' | 'activated' | 'edit' | 'swap' | 'add' | 'remove' | 'reorder' | 'sets' | 'schedule' | 'coach' | 'optimize' | 'adapt' | 'auto';
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
  /** Deload-week session; excluded from progression history. */
  deload?: boolean;
  /** Set when the session was built by Optimize My Workout. */
  optimized?: { minutes?: number; feeling: string; changes: string[]; stimulusNote: string };
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

export interface CoachNote {
  id: string;
  at: string;
  topic: string;
  question: string;
  reply?: string;
  repliedAt?: string;
  applied?: string[]; // summaries of program changes applied from this reply
  appliedIdx?: number[]; // which proposed changes (by position) were applied
}

// ── Phase 3 ──────────────────────────────────────────────────────────
export interface NutritionTargets {
  kcal: number;
  protein: number; // g
  carbs: number; // g
  fat: number; // g
  custom: boolean; // true when the user overrode the calculated targets
}

export interface FoodEntry {
  id: string;
  date: string; // YYYY-MM-DD
  at: string;
  name: string;
  kcal: number;
  protein: number;
  carbs?: number;
  fat?: number;
}

export interface CheckIn {
  id: string;
  date: string; // YYYY-MM-DD, one per day
  sleepHours: number;
  sleepQuality: 1 | 2 | 3 | 4 | 5;
  energy: 1 | 2 | 3 | 4 | 5;
  soreness: 1 | 2 | 3 | 4 | 5; // 5 = very sore
  stress: 1 | 2 | 3 | 4 | 5; // 5 = very stressed
  note?: string;
}

export type AdaptCategory = 'volume' | 'exercise' | 'repRange' | 'deload' | 'nutrition' | 'structure';

export interface AdaptSettings {
  mode: 'recommend' | 'auto';
  autoCategories: AdaptCategory[]; // never includes 'structure'
  maxSetDelta: number; // max sets added/removed per exercise per change
  maxCalorieDelta: number; // max kcal change per adjustment
}

/** Memory of what happened to each proposal, so it isn't nagged about. */
export interface AdaptRecord {
  key: string;
  status: 'applied' | 'dismissed';
  at: string;
  auto?: boolean;
  summary?: string;
}
