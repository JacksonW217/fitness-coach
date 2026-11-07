import Dexie, { type EntityTable } from 'dexie';
import type { BodyWeight, Measurement, Profile, Program, ProgramChange, Session } from './types';

export const db = new Dexie('forge') as Dexie & {
  profile: EntityTable<Profile, 'id'>;
  programs: EntityTable<Program, 'id'>;
  changes: EntityTable<ProgramChange, 'id'>;
  sessions: EntityTable<Session, 'id'>;
  bodyweights: EntityTable<BodyWeight, 'id'>;
  measurements: EntityTable<Measurement, 'id'>;
};

db.version(1).stores({
  profile: 'id',
  programs: 'id, status, createdAt',
  changes: 'id, programId, at',
  sessions: 'id, status, startedAt, dayId',
  bodyweights: 'id, &date',
  measurements: 'id, date',
});

/** Ask Safari not to evict our storage. Best-effort. */
export async function requestPersistence() {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) await navigator.storage.persist();
  } catch {
    /* ignore */
  }
}

const TABLES = ['profile', 'programs', 'changes', 'sessions', 'bodyweights', 'measurements'] as const;

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
      if (Array.isArray(j.data![t])) await db.table(t).bulkAdd(j.data![t]);
    }
  });
}

export async function wipeAll() {
  await db.transaction('rw', TABLES.map((t) => db.table(t)), async () => {
    for (const t of TABLES) await db.table(t).clear();
  });
}
