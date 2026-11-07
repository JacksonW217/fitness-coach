import { describe, expect, it } from 'vitest';
import type { Profile, Session } from '../types';
import { buildCoachPrompt, extractChanges, resolveChanges } from './coach';
import { estimateMinutes, generateProgram } from './generator';
import { optimizeDay } from './optimizer';

const profile: Profile = {
  id: 'me', createdAt: '2026-01-01', updatedAt: '', age: 24, heightIn: 71, weightLbs: 180, goals: ['muscle'], experience: 'intermediate', trainingYears: 2,
  daysPerWeek: 4, preferredDays: [1, 2, 4, 5], sessionMinutes: 75, scheduledRest: true, splitPref: 'auto', location: 'commercial',
  equipment: ['barbell', 'rack', 'bench', 'dumbbell', 'cable', 'machine', 'smith', 'pullupBar', 'bodyweight'],
  favoriteExercises: [], dislikedExercises: [], cannotPerform: [], style: 'mixed', limitations: [], nutritionGoal: 'gain', trackMacros: false,
  sleepHours: 7, recovery: 3, stress: 3, outsideActivity: 'light',
};
const program = generateProgram(profile);
const upper = program.days[0];

describe('optimizer', () => {
  it('leaves the workout alone when it fits and you feel normal', () => {
    const r = optimizeDay({ day: upper, minutes: 120, feeling: 'normal', profile });
    expect(r.changed).toBe(false);
    expect(r.day.exercises).toEqual(upper.exercises);
  });

  it('fits a 35-minute window, keeps the main lifts and explains itself', () => {
    const r = optimizeDay({ day: upper, minutes: 35, feeling: 'normal', profile });
    expect(r.changed).toBe(true);
    expect(estimateMinutes(r.day.exercises)).toBeLessThanOrEqual(35);
    const mains = upper.exercises.filter((e) => e.priority === 1).map((e) => e.exerciseId);
    for (const m of mains) expect(r.day.exercises.map((e) => e.exerciseId)).toContain(m);
    expect(r.changes.length).toBeGreaterThan(0);
    expect(r.stimulusNote).toMatch(/isn’t the same training stimulus/);
  });

  it('never mutates the original program day', () => {
    const snapshot = JSON.stringify(upper);
    optimizeDay({ day: upper, minutes: 20, feeling: 'tired', profile });
    expect(JSON.stringify(upper)).toBe(snapshot);
  });

  it('reduces accessory volume on low readiness', () => {
    const r = optimizeDay({ day: upper, feeling: 'poorSleep', profile });
    expect(r.after.sets).toBeLessThan(r.before.sets);
    const main = r.day.exercises.find((e) => e.priority === 1)!;
    expect(main.sets).toBe(upper.exercises.find((e) => e.id === main.id)!.sets);
  });

  it('drops isolation work for sore muscles', () => {
    const r = optimizeDay({ day: upper, feeling: 'sore', soreMuscles: ['biceps'], profile });
    expect(r.day.exercises.some((e) => e.exerciseId.includes('curl'))).toBe(false);
  });
});

describe('coach bridge', () => {
  it('builds a prompt from real data only', () => {
    const s: Session = {
      id: 's1', dayId: upper.id, dayName: upper.name, startedAt: '2026-11-02T17:00:00Z', endedAt: '2026-11-02T18:00:00Z', status: 'done', pausedMs: 0,
      exercises: [{ id: 'e', exerciseId: 'bench-press', repMin: 6, repMax: 10, restSec: 150, sets: [{ id: 'a', kind: 'work', weight: 185, reps: 8, rpe: 8, status: 'done' }] }],
    };
    const txt = buildCoachPrompt({ question: 'How is my bench?', profile, program, sessions: [s], weights: [], measurements: [], notes: [], now: new Date('2026-11-07') });
    expect(txt).toContain('185×8@8');
    expect(txt).toContain('How is my bench?');
    expect(txt).toContain('No weigh-ins logged');
  });

  it('extracts and validates proposed changes', () => {
    const reply = `Here's my take.\n\n\`\`\`forge-changes\n{"changes":[{"type":"sets","day":"${upper.name}","exercise":"Lat Pulldown","sets":4,"repMin":8,"repMax":12,"reason":"more back volume"},{"type":"swap","day":"Nope","from":"X","to":"Y"},{"type":"add","day":"${upper.name}","exercise":"Face Pull","sets":3,"repMin":12,"repMax":15}]}\n\`\`\``;
    const ch = extractChanges(reply)!;
    expect(ch).toHaveLength(3);
    const r = resolveChanges(ch, program, profile);
    expect(r[0].ok).toBe(true);
    expect(r[1].ok).toBe(false);
    expect(r[2].ok).toBe(true);
    const p = structuredClone(program);
    r[0].apply!(p);
    r[2].apply!(p);
    const d = p.days[0];
    expect(d.exercises.find((e) => e.exerciseId === 'lat-pulldown')?.sets).toBe(4);
    expect(d.exercises.some((e) => e.exerciseId === 'face-pull')).toBe(true);
    expect(program.days[0].exercises.some((e) => e.exerciseId === 'face-pull')).toBe(false);
  });

  it('returns null when there is no change block', () => {
    expect(extractChanges('Just keep going, you are doing great.')).toBeNull();
  });
});
