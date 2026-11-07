import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Readiness } from '../engine/progression';
import { startSession } from '../lib/data';
import type { ProgramDay } from '../types';
import { dayMeta } from './DayList';
import { Options, Sheet } from './ui';

const FEELINGS: { value: string; title: string; readiness: Readiness; desc?: string }[] = [
  { value: 'great', title: 'Feeling great', readiness: 'great' },
  { value: 'normal', title: 'Feeling normal', readiness: 'normal' },
  { value: 'tired', title: 'Tired', readiness: 'low', desc: 'Targets will match last time instead of pushing.' },
  { value: 'poorSleep', title: 'Poor sleep', readiness: 'low', desc: 'Targets will match last time instead of pushing.' },
  { value: 'lowEnergy', title: 'Low energy', readiness: 'low', desc: 'Targets will match last time instead of pushing.' },
  { value: 'sore', title: 'Sore', readiness: 'low', desc: 'Warm up well; ease off anything that hurts.' },
];

export function StartWorkoutSheet({ open, onClose, days, programId, defaultDayId }: { open: boolean; onClose: () => void; days: ProgramDay[]; programId: string; defaultDayId?: string }) {
  const nav = useNavigate();
  const [feeling, setFeeling] = useState('normal');
  const [dayId, setDayId] = useState<string | undefined>(defaultDayId);
  const chosen = days.find((d) => d.id === (dayId ?? defaultDayId)) ?? days[0];

  const start = async () => {
    const f = FEELINGS.find((x) => x.value === feeling)!;
    await startSession(chosen, programId, f.readiness, f.title);
    onClose();
    nav('/workout');
  };

  return (
    <Sheet open={open} onClose={onClose} title="Start workout">
      <div className="stack">
        <div>
          <div className="eyebrow" style={{ margin: '0 4px 8px' }}>Workout</div>
          <Options value={chosen?.id} onChange={setDayId} options={days.map((d) => ({ value: d.id, title: d.name + (d.id === defaultDayId ? ' · scheduled today' : ''), desc: dayMeta(d) }))} />
        </div>
        <div>
          <div className="eyebrow" style={{ margin: '8px 4px 8px' }}>How do you feel?</div>
          <div className="chips">
            {FEELINGS.map((f) => (
              <button key={f.value} className={`chip${feeling === f.value ? ' on' : ''}`} onClick={() => setFeeling(f.value)}>
                {f.title}
              </button>
            ))}
          </div>
          {FEELINGS.find((f) => f.value === feeling)?.desc && <p className="foot" style={{ margin: '10px 4px 0' }}>{FEELINGS.find((f) => f.value === feeling)!.desc}</p>}
        </div>
        <button className="btn" onClick={start} disabled={!chosen}>
          Start {chosen?.name}
        </button>
      </div>
    </Sheet>
  );
}
