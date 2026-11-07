/**
 * Program adaptation engine. Looks at weeks of real data (not one session) and
 * proposes specific, bounded program changes with the evidence behind them.
 * Pure functions: the UI decides whether to ask or auto-apply.
 */
import { getExercise, MUSCLE_LABEL } from '../data/exercises';
import { dateKey, daysBetween, fmtNum, WEEKDAYS_LONG } from '../lib/util';
import type { AdaptCategory, AdaptRecord, AdaptSettings, BodyWeight, CheckIn, FoodEntry, Muscle, Profile, Program, Session, Weekday } from '../types';
import { candidatesFor, estimateMinutes } from './generator';
import { consistency, weeklySetsByMuscle } from './insights';
import { byDate, targetsFor } from './nutrition';
import { analyzeTrend, exposuresFor } from './progression';
import { averageReadiness } from './recovery';

export const DEFAULT_ADAPT: AdaptSettings = { mode: 'recommend', autoCategories: [], maxSetDelta: 1, maxCalorieDelta: 150 };

export const CATEGORY_LABEL: Record<AdaptCategory, string> = {
  volume: 'Weekly volume (add/remove a set)',
  exercise: 'Swap stalled exercises',
  repRange: 'Change rep ranges',
  deload: 'Deload weeks',
  nutrition: 'Calorie target',
  structure: 'Split, frequency & session length',
};
/** Categories that may never be applied automatically. */
export const MANUAL_ONLY: AdaptCategory[] = ['structure'];

export type AdaptAction =
  | { kind: 'setDelta'; dayId: string; peId: string; delta: number }
  | { kind: 'swap'; dayId: string; peId: string; toId: string }
  | { kind: 'repRange'; dayId: string; peId: string; repMin: number; repMax: number }
  | { kind: 'deload'; until: string }
  | { kind: 'calories'; delta: number }
  | { kind: 'rebuild'; patch: Partial<Profile> };

export interface Proposal {
  key: string; // stable id for cooldowns
  category: AdaptCategory;
  title: string;
  evidence: string; // the numbers behind it
  change: string; // what will change
  action: AdaptAction;
  /** Rough size, used against auto-mode bounds. */
  magnitude: number;
}

export interface AdaptInput {
  profile: Profile;
  program: Program;
  sessions: Session[];
  weights: BodyWeight[];
  checkins: CheckIn[];
  food: FoodEntry[];
  records: AdaptRecord[];
  now?: Date;
}

export interface AdaptResult {
  locked?: string;
  proposals: Proposal[];
  /** Further proposals held back so a review stays focused. */
  more: number;
}

const PRIORITY: AdaptCategory[] = ['deload', 'structure', 'volume', 'repRange', 'exercise', 'nutrition'];
const MAX_SHOWN = 4;
const MAX_STALL = 2;

const MIN_DAYS = 14;
const MIN_SESSIONS = 4;
const DISMISS_COOLDOWN_DAYS = 14;
const APPLY_COOLDOWN_DAYS = 10;

