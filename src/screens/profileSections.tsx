/**
 * Profile question sections, shared by onboarding and Profile → edit.
 */
import { ArrowDown, ArrowUp, ChevronRight } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { ExercisePicker } from '../components/ExercisePicker';
import { Chips, Field, NumberInput, Options, Segmented, Sheet, Stepper, Toggle } from '../components/ui';
import { ALL_EQUIPMENT, EQUIPMENT_LABEL, getExercise, LOCATION_PRESETS } from '../data/exercises';
import { WEEKDAYS } from '../lib/util';
import type { Goal, Limitation, MeasurementKey, Profile, Weekday } from '../types';

export type Draft = Partial<Profile>;
export interface SectionProps {
  p: Draft;
  set: (patch: Draft) => void;
}

export const GOAL_LABEL: Record<Goal, string> = {
  muscle: 'Build muscle',
  fatLoss: 'Lose body fat',
  strength: 'Build strength',
  athletic: 'Athletic performance',
  endurance: 'Improve endurance',
  general: 'General fitness',
  physique: 'A particular physique',
  maintain: 'Maintain my physique',
};
export const LIMIT_LABEL: Record<Limitation, string> = {
  shoulder: 'Shoulder',
  lowBack: 'Lower back',
  knee: 'Knee',
  elbow: 'Elbow',
  wrist: 'Wrist',
  hip: 'Hip',
  neck: 'Neck',
};
export const MEASURE_LABEL: Record<MeasurementKey, string> = {
  waist: 'Waist',
  chest: 'Chest',
  hips: 'Hips',
  neck: 'Neck',
  shoulders: 'Shoulders',
  armL: 'Left arm',
  armR: 'Right arm',
  thighL: 'Left thigh',
  thighR: 'Right thigh',
  calf: 'Calf',
};

export const DEFAULT_DRAFT: Draft = {
  goals: [],
  experience: undefined,
  trainingYears: 1,
  daysPerWeek: 4,
  preferredDays: [],
  sessionMinutes: 60,
  scheduledRest: true,
  splitPref: 'auto',
  equipment: [],
  favoriteExercises: [],
  dislikedExercises: [],
  cannotPerform: [],
  style: 'mixed',
  limitations: [],
  nutritionGoal: undefined,
  trackMacros: false,
  sleepHours: 7,
  recovery: 3,
  stress: 3,
  outsideActivity: 'light',
};

