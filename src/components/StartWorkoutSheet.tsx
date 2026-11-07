import { Sparkles } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MUSCLE_LABEL } from '../data/exercises';
import { optimizeDay, type Feeling } from '../engine/optimizer';
import type { Readiness } from '../engine/progression';
import { saveProgram, startSession, useActiveProgram, useProfile } from '../lib/data';
import type { Muscle, ProgramDay } from '../types';
import { DayExercises, dayMeta } from './DayList';
import { Chips, Options, Sheet, Toggle } from './ui';

const FEELINGS: { value: Feeling; title: string; readiness: Readiness }[] = [
  { value: 'great', title: 'Feeling great', readiness: 'great' },
  { value: 'normal', title: 'Normal', readiness: 'normal' },
  { value: 'tired', title: 'Tired', readiness: 'low' },
  { value: 'poorSleep', title: 'Poor sleep', readiness: 'low' },
  { value: 'lowEnergy', title: 'Low energy', readiness: 'low' },
  { value: 'sore', title: 'Sore', readiness: 'normal' },
];
const TIMES: (number | undefined)[] = [undefined, 20, 30, 45, 60, 75, 90];
const MUSCLES = Object.keys(MUSCLE_LABEL) as Muscle[];

export function StartWorkoutSheet({
  open,
  onClose,
  days,
  programId,
  defaultDayId,
  optimizeFirst,
}: {
  open: boolean;
  onClose: () => void;
  days: ProgramDay[];
  programId: string;
  defaultDayId?: string;
  optimizeFirst?: boolean;
}) {
  const nav = useNavigate();
  const profile = useProfile();
  const program = useActiveProgram();
  const [feeling, setFeeling] = useState<Feeling>('normal');
  const [sore, setSore] = useState<Muscle[]>([]);
  const [minutes, setMinutes] = useState<number | undefined>(undefined);
  const [dayId, setDayId] = useState<string | undefined>(defaultDayId);
  const [preview, setPreview] = useState(false);
  const [permanent, setPermanent] = useState(false);
  const chosen = days.find((d) => d.id === (dayId ?? defaultDayId)) ?? days[0];

  useEffect(() => {
    if (open) {
      setPreview(false);
      setPermanent(false);
      setDayId(defaultDayId);
      if (optimizeFirst && profile) setMinutes(profile.sessionMinutes > 45 ? 45 : 30);
    }
  }, [open, defaultDayId, optimizeFirst, profile]);

  const result = useMemo(
    () => (chosen ? optimizeDay({ day: chosen, minutes, feeling, soreMuscles: feeling === 'sore' ? sore : [], profile: profile ?? undefined }) : undefined),
    [chosen, minutes, feeling, sore, profile],
  );
  const readiness = FEELINGS.find((f) => f.value === feeling)!.readiness;
  const feelingTitle = FEELINGS.find((f) => f.value === feeling)!.title;
  const wantsOptimize = minutes !== undefined || feeling !== 'normal';

  const go = async (useOptimized: boolean) => {
    if (!chosen) return;
    if (useOptimized && result?.changed) {
      if (permanent && program) {
        const p = structuredClone(program);
        const i = p.days.findIndex((d) => d.id === chosen.id);
        p.days[i] = { ...result.day };
        await saveProgram(p, 'optimize', `${chosen.name}: saved optimized version (${result.after.exercises} exercises, ~${result.after.minutes} min)`, result.changes.join(' '));
      }
      await startSession(result.day, programId, readiness, feelingTitle, { minutes, feeling: feelingTitle, changes: result.changes, stimulusNote: result.stimulusNote });
    } else {
      await startSession(chosen, programId, readiness, feelingTitle);
    }
    onClose();
    nav('/workout');
  };

  return (
    <Sheet open={open} onClose={onClose} title={preview ? 'Optimized workout' : optimizeFirst ? 'Optimize my workout' : 'Start workout'}>
      {!preview || !result ? (
        <div className="stack">
          <div>
            <div className="eyebrow" style={{ margin: '0 4px 8px' }}>Workout</div>
            <Options value={chosen?.id} onChange={setDayId} options={days.map((d) => ({ value: d.id, title: d.name + (d.id === defaultDayId ? ' · scheduled' : ''), desc: dayMeta(d) }))} />
          </div>
          <div>
            <div className="eyebrow" style={{ margin: '8px 4px 8px' }}>Time available</div>
            <div className="chips">
              {TIMES.map((t) => (
                <button key={String(t)} className={`chip${minutes === t ? ' on' : ''}`} onClick={() => setMinutes(t)}>
                  {t === undefined ? 'Full workout' : `${t} min`}
                </button>
              ))}
            </div>
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
          </div>
          {feeling === 'sore' && (
            <div>
              <div className="eyebrow" style={{ margin: '8px 4px 8px' }}>Where?</div>
              <Chips options={MUSCLES} value={sore} onChange={setSore} labels={MUSCLE_LABEL} />
            </div>
          )}
          {wantsOptimize ? (
            <>
              <button className="btn" onClick={() => setPreview(true)} disabled={!chosen}>
                <Sparkles size={18} /> Optimize
              </button>
              <button className="btn secondary" onClick={() => go(false)} disabled={!chosen}>Start as planned</button>
            </>
          ) : (
            <button className="btn" onClick={() => go(false)} disabled={!chosen}>Start {chosen?.name}</button>
          )}
        </div>
      ) : (
        <div className="stack">
          <div className="grid-2">
            <div className="card" style={{ margin: 0 }}>
              <div className="foot">Planned</div>
              <div className="mid-num">~{result.before.minutes} min</div>
              <div className="foot">{result.before.exercises} exercises · {result.before.sets} sets</div>
            </div>
            <div className="card ink" style={{ margin: 0 }}>
              <div className="foot">Optimized</div>
              <div className="mid-num">~{result.after.minutes} min</div>
              <div className="foot">{result.after.exercises} exercises · {result.after.sets} sets</div>
            </div>
          </div>
          <div className="card">
            <div style={{ fontWeight: 600, marginBottom: 6 }}>What changed and why</div>
            {result.changes.length ? (
              <ul className="sub" style={{ margin: 0, paddingLeft: 18, fontSize: 14, color: 'var(--ink)' }}>
                {result.changes.map((c) => <li key={c} style={{ marginTop: 4 }}>{c}</li>)}
              </ul>
            ) : (
              <div className="sub">Nothing needed changing.</div>
            )}
            <div className="divider" />
            <div className="sub" style={{ fontSize: 14 }}>{result.stimulusNote}</div>
          </div>
          {result.changed && <DayExercises day={result.day} />}
          {result.changed && (
            <div className="row between card">
              <div>
                <div style={{ fontWeight: 600 }}>Save to my program</div>
                <div className="foot">Off: today only. Your program stays as it is.</div>
              </div>
              <Toggle on={permanent} onChange={setPermanent} />
            </div>
          )}
          <button className="btn" onClick={() => go(true)}>{result.changed ? 'Start optimized workout' : `Start ${chosen.name}`}</button>
          <div className="btn-row">
            <button className="btn secondary" onClick={() => setPreview(false)}>Adjust</button>
            {result.changed && <button className="btn secondary" onClick={() => go(false)}>Start original</button>}
          </div>
        </div>
      )}
    </Sheet>
  );
}
