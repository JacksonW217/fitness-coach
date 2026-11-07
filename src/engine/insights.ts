/**
 * Rule-based coaching insights computed from the user's real data. Each insight
 * cites the numbers it is based on; with too little data it says so instead of
 * guessing.
 */
import { getExercise, MUSCLE_LABEL } from '../data/exercises';
import { dateKey, daysBetween, fmtNum, parseDateKey, startOfWeek } from '../lib/util';
import type { BodyWeight, Muscle, Profile, Program, Session, Weekday } from '../types';
import { analyzeTrend, exposuresFor, recommend, sessionPRs } from './progression';

export interface Insight {
  id: string;
  tone: 'progress' | 'caution' | 'info';
  title: string;
  body: string;
}

export function todaysDay(program: Program | undefined, d = new Date()) {
  if (!program) return undefined;
  const id = program.schedule[d.getDay() as Weekday];
  return id ? program.days.find((x) => x.id === id) : undefined;
}

export function nextTrainingDay(program: Program, from = new Date()) {
  for (let i = 1; i <= 7; i++) {
    const d = new Date(from);
    d.setDate(d.getDate() + i);
    const day = todaysDay(program, d);
    if (day) return { date: d, day };
  }
  return undefined;
}

/** Weekly working sets per muscle (secondary muscles count half). */
export function weeklySetsByMuscle(sessions: Session[], since: Date): Record<Muscle, number> {
  const out = {} as Record<Muscle, number>;
  for (const s of sessions) {
    if (s.status !== 'done' || new Date(s.startedAt) < since) continue;
    for (const ex of s.exercises) {
      const def = getExercise(ex.exerciseId);
      const n = ex.sets.filter((x) => x.kind === 'work' && x.status === 'done').length;
      out[def.muscle] = (out[def.muscle] ?? 0) + n;
      for (const m of def.secondary) out[m] = (out[m] ?? 0) + n / 2;
    }
  }
  return out;
}

export function weightTrend(entries: BodyWeight[]) {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  if (sorted.length < 2) return undefined;
  const last = sorted.at(-1)!;
  const lastDate = parseDateKey(last.date);
  const win = (fromDays: number, toDays: number) =>
    sorted.filter((e) => {
      const ago = daysBetween(parseDateKey(e.date), lastDate);
      return ago >= fromDays && ago < toDays;
    });
  const thisWeek = win(0, 7);
  const prevWeek = win(7, 14);
  const mean = (xs: BodyWeight[]) => xs.reduce((a, b) => a + b.lbs, 0) / xs.length;
  const weeklyChange = thisWeek.length && prevWeek.length ? mean(thisWeek) - mean(prevWeek) : undefined;
  return { latest: last.lbs, weeklyChange, avgThisWeek: thisWeek.length ? mean(thisWeek) : undefined };
}

