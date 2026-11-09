/**
 * Deterministic program generator. Chooses a split from the profile, fills each
 * day from movement-pattern slots, prescribes sets/reps/rest by goal and
 * experience, and trims accessories to fit the time available that day.
 */
import { EXERCISES, getExercise, hasEquipment } from '../data/exercises';
import { uid, WEEKDAYS_LONG } from '../lib/util';
import type { ExerciseDef, Muscle, Pattern, Profile, Program, ProgramDay, ProgramExercise, Weekday } from '../types';

interface Slot {
  patterns: Pattern[]; // first that yields a candidate wins
  priority: 1 | 2 | 3;
  muscle?: Muscle; // restrict candidates to this primary muscle
}
interface DayTemplate {
  key: string;
  name: string;
  focus: string;
  muscles: Muscle[];
  slots: Slot[];
}

const S = (patterns: Pattern[], priority: 1 | 2 | 3, muscle?: Muscle): Slot => ({ patterns, priority, muscle });

const T: Record<string, DayTemplate> = {
  fullA: { key: 'fullA', name: 'Full Body A', focus: 'Squat, press, row', muscles: ['quads', 'chest', 'back', 'hamstrings', 'shoulders'], slots: [S(['squat'], 1), S(['hPush'], 1, 'chest'), S(['hPull'], 1), S(['hinge'], 2), S(['lateral'], 3), S(['biceps'], 3), S(['core'], 3)] },
  fullB: { key: 'fullB', name: 'Full Body B', focus: 'Hinge, overhead, pull-down', muscles: ['hamstrings', 'shoulders', 'back', 'quads', 'chest'], slots: [S(['hinge'], 1), S(['vPush'], 1), S(['vPull'], 1), S(['lunge', 'squat'], 2), S(['fly', 'inclinePush'], 3), S(['triceps'], 3), S(['calf'], 3)] },
  fullC: { key: 'fullC', name: 'Full Body C', focus: 'Legs, incline, back', muscles: ['quads', 'chest', 'back', 'hamstrings', 'shoulders'], slots: [S(['squat'], 1), S(['inclinePush'], 1), S(['hPull', 'vPull'], 2), S(['kneeFlex', 'hinge'], 2), S(['rearDelt'], 3), S(['lateral'], 3), S(['triceps', 'biceps'], 3)] },
  upperA: { key: 'upperA', name: 'Upper A', focus: 'Chest, back, shoulders, arms', muscles: ['chest', 'back', 'shoulders', 'biceps', 'triceps'], slots: [S(['hPush'], 1, 'chest'), S(['hPull'], 1), S(['vPush'], 2), S(['vPull'], 2), S(['lateral'], 3), S(['biceps'], 3), S(['triceps'], 3)] },
  upperB: { key: 'upperB', name: 'Upper B', focus: 'Back, upper chest, delts, arms', muscles: ['back', 'chest', 'shoulders', 'biceps', 'triceps'], slots: [S(['vPull'], 1), S(['inclinePush'], 1), S(['hPull'], 2), S(['fly'], 3), S(['rearDelt'], 3), S(['triceps'], 3), S(['biceps'], 3)] },
  lowerA: { key: 'lowerA', name: 'Lower A', focus: 'Quads, glutes, hamstrings', muscles: ['quads', 'glutes', 'hamstrings', 'calves', 'abs'], slots: [S(['squat'], 1), S(['hinge'], 2), S(['lunge'], 2), S(['kneeFlex'], 3), S(['calf'], 3), S(['core'], 3)] },
  lowerB: { key: 'lowerB', name: 'Lower B', focus: 'Hamstrings, glutes, quads', muscles: ['hamstrings', 'glutes', 'quads', 'calves', 'abs'], slots: [S(['hinge'], 1), S(['squat'], 2), S(['glute'], 2), S(['kneeExt'], 3), S(['kneeFlex'], 3), S(['calf'], 3)] },
  push: { key: 'push', name: 'Push', focus: 'Chest, shoulders, triceps', muscles: ['chest', 'shoulders', 'triceps'], slots: [S(['hPush'], 1, 'chest'), S(['inclinePush'], 2), S(['vPush'], 2), S(['fly'], 3), S(['lateral'], 3), S(['triceps'], 3)] },
  pull: { key: 'pull', name: 'Pull', focus: 'Back, rear delts, biceps', muscles: ['back', 'shoulders', 'biceps'], slots: [S(['vPull'], 1), S(['hPull'], 1), S(['hPull', 'vPull'], 2), S(['rearDelt'], 3), S(['biceps'], 3), S(['biceps'], 3)] },
  legs: { key: 'legs', name: 'Legs', focus: 'Quads, hamstrings, glutes, calves', muscles: ['quads', 'hamstrings', 'glutes', 'calves', 'abs'], slots: [S(['squat'], 1), S(['hinge'], 2), S(['lunge', 'kneeExt'], 2), S(['kneeFlex'], 3), S(['calf'], 3), S(['core'], 3)] },
  chest: { key: 'chest', name: 'Chest', focus: 'Chest', muscles: ['chest', 'triceps'], slots: [S(['hPush'], 1, 'chest'), S(['inclinePush'], 1), S(['hPush'], 2, 'chest'), S(['fly'], 3), S(['fly'], 3)] },
  back: { key: 'back', name: 'Back', focus: 'Back', muscles: ['back', 'biceps'], slots: [S(['vPull'], 1), S(['hPull'], 1), S(['hPull'], 2), S(['vPull'], 2), S(['rearDelt'], 3)] },
  shoulders: { key: 'shoulders', name: 'Shoulders', focus: 'Delts & traps', muscles: ['shoulders'], slots: [S(['vPush'], 1), S(['lateral'], 2), S(['rearDelt'], 3), S(['lateral'], 3), S(['core'], 3)] },
  arms: { key: 'arms', name: 'Arms', focus: 'Biceps & triceps', muscles: ['biceps', 'triceps'], slots: [S(['hPush'], 1, 'triceps'), S(['biceps'], 2), S(['triceps'], 2), S(['biceps'], 3), S(['triceps'], 3), S(['biceps'], 3)] },
};

