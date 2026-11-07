import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { getExercise } from '../data/exercises';
import { exposuresFor, recommend, warmupSets, type Readiness } from '../engine/progression';
import type { BodyWeight, LoggedSet, Program, ProgramChange, ProgramDay, Session, SessionExercise } from '../types';
import { dateKey, nowISO, uid } from './util';

// ── Hooks ────────────────────────────────────────────────────────────
export const useProfile = () => useLiveQuery(() => db.profile.get('me'), [], null);
export const useActiveProgram = () => useLiveQuery(() => db.programs.where('status').equals('active').first(), [], null);
export const useSessions = () => useLiveQuery(() => db.sessions.orderBy('startedAt').reverse().toArray(), [], null);
export const useActiveSession = () => useLiveQuery(() => db.sessions.where('status').equals('active').first(), [], null);
export const useWeights = () => useLiveQuery(() => db.bodyweights.orderBy('date').toArray(), [], null);
export const useMeasurements = () => useLiveQuery(() => db.measurements.orderBy('date').toArray(), [], null);
export const useCoachNotes = () => useLiveQuery(() => db.coach.orderBy('at').reverse().toArray(), [], null);
export const useChanges = (programId?: string) =>
  useLiveQuery(() => (programId ? db.changes.where('programId').equals(programId).reverse().sortBy('at') : db.changes.orderBy('at').reverse().toArray()), [programId], null);

// ── Program ──────────────────────────────────────────────────────────
export async function logChange(programId: string, kind: ProgramChange['kind'], summary: string, reason?: string) {
  await db.changes.add({ id: uid(), programId, at: nowISO(), kind, summary, reason });
}

export async function activateProgram(p: Program) {
  await db.transaction('rw', db.programs, db.changes, async () => {
    const actives = await db.programs.where('status').equals('active').toArray();
    for (const a of actives) await db.programs.update(a.id, { status: 'archived' });
    await db.programs.put({ ...p, status: 'active' });
    await logChange(p.id, 'activated', `Activated “${p.name}”`, actives.length ? `Replaced “${actives[0].name}”.` : 'Initial program from onboarding.');
  });
}

export async function saveProgram(p: Program, kind: ProgramChange['kind'], summary: string, reason?: string) {
  await db.programs.put(p);
  await logChange(p.id, kind, summary, reason);
}

// ── Sessions ─────────────────────────────────────────────────────────
export async function finishedSessions(): Promise<Session[]> {
  return db.sessions.where('status').equals('done').toArray();
}

/** Build a session from a program day using real history for targets. */
export function buildSession(day: ProgramDay, programId: string | undefined, history: Session[], readiness: Readiness = 'normal'): Session {
  const exercises: SessionExercise[] = day.exercises.map((pe) => {
    const def = getExercise(pe.exerciseId);
    const rec = recommend(def, pe, exposuresFor(pe.exerciseId, history), readiness);
    // Load changes need confirmation: until confirmed, target the previous weight.
    const pendingChange = rec.needsConfirm && rec.previousWeight !== undefined;
    const work: LoggedSet[] = rec.targets.map((t) => ({
      id: uid(),
      kind: 'work',
      targetWeight: pendingChange ? rec.previousWeight : t.weight,
      targetReps: pendingChange && rec.kind === 'increase' ? pe.repMax : t.reps,
      status: 'pending',
    }));
    const wWeight = work[0]?.targetWeight;
    const warm: LoggedSet[] = pe.warmup
      ? warmupSets(def, wWeight).map((t) => ({ id: uid(), kind: 'warmup', targetWeight: t.weight, targetReps: t.reps, status: 'pending' }))
      : [];
    return {
      id: uid(),
      exerciseId: pe.exerciseId,
      programExerciseId: pe.id,
      repMin: pe.repMin,
      repMax: pe.repMax,
      restSec: pe.restSec,
      sets: [...warm, ...work],
      recommendation: rec.message,
      ...(pendingChange ? { pending: { kind: rec.kind, from: rec.previousWeight, to: rec.suggestedWeight, reps: rec.targets[0]?.reps } } : {}),
    };
  });
  return {
    id: uid(),
    programId,
    dayId: day.id,
    dayName: day.name,
    startedAt: nowISO(),
    status: 'active',
    pausedMs: 0,
    exercises,
  };
}

export async function startSession(day: ProgramDay, programId: string | undefined, readiness: Readiness = 'normal', feeling?: string, optimized?: Session['optimized']) {
  const existing = await db.sessions.where('status').equals('active').first();
  if (existing) return existing.id;
  const s = buildSession(day, programId, await finishedSessions(), readiness);
  s.feeling = feeling;
  if (optimized) s.optimized = optimized;
  await db.sessions.add(s);
  return s.id;
}

// ── Body weight ──────────────────────────────────────────────────────
export async function logWeight(lbs: number, date = dateKey()) {
  const existing = await db.bodyweights.where('date').equals(date).first();
  if (existing) await db.bodyweights.update(existing.id, { lbs });
  else await db.bodyweights.add({ id: uid(), date, lbs } as BodyWeight);
  const p = await db.profile.get('me');
  if (p && date >= dateKey(new Date(Date.now() - 86400000 * 3))) await db.profile.update('me', { weightLbs: lbs });
}
