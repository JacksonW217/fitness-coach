/**
 * Claude coaching bridge (no API): builds a data-rich prompt from the user's
 * actual records to paste into the Claude app, and parses a structured block
 * of proposed program changes from Claude's reply for in-app approval.
 */
import { EXERCISES, getExercise, hasEquipment, MUSCLE_LABEL, EQUIPMENT_LABEL } from '../data/exercises';
import { fmtHeight, fmtNum, fmtDate, WEEKDAYS_LONG } from '../lib/util';
import type { BodyWeight, CheckIn, CoachNote, FoodEntry, Measurement, Muscle, Profile, Program, ProgramExercise, Session, Weekday } from '../types';
import { byDate, targetsFor } from './nutrition';
import { averageReadiness, readinessScore } from './recovery';
import { estimateMinutes } from './generator';
import { buildInsights, consistency, recentPRs, weeklySetsByMuscle, weightTrend } from './insights';
import { analyzeTrend, bestE1rm, exposuresFor, recommend } from './progression';

export const PROJECT_INSTRUCTIONS = `You are my personal strength and physique coach. I use a training app called Forge that logs all my workouts, body weight and measurements. When I message you, I'll paste a snapshot of my real data from the app followed by a question.

How to coach me:
- Base every answer on the data I paste. Quote the specific numbers you're using (weights, reps, dates, set counts, trends). If the data can't answer the question, say what's missing instead of guessing.
- Never invent workouts, weights or history that aren't in the snapshot.
- Be direct and practical. Give me the 1–3 changes that matter most, with the reasoning, then stop.
- Use evidence-informed training principles (progressive overload, weekly volume per muscle, proximity to failure, recovery, adherence). Mention uncertainty honestly.
- I train in pounds and inches.
- You are not a doctor. If something sounds like an injury or medical issue, tell me to see a qualified professional and don't diagnose it.
- Remember earlier conversations in this project and hold me accountable to what we agreed.

If — and only if — you recommend concrete changes to my program, end your reply with a code block tagged forge-changes containing JSON exactly like this, using day names and exercise names exactly as they appear in my snapshot or the available-exercise list:

\`\`\`forge-changes
{"changes":[
  {"type":"swap","day":"Upper A","from":"Barbell Bench Press","to":"Dumbbell Bench Press","reason":"..."},
  {"type":"sets","day":"Upper A","exercise":"Lat Pulldown","sets":4,"repMin":8,"repMax":12,"reason":"..."},
  {"type":"add","day":"Lower A","exercise":"Leg Extension","sets":3,"repMin":10,"repMax":15,"reason":"..."},
  {"type":"remove","day":"Lower B","exercise":"Seated Calf Raise","reason":"..."},
  {"type":"rest","day":"Upper A","exercise":"Barbell Row","restSec":150,"reason":"..."}
]}
\`\`\`

I approve each change in the app before anything is applied.`;

export interface CoachTopic {
  id: string;
  title: string;
  question: (arg?: string) => string;
  needs?: 'exercise' | 'muscle';
}

export const TOPICS: CoachTopic[] = [
  { id: 'weekly', title: 'Weekly review', question: () => 'Review my last week of training. What went well, what didn’t, and what should I focus on this coming week?' },
  { id: 'focus', title: 'What should I focus on this week?', question: () => 'What should I focus on this week to make the most progress toward my goals?' },
  { id: 'goal', title: 'Am I making progress toward my goal?', question: () => 'Am I making progress toward my goals? Be honest about what the numbers show and what I should change.' },
  { id: 'stall', title: 'Why has a lift stopped progressing?', needs: 'exercise', question: (x) => `Why has my ${x ?? 'main lift'} stopped progressing, and what should I change?` },
  { id: 'muscle', title: 'Am I training a muscle enough?', needs: 'muscle', question: (x) => `Am I training my ${x ?? 'chest'} enough? Look at weekly sets, exercise selection and progress.` },
  { id: 'split', title: 'Should I change my split?', question: () => 'What, if anything, should I change about my current split and program structure?' },
  { id: 'volume', title: 'Is my training volume right?', question: () => 'Is my weekly training volume appropriate for my goals, experience and recovery?' },
  { id: 'recovery', title: 'Am I recovering properly?', question: () => 'Based on my performance trends and recovery info, am I recovering properly? What should I adjust?' },
  { id: 'weight', title: 'Why is my body weight changing?', question: () => 'Explain what my body-weight trend means relative to my goal, and what I should do about it.' },
  { id: 'improve', title: 'How can I improve my workouts?', question: () => 'What should I improve about how I’m running my workouts (exercise order, effort, rest, consistency)?' },
];

