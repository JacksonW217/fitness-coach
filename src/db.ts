import Dexie, { type EntityTable } from 'dexie';
import { registerCustomExercises } from './data/exercises';
import type { ExerciseDef, AdaptRecord, BodyWeight, CheckIn, CoachNote, FoodEntry, Measurement, Profile, Program, ProgramChange, Session } from './types';

export const db = new Dexie('forge') as Dexie & {
  profile: EntityTable<Profile, 'id'>;
  programs: EntityTable<Program, 'id'>;
  changes: EntityTable<ProgramChange, 'id'>;
  sessions: EntityTable<Session, 'id'>;
  bodyweights: EntityTable<BodyWeight, 'id'>;
  measurements: EntityTable<Measurement, 'id'>;
  coach: EntityTable<CoachNote, 'id'>;
  food: EntityTable<FoodEntry, 'id'>;
  checkins: EntityTable<CheckIn, 'id'>;
  adaptations: EntityTable<AdaptRecord, 'key'>;
  customExercises: EntityTable<CustomExercise, 'id'>;
};

db.version(1).stores({
  profile: 'id',
  programs: 'id, status, createdAt',
  changes: 'id, programId, at',
  sessions: 'id, status, startedAt, dayId',
  bodyweights: 'id, &date',
  measurements: 'id, date',
});
db.version(2).stores({ coach: 'id, at' });
db.version(3).stores({ food: 'id, date', checkins: 'id, &date', adaptations: 'key' });
db.version(4).stores({ customExercises: 'id' });

/** A user-created exercise. `archived` ones stay resolvable for history but are hidden from pickers. */
export type CustomExercise = ExerciseDef;

/** Load user-created exercises into the in-memory catalog. */
export async function loadCustomExercises() {
  try {
    registerCustomExercises(await db.customExercises.toArray());
  } catch {
    /* storage unavailable: built-ins still work */
  }
}

export async function saveCustomExercise(ex: CustomExercise) {
  await db.customExercises.put({ ...ex, custom: true });
  await loadCustomExercises();
}

/** Ask Safari not to evict our storage. Best-effort. */
export async function requestPersistence() {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) await navigator.storage.persist();
  } catch {
    /* ignore */
  }
}

const TABLES = ['profile', 'programs', 'changes', 'sessions', 'bodyweights', 'measurements', 'coach', 'food', 'checkins', 'adaptations', 'customExercises'] as const;

export async function exportAll() {
  const data: Record<string, unknown[]> = {};
  for (const t of TABLES) data[t] = await db.table(t).toArray();
  return { app: 'forge', version: 1, exportedAt: new Date().toISOString(), data };
}

export async function importAll(json: unknown) {
  const j = json as { app?: string; data?: Record<string, unknown[]> };
  if (j?.app !== 'forge' || !j.data) throw new Error('This file is not a Forge backup.');
  await db.transaction('rw', TABLES.map((t) => db.table(t)), async () => {
    for (const t of TABLES) {
      await db.table(t).clear();
      if (Array.isArray(j.data![t])) await db.table(t).bulkAdd(j.data![t]); // older backups may lack newer tables
    }
  });
  await loadCustomExercises();
}

export async function wipeAll() {
  await db.transaction('rw', TABLES.map((t) => db.table(t)), async () => {
    for (const t of TABLES) await db.table(t).clear();
  });
}
