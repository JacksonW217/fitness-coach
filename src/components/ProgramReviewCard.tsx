import { useLiveQuery } from 'dexie-react-hooks';
import { Check, Settings2 } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../db';
import { analyzeProgram, CATEGORY_LABEL, DEFAULT_ADAPT, MANUAL_ONLY, type Proposal } from '../engine/adaptation';
import { applyProposal, dismissProposal } from '../lib/adapt';
import { useActiveProgram, useAdaptRecords, useCheckins, useFood, useProfile, useSessions, useWeights } from '../lib/data';
import { dateKey, fmtDate } from '../lib/util';
import type { AdaptCategory, AdaptSettings } from '../types';
import { Section, Segmented, Sheet, Stepper, Toggle } from './ui';

export function useProposals() {
  const profile = useProfile();
  const program = useActiveProgram();
  const sessions = useSessions();
  const weights = useWeights();
  const checkins = useCheckins();
  const food = useFood();
  const records = useAdaptRecords();
  if (!profile || !program || !sessions || !weights || !checkins || !food || !records) return undefined;
  return analyzeProgram({ profile, program, sessions, weights, checkins, food, records });
}

const CAT_ORDER: AdaptCategory[] = ['volume', 'exercise', 'repRange', 'deload', 'nutrition', 'structure'];

export function ProgramReviewSection() {
  const nav = useNavigate();
  const result = useProposals();
  const profile = useProfile();
  const program = useActiveProgram();
  const [busy, setBusy] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const recentAuto = useLiveQuery(() => db.adaptations.filter((r) => !!r.auto && r.status === 'applied' && Date.now() - new Date(r.at).getTime() < 7 * 86400000).toArray(), [], []);
  if (!result || !profile) return null;
  const settings = profile.adapt ?? DEFAULT_ADAPT;
  const deloadOn = program?.deloadUntil && program.deloadUntil >= dateKey();

  const approve = async (p: Proposal) => {
    setBusy(p.key);
    const r = await applyProposal(p);
    setBusy(null);
    if (r === 'review') nav('/review');
  };

  return (
    <Section
      title="Program review"
      action={
        <button className="link-btn" style={{ fontSize: 15, display: 'flex', alignItems: 'center', gap: 4 }} onClick={() => setSettingsOpen(true)}>
          <Settings2 size={16} /> {settings.mode === 'auto' ? 'Automatic' : 'Recommend'}
        </button>
      }
    >
      {deloadOn && (
        <div className="card ink" style={{ marginBottom: 12 }}>
          <div className="headline">Deload week</div>
          <div className="sub">Lighter loads and fewer sets through {fmtDate(program!.deloadUntil!)}. Deload sessions don’t count against your progression history.</div>
          <button className="btn white sm" style={{ marginTop: 12 }} onClick={async () => { const p = structuredClone(program!); p.deloadUntil = undefined; await db.programs.put(p); }}>
            End deload now
          </button>
        </div>
      )}
      {recentAuto && recentAuto.length > 0 && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div style={{ fontWeight: 600 }}>Applied automatically this week</div>
          {recentAuto.map((r) => <div key={r.key} className="sub" style={{ fontSize: 14, marginTop: 4 }}>• {r.summary}</div>)}
          <button className="link-btn" style={{ fontSize: 14 }} onClick={() => nav('/program/history')}>See reasons in change history</button>
        </div>
      )}
      {result.locked ? (
        <div className="card sub" style={{ fontSize: 14 }}>{result.locked}</div>
      ) : result.proposals.length === 0 ? (
        <div className="card">
          <div className="row" style={{ gap: 10 }}><Check size={18} /><div style={{ fontWeight: 600 }}>Your program looks on track</div></div>
          <div className="sub" style={{ fontSize: 14, marginTop: 4 }}>Volume, progress, consistency and recovery don’t call for changes right now. I check again as you log more.</div>
        </div>
      ) : (
        <div className="stack">
          {result.proposals.map((p) => (
            <div key={p.key} className="card">
              <div className="row between" style={{ alignItems: 'flex-start' }}>
                <div className="headline">{p.title}</div>
                <span className="badge" style={{ flex: 'none' }}>{p.category === 'structure' ? 'Major' : CATEGORY_LABEL[p.category].split(' (')[0]}</span>
              </div>
              <div className="sub" style={{ fontSize: 14, marginTop: 6 }}>{p.evidence}</div>
              <div className="rec" style={{ marginTop: 10 }}><b>Change:</b> {p.change}</div>
              <div className="btn-row" style={{ marginTop: 12 }}>
                <button className="btn sm" style={{ height: 40 }} disabled={busy === p.key} onClick={() => approve(p)}>{p.action.kind === 'rebuild' ? 'Review new program' : 'Approve'}</button>
                <button className="btn secondary sm" style={{ height: 40 }} onClick={() => dismissProposal(p)}>Not now</button>
              </div>
            </div>
          ))}
          {result.more > 0 && <p className="foot" style={{ margin: '0 4px' }}>{result.more} more suggestion{result.more > 1 ? 's' : ''} will appear as you act on these — one change at a time makes it clear what works.</p>}
        </div>
      )}
      <AdaptSettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} settings={settings} />
    </Section>
  );
}

function AdaptSettingsSheet({ open, onClose, settings }: { open: boolean; onClose: () => void; settings: AdaptSettings }) {
  const [s, setS] = useState(settings);
  const save = async () => {
    await db.profile.update('me', { adapt: s });
    onClose();
  };
  return (
    <Sheet open={open} onClose={onClose} title="Coaching mode" right={<button className="link-btn" onClick={save}>Save</button>}>
      <div className="stack">
        <Segmented options={[{ value: 'recommend', label: 'Recommend' }, { value: 'auto', label: 'Automatic' }]} value={s.mode} onChange={(mode) => setS({ ...s, mode })} />
        <p className="sub" style={{ fontSize: 14, margin: '0 4px' }}>
          {s.mode === 'recommend'
            ? 'I suggest changes with the evidence; nothing changes until you approve.'
            : 'Changes in the categories you allow are applied automatically, within your limits — at most 2 per week. Everything is logged with its reason. Major changes always need your approval.'}
        </p>
        {s.mode === 'auto' && (
          <>
            <div className="list">
              {CAT_ORDER.map((c) => {
                const locked = MANUAL_ONLY.includes(c);
                const on = !locked && s.autoCategories.includes(c);
                return (
                  <div key={c} className="list-row">
                    <div className="grow">
                      <div style={{ fontWeight: 500 }}>{CATEGORY_LABEL[c]}</div>
                      {locked && <div className="foot">Always asks first</div>}
                    </div>
                    {!locked && <Toggle on={on} onChange={(v) => setS({ ...s, autoCategories: v ? [...s.autoCategories, c] : s.autoCategories.filter((x) => x !== c) })} />}
                  </div>
                );
              })}
            </div>
            <label className="field">
              <span>Max sets added or removed per change</span>
              <Stepper value={s.maxSetDelta} min={1} max={2} onChange={(v) => setS({ ...s, maxSetDelta: v })} />
            </label>
            <label className="field">
              <span>Max calorie change per adjustment</span>
              <Stepper value={s.maxCalorieDelta} min={50} max={300} step={50} onChange={(v) => setS({ ...s, maxCalorieDelta: v })} format={(v) => `${v} kcal`} />
            </label>
          </>
        )}
      </div>
    </Sheet>
  );
}
