import { describe, expect, it } from 'vitest';
import { EXERCISES, getExercise, registerCustomExercises } from '../data/exercises';
import type { ExerciseDef, Profile } from '../types';
import { buildCoachPrompt, findExerciseId } from './coach';
import { candidatesFor, generateProgram, schemeFor } from './generator';
import { recommend } from './progression';

const base: Profile = {
  id: 'me', createdAt: '', updatedAt: '', age: 22, heightIn: 70, weightLbs: 170, goals: ['muscle', 'strength', 'physique'],
  experience: 'intermediate', trainingYears: 2, daysPerWeek: 4, preferredDays: [1, 2, 4, 5], sessionMinutes: 75, scheduledRest: true,
  splitPref: 'auto', location: 'commercial', equipment: ['barbell', 'rack', 'bench', 'dumbbell', 'cable', 'machine', 'smith', 'pullupBar', 'dipStation', 'bodyweight'],
  favoriteExercises: [], dislikedExercises: [], cannotPerform: [], style: 'mixed', limitations: [], nutritionGoal: 'gain', trackMacros: false,
  sleepHours: 7, recovery: 3, stress: 3, outsideActivity: 'light',
};

const custom: ExerciseDef = {
  id: 'custom-test', name: 'Incline Smith Press', muscle: 'chest', secondary: ['shoulders'], pattern: 'inclinePush', equipment: ['smith'],
  compound: true, increment: 5, stresses: [], cues: ['Bench at 30°'], notes: 'Bench at 30°', custom: true,
};

describe('exercise library', () => {
  it('has unique ids and the common staples', () => {
    const ids = EXERCISES.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const n of ['T-Bar Row', 'Barbell Shrug', 'EZ-Bar Preacher Curl', 'Hip Abduction Machine', 'Arnold Press', 'Sumo Deadlift']) {
      expect(EXERCISES.some((e) => e.name === n)).toBe(true);
    }
  });

  it('timed exercises are prescribed in seconds', () => {
    expect(schemeFor(base, 3, getExercise('plank'))).toMatchObject({ repMin: 30, repMax: 60 });
    expect(schemeFor(base, 3, getExercise('farmers-carry'))).toMatchObject({ repMin: 30, repMax: 60 });
  });
});

describe('custom exercises', () => {
  it('are resolvable, swappable, progressable and visible to the coach', () => {
    registerCustomExercises([custom]);
    expect(getExercise('custom-test').name).toBe('Incline Smith Press');
    expect(findExerciseId('incline smith press')).toBe('custom-test');
    expect(candidatesFor(base, { patterns: ['inclinePush'], priority: 2 }).some((e) => e.id === 'custom-test')).toBe(true);
    const r = recommend(getExercise('custom-test'), { sets: 3, repMin: 8, repMax: 12 }, [
      { sessionId: 'a', date: '2026-11-01', repMin: 8, repMax: 12, sets: [{ weight: 95, reps: 12 }, { weight: 95, reps: 12 }, { weight: 95, reps: 12 }] },
    ]);
    expect(r.suggestedWeight).toBe(100);
    const prompt = buildCoachPrompt({ question: 'q', profile: base, program: generateProgram(base), sessions: [], weights: [], measurements: [], notes: [] });
    expect(prompt).toContain('Incline Smith Press: Chest');
    registerCustomExercises([{ ...custom, archived: true }]);
    expect(candidatesFor(base, { patterns: ['inclinePush'], priority: 2 }).some((e) => e.id === 'custom-test')).toBe(false);
    expect(getExercise('custom-test').name).toBe('Incline Smith Press'); // history still resolves
    registerCustomExercises([]);
  });
});

describe('aesthetic goal', () => {
  it('adds side-delt and upper-chest work and keeps main lifts heavier', () => {
    const p = generateProgram(base);
    const all = p.days.flatMap((d) => d.exercises.map((e) => getExercise(e.exerciseId)));
    const plain = generateProgram({ ...base, goals: ['muscle'] }).days.flatMap((d) => d.exercises.map((e) => getExercise(e.exerciseId)));
    const count = (xs: ExerciseDef[], pat: string) => xs.filter((e) => e.pattern === pat).length;
    expect(count(all, 'lateral')).toBeGreaterThan(count(plain, 'lateral'));
    const main = p.days.flatMap((d) => d.exercises).filter((e) => e.priority === 1);
    expect(main.every((e) => e.repMin === 5 && e.repMax === 8)).toBe(true);
    expect(p.rationale.join(' ')).toMatch(/aesthetic/i);
  });
});
