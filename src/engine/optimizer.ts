/**
 * OPTIMIZE MY WORKOUT — deterministic restructuring of a scheduled day for the
 * time available and how the user feels. Never mutates the program; returns a
 * one-off day plus a plain-language list of what changed and why.
 */
import { getExercise, MUSCLE_LABEL } from '../data/exercises';
import type { Muscle, Profile, ProgramDay, ProgramExercise } from '../types';
import { candidatesFor, estimateMinutes } from './generator';

export type Feeling = 'great' | 'normal' | 'tired' | 'poorSleep' | 'lowEnergy' | 'sore';

export interface OptimizeInput {
  day: ProgramDay;
  minutes?: number; // undefined = no time limit
  feeling: Feeling;
  soreMuscles?: Muscle[];
  profile?: Profile;
}

export interface OptimizeResult {
  day: ProgramDay;
  changes: string[];
  before: { minutes: number; sets: number; exercises: number };
  after: { minutes: number; sets: number; exercises: number };
  stimulusNote: string;
  changed: boolean;
}

const totalSets = (xs: ProgramExercise[]) => xs.reduce((a, e) => a + e.sets, 0);
const LOW: Feeling[] = ['tired', 'poorSleep', 'lowEnergy'];
const FEEL_LABEL: Record<Feeling, string> = { great: 'feeling great', normal: 'feeling normal', tired: 'tired', poorSleep: 'poor sleep', lowEnergy: 'low energy', sore: 'sore' };