/**
 * Extra slots for an aesthetic (physique) goal: side delts and back width for a
 * V-taper, upper chest, and arms. They go right after the main lifts so time
 * trimming drops calves/core before these.
 */
const AESTHETIC_EXTRAS: Record<string, Slot[]> = {
  fullA: [S(['vPull'], 3)],
  fullB: [S(['lateral'], 3), S(['biceps'], 3)],
  fullC: [S(['biceps'], 3)],
  upperA: [S(['inclinePush', 'fly'], 3)],
  upperB: [S(['lateral'], 3)],
  push: [S(['lateral'], 3)],
  pull: [S(['lateral'], 3), S(['shrug'], 3)],
  shoulders: [S(['shrug'], 3)],
  arms: [S(['forearm'], 3)],
};

export const wantsAesthetic = (p: Profile) => p.goals.slice(0, 3).includes('physique');

export interface SplitChoice {
  name: string;
  days: string[]; // template keys in weekly order
  why: string;
}

export function chooseSplit(p: Profile): SplitChoice {
  const d = Math.max(1, Math.min(6, p.daysPerWeek));
  const pref = p.splitPref;
  const goal = p.goals[0] ?? 'general';

  const rotate = (keys: string[]) => Array.from({ length: d }, (_, i) => keys[i % keys.length]);

  if (pref === 'fullBody') return { name: 'Full Body', days: rotate(['fullA', 'fullB', 'fullC']), why: 'You asked for full-body training.' };
  if (pref === 'upperLower') return { name: 'Upper / Lower', days: rotate(['upperA', 'lowerA', 'upperB', 'lowerB']), why: 'You asked for an upper/lower split.' };
  if (pref === 'ppl') return { name: 'Push / Pull / Legs', days: rotate(['push', 'pull', 'legs']), why: 'You asked for push/pull/legs.' };
  if (pref === 'bro') return { name: 'Body-Part Split', days: rotate(['chest', 'back', 'legs', 'shoulders', 'arms']), why: 'You asked for a body-part split. Each muscle gets one hard session a week, so effort per session matters.' };

  if (d <= 3)
    return {
      name: 'Full Body',
      days: rotate(['fullA', 'fullB', 'fullC']),
      why: `With ${d} day${d > 1 ? 's' : ''} a week, full-body sessions let every major muscle get trained ${d > 1 ? `${d}× per week` : 'each week'} — frequency you'd lose with a split.`,
    };
  if (d === 4)
    return { name: 'Upper / Lower', days: ['upperA', 'lowerA', 'upperB', 'lowerB'], why: '4 days fits upper/lower perfectly: each muscle twice a week with room to recover between sessions.' };
  if (d === 5)
    return {
      name: 'Upper / Lower + Push / Pull / Legs',
      days: ['upperA', 'lowerA', 'push', 'pull', 'legs'],
      why: `5 days works well as a hybrid: upper/lower early in the week, push/pull/legs after. Most muscles are hit about twice a week${goal === 'strength' ? ' and the main lifts get practiced often' : ''}.`,
    };
  if (p.experience === 'beginner')
    return { name: 'Upper / Lower ×3', days: ['upperA', 'lowerA', 'upperB', 'lowerB', 'upperA', 'lowerA'], why: 'For a newer lifter training 6 days, alternating upper/lower keeps sessions shorter and recovery manageable.' };
  return { name: 'Push / Pull / Legs ×2', days: ['push', 'pull', 'legs', 'push', 'pull', 'legs'], why: '6 days with your experience suits push/pull/legs twice through — each muscle twice weekly with plenty of volume.' };
}