export function analyzeProgram(input: AdaptInput): AdaptResult {
  const { profile, program, weights, checkins, food, records } = input;
  const now = input.now ?? new Date();
  const done = input.sessions.filter((s) => s.status === 'done');
  const sinceProgram = done.filter((s) => s.startedAt >= program.createdAt || s.programId === program.id);
  const age = daysBetween(program.createdAt, now);
  const firstSession = done.map((s) => s.startedAt).sort()[0];
  const trainingDays = firstSession ? daysBetween(firstSession, now) : 0;

  if (done.length < MIN_SESSIONS || trainingDays < MIN_DAYS) {
    const needS = Math.max(0, MIN_SESSIONS - done.length);
    const needD = Math.max(0, Math.ceil(MIN_DAYS - trainingDays));
    return {
      locked: `Program reviews start after 2 weeks and ${MIN_SESSIONS} workouts, so changes are based on trends rather than one session. ${needS ? `${needS} more workout${needS > 1 ? 's' : ''}` : ''}${needS && needD ? ' and ' : ''}${needD ? `${needD} more day${needD > 1 ? 's' : ''}` : ''} to go.`,
      proposals: [],
      more: 0,
    };
  }

  const out: Proposal[] = [];
  const cons = consistency(program, done);
  const allPe = program.days.flatMap((d) => d.exercises.map((pe) => ({ d, pe })));
  const goal = profile.goals[0];
  const hypertrophy = goal === 'muscle' || goal === 'physique';

  // ── 1. Weekly volume per muscle (only when you're actually showing up) ──
  if (cons && cons.pct >= 75) {
    const since = new Date(now.getTime() - 14 * 86400000);
    const sets14 = weeklySetsByMuscle(done, since);
    const perWeek = (m: Muscle) => (sets14[m] ?? 0) / 2;
    const programMuscles = [...new Set(program.days.flatMap((d) => d.muscles))].filter((m) => m !== 'calves' && m !== 'abs');
    const lowBar = hypertrophy ? 8 : 6;
    const low = programMuscles.filter((m) => perWeek(m) < lowBar).sort((a, b) => perWeek(a) - perWeek(b)).slice(0, 2);
    for (const m of low) {
      const target = allPe
        .filter(({ pe }) => getExercise(pe.exerciseId).muscle === m && pe.sets < 5)
        .sort((a, b) => b.pe.priority - a.pe.priority || a.pe.sets - b.pe.sets)[0];
      if (!target) continue;
      out.push({
        key: `volume:+:${m}`,
        category: 'volume',
        title: `More ${MUSCLE_LABEL[m].toLowerCase()} volume`,
        evidence: `${MUSCLE_LABEL[m]} averaged ${fmtNum(perWeek(m), 1)} hard sets/week over the last 2 weeks while you completed ${cons.pct}% of planned workouts. ${hypertrophy ? 'Around 10+ weekly sets per muscle is a common target for growth.' : 'A bit more direct work keeps it from lagging.'}`,
        change: `${target.d.name}: ${getExercise(target.pe.exerciseId).name} ${target.pe.sets} → ${target.pe.sets + 1} sets`,
        action: { kind: 'setDelta', dayId: target.d.id, peId: target.pe.id, delta: 1 },
        magnitude: 1,
      });
    }
    // Very high volume with declining performance → trim.
    for (const m of programMuscles) {
      if (perWeek(m) <= 22) continue;
      const declining = allPe.some(({ pe }) => getExercise(pe.exerciseId).muscle === m && analyzeTrend(exposuresFor(pe.exerciseId, done)).trend === 'declining');
      const target = allPe.filter(({ pe }) => getExercise(pe.exerciseId).muscle === m && pe.priority === 3 && pe.sets > 2)[0];
      if (!declining || !target) continue;
      out.push({
        key: `volume:-:${m}`,
        category: 'volume',
        title: `Trim ${MUSCLE_LABEL[m].toLowerCase()} volume`,
        evidence: `${MUSCLE_LABEL[m]} is getting ${fmtNum(perWeek(m), 1)} sets/week and its lifts are trending down — more than you’re recovering from right now.`,
        change: `${target.d.name}: ${getExercise(target.pe.exerciseId).name} ${target.pe.sets} → ${target.pe.sets - 1} sets`,
        action: { kind: 'setDelta', dayId: target.d.id, peId: target.pe.id, delta: -1 },
        magnitude: 1,
      });
    }
  }

  // ── 2. Stalled exercises: swap accessories, change rep range on main lifts ──
  for (const { d, pe } of allPe) {
    const hist = exposuresFor(pe.exerciseId, done);
    if (hist.length < 4) continue;
    const t = analyzeTrend(hist);
    if (t.trend !== 'stalled') continue;
    const def = getExercise(pe.exerciseId);
    if (pe.priority === 1) {
      const [repMin, repMax] = pe.repMax <= 8 ? [8, 12] : [5, 8];
      out.push({
        key: `repRange:${pe.exerciseId}:${repMin}-${repMax}`,
        category: 'repRange',
        title: `New rep range for ${def.name}`,
        evidence: `${def.name}: ${t.detail} (${hist.length} sessions, ${fmtNum(daysBetween(hist.at(-1)!.date, hist[0].date))} days). It’s a main lift, so keep it and change the stimulus instead.`,
        change: `${d.name}: ${def.name} ${pe.repMin}–${pe.repMax} → ${repMin}–${repMax} reps for the next block`,
        action: { kind: 'repRange', dayId: d.id, peId: pe.id, repMin, repMax },
        magnitude: 1,
      });
    } else {
      const inDay = new Set(d.exercises.map((x) => x.exerciseId));
      const alt = candidatesFor(profile, { patterns: [def.pattern], priority: pe.priority }).find((c) => !inDay.has(c.id) && c.id !== def.id);
      if (!alt) continue;
      out.push({
        key: `exercise:${pe.exerciseId}`,
        category: 'exercise',
        title: `Swap ${def.name}`,
        evidence: `${def.name}: ${t.detail} (${hist.length} sessions). A close variation often restarts progress on an accessory.`,
        change: `${d.name}: ${def.name} → ${alt.name}`,
        action: { kind: 'swap', dayId: d.id, peId: pe.id, toId: alt.id },
        magnitude: 1,
      });
    }
  }

  // ── 3. Fatigue → deload week ──
  const declining = [...new Set(done.flatMap((s) => s.exercises.map((e) => e.exerciseId)))].filter((id) => analyzeTrend(exposuresFor(id, done)).trend === 'declining');
  const ready = averageReadiness(checkins, 7, now);
  const lowReadiness = ready && ready.n >= 4 && ready.avg < 50;
  const inDeload = program.deloadUntil && program.deloadUntil >= dateKey(now);
  if (!inDeload && (declining.length >= 2 || (lowReadiness && declining.length >= 1))) {
    const until = dateKey(new Date(now.getTime() + 7 * 86400000));
    out.push({
      key: 'deload',
      category: 'deload',
      title: 'Take a deload week',
      evidence: [
        declining.length ? `Performance is trending down on ${declining.slice(0, 3).map((i) => getExercise(i).name).join(', ')}.` : '',
        ready ? `Average readiness over the last week: ${ready.avg}/100 (${ready.n} check-ins).` : '',
        'When several lifts dip together, accumulated fatigue is the usual cause.',
      ].filter(Boolean).join(' '),
      change: `For 7 days: about 40% fewer sets and ~10% lighter loads. Normal training resumes automatically after ${until}.`,
      action: { kind: 'deload', until },
      magnitude: 1,
    });
  }

  // ── 4. Consistency → fewer days (structure, never automatic) ──
  if (cons && cons.pct < 60 && age >= 21 && profile.daysPerWeek > 2) {
    const missed = missedWeekdays(program, done, now);
    out.push({
      key: `structure:days:${profile.daysPerWeek - 1}`,
      category: 'structure',
      title: `Train ${profile.daysPerWeek - 1} days instead of ${profile.daysPerWeek}`,
      evidence: `You completed ${cons.done} of ${cons.planned} planned workouts (${cons.pct}%) over the last ${Math.min(4, Math.ceil(age / 7))} weeks${missed.length ? `, most often missing ${missed.map((d) => WEEKDAYS_LONG[d]).join(' and ')}` : ''}. A plan you complete beats a bigger plan you don’t.`,
      change: `Rebuild your program for ${profile.daysPerWeek - 1} days/week. You’ll review it before it replaces the current one.`,
      action: { kind: 'rebuild', patch: { daysPerWeek: profile.daysPerWeek - 1, preferredDays: profile.preferredDays.filter((d) => !missed.includes(d)) } },
      magnitude: 3,
    });
  }

  // ── 5. Sessions repeatedly cut short → shorter program (structure) ──
  const recent = sinceProgram.slice(0, 8);
  const shortened = recent.filter((s) => s.optimized?.minutes);
  if (recent.length >= 4 && shortened.length / recent.length >= 0.5) {
    const typical = Math.round(shortened.reduce((a, s) => a + (s.optimized!.minutes ?? 0), 0) / shortened.length / 5) * 5;
    const planned = Math.round(program.days.reduce((a, d) => a + estimateMinutes(d.exercises), 0) / program.days.length);
    if (typical < planned - 10)
      out.push({
        key: `structure:minutes:${typical}`,
        category: 'structure',
        title: `Build for ${typical}-minute sessions`,
        evidence: `${shortened.length} of your last ${recent.length} workouts were optimized down to ~${typical} min, while program days average ~${planned} min. A program designed for your real time distributes volume better than trimming each day.`,
        change: `Rebuild your program for ~${typical} min sessions. You’ll review it first.`,
        action: { kind: 'rebuild', patch: { sessionMinutes: typical, minutesByDay: {} } },
        magnitude: 3,
      });
  }

  // ── 6. Calorie target vs body-weight trend ──
  if (profile.trackMacros) {
    const days = byDate(food);
    const cutoff = dateKey(new Date(now.getTime() - 14 * 86400000));
    const logged = [...days.keys()].filter((k) => k > cutoff).length;
    const wk = (from: number, to: number) => {
      const xs = weights.filter((w) => {
        const ago = daysBetween(w.date + 'T12:00:00', now);
        return ago >= from && ago < to;
      });
      return xs.length >= 3 ? xs.reduce((a, b) => a + b.lbs, 0) / xs.length : undefined;
    };
    const w0 = wk(0, 7), w1 = wk(7, 14), w2 = wk(14, 21);
    if (logged >= 10 && w0 !== undefined && w1 !== undefined && w2 !== undefined) {
      const rate = (w0 - w2) / 2; // lb/week over 2 weeks
      const pct = (rate / w0) * 100;
      const t = targetsFor(profile, w0);
      let delta = 0;
      let why = '';
      if (profile.nutritionGoal === 'lose' && pct > -0.25) { delta = -150; why = `Your weekly average moved ${rate >= 0 ? '+' : ''}${fmtNum(rate, 1)} lb/week over 2 weeks — slower than the ~0.5–1%/week that makes fat loss noticeable.`; }
      else if (profile.nutritionGoal === 'lose' && pct < -1.2) { delta = 150; why = `You’re losing ${fmtNum(-rate, 1)} lb/week (${fmtNum(-pct, 1)}%/week). Faster than ~1%/week risks muscle and training quality.`; }
      else if (profile.nutritionGoal === 'gain' && pct < 0.1) { delta = 150; why = `Weight changed ${rate >= 0 ? '+' : ''}${fmtNum(rate, 1)} lb/week over 2 weeks. Building muscle goes better with a small, steady gain (~0.25–0.5%/week).`; }
      else if (profile.nutritionGoal === 'gain' && pct > 0.75) { delta = -150; why = `Gaining ${fmtNum(rate, 1)} lb/week is faster than needed; a slower gain keeps more of it muscle.`; }
      else if (profile.nutritionGoal === 'maintain' && Math.abs(pct) > 0.4) { delta = pct > 0 ? -100 : 100; why = `Weight drifted ${fmtNum(rate, 1)} lb/week while maintaining.`; }
      if (delta)
        out.push({
          key: `nutrition:${delta > 0 ? '+' : '-'}`,
          category: 'nutrition',
          title: `${delta > 0 ? 'Raise' : 'Lower'} calories by ${Math.abs(delta)}`,
          evidence: `${why} You logged food on ${logged} of the last 14 days.`,
          change: `Daily target ${t.kcal} → ${t.kcal + delta} kcal (carbs adjusted; protein unchanged).`,
          action: { kind: 'calories', delta },
          magnitude: Math.abs(delta),
        });
    }
  }

  // ── Filter by memory ──
  const rec = new Map(records.map((r) => [r.key, r]));
  const fresh = out.filter((p) => {
    const r = rec.get(p.key);
    if (!r) return true;
    const ago = daysBetween(r.at, now);
    return r.status === 'dismissed' ? ago >= DISMISS_COOLDOWN_DAYS : ago >= APPLY_COOLDOWN_DAYS;
  });
  // ── Focus: most important first, at most 2 stall fixes and 4 total ──
  const ranked = [...fresh].sort((a, b) => PRIORITY.indexOf(a.category) - PRIORITY.indexOf(b.category));
  const shown: Proposal[] = [];
  let stalls = 0;
  for (const p of ranked) {
    if (shown.length >= MAX_SHOWN) break;
    const isStall = p.category === 'repRange' || p.category === 'exercise';
    if (isStall && stalls >= MAX_STALL) continue;
    if (isStall) stalls++;
    shown.push(p);
  }
  return { proposals: shown, more: fresh.length - shown.length };
}