export function buildInsights(args: { profile: Profile; program?: Program; sessions: Session[]; weights: BodyWeight[] }): Insight[] {
  const { profile, program, sessions, weights } = args;
  const done = sessions.filter((s) => s.status === 'done').sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  const out: Insight[] = [];

  if (!done.length) {
    out.push({
      id: 'first',
      tone: 'info',
      title: 'Your first session sets the baseline',
      body: 'Log your first workout and I’ll start calculating targets from your real numbers. Until then, nothing here is a guess.',
    });
  }

  // Today's lifts ready for progression.
  const today = todaysDay(program);
  if (today) {
    const ready: string[] = [];
    for (const pe of today.exercises) {
      const def = getExercise(pe.exerciseId);
      const r = recommend(def, pe, exposuresFor(pe.exerciseId, done));
      if (r.kind === 'increase') ready.push(`${def.name}: ${r.previousWeight} → ${r.suggestedWeight} lb`);
    }
    if (ready.length)
      out.push({
        id: 'ready',
        tone: 'progress',
        title: `Ready to progress on ${ready.length} lift${ready.length > 1 ? 's' : ''}`,
        body: `${ready.join(' · ')}. You hit the top of the rep range on every set last time. Confirm each jump in the workout only if your form held.`,
      });
  }

  // Plateaus / declines across all trained exercises.
  const ids = [...new Set(done.flatMap((s) => s.exercises.map((e) => e.exerciseId)))];
  const stalled: string[] = [];
  const declining: string[] = [];
  for (const id of ids) {
    const t = analyzeTrend(exposuresFor(id, done));
    if (t.trend === 'stalled') stalled.push(getExercise(id).name);
    if (t.trend === 'declining') declining.push(getExercise(id).name);
  }
  if (declining.length >= 2)
    out.push({
      id: 'fatigue',
      tone: 'caution',
      title: 'Signs of accumulated fatigue',
      body: `Performance has dropped across ${declining.slice(0, 3).join(', ')} over several sessions. When several lifts dip together, recovery (sleep, food, stress) is the usual cause. Consider a lighter week.`,
    });
  else if (declining.length === 1)
    out.push({ id: 'decline', tone: 'caution', title: `${declining[0]} is trending down`, body: 'Estimated strength is lower over your last three sessions. Check sleep and technique, and hold the weight steady.' });
  if (stalled.length)
    out.push({
      id: 'plateau',
      tone: 'info',
      title: `Plateau: ${stalled.slice(0, 2).join(', ')}`,
      body: 'No new best in three sessions over at least two weeks. Options: add a set, shift the rep range, or swap to a close variation for a block.',
    });

  // Consistency this week.
  if (program) {
    const wk = startOfWeek();
    const planned = Object.values(program.schedule).filter(Boolean).length;
    const doneThisWeek = done.filter((s) => new Date(s.startedAt) >= wk).length;
    if (done.length && planned)
      out.push({
        id: 'consistency',
        tone: doneThisWeek >= planned ? 'progress' : 'info',
        title: `${doneThisWeek} of ${planned} workouts this week`,
        body: doneThisWeek >= planned ? 'Week complete. Consistency drives most of your results.' : 'Staying consistent through the week matters more than any single session.',
      });
  }

  // Under-trained muscles (only after ~2 weeks of data).
  if (done.length >= 4 && daysBetween(done.at(-1)!.startedAt, new Date()) >= 10) {
    const since = new Date();
    since.setDate(since.getDate() - 7);
    const sets = weeklySetsByMuscle(done, since);
    const focus: Muscle[] = ['chest', 'back', 'shoulders', 'quads', 'hamstrings'];
    const low = focus.filter((m) => (sets[m] ?? 0) < 6);
    if (low.length && low.length < focus.length)
      out.push({
        id: 'volume',
        tone: 'info',
        title: `Low weekly volume: ${low.map((m) => MUSCLE_LABEL[m]).join(', ')}`,
        body: `Fewer than 6 hard sets in the last 7 days (${low.map((m) => `${MUSCLE_LABEL[m]} ${fmtNum(sets[m] ?? 0, 1)}`).join(', ')}). About 10+ weekly sets per muscle is a common target for growth.`,
      });
  }

  // Body-weight direction vs goal.
  const wt = weightTrend(weights);
  if (wt?.weeklyChange !== undefined) {
    const pct = (wt.weeklyChange / wt.latest) * 100;
    const g = profile.nutritionGoal;
    if (g === 'lose' && pct > 0.1)
      out.push({ id: 'bw', tone: 'caution', title: 'Weight trending up', body: `Your weekly average rose ${fmtNum(wt.weeklyChange, 1)} lb while your goal is fat loss. Check calorie intake. One week can be noise; two in a row is a pattern.` });
    else if (g === 'lose' && pct < -1.2)
      out.push({ id: 'bw', tone: 'caution', title: 'Losing quickly', body: `Down ${fmtNum(-wt.weeklyChange, 1)} lb this week (${fmtNum(-pct, 1)}%). Faster than ~1%/week can cost muscle and performance.` });
    else if (g === 'gain' && pct < 0)
      out.push({ id: 'bw', tone: 'caution', title: 'Weight not moving up', body: `Weekly average changed ${fmtNum(wt.weeklyChange, 1)} lb. To build muscle, a small surplus (~0.25–0.5%/week gain) helps.` });
    else
      out.push({ id: 'bw', tone: 'progress', title: 'Body weight on track', body: `Weekly average ${wt.weeklyChange >= 0 ? '+' : ''}${fmtNum(wt.weeklyChange, 1)} lb, in line with your ${g === 'lose' ? 'fat-loss' : g === 'gain' ? 'muscle-gain' : 'maintenance'} goal.` });
  }

  if (profile.sleepHours && profile.sleepHours < 6.5)
    out.push({ id: 'sleep', tone: 'info', title: 'Sleep is a lever', body: `You reported ~${profile.sleepHours} h of sleep. Getting closer to 7–9 h is one of the most reliable ways to recover and progress faster.` });

  // Recent PRs
  const last = done[0];
  if (last && daysBetween(last.startedAt, new Date()) < 4) {
    const prs = sessionPRs(last, done);
    if (prs.length)
      out.push({ id: 'pr', tone: 'progress', title: `New PR${prs.length > 1 ? 's' : ''} last session`, body: prs.map((p) => `${getExercise(p.exerciseId).name} ${p.weight} × ${p.reps}`).join(' · ') });
  }
  return out;
}

export function recentPRs(sessions: Session[], limit = 5) {
  const done = sessions.filter((s) => s.status === 'done').sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  const out: { date: string; exerciseId: string; weight: number; reps: number }[] = [];
  done.forEach((s, i) => {
    for (const p of sessionPRs(s, done.slice(0, i))) out.push({ date: s.startedAt, exerciseId: p.exerciseId, weight: p.weight, reps: p.reps });
  });
  return out.reverse().slice(0, limit);
}

export function weekStats(sessions: Session[]) {
  const wk = startOfWeek();
  const thisWeek = sessions.filter((s) => s.status === 'done' && new Date(s.startedAt) >= wk);
  return { count: thisWeek.length, sessions: thisWeek };
}

/** Rolling 4-week consistency: done / planned. */
export function consistency(program: Program | undefined, sessions: Session[]) {
  if (!program) return undefined;
  const planned = Object.values(program.schedule).filter(Boolean).length * 4;
  const since = new Date();
  since.setDate(since.getDate() - 28);
  const firstDone = sessions.filter((s) => s.status === 'done').map((s) => s.startedAt).sort()[0];
  if (!firstDone) return undefined;
  // Count from when you started training with the app (or 4 weeks ago, whichever is later).
  const start = Math.min(new Date(program.createdAt).getTime(), new Date(firstDone).getTime());
  const effectiveSince = new Date(Math.max(since.getTime(), start));
  const weeks = Math.max(1, Math.ceil(daysBetween(effectiveSince, new Date()) / 7));
  const p = Math.min(planned, Object.values(program.schedule).filter(Boolean).length * weeks);
  const n = sessions.filter((s) => s.status === 'done' && new Date(s.startedAt) >= effectiveSince).length;
  return { done: n, planned: p, pct: p ? Math.min(100, Math.round((n / p) * 100)) : 0 };
}

export const todayKey = () => dateKey();