export function optimizeDay({ day, minutes, feeling, soreMuscles = [], profile }: OptimizeInput): OptimizeResult {
  let xs = day.exercises.map((e) => ({ ...e }));
  const changes: string[] = [];
  const before = { minutes: estimateMinutes(xs), sets: totalSets(xs), exercises: xs.length };
  const name = (e: ProgramExercise) => getExercise(e.exerciseId).name;
  const fits = () => minutes === undefined || estimateMinutes(xs) <= minutes;

  // 1 ─ Readiness
  if (LOW.includes(feeling)) {
    const cut: string[] = [];
    for (const e of xs) if (e.priority > 1 && e.sets > 2) { e.sets -= 1; cut.push(name(e)); }
    if (cut.length) changes.push(`Because you reported ${FEEL_LABEL[feeling]}, I removed one set from accessory and secondary lifts (${cut.join(', ')}). Main lifts keep their sets; targets will match last session rather than push for more.`);
  }
  if (feeling === 'sore' && soreMuscles.length) {
    const removed: string[] = [];
    const reduced: string[] = [];
    xs = xs.filter((e) => {
      const m = getExercise(e.exerciseId).muscle;
      if (!soreMuscles.includes(m)) return true;
      if (e.priority === 3) { removed.push(name(e)); return false; }
      if (e.sets > 2) { e.sets -= 1; reduced.push(name(e)); }
      return true;
    });
    if (removed.length) changes.push(`Dropped ${removed.join(', ')} because you’re sore in ${soreMuscles.map((m) => MUSCLE_LABEL[m].toLowerCase()).join(', ')} — extra isolation work there adds fatigue without much benefit today.`);
    if (reduced.length) changes.push(`One fewer set on ${reduced.join(', ')} while sore. Use a weight you can move with clean technique; stop if anything feels sharp rather than just tight.`);
  }
  if (feeling === 'great' && fits()) changes.push('Feeling great: the plan already includes progression where your history supports it, so nothing extra was added — junk volume doesn’t help.');

  // 2 ─ Time
  if (!fits()) {
    // a. Shorter rests on accessories/secondary
    const rested: string[] = [];
    for (const e of xs) {
      const cap = e.priority === 3 ? 60 : e.priority === 2 ? 90 : e.restSec;
      if (e.restSec > cap) { e.restSec = cap; rested.push(name(e)); }
    }
    if (rested.length) changes.push(`Shortened rest to 60–90 s on ${rested.join(', ')}. Main lifts keep full rest so their quality doesn’t drop.`);
  }
  if (!fits()) {
    // b. Drop redundant accessories first (muscle already trained by another exercise today), then from the end
    const dropped: string[] = [];
    const redundant = (e: ProgramExercise) => {
      const m = getExercise(e.exerciseId).muscle;
      return xs.some((o) => o !== e && (getExercise(o.exerciseId).muscle === m || getExercise(o.exerciseId).secondary.includes(m)));
    };
    for (const pass of [true, false]) {
      for (let i = xs.length - 1; i >= 0 && !fits(); i--) {
        if (xs[i].priority === 3 && (!pass || redundant(xs[i]))) { dropped.push(name(xs[i])); xs.splice(i, 1); }
      }
    }
    if (dropped.length) changes.push(`Removed accessories: ${dropped.join(', ')}. ${dropped.length > 1 ? 'These' : 'This'} had the lowest priority today, and muscles already worked by other lifts were cut first.`);
  }
  if (!fits()) {
    // c. Trim sets on secondary, then main lifts (never below 2)
    const trimmed: string[] = [];
    for (const pr of [2, 1] as const) {
      let progress = true;
      while (!fits() && progress) {
        progress = false;
        for (let i = xs.length - 1; i >= 0 && !fits(); i--) {
          if (xs[i].priority === pr && xs[i].sets > 2) { xs[i].sets -= 1; progress = true; if (!trimmed.includes(name(xs[i]))) trimmed.push(name(xs[i])); }
        }
      }
    }
    if (trimmed.length) changes.push(`Cut sets on ${trimmed.join(', ')} (minimum 2 working sets each). Fewer hard sets still maintain progress well short-term.`);
  }
  if (!fits() && minutes !== undefined && minutes <= 35) {
    // d. Faster-setup substitutions for barbell secondary lifts
    const subs: string[] = [];
    for (const e of xs) {
      const def = getExercise(e.exerciseId);
      if (e.priority !== 2 || !def.equipment.includes('barbell') || !profile) continue;
      const alt = candidatesFor({ ...profile, style: 'machines' }, { patterns: [def.pattern], priority: 2 }).find((c) => !c.equipment.includes('barbell') && c.id !== def.id);
      if (alt) { subs.push(`${def.name} → ${alt.name}`); e.exerciseId = alt.id; e.warmup = false; }
    }
    if (subs.length) changes.push(`Swapped to quicker-setup options: ${subs.join(', ')}. Less time loading plates; similar muscles worked.`);
  }
  if (!fits()) {
    // e. Drop secondary lifts, keeping main lifts
    const dropped: string[] = [];
    for (let i = xs.length - 1; i >= 0 && !fits(); i--) {
      if (xs[i].priority === 2 && xs.filter((x) => x.priority <= 2).length > 1) { dropped.push(name(xs[i])); xs.splice(i, 1); }
    }
    if (dropped.length) changes.push(`Removed secondary lifts: ${dropped.join(', ')} to protect your main compound movements.`);
  }
  if (!fits()) {
    // f. Last resort: keep the top movements only
    const mains = xs.filter((x) => x.priority === 1);
    while (!fits() && xs.length > 1) {
      const removed = xs.pop()!;
      changes.push(`Removed ${name(removed)} — there isn’t time for it with proper warm-ups.`);
    }
    if (!fits() && mains.length) {
      for (const e of xs) e.warmup = false;
      changes.push('Do 1–2 quick ramp-up sets on your own instead of full warm-up sets.');
    }
  }

  const after = { minutes: estimateMinutes(xs), sets: totalSets(xs), exercises: xs.length };
  const lostMuscles = day.muscles.filter((m) => !xs.some((e) => getExercise(e.exerciseId).muscle === m || getExercise(e.exerciseId).secondary.includes(m)));
  const pct = before.sets ? Math.round((after.sets / before.sets) * 100) : 100;
  const changed = changes.length > 0 && (after.sets !== before.sets || after.exercises !== before.exercises || JSON.stringify(xs) !== JSON.stringify(day.exercises));

  let stimulusNote: string;
  if (!changed) stimulusNote = minutes !== undefined && before.minutes <= minutes ? `Your full workout fits in ${minutes} min (about ${before.minutes} min). No changes needed.` : 'No changes needed.';
  else if (pct >= 90) stimulusNote = `Keeps ${after.sets} of ${before.sets} working sets — very close to the full session.`;
  else
    stimulusNote = `Keeps ${after.sets} of ${before.sets} working sets (${pct}%). It’s a worthwhile session that protects your most important lifts, but it isn’t the same training stimulus as the full workout${lostMuscles.length ? ` — ${lostMuscles.map((m) => MUSCLE_LABEL[m].toLowerCase()).join(', ')} get little or no direct work today` : ''}. If this happens often, consider a program built for shorter sessions.`;

  if (minutes !== undefined && after.minutes > minutes) changes.push(`Even trimmed, this needs about ${after.minutes} min. Move briskly between sets or do what you can — partial sessions still count.`);

  return { day: { ...day, exercises: xs }, changes: changed ? changes : changes.filter((c) => c.startsWith('Feeling great')), before, after, stimulusNote, changed };
}