function missedWeekdays(program: Program, done: Session[], now: Date): Weekday[] {
  const out: Weekday[] = [];
  for (const [wdStr, dayId] of Object.entries(program.schedule)) {
    if (!dayId) continue;
    const wd = Number(wdStr) as Weekday;
    let planned = 0, hit = 0;
    for (let i = 1; i <= 28; i++) {
      const d = new Date(now.getTime() - i * 86400000);
      if (d.getDay() !== wd || d.toISOString() < program.createdAt) continue;
      planned++;
      if (done.some((s) => dateKey(new Date(s.startedAt)) === dateKey(d))) hit++;
    }
    if (planned >= 2 && hit / planned <= 0.34) out.push(wd);
  }
  return out;
}

/** Whether auto mode may apply this proposal without asking. */
export function autoAllowed(p: Proposal, s: AdaptSettings): boolean {
  if (s.mode !== 'auto' || MANUAL_ONLY.includes(p.category) || !s.autoCategories.includes(p.category)) return false;
  if (p.action.kind === 'setDelta') return Math.abs(p.action.delta) <= s.maxSetDelta;
  if (p.action.kind === 'calories') return Math.abs(p.action.delta) <= s.maxCalorieDelta;
  return p.action.kind !== 'rebuild';
}

/** Apply a non-rebuild action. Returns new copies; never mutates inputs. */
export function applyAction(program: Program, profile: Profile, a: AdaptAction): { program: Program; profile: Profile } {
  const p = structuredClone(program);
  const pr = structuredClone(profile);
  const pe = (dayId: string, peId: string) => p.days.find((d) => d.id === dayId)?.exercises.find((e) => e.id === peId);
  switch (a.kind) {
    case 'setDelta': {
      const x = pe(a.dayId, a.peId);
      if (x) x.sets = Math.max(1, Math.min(10, x.sets + a.delta));
      break;
    }
    case 'swap': {
      const x = pe(a.dayId, a.peId);
      if (x) x.exerciseId = a.toId;
      break;
    }
    case 'repRange': {
      const x = pe(a.dayId, a.peId);
      if (x) Object.assign(x, { repMin: a.repMin, repMax: a.repMax });
      break;
    }
    case 'deload':
      p.deloadUntil = a.until;
      break;
    case 'calories': {
      const t = targetsFor(pr);
      const kcal = t.kcal + a.delta;
      pr.nutritionTargets = { ...t, kcal, carbs: Math.max(0, Math.round((kcal - t.protein * 4 - t.fat * 9) / 4 / 5) * 5), custom: true };
      break;
    }
    case 'rebuild':
      Object.assign(pr, a.patch);
      break;
  }
  return { program: p, profile: pr };
}