const line = (s: string) => s + '\n';

function exerciseLine(pe: ProgramExercise) {
  return `${getExercise(pe.exerciseId).name} ${pe.sets}×${pe.repMin}–${pe.repMax}, rest ${pe.restSec}s${pe.warmup ? ', warm-ups' : ''}`;
}

export function buildCoachPrompt(args: {
  question: string;
  profile: Profile;
  program?: Program;
  sessions: Session[];
  weights: BodyWeight[];
  measurements: Measurement[];
  notes: CoachNote[];
  food?: FoodEntry[];
  checkins?: CheckIn[];
  now?: Date;
}): string {
  const { question, profile: p, program, sessions, weights, measurements, notes, food = [], checkins = [] } = args;
  const now = args.now ?? new Date();
  const done = sessions.filter((s) => s.status === 'done').sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  let out = '';
  out += line(`# My Forge data — ${now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}`);
  out += line('');
  out += line('## Profile');
  out += line(`- ${p.age} yrs, ${fmtHeight(p.heightIn)}, ${weights.at(-1)?.lbs ?? p.weightLbs} lb${p.sex && p.sex !== 'unspecified' ? `, ${p.sex}` : ''}${p.bodyFatPct ? `, ~${p.bodyFatPct}% body fat` : ''}`);
  out += line(`- Goals (priority order): ${p.goals.join(' > ')}`);
  if (p.idealPhysique) out += line(`- Ideal physique: ${p.idealPhysique}`);
  const targets = [p.targetWeightLbs && `weight ${p.targetWeightLbs} lb`, p.targetBodyFatPct && `body fat ${p.targetBodyFatPct}%`, p.milestone].filter(Boolean);
  if (targets.length) out += line(`- Targets: ${targets.join('; ')}`);
  out += line(`- Experience: ${p.experience}, ${p.trainingYears} yr${p.trainingYears === 1 ? '' : 's'} training${p.exerciseComfort ? ` (${p.exerciseComfort})` : ''}`);
  out += line(`- Schedule: ${p.daysPerWeek} days/week, ~${p.sessionMinutes} min/session`);
  out += line(`- Equipment: ${p.location} — ${p.equipment.filter((e) => e !== 'bodyweight').map((e) => EQUIPMENT_LABEL[e]).join(', ')}`);
  out += line(`- Style: ${p.style}${p.trainingStyles ? `; ${p.trainingStyles}` : ''}`);
  if (p.favoriteExercises.length) out += line(`- Favorites: ${p.favoriteExercises.map((i) => getExercise(i).name).join(', ')}`);
  if (p.dislikedExercises.length) out += line(`- Dislikes: ${p.dislikedExercises.map((i) => getExercise(i).name).join(', ')}`);
  if (p.cannotPerform.length) out += line(`- Cannot perform: ${p.cannotPerform.map((i) => getExercise(i).name).join(', ')}`);
  if (p.limitations.length || p.limitationNotes) out += line(`- Limitations: ${p.limitations.join(', ')}${p.limitationNotes ? ` — ${p.limitationNotes}` : ''}`);
  out += line(`- Nutrition: goal ${p.nutritionGoal}${p.dietPreferences ? `; ${p.dietPreferences}` : ''}${p.foodRestrictions ? `; restrictions: ${p.foodRestrictions}` : ''}`);
  out += line(`- Recovery: ~${p.sleepHours} h sleep, recovery ${p.recovery}/5, stress ${p.stress}/5, outside activity ${p.outsideActivity}`);

  if (program) {
    out += line('');
    out += line(`## Current program: ${program.name} (active since ${fmtDate(program.createdAt)})`);
    const order: Weekday[] = [1, 2, 3, 4, 5, 6, 0];
    out += line(`Schedule: ${order.map((d) => `${WEEKDAYS_LONG[d].slice(0, 3)} ${program.days.find((x) => x.id === program.schedule[d])?.name ?? 'rest'}`).join(' · ')}`);
    for (const d of program.days) {
      out += line(`- **${d.name}** (~${estimateMinutes(d.exercises)} min): ${d.exercises.map(exerciseLine).join('; ')}`);
    }
  }

  out += line('');
  out += line('## Training history');
  if (!done.length) {
    out += line('No workouts logged yet.');
  } else {
    const c = consistency(program, sessions);
    const since28 = new Date(now.getTime() - 28 * 86400000);
    out += line(`- ${done.length} workouts logged total; ${done.filter((s) => new Date(s.startedAt) >= since28).length} in the last 4 weeks${c ? ` (${c.done}/${c.planned} planned = ${c.pct}%)` : ''}.`);
    const since7 = new Date(now.getTime() - 7 * 86400000);
    const w1 = weeklySetsByMuscle(done, since7);
    const w4 = weeklySetsByMuscle(done, since28);
    const muscles = Object.keys(MUSCLE_LABEL) as Muscle[];
    out += line(`- Hard sets per muscle, last 7 days (secondary = ½): ${muscles.map((m) => `${MUSCLE_LABEL[m]} ${fmtNum(w1[m] ?? 0, 1)}`).join(', ')}`);
    out += line(`- Weekly average, last 4 weeks: ${muscles.map((m) => `${MUSCLE_LABEL[m]} ${fmtNum((w4[m] ?? 0) / 4, 1)}`).join(', ')}`);
    out += line('');
    out += line('### Per exercise (newest first, working sets weight×reps@RPE)');
    const ids = [...new Set(done.flatMap((s) => s.exercises.map((e) => e.exerciseId)))];
    const rows = ids
      .map((id) => ({ id, ex: exposuresFor(id, done) }))
      .filter((r) => r.ex.length)
      .sort((a, b) => b.ex[0].date.localeCompare(a.ex[0].date));
    for (const { id, ex } of rows.slice(0, 20)) {
      const def = getExercise(id);
      const t = analyzeTrend(ex);
      const recent = ex
        .slice(0, 4)
        .map((x) => `${fmtDate(x.date)}: ${x.sets.map((s) => `${s.weight ? s.weight + '×' : ''}${s.reps}${s.rpe ? '@' + s.rpe : ''}`).join(', ')}`)
        .join(' | ');
      const pe = program?.days.flatMap((d) => d.exercises).find((e) => e.exerciseId === id);
      const rec = pe ? recommend(def, pe, ex) : undefined;
      out += line(`- **${def.name}** — ${ex.length} sessions, trend: ${t.trend} (${t.detail})${def.increment ? ` best est. 1RM ${fmtNum(Math.max(...ex.map(bestE1rm)))} lb` : ''}. ${recent}${rec ? `. App's next-session rule: ${rec.kind}` : ''}`);
    }
    const prs = recentPRs(sessions, 5);
    if (prs.length) out += line(`- Recent PRs: ${prs.map((x) => `${getExercise(x.exerciseId).name} ${x.weight ? x.weight + '×' : ''}${x.reps} (${fmtDate(x.date)})`).join('; ')}`);
    const recentNotes = done.slice(0, 6).filter((s) => s.notes || s.feeling).map((s) => `${fmtDate(s.startedAt)} ${s.dayName}: ${[s.feeling && `felt ${s.feeling}`, s.notes].filter(Boolean).join(' — ')}`);
    if (recentNotes.length) out += line(`- Recent session notes: ${recentNotes.join(' | ')}`);
  }

  out += line('');
  out += line('## Body');
  if (weights.length) {
    const wt = weightTrend(weights);
    const sorted = [...weights].sort((a, b) => a.date.localeCompare(b.date));
    const weekly = new Map<string, number[]>();
    for (const w of sorted.slice(-60)) {
      const d = new Date(w.date + 'T12:00:00');
      const monday = new Date(d);
      monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
      const k = monday.toISOString().slice(0, 10);
      weekly.set(k, [...(weekly.get(k) ?? []), w.lbs]);
    }
    out += line(`- Latest ${sorted.at(-1)!.lbs} lb (${fmtDate(sorted.at(-1)!.date)}); first logged ${sorted[0].lbs} lb (${fmtDate(sorted[0].date)}); ${weights.length} weigh-ins.`);
    if (wt?.weeklyChange !== undefined) out += line(`- Change vs previous week's average: ${wt.weeklyChange >= 0 ? '+' : ''}${fmtNum(wt.weeklyChange, 1)} lb`);
    out += line(`- Weekly averages: ${[...weekly.entries()].slice(-8).map(([k, v]) => `wk of ${fmtDate(k)} ${fmtNum(v.reduce((a, b) => a + b, 0) / v.length, 1)}`).join(', ')}`);
  } else out += line('- No weigh-ins logged.');
  const m = measurements.at(-1);
  if (m) out += line(`- Measurements (${fmtDate(m.date)}, inches): ${Object.entries(m.values).map(([k, v]) => `${k} ${v}`).join(', ')}${m.bodyFatPct ? `, body fat ${m.bodyFatPct}%` : ''}`);

  const days = byDate(food);
  const recentFood = [...days.entries()].filter(([k]) => k > new Date(now.getTime() - 7 * 86400000).toISOString().slice(0, 10));
  out += line('');
  out += line('## Nutrition');
  const tg = targetsFor(p, weights.at(-1)?.lbs);
  out += line(`- Targets${tg.custom ? ' (custom)' : ' (calculated)'}: ${tg.kcal} kcal, ${tg.protein} g protein, ${tg.carbs} g carbs, ${tg.fat} g fat`);
  if (recentFood.length) {
    const avg = (f: (t: { kcal: number; protein: number }) => number) => Math.round(recentFood.reduce((a, [, t]) => a + f(t), 0) / recentFood.length);
    out += line(`- Last 7 days: logged ${recentFood.length}/7 days; average ${avg((t) => t.kcal)} kcal and ${avg((t) => t.protein)} g protein on logged days`);
  } else out += line(`- ${p.trackMacros ? 'No food logged in the last 7 days.' : 'Not tracking food intake.'}`);

  out += line('');
  out += line('## Recovery');
  const ready = averageReadiness(checkins, 7, now);
  const last7 = checkins.filter((c) => c.date > new Date(now.getTime() - 7 * 86400000).toISOString().slice(0, 10));
  if (ready) {
    out += line(`- Readiness (0–100) 7-day average: ${ready.avg} from ${ready.n} check-ins; avg sleep ${fmtNum(last7.reduce((a, c) => a + c.sleepHours, 0) / Math.max(1, last7.length), 1)} h`);
    out += line(`- Daily: ${last7.map((c) => `${fmtDate(c.date)} ${readinessScore(c)} (sleep ${c.sleepHours}h, energy ${c.energy}/5, soreness ${c.soreness}/5, stress ${c.stress}/5)`).join('; ')}`);
  } else out += line('- No recovery check-ins in the last 7 days.');
  if (program?.deloadUntil && program.deloadUntil >= now.toISOString().slice(0, 10)) out += line(`- Currently in a deload week through ${fmtDate(program.deloadUntil)}.`);

  const flags = buildInsights({ profile: p, program, sessions, weights, checkins }).filter((i) => i.id !== 'first');
  if (flags.length) {
    out += line('');
    out += line('## What the app’s rule engine is flagging');
    for (const f of flags) out += line(`- ${f.title}: ${f.body}`);
  }

  const prior = notes.filter((n) => n.reply).slice(0, 2);
  if (prior.length) {
    out += line('');
    out += line('## Our recent coaching (saved in the app)');
    for (const n of prior) out += line(`- ${fmtDate(n.at)} — Q: ${n.question}\n  Your answer (excerpt): ${n.reply!.replace(/```[\s\S]*?```/g, '').replace(/\s+/g, ' ').trim().slice(0, 500)}${n.applied?.length ? `\n  Changes I applied: ${n.applied.join('; ')}` : ''}`);
  }

  if (program) {
    const avail = EXERCISES.filter((e) => hasEquipment(e, p.equipment) && !p.cannotPerform.includes(e.id)).map((e) => e.name);
    out += line('');
    out += line(`Available exercises (use these exact names in forge-changes): ${avail.join(', ')}`);
  }

  out += line('');
  out += line('## How to answer');
  out += line(PROJECT_INSTRUCTIONS.split('\n').slice(2).join('\n'));
  out += line('');
  out += line('## My question');
  out += line(question);
  return out;
}

// ── Parsing Claude's proposed changes ──────────────────────────────────
export type ProposedChange =
  | { type: 'swap'; day: string; from: string; to: string; reason?: string }
  | { type: 'sets'; day: string; exercise: string; sets?: number; repMin?: number; repMax?: number; reason?: string }
  | { type: 'add'; day: string; exercise: string; sets?: number; repMin?: number; repMax?: number; restSec?: number; reason?: string }
  | { type: 'remove'; day: string; exercise: string; reason?: string }
  | { type: 'rest'; day: string; exercise: string; restSec: number; reason?: string };

export interface ResolvedChange {
  raw: ProposedChange;
  ok: boolean;
  error?: string;
  summary: string;
  reason?: string;
  apply?: (p: Program) => void;
}

export function extractChanges(reply: string): ProposedChange[] | null {
  const m = reply.match(/```forge-changes\s*([\s\S]*?)```/) ?? reply.match(/```(?:json)?\s*(\{[\s\S]*?"changes"[\s\S]*?\})\s*```/);
  const src = m?.[1] ?? (reply.trim().startsWith('{') ? reply.trim() : null);
  if (!src) return null;
  try {
    const j = JSON.parse(src.trim());
    return Array.isArray(j?.changes) ? j.changes : null;
  } catch {
    return null;
  }
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
export function findExerciseId(name: string): string | undefined {
  const n = norm(name ?? '');
  return EXERCISES.find((e) => norm(e.name) === n || e.id === name)?.id ?? EXERCISES.find((e) => norm(e.name).includes(n) && n.length > 5)?.id;
}

const clampInt = (v: unknown, lo: number, hi: number) => (typeof v === 'number' && isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v))) : undefined);

