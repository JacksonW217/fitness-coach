/**
 * Deterministic progressive-overload engine.
 *
 * Everything here is plain math on the user's logged history — no AI, no
 * invented numbers. If there is no history, the engine says so and does not
 * suggest a weight.
 */
import type { ExerciseDef, Session } from '../types';
import { roundTo } from '../lib/util';

export interface WorkSet {
  weight: number; // 0 for bodyweight
  reps: number;
  rpe?: number;
}

/** One time the user trained an exercise. */
export interface Exposure {
  sessionId: string;
  date: string; // ISO
  repMin: number;
  repMax: number;
  sets: WorkSet[]; // completed working sets only, in order
}

export type Readiness = 'great' | 'normal' | 'low';

export interface SetTarget {
  weight?: number;
  reps: number;
}

export interface Recommendation {
  kind: 'start' | 'increase' | 'repsUp' | 'hold' | 'deload';
  targets: SetTarget[];
  message: string;
  /** Load changes always need the user to confirm before they are used. */
  needsConfirm: boolean;
  previousWeight?: number;
  suggestedWeight?: number;
}

export type Trend = 'new' | 'improving' | 'stalled' | 'declining' | 'steady';

/** Epley estimated one-rep max. Bodyweight work returns reps as the metric. */
export function e1rm(weight: number, reps: number): number {
  if (!weight) return reps;
  if (reps <= 1) return weight;
  return weight * (1 + Math.min(reps, 15) / 30);
}

export const bestE1rm = (x: Exposure) => Math.max(0, ...x.sets.map((s) => e1rm(s.weight, s.reps)));
export const topWeight = (x: Exposure) => Math.max(0, ...x.sets.map((s) => s.weight));