const DEFAULT_DAYS: Record<number, Weekday[]> = {
  1: [3],
  2: [1, 4],
  3: [1, 3, 5],
  4: [1, 2, 4, 5],
  5: [1, 2, 3, 5, 6],
  6: [1, 2, 3, 4, 5, 6],
};
const monFirst = (d: Weekday) => (d + 6) % 7;

export function chooseTrainingDays(p: Profile): Weekday[] {
  const n = Math.max(1, Math.min(6, p.daysPerWeek));
  const pref = [...new Set(p.preferredDays)].sort((a, b) => monFirst(a) - monFirst(b));
  if (pref.length === n) return pref;
  if (pref.length > n) {
    const step = pref.length / n;
    return Array.from({ length: n }, (_, i) => pref[Math.floor(i * step)]);
  }
  const out = [...pref];
  for (const d of [...DEFAULT_DAYS[n], 0, 1, 2, 3, 4, 5, 6] as Weekday[]) {
    if (out.length >= n) break;
    if (!out.includes(d)) out.push(d);
  }
  return out.sort((a, b) => monFirst(a) - monFirst(b));
}

interface Scheme {
  sets: number;
  repMin: number;
  repMax: number;
  rest: number;
}

export function schemeFor(p: Profile, priority: 1 | 2 | 3, ex: ExerciseDef): Scheme {
  const goal = p.goals[0] ?? 'general';
  let s: Scheme;
  if (goal === 'strength' || goal === 'athletic') {
    s = priority === 1 ? { sets: 4, repMin: 4, repMax: 6, rest: 180 } : priority === 2 ? { sets: 3, repMin: 6, repMax: 8, rest: 120 } : { sets: 3, repMin: 8, repMax: 12, rest: 75 };
  } else if (goal === 'endurance') {
    s = priority === 1 ? { sets: 3, repMin: 10, repMax: 15, rest: 90 } : priority === 2 ? { sets: 3, repMin: 12, repMax: 15, rest: 60 } : { sets: 2, repMin: 15, repMax: 20, rest: 45 };
  } else if (goal === 'muscle' || goal === 'physique') {
    s = priority === 1 ? { sets: 3, repMin: 6, repMax: 10, rest: 150 } : priority === 2 ? { sets: 3, repMin: 8, repMax: 12, rest: 120 } : { sets: 3, repMin: 10, repMax: 15, rest: 75 };
  } else {
    s = priority === 1 ? { sets: 3, repMin: 6, repMax: 10, rest: 120 } : priority === 2 ? { sets: 3, repMin: 8, repMax: 12, rest: 90 } : { sets: 2, repMin: 10, repMax: 15, rest: 60 };
  }
  // Strength as a secondary goal: keep main lifts a little heavier.
  if (priority === 1 && goal !== 'strength' && p.goals.slice(1, 3).includes('strength')) {
    s = { ...s, repMin: 5, repMax: 8 };
  }
  if (p.experience === 'advanced' && priority === 1) s.sets += 1;
  if (p.experience === 'beginner' && priority === 3) s.sets = Math.min(s.sets, 2);
  if (goal === 'maintain' && priority > 1) s.sets = Math.max(2, s.sets - 1);
  if (ex.increment === 0) {
    s = { ...s, repMin: Math.max(s.repMin, 8), repMax: Math.max(s.repMax, 15) };
  }
  if (ex.timed) s = { ...s, repMin: 30, repMax: 60 };
  if (ex.pattern === 'core' && ex.increment > 0) s = { ...s, repMin: 10, repMax: 15 };
  if (ex.pattern === 'calf') s = { ...s, repMin: Math.max(s.repMin, 8), repMax: Math.max(s.repMax, 15) };
  return s;
}

