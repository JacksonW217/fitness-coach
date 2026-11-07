import { describe, expect, it } from 'vitest';
import { buildSession } from '../lib/data';
import type { CheckIn, Profile, Session } from '../types';
import { analyzeProgram, applyAction, autoAllowed, DEFAULT_ADAPT } from './adaptation';
import { generateProgram } from './generator';
import { calculateTargets } from './nutrition';
import { readinessScore, suggestedFeeling } from './recovery';

const profile: Profile = {
  id: 'me', createdAt: '', updatedAt: '', age: 30, heightIn: 70, weightLbs: 180, sex: 'male', goals: ['muscle'], experience: 'intermediate', trainingYears: 3,
  daysPerWeek: 4, preferredDays: [1, 2, 4, 5], sessionMinutes: 60, scheduledRest: true, splitPref: 'auto', location: 'commercial',
  equipment: ['barbell', 'rack', 'bench', 'dumbbell', 'cable', 'machine', 'smith', 'pullupBar', 'bodyweight'],
  favoriteExercises: [], dislikedExercises: [], cannotPerform: [], style: 'mixed', limitations: [], nutritionGoal: 'gain', trackMacros: true,
  sleepHours: 7, recovery: 3, stress: 3, outsideActivity: 'light',
};
const NOW = new Date('2026-11-07T12:00:00');
const program = { ...generateProgram(profile), status: 'active' as const, createdAt: '2026-10-01T00:00:00.000Z' };

/** Sessions that train only the first exercise of each day, with flat performance. */
function flatSessions(weeks: number, perWeek = 4): Session[] {
  const out: Session[] = [];
  for (let w = weeks; w >= 1; w--)
    for (let k = 0; k < perWeek; k++) {
      const day = program.days[k % program.days.length];
      const pe = day.exercises[0];
      const d = new Date(NOW.getTime() - (w * 7 - k * 1.5) * 86400000);
      out.push({
        id: `s${w}${k}`, programId: program.id, dayId: day.id, dayName: day.name, startedAt: d.toISOString(), status: 'done', pausedMs: 0,
        exercises: [{ id: 'e', exerciseId: pe.exerciseId, repMin: pe.repMin, repMax: pe.repMax, restSec: 120, sets: [0, 1, 2].map((i) => ({ id: `${i}`, kind: 'work' as const, weight: 135, reps: 6, status: 'done' as const })) }],
      });
    }
  return out;
}