export function resolveChanges(changes: ProposedChange[], program: Program, profile?: Profile): ResolvedChange[] {
  return changes.map((c) => {
    const day = program.days.find((d) => norm(d.name) === norm(c.day ?? ''));
    const fail = (error: string, summary: string): ResolvedChange => ({ raw: c, ok: false, error, summary, reason: c.reason });
    if (!day) return fail(`No day named “${c.day}” in your program.`, `${c.type} on ${c.day}`);
    const dayId = day.id;
    const inDay = (name: string) => {
      const id = findExerciseId(name);
      return id ? day.exercises.find((e) => e.exerciseId === id) : undefined;
    };
    const getDay = (p: Program) => p.days.find((d) => d.id === dayId)!;
    switch (c.type) {
      case 'swap': {
        const from = inDay(c.from);
        const toId = findExerciseId(c.to);
        if (!from) return fail(`“${c.from}” isn’t in ${day.name}.`, `Swap ${c.from} → ${c.to}`);
        if (!toId) return fail(`“${c.to}” isn’t in the exercise library.`, `Swap ${c.from} → ${c.to}`);
        if (profile && !hasEquipment(getExercise(toId), profile.equipment)) return fail(`You don’t have the equipment for ${getExercise(toId).name}.`, `Swap ${c.from} → ${c.to}`);
        return { raw: c, ok: true, reason: c.reason, summary: `${day.name}: ${getExercise(from.exerciseId).name} → ${getExercise(toId).name}`, apply: (p) => void (getDay(p).exercises.find((e) => e.id === from.id)!.exerciseId = toId) };
      }
      case 'sets': {
        const pe = inDay(c.exercise);
        if (!pe) return fail(`“${c.exercise}” isn’t in ${day.name}.`, `Change ${c.exercise}`);
        const sets = clampInt(c.sets, 1, 10) ?? pe.sets;
        const repMin = clampInt(c.repMin, 1, 50) ?? pe.repMin;
        const repMax = Math.max(repMin, clampInt(c.repMax, 1, 60) ?? pe.repMax);
        return { raw: c, ok: true, reason: c.reason, summary: `${day.name}: ${getExercise(pe.exerciseId).name} ${pe.sets}×${pe.repMin}–${pe.repMax} → ${sets}×${repMin}–${repMax}`, apply: (p) => void Object.assign(getDay(p).exercises.find((e) => e.id === pe.id)!, { sets, repMin, repMax }) };
      }
      case 'rest': {
        const pe = inDay(c.exercise);
        const restSec = clampInt(c.restSec, 20, 600);
        if (!pe || !restSec) return fail(`Couldn’t match “${c.exercise}” in ${day.name}.`, `Rest for ${c.exercise}`);
        return { raw: c, ok: true, reason: c.reason, summary: `${day.name}: ${getExercise(pe.exerciseId).name} rest ${pe.restSec}s → ${restSec}s`, apply: (p) => void (getDay(p).exercises.find((e) => e.id === pe.id)!.restSec = restSec) };
      }
      case 'remove': {
        const pe = inDay(c.exercise);
        if (!pe) return fail(`“${c.exercise}” isn’t in ${day.name}.`, `Remove ${c.exercise}`);
        return { raw: c, ok: true, reason: c.reason, summary: `${day.name}: remove ${getExercise(pe.exerciseId).name}`, apply: (p) => void (getDay(p).exercises = getDay(p).exercises.filter((e) => e.id !== pe.id)) };
      }
      case 'add': {
        const id = findExerciseId(c.exercise);
        if (!id) return fail(`“${c.exercise}” isn’t in the exercise library.`, `Add ${c.exercise}`);
        const def = getExercise(id);
        if (profile && !hasEquipment(def, profile.equipment)) return fail(`You don’t have the equipment for ${def.name}.`, `Add ${def.name}`);
        const sets = clampInt(c.sets, 1, 10) ?? 3;
        const repMin = clampInt(c.repMin, 1, 50) ?? 8;
        const repMax = Math.max(repMin, clampInt(c.repMax, 1, 60) ?? 12);
        const restSec = clampInt(c.restSec, 20, 600) ?? (def.compound ? 120 : 75);
        return {
          raw: c,
          ok: true,
          reason: c.reason,
          summary: `${day.name}: add ${def.name} ${sets}×${repMin}–${repMax}`,
          apply: (p) => void getDay(p).exercises.push({ id: Math.random().toString(36).slice(2, 12), exerciseId: id, sets, repMin, repMax, restSec, priority: def.compound ? 2 : 3, warmup: false }),
        };
      }
      default:
        return fail('Unknown change type.', String((c as { type?: string }).type));
    }
  });
}