/** Candidate exercises for a slot, best first. */
export function candidatesFor(p: Profile, slot: { patterns: Pattern[]; muscle?: Muscle; priority: 1 | 2 | 3 }, used = new Set<string>()): ExerciseDef[] {
  for (const pattern of slot.patterns) {
    const scored = EXERCISES.map((ex, idx) => ({ ex, idx }))
      .filter(({ ex }) => !ex.archived && ex.pattern === pattern && (!slot.muscle || ex.muscle === slot.muscle))
      .filter(({ ex }) => hasEquipment(ex, p.equipment))
      .filter(({ ex }) => !p.cannotPerform.includes(ex.id))
      .filter(({ ex }) => !ex.stresses.some((s) => p.limitations.includes(s)))
      .map(({ ex, idx }) => ({ ex, score: scoreExercise(p, ex, slot.priority, used) - idx * 0.01 }))
      .sort((a, b) => b.score - a.score);
    if (scored.length) return scored.map((s) => s.ex);
  }
  return [];
}

function scoreExercise(p: Profile, ex: ExerciseDef, priority: number, used: Set<string>): number {
  let s = 0;
  if (p.favoriteExercises.includes(ex.id)) s += 30;
  if (p.dislikedExercises.includes(ex.id)) s -= 50;
  if (used.has(ex.id)) s -= 15;
  const eq = ex.equipment;
  const free = eq.includes('barbell') || eq.includes('dumbbell') || eq.includes('kettlebell');
  if (p.style === 'freeWeights' && free) s += 10;
  if (p.style === 'machines' && (eq.includes('machine') || eq.includes('smith'))) s += 10;
  if (p.style === 'cables' && eq.includes('cable')) s += 10;
  if (p.style === 'bodyweight' && ex.increment === 0) s += 10;
  // Loadable movements progress more measurably than bodyweight ones.
  if (ex.increment === 0 && p.style !== 'bodyweight') s -= 6;
  if (priority === 1) {
    if (ex.compound) s += 5;
    if ((p.goals[0] === 'strength' || p.goals[0] === 'athletic') && eq.includes('barbell')) s += 8;
    if (p.experience === 'beginner' && eq.includes('barbell') && ex.pattern === 'hinge') s -= 4;
  }
  return s;
}

const GENERAL_WARMUP_SEC = 300;
const TRANSITION_SEC = 60;
const WARMUP_SET_SEC = 75;

export function estimateMinutes(exercises: Pick<ProgramExercise, 'exerciseId' | 'sets' | 'restSec' | 'warmup'>[]): number {
  let sec = GENERAL_WARMUP_SEC;
  for (const pe of exercises) {
    const ex = getExercise(pe.exerciseId);
    sec += pe.sets * (ex.setSeconds ?? 40) + Math.max(0, pe.sets - 1) * pe.restSec + TRANSITION_SEC;
    if (pe.warmup) sec += 3 * WARMUP_SET_SEC;
  }
  return Math.round(sec / 60);
}

/** Trim a day to fit `minutes`: drop accessories from the end, then trim sets. */
export function fitToTime(list: ProgramExercise[], minutes: number): { exercises: ProgramExercise[]; removed: string[]; trimmed: boolean } {
  let out = list.map((e) => ({ ...e }));
  const removed: string[] = [];
  let trimmed = false;
  const fits = () => estimateMinutes(out) <= minutes;
  while (!fits()) {
    const idx = findLastIndex(out, (e) => e.priority === 3);
    if (idx < 0) break;
    removed.push(out[idx].exerciseId);
    out.splice(idx, 1);
  }
  for (const pr of [2, 1] as const) {
    let changed = true;
    while (!fits() && changed) {
      changed = false;
      for (let i = out.length - 1; i >= 0 && !fits(); i--) {
        if (out[i].priority === pr && out[i].sets > 2) {
          out[i].sets -= 1;
          trimmed = changed = true;
        }
      }
    }
  }
  while (!fits() && out.length > 2) {
    const idx = findLastIndex(out, (e) => e.priority === 2);
    if (idx < 0) break;
    removed.push(out[idx].exerciseId);
    out.splice(idx, 1);
  }
  out = out.map((e) => ({ ...e }));
  return { exercises: out, removed, trimmed };
}

function findLastIndex<T>(xs: T[], f: (x: T) => boolean) {
  for (let i = xs.length - 1; i >= 0; i--) if (f(xs[i])) return i;
  return -1;
}

