import { useState } from 'react';
import { ALL_EQUIPMENT, EQUIPMENT_LABEL, MUSCLE_LABEL, PATTERN_LABEL } from '../data/exercises';
import { saveCustomExercise } from '../db';
import type { Equipment, ExerciseDef, Muscle, Pattern } from '../types';
import { Chips, Field, Segmented, Stepper, Toggle } from './ui';

type LogType = 'weight' | 'bodyweight' | 'time' | 'weightTime';

const MUSCLES = Object.keys(MUSCLE_LABEL) as Muscle[];
const PATTERNS = Object.keys(PATTERN_LABEL) as Pattern[];
const COMPOUND: Pattern[] = ['squat', 'hinge', 'lunge', 'hPush', 'inclinePush', 'vPush', 'hPull', 'vPull', 'carry'];

/** Sensible defaults so a new exercise only needs a name, muscle and movement. */
function guessPattern(m: Muscle): Pattern {
  const map: Partial<Record<Muscle, Pattern>> = {
    chest: 'hPush', back: 'hPull', shoulders: 'lateral', biceps: 'biceps', triceps: 'triceps', quads: 'squat',
    hamstrings: 'kneeFlex', glutes: 'glute', calves: 'calf', abs: 'core', traps: 'shrug', forearms: 'forearm',
  };
  return map[m] ?? 'other';
}

function logTypeOf(ex?: ExerciseDef): LogType {
  if (!ex) return 'weight';
  if (ex.timed) return ex.increment === 0 ? 'time' : 'weightTime';
  return ex.increment === 0 ? 'bodyweight' : 'weight';
}

/**
 * Create or edit a user exercise. The answers map onto the same fields built-in
 * exercises use, so progression, swaps, weekly volume and the coach all
 * understand it.
 */
export function CustomExerciseForm({ initial, initialName = '', onSaved, onCancel }: { initial?: ExerciseDef; initialName?: string; onSaved: (ex: ExerciseDef) => void; onCancel: () => void }) {
  const [name, setName] = useState(initial?.name ?? initialName);
  const [muscle, setMuscle] = useState<Muscle>(initial?.muscle ?? 'chest');
  const [secondary, setSecondary] = useState<Muscle[]>(initial?.secondary ?? []);
  const [pattern, setPattern] = useState<Pattern>(initial?.pattern ?? 'hPush');
  const [patternTouched, setPatternTouched] = useState(!!initial);
  const [equipment, setEquipment] = useState<Equipment[]>(initial?.equipment ?? []);
  const [logType, setLogType] = useState<LogType>(logTypeOf(initial));
  const [perHand, setPerHand] = useState(initial?.perHand ?? false);
  const [increment, setIncrement] = useState(initial?.increment || 5);
  const [compound, setCompound] = useState(initial?.compound ?? true);
  const [compoundTouched, setCompoundTouched] = useState(!!initial);
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [busy, setBusy] = useState(false);

  const weighted = logType === 'weight' || logType === 'weightTime';
  const valid = name.trim().length > 1;

  const pickMuscle = (m: Muscle) => {
    setMuscle(m);
    setSecondary((s) => s.filter((x) => x !== m));
    if (!patternTouched) {
      const p = guessPattern(m);
      setPattern(p);
      if (!compoundTouched) setCompound(COMPOUND.includes(p));
    }
  };
  const pickPattern = (p: Pattern) => {
    setPattern(p);
    setPatternTouched(true);
    if (!compoundTouched) setCompound(COMPOUND.includes(p));
  };

  const save = async () => {
    if (!valid || busy) return;
    setBusy(true);
    const def: ExerciseDef = {
      id: initial?.id ?? `custom-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      name: name.trim(),
      muscle,
      secondary,
      pattern,
      equipment: equipment.length ? equipment : ['bodyweight'],
      compound,
      increment: weighted ? increment : 0,
      perHand: weighted && perHand ? true : undefined,
      timed: logType === 'time' || logType === 'weightTime' ? true : undefined,
      stresses: initial?.stresses ?? [],
      cues: notes.trim() ? notes.trim().split(/\n+/).map((s) => s.trim()).filter(Boolean).slice(0, 4) : [],
      notes: notes.trim() || undefined,
      custom: true,
      createdAt: initial?.createdAt ?? new Date().toISOString(),
    };
    await saveCustomExercise(def);
    setBusy(false);
    onSaved(def);
  };

  return (
    <div className="stack">
      <Field label="Name">
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Incline Smith Press" autoFocus={!initial} />
      </Field>

      <Field label="Main muscle worked">
        <Chips options={MUSCLES} value={[muscle]} onChange={(v) => pickMuscle((v.find((x) => x !== muscle) ?? muscle) as Muscle)} labels={MUSCLE_LABEL} />
      </Field>

      <Field label="Also works (optional)">
        <Chips options={MUSCLES.filter((m) => m !== muscle)} value={secondary} onChange={setSecondary} labels={MUSCLE_LABEL} />
      </Field>

      <Field label="Movement type">
        <select className="input" value={pattern} onChange={(e) => pickPattern(e.target.value as Pattern)}>
          {PATTERNS.map((p) => (
            <option key={p} value={p}>{PATTERN_LABEL[p]}</option>
          ))}
        </select>
      </Field>
      <p className="foot" style={{ margin: '-4px 4px 0' }}>This tells Forge which exercises it can swap with and how it fits your program.</p>

      <Field label="How you log it">
        <Segmented
          value={logType}
          onChange={setLogType}
          options={[
            { value: 'weight', label: 'Weight × reps' },
            { value: 'bodyweight', label: 'Reps only' },
            { value: 'time', label: 'Seconds' },
            { value: 'weightTime', label: 'Weight × sec' },
          ]}
        />
      </Field>

      {weighted && (
        <>
          <div className="row between">
            <div>
              <div style={{ fontWeight: 500 }}>Weight is per hand</div>
              <div className="foot">For dumbbells and single-arm cables</div>
            </div>
            <Toggle on={perHand} onChange={setPerHand} label="Weight is per hand" />
          </div>
          <Field label="Smallest weight jump">
            <Stepper value={increment} onChange={setIncrement} min={1} max={50} step={increment >= 10 ? 5 : increment >= 5 ? 2.5 : 1} format={(n) => `${n} lb`} />
          </Field>
        </>
      )}

      <div className="row between">
        <div>
          <div style={{ fontWeight: 500 }}>Multi-joint (compound)</div>
          <div className="foot">Presses, rows, squats, deadlifts. Off for curls, raises and other isolation work.</div>
        </div>
        <Toggle on={compound} onChange={(v) => { setCompound(v); setCompoundTouched(true); }} label="Compound" />
      </div>

      <Field label="Equipment (optional)">
        <Chips options={ALL_EQUIPMENT.filter((e) => e !== 'bodyweight')} value={equipment} onChange={setEquipment} labels={EQUIPMENT_LABEL} />
      </Field>

      <Field label="Notes & form cues (optional)">
        <textarea className="input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={'One cue per line, e.g.\nSeat on notch 4\nPause at the bottom'} />
      </Field>

      <div className="btn-row" style={{ marginTop: 8 }}>
        <button type="button" className="btn secondary" onClick={onCancel}>Cancel</button>
        <button type="button" className="btn" disabled={!valid || busy} onClick={save}>{initial ? 'Save' : 'Create'}</button>
      </div>
    </div>
  );
}
