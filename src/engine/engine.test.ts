import { describe, expect, it } from 'vitest';
import { getExercise } from '../data/exercises';
import type { Profile } from '../types';
import { chooseSplit, chooseTrainingDays, estimateMinutes, generateProgram } from './generator';
import { analyzeTrend, recommend, warmupSets, type Exposure } from './progression';

const bench = getExercise('bench-press');
const rx = { sets: 3, repMin: 8, repMax: 12 };
const ex = (date: string, w: number, reps: number[], rpe?: number): Exposure => ({
  sessionId: date,
  date,
  repMin: 8,
  repMax: 12,
  sets: reps.map((r) => ({ weight: w, reps: r, rpe })),
});

describe('progression', () => {
  it('never invents a weight without history', () => {
    const r = recommend(bench, rx, []);
    expect(r.kind).toBe('start');
    expect(r.targets.every((t) => t.weight === undefined)).toBe(true);
  });

  it('adds a rep per set when below the top of the range', () => {
    const r = recommend(bench, rx, [ex('2026-01-08', 135, [10, 9, 8])]);
    expect(r.kind).toBe('repsUp');
    expect(r.targets).toEqual([
      { weight: 135, reps: 11 },
      { weight: 135, reps: 10 },
      { weight: 135, reps: 9 },
    ]);
  });

  it('recommends the smallest jump when all sets hit the top, and requires confirmation', () => {
    const r = recommend(bench, rx, [ex('2026-01-08', 135, [12, 12, 12], 8)]);
    expect(r.kind).toBe('increase');
    expect(r.suggestedWeight).toBe(140);
    expect(r.needsConfirm).toBe(true);
    expect(r.targets[0]).toEqual({ weight: 140, reps: 8 });
  });

  it('holds the weight when top-of-range effort was maximal', () => {
    expect(recommend(bench, rx, [ex('2026-01-08', 135, [12, 12, 12], 10)]).kind).toBe('hold');
  });

  it('holds on low readiness instead of increasing', () => {
    expect(recommend(bench, rx, [ex('2026-01-08', 135, [12, 12, 12])], 'low').kind).toBe('hold');
  });

  it('suggests a reset after two sessions of misses at the same load', () => {
    const r = recommend(bench, rx, [ex('2026-01-15', 155, [8, 7, 6]), ex('2026-01-08', 155, [8, 7, 7])]);
    expect(r.kind).toBe('deload');
    expect(r.suggestedWeight).toBe(140);
  });

  it('does not call a plateau on one bad day', () => {
    const h = [ex('2026-01-15', 135, [8, 8, 7]), ex('2026-01-08', 135, [10, 10, 9])];
    expect(analyzeTrend(h).trend).not.toBe('stalled');
  });

  it('detects a stall over enough sessions', () => {
    const h = [
      ex('2026-02-05', 135, [10, 10, 9]),
      ex('2026-01-29', 135, [10, 10, 10]),
      ex('2026-01-22', 135, [10, 9, 9]),
      ex('2026-01-15', 135, [10, 10, 10]),
      ex('2026-01-08', 135, [9, 9, 8]),
    ];
    expect(analyzeTrend(h).trend).toBe('stalled');
  });

  it('builds sensible barbell warm-ups', () => {
    const w = warmupSets(bench, 185);
    expect(w[0]).toEqual({ weight: 45, reps: 10 });
    expect(w.every((s) => (s.weight ?? 0) < 185)).toBe(true);
    expect(warmupSets(bench, undefined)).toEqual([]);
  });
});

const base: Profile = {
  id: 'me',
  createdAt: '',
  updatedAt: '',
  age: 28,
  heightIn: 70,
  weightLbs: 175,
  goals: ['muscle'],
  experience: 'intermediate',
  trainingYears: 2,
  daysPerWeek: 4,
  preferredDays: [1, 2, 4, 5],
  sessionMinutes: 60,
  scheduledRest: true,
  splitPref: 'auto',
  location: 'commercial',
  equipment: ['barbell', 'rack', 'bench', 'dumbbell', 'cable', 'machine', 'smith', 'pullupBar', 'dipStation', 'bodyweight'],
  favoriteExercises: [],
  dislikedExercises: [],
  cannotPerform: [],
  style: 'mixed',
  limitations: [],
  nutritionGoal: 'gain',
  trackMacros: false,
  sleepHours: 7,
  recovery: 3,
  stress: 3,
  outsideActivity: 'light',
};

describe('generator', () => {
  it('picks splits from days per week', () => {
    expect(chooseSplit({ ...base, daysPerWeek: 3 }).name).toBe('Full Body');
    expect(chooseSplit(base).name).toBe('Upper / Lower');
    expect(chooseSplit({ ...base, daysPerWeek: 6 }).name).toContain('Push / Pull / Legs');
    expect(chooseSplit({ ...base, splitPref: 'ppl', daysPerWeek: 3 }).name).toBe('Push / Pull / Legs');
  });

  it('uses preferred days and fills gaps', () => {
    expect(chooseTrainingDays({ ...base, daysPerWeek: 3, preferredDays: [] })).toEqual([1, 3, 5]);
    expect(chooseTrainingDays({ ...base, daysPerWeek: 3, preferredDays: [6] })).toHaveLength(3);
  });

  it('fits every day into the time available', () => {
    const p = generateProgram({ ...base, sessionMinutes: 45 });
    for (const d of p.days) expect(estimateMinutes(d.exercises)).toBeLessThanOrEqual(45);
    expect(Object.values(p.schedule).filter(Boolean)).toHaveLength(4);
  });

  it('respects equipment, limitations and exclusions', () => {
    const p = generateProgram({
      ...base,
      equipment: ['dumbbell', 'bench', 'bodyweight'],
      limitations: ['lowBack'],
      cannotPerform: ['db-bench'],
    });
    const ids = p.days.flatMap((d) => d.exercises.map((e) => e.exerciseId));
    for (const id of ids) {
      const def = getExercise(id);
      expect(def.equipment.every((e) => ['dumbbell', 'bench', 'bodyweight'].includes(e))).toBe(true);
      expect(def.stresses).not.toContain('lowBack');
    }
    expect(ids).not.toContain('db-bench');
  });

  it('prefers favorites', () => {
    const p = generateProgram({ ...base, favoriteExercises: ['hack-squat'] });
    expect(p.days.flatMap((d) => d.exercises.map((e) => e.exerciseId))).toContain('hack-squat');
  });
});
