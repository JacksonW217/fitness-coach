import { ArrowDown, ArrowUp, Star } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { fmtRest } from '../components/DayList';
import { ExercisePicker } from '../components/ExercisePicker';
import { BackBar, Field, Page, Section, Segmented, Sheet, Stepper, Toggle } from '../components/ui';
import { db } from '../db';
import { getExercise, hasEquipment, MUSCLE_LABEL } from '../data/exercises';
import { candidatesFor, estimateMinutes, schemeFor } from '../engine/generator';
import { saveProgram, useActiveProgram, useProfile } from '../lib/data';
import { uid } from '../lib/util';
import type { ExerciseDef, Program, ProgramExercise } from '../types';

const RESTS = [45, 60, 90, 120, 150, 180, 240];

export default function ProgramDayEdit() {
  const { id } = useParams();
  const program = useActiveProgram();
  const profile = useProfile();
  const [editing, setEditing] = useState<string | null>(null);
  const [swapping, setSwapping] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [dr, setDr] = useState<Pick<ProgramExercise, 'sets' | 'repMin' | 'repMax' | 'restSec' | 'warmup'> | null>(null);
  const day = program?.days.find((d) => d.id === id);

  const swapSuggestions = useMemo(() => {
    const pe = day?.exercises.find((e) => e.id === swapping);
    if (!pe || !profile) return [];
    const def = getExercise(pe.exerciseId);
    return candidatesFor(profile, { patterns: [def.pattern], priority: pe.priority }).filter((e) => e.id !== def.id).slice(0, 6);
  }, [swapping, day, profile]);

  if (!program || !day) return null;

  const update = async (fn: (p: Program, list: ProgramExercise[]) => void, kind: Parameters<typeof saveProgram>[1], summary: string) => {
    const p = structuredClone(program);
    const d = p.days.find((x) => x.id === day.id)!;
    fn(p, d.exercises);
    await saveProgram(p, kind, `${day.name}: ${summary}`, 'Manual edit.');
  };

  const pe = day.exercises.find((e) => e.id === editing);
  const peDef = pe ? getExercise(pe.exerciseId) : undefined;
  const dirty = !!pe && !!dr && (dr.sets !== pe.sets || dr.repMin !== pe.repMin || dr.repMax !== pe.repMax || dr.restSec !== pe.restSec || dr.warmup !== pe.warmup);

  return (
    <Page noTabs>
      <BackBar title={day.name} />
      <div className="sub" style={{ margin: '4px 4px 0' }}>{day.focus}</div>
      <div className="foot" style={{ margin: '2px 4px 0' }}>Estimated {estimateMinutes(day.exercises)} min including warm-up</div>

      <Section>
        <div className="list">
          {day.exercises.map((x, i) => {
            const def = getExercise(x.exerciseId);
            const fav = profile?.favoriteExercises.includes(def.id);
            return (
              <div className="list-row" key={x.id}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <button className="icon-btn plain" style={{ width: 28, height: 24, opacity: i ? 1 : 0.25 }} disabled={!i} aria-label="Move up" onClick={() => update((_, l) => { const [m] = l.splice(i, 1); l.splice(i - 1, 0, m); }, 'reorder', `moved ${def.name} up`)}>
                    <ArrowUp size={16} />
                  </button>
                  <button className="icon-btn plain" style={{ width: 28, height: 24, opacity: i < day.exercises.length - 1 ? 1 : 0.25 }} disabled={i >= day.exercises.length - 1} aria-label="Move down" onClick={() => update((_, l) => { const [m] = l.splice(i, 1); l.splice(i + 1, 0, m); }, 'reorder', `moved ${def.name} down`)}>
                    <ArrowDown size={16} />
                  </button>
                </div>
                <button className="grow" style={{ border: 'none', background: 'none', textAlign: 'left', padding: 0 }} onClick={() => { setEditing(x.id); setDr({ sets: x.sets, repMin: x.repMin, repMax: x.repMax, restSec: x.restSec, warmup: x.warmup }); }}>
                  <div style={{ fontWeight: 500 }}>{def.name} {fav && <Star size={12} fill="currentColor" style={{ verticalAlign: 0 }} />}</div>
                  <div className="foot">{MUSCLE_LABEL[def.muscle]} · {x.sets} × {x.repMin}–{x.repMax} · rest {fmtRest(x.restSec)}</div>
                </button>
              </div>
            );
          })}
        </div>
        <button className="btn secondary" style={{ marginTop: 12 }} onClick={() => setAdding(true)}>Add exercise</button>
      </Section>

      <Sheet open={!!pe} onClose={() => setEditing(null)} title={peDef?.name}>
        {pe && peDef && dr && (
          <div className="stack">
            <Field label="Working sets">
              <Stepper value={dr!.sets} min={1} max={10} onChange={(v) => setDr({ ...dr!, sets: v })} />
            </Field>
            <div className="grid-2">
              <Field label="Min reps">
                <Stepper value={dr!.repMin} min={1} max={dr!.repMax} onChange={(v) => setDr({ ...dr!, repMin: v })} />
              </Field>
              <Field label="Max reps">
                <Stepper value={dr!.repMax} min={dr!.repMin} max={60} onChange={(v) => setDr({ ...dr!, repMax: v })} />
              </Field>
            </div>
            <Field label="Rest between sets">
              <Segmented options={RESTS.map((r) => ({ value: r, label: fmtRest(r) }))} value={dr!.restSec} onChange={(v) => setDr({ ...dr!, restSec: v })} />
            </Field>
            <div className="row between card">
              <div><div style={{ fontWeight: 600 }}>Warm-up sets</div><div className="foot">Ramp-up sets before working sets</div></div>
              <Toggle on={dr!.warmup} onChange={(v) => setDr({ ...dr!, warmup: v })} />
            </div>
            {dirty && (
              <button
                className="btn"
                onClick={async () => {
                  const parts: string[] = [];
                  if (dr!.sets !== pe.sets) parts.push(`sets ${pe.sets} → ${dr!.sets}`);
                  if (dr!.repMin !== pe.repMin || dr!.repMax !== pe.repMax) parts.push(`reps ${pe.repMin}–${pe.repMax} → ${dr!.repMin}–${dr!.repMax}`);
                  if (dr!.restSec !== pe.restSec) parts.push(`rest ${fmtRest(pe.restSec)} → ${fmtRest(dr!.restSec)}`);
                  if (dr!.warmup !== pe.warmup) parts.push(`warm-ups ${dr!.warmup ? 'on' : 'off'}`);
                  await update((_, l) => Object.assign(l.find((e) => e.id === pe.id)!, dr), 'sets', `${peDef.name} ${parts.join(', ')}`);
                  setEditing(null);
                }}
              >
                Save changes
              </button>
            )}
            <div className="row between card">
              <div><div style={{ fontWeight: 600 }}>Preferred exercise</div><div className="foot">Prioritized when programs are built</div></div>
              <Toggle
                on={!!profile?.favoriteExercises.includes(peDef.id)}
                onChange={async (v) => {
                  if (!profile) return;
                  const favs = v ? [...profile.favoriteExercises, peDef.id] : profile.favoriteExercises.filter((f) => f !== peDef.id);
                  await db.profile.update('me', { favoriteExercises: favs });
                }}
              />
            </div>
            <div className="card">
              <div className="foot" style={{ marginBottom: 4 }}>Technique</div>
              <ul className="sub" style={{ margin: 0, paddingLeft: 18, fontSize: 14 }}>{peDef.cues.map((c) => <li key={c}>{c}</li>)}</ul>
            </div>
            <div className="btn-row">
              <button className="btn secondary" onClick={() => { setSwapping(pe.id); setEditing(null); }}>Replace</button>
              <button className="btn danger" onClick={async () => { await update((_, l) => void l.splice(l.findIndex((e) => e.id === pe.id), 1), 'remove', `removed ${peDef.name}`); setEditing(null); }}>Remove</button>
            </div>
          </div>
        )}
      </Sheet>

      <Sheet open={!!swapping} onClose={() => setSwapping(null)} title="Replace exercise">
        <ExercisePicker
          suggested={swapSuggestions}
          filter={(e: ExerciseDef) => !profile || hasEquipment(e, profile.equipment)}
          onPick={async (def) => {
            const old = day.exercises.find((e) => e.id === swapping)!;
            await update((_, l) => void (l.find((e) => e.id === swapping)!.exerciseId = def.id), 'swap', `${getExercise(old.exerciseId).name} → ${def.name}`);
            setSwapping(null);
          }}
        />
      </Sheet>

      <Sheet open={adding} onClose={() => setAdding(false)} title="Add exercise">
        <ExercisePicker
          filter={(e: ExerciseDef) => !profile || hasEquipment(e, profile.equipment)}
          onPick={async (def) => {
            const pr = def.compound ? 2 : 3;
            const s = profile ? schemeFor(profile, pr, def) : { sets: 3, repMin: 8, repMax: 12, rest: 90 };
            await update((_, l) => void l.push({ id: uid(), exerciseId: def.id, sets: s.sets, repMin: s.repMin, repMax: s.repMax, restSec: s.rest, priority: pr, warmup: false }), 'add', `added ${def.name}`);
            setAdding(false);
          }}
        />
      </Sheet>
    </Page>
  );
}