export function buildDay(p: Profile, tpl: DayTemplate, minutes: number, used: Set<string>, suffix = ''): { day: ProgramDay; notes: string[] } {
  const exercises: ProgramExercise[] = [];
  const notes: string[] = [];
  const inDay = new Set<string>();
  let slots = tpl.slots;
  const extras = wantsAesthetic(p) ? AESTHETIC_EXTRAS[tpl.key] ?? [] : [];
  if (extras.length) {
    const firstAccessory = slots.findIndex((x) => x.priority === 3);
    const at = firstAccessory < 0 ? slots.length : firstAccessory;
    slots = [...slots.slice(0, at), ...extras, ...slots.slice(at)];
  }
  for (const slot of slots) {
    const cands = candidatesFor(p, slot, used).filter((c) => !inDay.has(c.id));
    const ex = cands[0];
    if (!ex) continue;
    inDay.add(ex.id);
    used.add(ex.id);
    const s = schemeFor(p, slot.priority, ex);
    exercises.push({
      id: uid(),
      exerciseId: ex.id,
      sets: s.sets,
      repMin: s.repMin,
      repMax: s.repMax,
      restSec: s.rest,
      priority: slot.priority,
      warmup: slot.priority === 1 && ex.increment > 0,
    });
  }
  const fit = fitToTime(exercises, minutes);
  if (fit.removed.length || fit.trimmed) {
    notes.push(
      `${tpl.name}${suffix}: trimmed to fit ${minutes} min${fit.removed.length ? ` (dropped ${fit.removed.map((id) => getExercise(id).name).join(', ')})` : ''}${fit.trimmed ? '; fewer sets on some lifts' : ''}.`,
    );
  }
  return {
    day: { id: uid(), name: tpl.name + suffix, focus: tpl.focus, muscles: tpl.muscles, exercises: fit.exercises },
    notes,
  };
}

export function generateProgram(p: Profile): Program {
  const split = chooseSplit(p);
  const trainingDays = chooseTrainingDays(p);
  const used = new Set<string>();
  const days: ProgramDay[] = [];
  const notes: string[] = [];
  const schedule = { 0: null, 1: null, 2: null, 3: null, 4: null, 5: null, 6: null } as Record<Weekday, string | null>;
  const seen: Record<string, number> = {};

  split.days.forEach((key, i) => {
    const wd = trainingDays[i];
    const minutes = p.minutesByDay?.[wd] ?? p.sessionMinutes;
    seen[key] = (seen[key] ?? 0) + 1;
    const suffix = seen[key] > 1 ? ` ${seen[key]}` : '';
    const { day, notes: n } = buildDay(p, T[key], minutes, used, suffix);
    days.push(day);
    notes.push(...n);
    schedule[wd] = day.id;
  });

  const goal = p.goals[0] ?? 'general';
  const goalLine: Record<string, string> = {
    strength: 'Main lifts use heavier sets of 4–6 with longer rest; accessories stay in moderate rep ranges to build supporting muscle.',
    athletic: 'Main lifts are heavy and low-rep to build force; accessories support balanced, durable joints.',
    muscle: 'Rep ranges sit mostly between 6 and 15, where muscle growth is well supported, with enough sets per muscle each week.',
    physique: 'Built for an aesthetic physique: rep ranges mostly 6–15, plus extra side-delt, back-width, upper-chest and arm work for a V-taper look.',
    fatLoss: 'Training stays heavy enough to keep the muscle you have while you lose fat; diet does most of the fat-loss work.',
    endurance: 'Higher reps and shorter rests build muscular endurance.',
    general: 'Balanced moderate rep ranges build strength and fitness without excessive fatigue.',
    maintain: 'Slightly lower volume keeps your current strength and size with less time and fatigue.',
  };

  const rationale = [
    split.why,
    `Training days: ${trainingDays.map((d) => WEEKDAYS_LONG[d]).join(', ')}.`,
    goalLine[goal],
    goal !== 'physique' && wantsAesthetic(p) ? 'Because an aesthetic physique is one of your goals, extra side-delt, back-width, upper-chest and arm work is added after the main lifts.' : '',
    goal !== 'strength' && p.goals.slice(1, 3).includes('strength') ? 'Strength is also a goal, so your main lifts use heavier sets of 5–8.' : '',
    'Progression uses double progression: stay at a weight until every set reaches the top of the rep range, then add the smallest jump. You confirm every weight increase.',
    p.limitations.length ? `Exercises that load your ${p.limitations.join(', ').replace('lowBack', 'lower back')} were filtered out. This isn't medical advice — follow your clinician's guidance.` : '',
    ...notes,
  ].filter(Boolean);

  return {
    id: uid(),
    name: split.name,
    split: split.name,
    rationale,
    createdAt: new Date().toISOString(),
    status: 'draft',
    days,
    schedule,
  };
}

export { T as DAY_TEMPLATES };