const Q = ({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) => (
  <div className="q">
    <p className="ql">{label}</p>
    {hint && <p className="qh">{hint}</p>}
    {children}
  </div>
);

export function AboutSection({ p, set }: SectionProps) {
  const ft = p.heightIn ? Math.floor(p.heightIn / 12) : undefined;
  const inch = p.heightIn !== undefined ? Math.round(p.heightIn - (ft ?? 0) * 12) : undefined;
  const [showM, setShowM] = useState(!!p.measurements && Object.keys(p.measurements).length > 0);
  return (
    <>
      <Q label="What should I call you?" hint="Optional.">
        <input className="input" value={p.name ?? ''} onChange={(e) => set({ name: e.target.value })} placeholder="Name" />
      </Q>
      <Q label="Age">
        <NumberInput value={p.age} onChange={(v) => set({ age: v })} unit="yrs" placeholder="28" />
      </Q>
      <Q label="Height">
        <div className="grid-2">
          <NumberInput value={ft} onChange={(v) => set({ heightIn: (v ?? 0) * 12 + (inch ?? 0) })} unit="ft" placeholder="5" />
          <NumberInput value={inch} onChange={(v) => set({ heightIn: (ft ?? 0) * 12 + (v ?? 0) })} unit="in" placeholder="10" />
        </div>
      </Q>
      <Q label="Current weight">
        <NumberInput value={p.weightLbs} onChange={(v) => set({ weightLbs: v })} unit="lb" placeholder="175" />
      </Q>
      <Q label="Sex" hint="Only used for body-composition estimates. Skip if you prefer.">
        <Segmented
          options={[
            { value: 'male', label: 'Male' },
            { value: 'female', label: 'Female' },
            { value: 'unspecified', label: 'Skip' },
          ]}
          value={p.sex ?? 'unspecified'}
          onChange={(v) => set({ sex: v as Profile['sex'] })}
        />
      </Q>
      <Q label="Body-fat percentage" hint="Optional — only if you have a reasonable estimate.">
        <NumberInput value={p.bodyFatPct} onChange={(v) => set({ bodyFatPct: v })} unit="%" placeholder="—" />
      </Q>
      <div className="q">
        <button type="button" className="list-row" style={{ background: 'var(--fill)', borderRadius: 12 }} onClick={() => setShowM(!showM)}>
          <div className="grow">
            <div style={{ fontWeight: 600 }}>Body measurements</div>
            <div className="foot">Optional, in inches</div>
          </div>
          <ChevronRight size={18} style={{ transform: showM ? 'rotate(90deg)' : undefined, transition: 'transform .2s' }} />
        </button>
        {showM && (
          <div className="grid-2" style={{ marginTop: 12 }}>
            {(Object.keys(MEASURE_LABEL) as MeasurementKey[]).map((k) => (
              <Field key={k} label={MEASURE_LABEL[k]}>
                <NumberInput value={p.measurements?.[k]} onChange={(v) => set({ measurements: { ...p.measurements, [k]: v } })} unit="in" />
              </Field>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

export function GoalsSection({ p, set }: SectionProps) {
  const goals = p.goals ?? [];
  const move = (i: number, d: number) => {
    const g = [...goals];
    [g[i], g[i + d]] = [g[i + d], g[i]];
    set({ goals: g });
  };
  return (
    <>
      <Q label="What do you want to achieve?" hint="Pick all that apply.">
        <Chips options={Object.keys(GOAL_LABEL) as Goal[]} value={goals} onChange={(v) => set({ goals: v })} labels={GOAL_LABEL} />
      </Q>
      {goals.length > 1 && (
        <Q label="Put them in priority order" hint="Your top goal shapes rep ranges and programming the most.">
          <div className="list">
            {goals.map((g, i) => (
              <div className="list-row" key={g}>
                <span className="badge ink num">{i + 1}</span>
                <div className="grow" style={{ fontWeight: 500 }}>{GOAL_LABEL[g]}</div>
                <button className="icon-btn" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)} style={{ opacity: i === 0 ? 0.3 : 1 }}>
                  <ArrowUp size={16} />
                </button>
                <button className="icon-btn" aria-label="Move down" disabled={i === goals.length - 1} onClick={() => move(i, 1)} style={{ opacity: i === goals.length - 1 ? 0.3 : 1 }}>
                  <ArrowDown size={16} />
                </button>
              </div>
            ))}
          </div>
        </Q>
      )}
      <Q label="Describe your ideal physique" hint="What do you ultimately want to look like, feel like, or be able to do?">
        <textarea className="input" value={p.idealPhysique ?? ''} onChange={(e) => set({ idealPhysique: e.target.value })} placeholder="e.g. Lean and athletic, wider shoulders, visible abs, strong enough to…" />
      </Q>
      <Q label="Any specific targets?" hint="All optional.">
        <div className="grid-2">
          <Field label="Target weight">
            <NumberInput value={p.targetWeightLbs} onChange={(v) => set({ targetWeightLbs: v })} unit="lb" />
          </Field>
          <Field label="Target body fat">
            <NumberInput value={p.targetBodyFatPct} onChange={(v) => set({ targetBodyFatPct: v })} unit="%" />
          </Field>
        </div>
        <div style={{ marginTop: 12 }}>
          <Field label="Milestone">
            <input className="input" value={p.milestone ?? ''} onChange={(e) => set({ milestone: e.target.value })} placeholder="e.g. Bench 225 lb, 10 pull-ups" />
          </Field>
        </div>
      </Q>
    </>
  );
}

export function ExperienceSection({ p, set }: SectionProps) {
  return (
    <>
      <Q label="Training experience">
        <Options
          value={p.experience}
          onChange={(v) => set({ experience: v })}
          options={[
            { value: 'beginner', title: 'Beginner', desc: 'Under ~1 year of consistent lifting, still learning the main lifts.' },
            { value: 'intermediate', title: 'Intermediate', desc: '1–3+ years. Comfortable with most lifts; progress has slowed from week to week.' },
            { value: 'advanced', title: 'Advanced', desc: 'Many years of structured training; progress takes months.' },
          ]}
        />
      </Q>
      <Q label="How long have you been training?">
        <Stepper value={p.trainingYears ?? 1} onChange={(v) => set({ trainingYears: v })} min={0} max={40} step={0.5} format={(v) => (v === 0 ? 'Just starting' : `${v} yr${v === 1 ? '' : 's'}`)} />
      </Q>
      <Q label="How comfortable are you with different exercises?" hint="e.g. confident on squats and bench, never deadlifted, unsure about Olympic lifts.">
        <textarea className="input" value={p.exerciseComfort ?? ''} onChange={(e) => set({ exerciseComfort: e.target.value })} />
      </Q>
    </>
  );
}

const MINUTES = [20, 30, 45, 60, 75, 90, 120];

export function ScheduleSection({ p, set }: SectionProps) {
  const varies = !!p.minutesByDay && Object.keys(p.minutesByDay).length > 0;
  const days = (p.preferredDays ?? []) as Weekday[];
  const order: Weekday[] = [1, 2, 3, 4, 5, 6, 0];
  return (
    <>
      <Q label="Days per week">
        <Stepper value={p.daysPerWeek ?? 4} onChange={(v) => set({ daysPerWeek: v })} min={1} max={6} format={(v) => `${v} day${v > 1 ? 's' : ''}`} />
      </Q>
      <Q label="Which days do you prefer?" hint="I’ll fill in sensible days if you pick fewer.">
        <div className="chips">
          {order.map((d) => {
            const on = days.includes(d);
            return (
              <button key={d} type="button" className={`chip${on ? ' on' : ''}`} onClick={() => set({ preferredDays: on ? days.filter((x) => x !== d) : [...days, d] })}>
                {WEEKDAYS[d]}
              </button>
            );
          })}
        </div>
      </Q>
      <Q label="Typical time per workout">
        <div className="chips">
          {MINUTES.map((m) => (
            <button key={m} type="button" className={`chip${p.sessionMinutes === m ? ' on' : ''}`} onClick={() => set({ sessionMinutes: m })}>
              {m} min
            </button>
          ))}
        </div>
      </Q>
      <div className="q row between">
        <div>
          <div className="ql" style={{ fontWeight: 600 }}>My time changes by day</div>
          <div className="foot">Set different time limits for specific days</div>
        </div>
        <Toggle on={varies} onChange={(v) => set({ minutesByDay: v ? Object.fromEntries(days.map((d) => [d, p.sessionMinutes ?? 60])) : {} })} />
      </div>
      {varies && (
        <div className="list" style={{ marginTop: 12 }}>
          {order
            .filter((d) => days.includes(d))
            .map((d) => (
              <div className="list-row" key={d}>
                <div className="grow" style={{ fontWeight: 500 }}>{WEEKDAYS[d]}</div>
                <select
                  className="input"
                  style={{ width: 120, padding: '8px 12px', background: 'var(--bg)' }}
                  value={p.minutesByDay?.[d] ?? p.sessionMinutes}
                  onChange={(e) => set({ minutesByDay: { ...p.minutesByDay, [d]: Number(e.target.value) } })}
                >
                  {MINUTES.map((m) => (
                    <option key={m} value={m}>{m} min</option>
                  ))}
                </select>
              </div>
            ))}
          {!days.length && <div className="list-row foot">Pick preferred days above first.</div>}
        </div>
      )}
      <div className="q row between">
        <div>
          <div className="ql" style={{ fontWeight: 600 }}>Scheduled rest days</div>
          <div className="foot">Keep fixed days off each week</div>
        </div>
        <Toggle on={p.scheduledRest ?? true} onChange={(v) => set({ scheduledRest: v })} />
      </div>
      <Q label="Split preference" hint="Let me decide unless you have a strong preference.">
        <Options
          value={p.splitPref ?? 'auto'}
          onChange={(v) => set({ splitPref: v })}
          options={[
            { value: 'auto', title: 'Choose for me', desc: 'Based on your goals, schedule and experience.' },
            { value: 'fullBody', title: 'Full body' },
            { value: 'upperLower', title: 'Upper / Lower' },
            { value: 'ppl', title: 'Push / Pull / Legs' },
            { value: 'bro', title: 'Body-part split' },
          ]}
        />
      </Q>
    </>
  );
}

export function EquipmentSection({ p, set }: SectionProps) {
  const eq = p.equipment ?? [];
  return (
    <>
      <Q label="Where do you train?">
        <Options
          value={p.location}
          onChange={(v) => set({ location: v, equipment: LOCATION_PRESETS[v] })}
          options={[
            { value: 'commercial', title: 'Commercial gym', desc: 'Full range of free weights, cables and machines.' },
            { value: 'home', title: 'Home gym' },
            { value: 'limited', title: 'Limited-equipment gym', desc: 'Hotel, apartment or small gym.' },
            { value: 'multiple', title: 'Multiple locations' },
          ]}
        />
      </Q>
      {p.location && (
        <Q label="Available equipment" hint="Adjust to match what you actually have.">
          <Chips options={ALL_EQUIPMENT.filter((e) => e !== 'bodyweight')} value={eq} onChange={(v) => set({ equipment: [...v, 'bodyweight'] })} labels={EQUIPMENT_LABEL} />
        </Q>
      )}
    </>
  );
}

function PickList({ label, hint, ids, onChange }: { label: string; hint?: string; ids: string[]; onChange: (ids: string[]) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Q label={label} hint={hint}>
      <button type="button" className="list-row" style={{ background: 'var(--fill)', borderRadius: 12 }} onClick={() => setOpen(true)}>
        <div className="grow">{ids.length ? ids.map((i) => getExercise(i).name).join(', ') : <span className="sub">None selected</span>}</div>
        <ChevronRight size={18} className="chev" />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={label} right={<button className="link-btn" onClick={() => setOpen(false)}>Done</button>}>
        <ExercisePicker selected={ids} onToggle={(id) => onChange(ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id])} />
      </Sheet>
    </Q>
  );
}

export function PreferencesSection({ p, set }: SectionProps) {
  return (
    <>
      <Q label="Favorite style of training">
        <Options
          value={p.style ?? 'mixed'}
          onChange={(v) => set({ style: v })}
          options={[
            { value: 'mixed', title: 'A combination', desc: 'Best tool for each job.' },
            { value: 'freeWeights', title: 'Mostly free weights' },
            { value: 'machines', title: 'Mostly machines' },
            { value: 'cables', title: 'Lots of cables' },
            { value: 'bodyweight', title: 'Mostly bodyweight' },
          ]}
        />
      </Q>
      <PickList label="Favorite exercises" hint="I’ll prioritize these." ids={p.favoriteExercises ?? []} onChange={(v) => set({ favoriteExercises: v })} />
      <PickList label="Exercises you dislike" hint="I’ll avoid these when there’s a good alternative." ids={p.dislikedExercises ?? []} onChange={(v) => set({ dislikedExercises: v })} />
      <PickList label="Exercises you can’t perform" hint="Never programmed." ids={p.cannotPerform ?? []} onChange={(v) => set({ cannotPerform: v })} />
      <Q label="Anything else about how you like to train?" hint="e.g. supersets, short rests, heavy singles, high-rep pump work.">
        <textarea className="input" value={p.trainingStyles ?? ''} onChange={(e) => set({ trainingStyles: e.target.value })} />
      </Q>
    </>
  );
}

export function HealthSection({ p, set }: SectionProps) {
  return (
    <>
      <Q label="Any injuries or limitations?" hint="Exercises that load these areas will be left out.">
        <Chips options={Object.keys(LIMIT_LABEL) as Limitation[]} value={p.limitations ?? []} onChange={(v) => set({ limitations: v })} labels={LIMIT_LABEL} />
      </Q>
      <Q label="Details" hint="Movements that hurt, or anything you’ve been advised to avoid.">
        <textarea className="input" value={p.limitationNotes ?? ''} onChange={(e) => set({ limitationNotes: e.target.value })} />
      </Q>
      <p className="foot" style={{ marginTop: 16 }}>
        This app doesn’t diagnose or treat injuries and isn’t a substitute for medical advice. If something hurts, stop and check with a qualified professional.
      </p>
    </>
  );
}

export function NutritionSection({ p, set }: SectionProps) {
  return (
    <>
      <Q label="Body-weight direction">
        <Options
          value={p.nutritionGoal}
          onChange={(v) => set({ nutritionGoal: v })}
          options={[
            { value: 'gain', title: 'Gain — build muscle', desc: 'Small calorie surplus.' },
            { value: 'lose', title: 'Lose — drop body fat', desc: 'Moderate calorie deficit.' },
            { value: 'maintain', title: 'Maintain', desc: 'Stay around current weight.' },
          ]}
        />
      </Q>
      <Q label="Dietary preferences" hint="e.g. high protein, vegetarian, intermittent fasting.">
        <input className="input" value={p.dietPreferences ?? ''} onChange={(e) => set({ dietPreferences: e.target.value })} />
      </Q>
      <Q label="Food restrictions or allergies">
        <input className="input" value={p.foodRestrictions ?? ''} onChange={(e) => set({ foodRestrictions: e.target.value })} />
      </Q>
      <div className="q row between">
        <div>
          <div style={{ fontWeight: 600 }}>Track calories and macros</div>
          <div className="foot">Nutrition logging arrives in phase 3</div>
        </div>
        <Toggle on={p.trackMacros ?? false} onChange={(v) => set({ trackMacros: v })} />
      </div>
    </>
  );
}

export function RecoverySection({ p, set }: SectionProps) {
  const scale = (key: 'recovery' | 'stress', lo: string, hi: string) => (
    <>
      <Segmented options={[1, 2, 3, 4, 5].map((n) => ({ value: n, label: String(n) }))} value={(p[key] ?? 3) as number} onChange={(v) => set({ [key]: v } as Draft)} />
      <div className="row between foot" style={{ marginTop: 6, padding: '0 4px' }}>
        <span>{lo}</span>
        <span>{hi}</span>
      </div>
    </>
  );
  return (
    <>
      <Q label="Average sleep per night">
        <Stepper value={p.sleepHours ?? 7} onChange={(v) => set({ sleepHours: v })} min={3} max={12} step={0.5} format={(v) => `${v} h`} />
      </Q>
      <Q label="How well do you usually recover?">{scale('recovery', 'Always sore', 'Bounce back fast')}</Q>
      <Q label="Day-to-day stress">{scale('stress', 'Low', 'Very high')}</Q>
      <Q label="Activity outside the gym">
        <Options
          value={p.outsideActivity ?? 'light'}
          onChange={(v) => set({ outsideActivity: v })}
          options={[
            { value: 'sedentary', title: 'Mostly sitting', desc: 'Desk job, few steps.' },
            { value: 'light', title: 'Lightly active', desc: 'Some walking most days.' },
            { value: 'moderate', title: 'Moderately active', desc: 'On your feet a lot, or sports weekly.' },
            { value: 'high', title: 'Very active', desc: 'Physical job or lots of sport.' },
          ]}
        />
      </Q>
    </>
  );
}

export const SECTIONS = [
  { key: 'about', title: 'About you', lead: 'The basics. Everything here can be changed later.', C: AboutSection, valid: (p: Draft) => !!p.age && !!p.heightIn && !!p.weightLbs },
  { key: 'goals', title: 'Your goals', lead: 'What are we working toward?', C: GoalsSection, valid: (p: Draft) => (p.goals?.length ?? 0) > 0 },
  { key: 'experience', title: 'Experience', lead: 'So I can pitch the program at the right level.', C: ExperienceSection, valid: (p: Draft) => !!p.experience },
  { key: 'schedule', title: 'Schedule', lead: 'When and how long you can train.', C: ScheduleSection, valid: (p: Draft) => !!p.daysPerWeek && !!p.sessionMinutes },
  { key: 'equipment', title: 'Equipment', lead: 'What you have access to.', C: EquipmentSection, valid: (p: Draft) => !!p.location && (p.equipment?.length ?? 0) > 0 },
  { key: 'preferences', title: 'Exercise preferences', lead: 'A program you enjoy is a program you’ll stick to.', C: PreferencesSection, valid: () => true },
  { key: 'health', title: 'Health & limitations', lead: 'So I can steer around anything that bothers you.', C: HealthSection, valid: () => true },
  { key: 'nutrition', title: 'Nutrition', lead: 'Food drives body composition more than anything else.', C: NutritionSection, valid: (p: Draft) => !!p.nutritionGoal },
  { key: 'recovery', title: 'Recovery', lead: 'Recovery decides how much training you can benefit from.', C: RecoverySection, valid: () => true },
] as const;
