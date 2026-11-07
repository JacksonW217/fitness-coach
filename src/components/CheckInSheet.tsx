import { useEffect, useState } from 'react';
import { db } from '../db';
import { readinessLabel, readinessScore } from '../engine/recovery';
import { dateKey, uid } from '../lib/util';
import type { CheckIn } from '../types';
import { Segmented, Sheet, Stepper } from './ui';

type Five = 1 | 2 | 3 | 4 | 5;
const scale = (lo: string, hi: string, value: Five, onChange: (v: Five) => void) => (
  <>
    <Segmented options={[1, 2, 3, 4, 5].map((n) => ({ value: n as Five, label: String(n) }))} value={value} onChange={onChange} />
    <div className="row between foot" style={{ marginTop: 4, padding: '0 4px' }}><span>{lo}</span><span>{hi}</span></div>
  </>
);

export function CheckInSheet({ open, onClose, existing, defaultSleep }: { open: boolean; onClose: () => void; existing?: CheckIn; defaultSleep: number }) {
  const blank = (): CheckIn => ({ id: uid(), date: dateKey(), sleepHours: defaultSleep, sleepQuality: 3, energy: 3, soreness: 2, stress: 3 });
  const [c, setC] = useState<CheckIn>(existing ?? blank());
  useEffect(() => {
    if (open) setC(existing ?? blank());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, existing]);
  const score = readinessScore(c);
  const l = readinessLabel(score);
  return (
    <Sheet open={open} onClose={onClose} title="Daily check-in">
      <div className="stack">
        <div className="card row between">
          <div><div className="foot">Readiness</div><div className="big-num">{score}</div></div>
          <span className={`badge ${l.tone}`}>{l.label}</span>
        </div>
        <label className="field"><span>Sleep last night</span><Stepper value={c.sleepHours} min={0} max={14} step={0.5} onChange={(v) => setC({ ...c, sleepHours: v })} format={(v) => `${v} h`} /></label>
        <label className="field"><span>Sleep quality</span>{scale('Poor', 'Great', c.sleepQuality, (v) => setC({ ...c, sleepQuality: v }))}</label>
        <label className="field"><span>Energy</span>{scale('Drained', 'Energized', c.energy, (v) => setC({ ...c, energy: v }))}</label>
        <label className="field"><span>Soreness</span>{scale('None', 'Very sore', c.soreness, (v) => setC({ ...c, soreness: v }))}</label>
        <label className="field"><span>Stress</span>{scale('Calm', 'Very stressed', c.stress, (v) => setC({ ...c, stress: v }))}</label>
        <button className="btn" onClick={async () => { await db.checkins.put(c); onClose(); }}>Save</button>
        <p className="foot">Readiness = sleep 40%, energy 25%, soreness 20%, stress 15%. It sets the default “how do you feel” for today’s workout and feeds program reviews.</p>
      </div>
    </Sheet>
  );
}
