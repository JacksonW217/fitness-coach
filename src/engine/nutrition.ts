/**
 * Calorie and macro targets from the profile (Mifflin-St Jeor), plus daily
 * totals. Estimates, not prescriptions — the adaptation engine refines the
 * calorie target from the user's real weight trend.
 */
import type { FoodEntry, NutritionTargets, Profile } from '../types';

const ACTIVITY: Record<Profile['outsideActivity'], number> = { sedentary: 1.2, light: 1.35, moderate: 1.5, high: 1.65 };

export function bmr(p: Pick<Profile, 'weightLbs' | 'heightIn' | 'age' | 'sex'>): number {
  const kg = p.weightLbs * 0.4536;
  const cm = p.heightIn * 2.54;
  const base = 10 * kg + 6.25 * cm - 5 * p.age;
  if (p.sex === 'male') return base + 5;
  if (p.sex === 'female') return base - 161;
  return base - 78; // midpoint when sex isn't given
}

export function maintenanceCalories(p: Profile): number {
  // Lifting adds ~0.03 to the multiplier per weekly session, capped.
  const mult = ACTIVITY[p.outsideActivity] + Math.min(0.15, p.daysPerWeek * 0.025);
  return bmr(p) * mult;
}

const r5 = (n: number) => Math.round(n / 5) * 5;

export function calculateTargets(p: Profile, weightLbs = p.weightLbs): NutritionTargets {
  const prof = { ...p, weightLbs };
  const tdee = maintenanceCalories(prof);
  const adj = p.nutritionGoal === 'lose' ? -0.2 : p.nutritionGoal === 'gain' ? 0.1 : 0;
  const kcal = Math.round((tdee * (1 + adj)) / 10) * 10;
  // Protein ~0.8 g/lb (1.0 when cutting, using goal weight if lower); fat ~0.3 g/lb; rest carbs.
  const refWeight = p.nutritionGoal === 'lose' && p.targetWeightLbs && p.targetWeightLbs < weightLbs ? (p.targetWeightLbs + weightLbs) / 2 : weightLbs;
  const protein = r5(refWeight * (p.nutritionGoal === 'lose' ? 1.0 : 0.8));
  const fat = r5(weightLbs * 0.3);
  const carbs = Math.max(0, r5((kcal - protein * 4 - fat * 9) / 4));
  return { kcal, protein, carbs, fat, custom: false };
}

export function targetsFor(p: Profile, latestWeight?: number): NutritionTargets {
  return p.nutritionTargets?.custom ? p.nutritionTargets : p.nutritionTargets ?? calculateTargets(p, latestWeight);
}

export interface DayTotals {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  entries: number;
}

export function totals(entries: FoodEntry[]): DayTotals {
  return entries.reduce(
    (a, e) => ({ kcal: a.kcal + e.kcal, protein: a.protein + e.protein, carbs: a.carbs + (e.carbs ?? 0), fat: a.fat + (e.fat ?? 0), entries: a.entries + 1 }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0, entries: 0 },
  );
}

export function byDate(entries: FoodEntry[]): Map<string, DayTotals> {
  const m = new Map<string, FoodEntry[]>();
  for (const e of entries) m.set(e.date, [...(m.get(e.date) ?? []), e]);
  return new Map([...m.entries()].map(([k, v]) => [k, totals(v)]));
}

/** Frequently logged foods, most recent version of each name. */
export function frequentFoods(entries: FoodEntry[], limit = 8): FoodEntry[] {
  const counts = new Map<string, { n: number; last: FoodEntry }>();
  for (const e of [...entries].sort((a, b) => a.at.localeCompare(b.at))) {
    const k = e.name.trim().toLowerCase();
    if (!k) continue;
    counts.set(k, { n: (counts.get(k)?.n ?? 0) + 1, last: e });
  }
  return [...counts.values()].sort((a, b) => b.n - a.n || b.last.at.localeCompare(a.last.at)).slice(0, limit).map((x) => x.last);
}
