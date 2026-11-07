import { db } from '../db';
import { analyzeProgram, applyAction, autoAllowed, DEFAULT_ADAPT, type Proposal } from '../engine/adaptation';
import { generateProgram } from '../engine/generator';
import { logChange } from './data';
import { dateKey, daysBetween, nowISO } from './util';

export async function loadAdaptInput() {
  const [profile, program, sessions, weights, checkins, food, records] = await Promise.all([
    db.profile.get('me'),
    db.programs.where('status').equals('active').first(),
    db.sessions.toArray(),
    db.bodyweights.toArray(),
    db.checkins.toArray(),
    db.food.toArray(),
    db.adaptations.toArray(),
  ]);
  if (!profile || !program) return undefined;
  return { profile, program, sessions, weights, checkins, food, records };
}

/**
 * Apply a proposal. Rebuild proposals create a draft for review and return
 * 'review'; everything else is applied immediately and logged.
 */
export async function applyProposal(p: Proposal, opts: { auto?: boolean } = {}): Promise<'applied' | 'review'> {
  const input = await loadAdaptInput();
  if (!input) return 'applied';
  const { program, profile } = applyAction(input.program, input.profile, p.action);
  await db.adaptations.put({ key: p.key, status: 'applied', at: nowISO(), auto: opts.auto, summary: p.change });
  if (p.action.kind === 'rebuild') {
    await db.profile.put({ ...profile, updatedAt: nowISO() });
    const draft = generateProgram(profile);
    await db.programs.where('status').equals('draft').delete();
    await db.programs.put(draft);
    await logChange(draft.id, 'created', `Generated “${draft.name}”`, `Program review: ${p.title}. ${p.evidence}`);
    return 'review';
  }
  await db.programs.put(program);
  if (p.action.kind === 'calories') await db.profile.put({ ...profile, updatedAt: nowISO() });
  await logChange(program.id, opts.auto ? 'auto' : 'adapt', p.change, `${opts.auto ? 'Applied automatically (within your limits)' : 'Program review'}: ${p.evidence}`);
  return 'applied';
}

export async function dismissProposal(p: Proposal) {
  await db.adaptations.put({ key: p.key, status: 'dismissed', at: nowISO() });
}

const AUTO_RUN_KEY = 'forge.adapt.lastAutoRun';
const MAX_AUTO_PER_WEEK = 2;

/** In automatic mode, apply allowed proposals at most once a day, max 2 per week. */
export async function runAutoAdapt(): Promise<Proposal[]> {
  try {
    if (localStorage.getItem(AUTO_RUN_KEY) === dateKey()) return [];
  } catch {
    /* ignore */
  }
  const input = await loadAdaptInput();
  if (!input) return [];
  const settings = input.profile.adapt ?? DEFAULT_ADAPT;
  if (settings.mode !== 'auto') return [];
  try {
    localStorage.setItem(AUTO_RUN_KEY, dateKey());
  } catch {
    /* ignore */
  }
  const recentAuto = input.records.filter((r) => r.auto && r.status === 'applied' && daysBetween(r.at, new Date()) < 7).length;
  let budget = Math.max(0, MAX_AUTO_PER_WEEK - recentAuto);
  const { proposals } = analyzeProgram(input);
  const applied: Proposal[] = [];
  for (const p of proposals) {
    if (budget <= 0) break;
    if (!autoAllowed(p, settings)) continue;
    await applyProposal(p, { auto: true });
    applied.push(p);
    budget--;
  }
  return applied;
}