/** Build exposures (newest first) for one exercise from finished sessions. */
export function exposuresFor(exerciseId: string, sessions: Session[]): Exposure[] {
  const out: Exposure[] = [];
  for (const s of sessions) {
    if (s.status !== 'done') continue;
    for (const ex of s.exercises) {
      if (ex.exerciseId !== exerciseId) continue;
      const sets = ex.sets
        .filter((x) => x.kind === 'work' && x.status === 'done' && (x.reps ?? 0) > 0)
        .map((x) => ({ weight: x.weight ?? 0, reps: x.reps ?? 0, rpe: x.rpe }));
      if (sets.length) out.push({ sessionId: s.id, date: s.startedAt, repMin: ex.repMin, repMax: ex.repMax, sets });
    }
  }
  return out.sort((a, b) => b.date.localeCompare(a.date));
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

function loadStep(def: ExerciseDef) {
  return def.increment || 0;
}

function roundLoad(def: ExerciseDef, w: number) {
  return Math.max(0, roundTo(w, def.increment >= 5 ? 5 : 2.5));
}

/**
 * Double progression:
 *  - every prescribed set hit the top of the range at a reasonable effort → add the
 *    smallest load step and drop back to the bottom of the range (needs confirmation)
 *  - otherwise keep the load and add a rep to sets below the top
 *  - repeated misses below the range at the same load → suggest a ~10% reset
 */
export function recommend(
  def: ExerciseDef,
  rx: { sets: number; repMin: number; repMax: number },
  history: Exposure[],
  readiness: Readiness = 'normal',
): Recommendation {
  const { sets, repMin, repMax } = rx;
  const last = history[0];
  if (!last) {
    return {
      kind: 'start',
      targets: Array.from({ length: sets }, () => ({ reps: repMin })),
      needsConfirm: false,
      message: `No history yet. Pick a weight you could do for about ${repMax} reps with good form, leaving 2–3 reps in the tank. Today sets your baseline.`,
    };
  }

  const w = topWeight(last);
  const atW = last.sets.filter((s) => s.weight === w);
  const step = loadStep(def);
  const rpes = atW.map((s) => s.rpe).filter((r): r is number => typeof r === 'number');
  const avgRpe = rpes.length ? avg(rpes) : undefined;
  const allTop = atW.length >= sets && atW.slice(0, sets).every((s) => s.reps >= repMax);
  const misses = atW.filter((s) => s.reps < repMin).length;

  // Bodyweight: progress reps beyond the range, then suggest a harder variation.
  if (!w || step === 0) {
    const t = Array.from({ length: sets }, (_, i) => ({ reps: Math.max(repMin, (atW[i]?.reps ?? atW.at(-1)?.reps ?? repMin) + 1) }));
    return {
      kind: 'repsUp',
      targets: t,
      needsConfirm: false,
      message: allTop
        ? `You hit ${repMax}+ reps on every set. Keep adding reps, or add load/a harder variation when it feels easy.`
        : 'Beat last time by one rep per set where you can.',
    };
  }

  // Two exposures in a row with misses at this load → reset.
  const prev = history[1];
  const prevMissedSameLoad = prev && topWeight(prev) >= w && prev.sets.filter((s) => s.reps < prev.repMin).length > 0;
  if (misses > 0 && prevMissedSameLoad) {
    const nw = roundLoad(def, w * 0.9);
    return {
      kind: 'deload',
      targets: Array.from({ length: sets }, () => ({ weight: nw, reps: repMin + 1 })),
      needsConfirm: true,
      previousWeight: w,
      suggestedWeight: nw,
      message: `You've missed the bottom of the ${repMin}–${repMax} range two sessions running at ${w} lb. A short reset to ${nw} lb usually rebuilds momentum.`,
    };
  }

  if (allTop && (avgRpe === undefined || avgRpe <= 9)) {
    if (readiness === 'low') {
      return {
        kind: 'hold',
        targets: atW.slice(0, sets).map((s) => ({ weight: w, reps: s.reps })),
        needsConfirm: false,
        previousWeight: w,
        message: `You earned a jump from ${w} lb, but you reported low readiness. Repeat ${w} lb today; progress next time.`,
      };
    }
    const nw = roundLoad(def, w + step);
    return {
      kind: 'increase',
      targets: Array.from({ length: sets }, () => ({ weight: nw, reps: repMin })),
      needsConfirm: true,
      previousWeight: w,
      suggestedWeight: nw,
      message: `All ${sets} sets reached ${repMax} reps at ${w} lb${avgRpe ? ` (avg RPE ${avgRpe.toFixed(1)})` : ''}. Ready to try ${nw} lb${def.perHand ? ' per hand' : ''} — only if form stayed solid.`,
    };
  }

  if (allTop) {
    return {
      kind: 'hold',
      targets: atW.slice(0, sets).map((s) => ({ weight: w, reps: s.reps })),
      needsConfirm: false,
      previousWeight: w,
      message: `Top of the range, but effort was very high (RPE ${avgRpe?.toFixed(1)}). Repeat ${w} lb and aim for an easier-feeling session before adding weight.`,
    };
  }

  const targets: SetTarget[] = Array.from({ length: sets }, (_, i) => {
    const r = atW[i]?.reps ?? atW.at(-1)?.reps ?? repMin;
    const bump = readiness === 'low' ? 0 : 1;
    return { weight: w, reps: Math.min(repMax, Math.max(repMin, r + bump)) };
  });
  return {
    kind: 'repsUp',
    targets,
    needsConfirm: false,
    previousWeight: w,
    message:
      readiness === 'low'
        ? `Low readiness: match last session at ${w} lb rather than pushing for more reps.`
        : misses > 0
          ? `Stay at ${w} lb and aim to get every set into the ${repMin}–${repMax} range.`
          : `Stay at ${w} lb and add a rep where you can. Weight goes up once every set reaches ${repMax}.`,
  };
}

/**
 * Trend over meaningful history, not one bad day. Needs ≥4 exposures across
 * ≥14 days before calling a plateau or decline.
 */
export function analyzeTrend(history: Exposure[]): { trend: Trend; detail: string } {
  if (history.length < 2) return { trend: 'new', detail: 'Not enough sessions yet.' };
  const chron = [...history].reverse();
  const e = chron.map(bestE1rm);
  const spanDays = (new Date(history[0].date).getTime() - new Date(chron[0].date).getTime()) / 86_400_000;

  if (history.length < 4 || spanDays < 14) {
    return e.at(-1)! > e[0] ? { trend: 'improving', detail: 'Early gains.' } : { trend: 'steady', detail: 'Building a baseline.' };
  }
  const recent = e.slice(-3);
  const prior = e.slice(0, -3);
  const bestPrior = Math.max(...prior);
  const bestRecent = Math.max(...recent);
  const avgRecent = avg(recent);
  const avgPrior = avg(prior.slice(-3));
  if (avgRecent < avgPrior * 0.95) {
    return { trend: 'declining', detail: `Estimated strength is down ~${Math.round((1 - avgRecent / avgPrior) * 100)}% over your last 3 sessions.` };
  }
  if (bestRecent <= bestPrior * 1.005) {
    return { trend: 'stalled', detail: 'No new best in your last 3 sessions.' };
  }
  return { trend: 'improving', detail: `Estimated max up ${Math.round((bestRecent / bestPrior - 1) * 100)}% vs earlier best.` };
}

/** Ramp-up warm-up sets for a working weight. Returns [] when no weight is known. */
export function warmupSets(def: ExerciseDef, workWeight?: number): SetTarget[] {
  if (!workWeight || workWeight <= 0 || !def.increment) return [];
  const isBar = def.equipment.includes('barbell') || def.equipment.includes('smith');
  const out: SetTarget[] = [];
  const add = (pct: number, reps: number) => {
    const w = roundLoad(def, workWeight * pct);
    if (w <= 0 || w >= workWeight) return;
    if (out.some((s) => s.weight === w)) return;
    out.push({ weight: w, reps });
  };
  if (isBar) {
    if (workWeight > 95) out.push({ weight: 45, reps: 10 });
    add(0.5, 8);
    add(0.7, 5);
    if (workWeight >= 135) add(0.85, 3);
  } else {
    add(0.5, 10);
    add(0.75, 5);
  }
  return out;
}

/** Personal records hit in a session vs all earlier sessions. */
export function sessionPRs(session: Session, earlier: Session[]) {
  const prs: { exerciseId: string; weight: number; reps: number; e1rm: number }[] = [];
  for (const ex of session.exercises) {
    const done = ex.sets.filter((s) => s.kind === 'work' && s.status === 'done' && (s.reps ?? 0) > 0);
    if (!done.length) continue;
    const best = done.reduce((a, s) => (e1rm(s.weight ?? 0, s.reps ?? 0) > e1rm(a.weight ?? 0, a.reps ?? 0) ? s : a));
    const bestE = e1rm(best.weight ?? 0, best.reps ?? 0);
    const prevBest = Math.max(0, ...exposuresFor(ex.exerciseId, earlier.filter((s) => s.startedAt < session.startedAt)).map(bestE1rm));
    if (prevBest > 0 && bestE > prevBest) prs.push({ exerciseId: ex.exerciseId, weight: best.weight ?? 0, reps: best.reps ?? 0, e1rm: bestE });
  }
  return prs;
}

export function sessionVolume(s: Session): number {
  let v = 0;
  for (const ex of s.exercises)
    for (const set of ex.sets) if (set.kind === 'work' && set.status === 'done') v += (set.weight ?? 0) * (set.reps ?? 0);
  return v;
}