describe('adaptation', () => {
  it('stays locked until there is enough data', () => {
    const r = analyzeProgram({ profile, program, sessions: flatSessions(1, 2), weights: [], checkins: [], food: [], records: [], now: NOW });
    expect(r.locked).toBeTruthy();
    expect(r.proposals).toHaveLength(0);
  });

  it('flags low volume and stalled lifts with evidence', () => {
    const r = analyzeProgram({ profile, program, sessions: flatSessions(5), weights: [], checkins: [], food: [], records: [], now: NOW });
    expect(r.locked).toBeUndefined();
    const vol = r.proposals.find((p) => p.category === 'volume');
    expect(vol?.evidence).toMatch(/hard sets\/week/);
    expect(r.proposals.some((p) => p.category === 'repRange')).toBe(true);
  });

  it('respects dismissals', () => {
    const first = analyzeProgram({ profile, program, sessions: flatSessions(5), weights: [], checkins: [], food: [], records: [], now: NOW });
    expect(first.proposals.length).toBeLessThanOrEqual(4);
    const records = first.proposals.map((p) => ({ key: p.key, status: 'dismissed' as const, at: NOW.toISOString() }));
    const again = analyzeProgram({ profile, program, sessions: flatSessions(5), weights: [], checkins: [], food: [], records, now: NOW });
    const dismissed = new Set(records.map((r) => r.key));
    expect(again.proposals.some((p) => dismissed.has(p.key))).toBe(false);
    // After the 14-day cooldown they may return.
    const later = analyzeProgram({ profile, program, sessions: flatSessions(5), weights: [], checkins: [], food: [], records, now: new Date(NOW.getTime() + 15 * 86400000) });
    expect(later.proposals.length + later.more).toBeGreaterThan(0);
  });

  it('suggests fewer days when consistency is poor, and never auto-applies it', () => {
    const r = analyzeProgram({ profile, program, sessions: flatSessions(5, 2), weights: [], checkins: [], food: [], records: [], now: NOW });
    const s = r.proposals.find((p) => p.category === 'structure');
    expect(s).toBeTruthy();
    expect(autoAllowed(s!, { ...DEFAULT_ADAPT, mode: 'auto', autoCategories: ['structure', 'volume'] })).toBe(false);
  });

  it('auto mode honours categories and bounds', () => {
    const r = analyzeProgram({ profile, program, sessions: flatSessions(5), weights: [], checkins: [], food: [], records: [], now: NOW });
    const vol = r.proposals.find((p) => p.category === 'volume')!;
    expect(autoAllowed(vol, DEFAULT_ADAPT)).toBe(false); // recommend mode
    expect(autoAllowed(vol, { ...DEFAULT_ADAPT, mode: 'auto', autoCategories: ['volume'] })).toBe(true);
    expect(autoAllowed(vol, { ...DEFAULT_ADAPT, mode: 'auto', autoCategories: ['volume'], maxSetDelta: 0 })).toBe(false);
  });

  it('applies actions without mutating inputs', () => {
    const before = JSON.stringify(program);
    const pe = program.days[0].exercises[0];
    const { program: p2 } = applyAction(program, profile, { kind: 'setDelta', dayId: program.days[0].id, peId: pe.id, delta: 1 });
    expect(p2.days[0].exercises[0].sets).toBe(pe.sets + 1);
    expect(JSON.stringify(program)).toBe(before);
    const { profile: pr2 } = applyAction(program, profile, { kind: 'calories', delta: -150 });
    expect(pr2.nutritionTargets!.kcal).toBe(calculateTargets(profile).kcal - 150);
  });
});

describe('deload sessions', () => {
  it('cuts sets and load, and are excluded from history', () => {
    const hist = flatSessions(2);
    const day = program.days[0];
    const s = buildSession(day, program.id, hist, 'normal', true);
    expect(s.deload).toBe(true);
    const work = s.exercises[0].sets.filter((x) => x.kind === 'work');
    expect(work.length).toBeLessThan(day.exercises[0].sets);
    expect(work[0].targetWeight).toBe(120); // 135 × 0.9 → 121.5 → 120
  });
});

describe('nutrition & recovery', () => {
  it('computes sensible targets', () => {
    const t = calculateTargets(profile);
    expect(t.kcal).toBeGreaterThan(2400);
    expect(t.kcal).toBeLessThan(3400);
    expect(t.protein).toBe(145);
    expect(Math.abs(t.protein * 4 + t.fat * 9 + t.carbs * 4 - t.kcal)).toBeLessThan(25);
    expect(calculateTargets({ ...profile, nutritionGoal: 'lose' }).kcal).toBeLessThan(t.kcal);
  });

  it('scores readiness and maps it to a workout feeling', () => {
    const good: CheckIn = { id: 'a', date: '2026-11-07', sleepHours: 8, sleepQuality: 5, energy: 5, soreness: 1, stress: 1 };
    const bad: CheckIn = { ...good, sleepHours: 5, sleepQuality: 2, energy: 2 };
    expect(readinessScore(good)).toBe(100);
    expect(readinessScore(bad)).toBeLessThan(60);
    expect(suggestedFeeling(good)).toBe('great');
    expect(suggestedFeeling(bad)).toBe('poorSleep');
    expect(suggestedFeeling({ ...good, soreness: 5 })).toBe('sore');
  });
});
