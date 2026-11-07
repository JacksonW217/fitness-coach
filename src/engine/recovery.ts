/** Daily readiness from a quick check-in. Transparent, simple weighting. */
import type { CheckIn } from '../types';
import type { Feeling } from './optimizer';

export function readinessScore(c: CheckIn): number {
  const sleep = Math.max(0, Math.min(1, (c.sleepHours - 4) / 4)); // 4h → 0, 8h+ → 1
  const q = (c.sleepQuality - 1) / 4;
  const energy = (c.energy - 1) / 4;
  const sore = 1 - (c.soreness - 1) / 4;
  const stress = 1 - (c.stress - 1) / 4;
  return Math.round(100 * (0.25 * sleep + 0.15 * q + 0.25 * energy + 0.2 * sore + 0.15 * stress));
}

export function readinessLabel(score: number): { label: string; tone: 'good' | 'warn' | 'bad' | '' } {
  if (score >= 75) return { label: 'Ready to push', tone: 'good' };
  if (score >= 55) return { label: 'Normal', tone: '' };
  if (score >= 40) return { label: 'Take it easier', tone: 'warn' };
  return { label: 'Recovery day?', tone: 'bad' };
}

/** Map today's check-in to the workout "how do you feel" default. */
export function suggestedFeeling(c?: CheckIn): Feeling {
  if (!c) return 'normal';
  if (c.soreness >= 4) return 'sore';
  if (c.sleepHours < 6 || c.sleepQuality <= 2) return 'poorSleep';
  if (c.energy <= 2) return 'lowEnergy';
  const s = readinessScore(c);
  if (s < 45) return 'tired';
  if (s >= 80) return 'great';
  return 'normal';
}

export function averageReadiness(checkins: CheckIn[], days = 7, now = new Date()): { avg: number; n: number } | undefined {
  const cutoff = new Date(now.getTime() - days * 86400000).toISOString().slice(0, 10);
  const recent = checkins.filter((c) => c.date > cutoff);
  if (!recent.length) return undefined;
  return { avg: Math.round(recent.reduce((a, c) => a + readinessScore(c), 0) / recent.length), n: recent.length };
}
