import { ChevronLeft, Dumbbell } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../db';
import { chooseSplit, chooseTrainingDays, generateProgram } from '../engine/generator';
import { logChange } from '../lib/data';
import { fmtHeight, fmtNum, nowISO, WEEKDAYS_LONG } from '../lib/util';
import type { Profile } from '../types';
import { DEFAULT_DRAFT, GOAL_LABEL, LIMIT_LABEL, SECTIONS, type Draft } from './profileSections';

const KEY = 'forge.onboarding.draft';

function loadDraft(): { step: number; p: Draft } {
  try {
    const j = JSON.parse(localStorage.getItem(KEY) ?? '');
    if (j && j.p) return j;
  } catch {
    /* ignore */
  }
  return { step: 0, p: DEFAULT_DRAFT };
}

export default function Onboarding() {
  const nav = useNavigate();
  const [{ step, p }, setState] = useState(loadDraft);
  const total = SECTIONS.length + 2; // welcome + sections + summary
  const set = (patch: Draft) => setState((s) => ({ ...s, p: { ...s.p, ...patch } }));
  const go = (n: number) => {
    setState((s) => ({ ...s, step: n }));
    window.scrollTo(0, 0);
  };

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify({ step, p }));
    } catch {
      /* ignore */
    }
  }, [step, p]);

  // Existing profile → prefill (e.g. re-running onboarding)
  useEffect(() => {
    db.profile.get('me').then((existing) => {
      if (existing && step === 0) setState({ step: 0, p: existing });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finish = async () => {
    const profile: Profile = {
      ...(DEFAULT_DRAFT as Profile),
      ...p,
      id: 'me',
      createdAt: p.createdAt ?? nowISO(),
      updatedAt: nowISO(),
      equipment: Array.from(new Set([...(p.equipment ?? []), 'bodyweight'])),
    } as Profile;
    await db.profile.put(profile);
    // Record starting body weight once.
    const today = new Date();
    const key = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    if (!(await db.bodyweights.where('date').equals(key).first())) await db.bodyweights.add({ id: crypto.randomUUID().slice(0, 12), date: key, lbs: profile.weightLbs });
    const program = generateProgram(profile);
    await db.programs.where('status').equals('draft').delete();
    await db.programs.put(program);
    await logChange(program.id, 'created', `Generated “${program.name}”`, 'Built from your onboarding answers.');
    localStorage.removeItem(KEY);
    nav('/review', { replace: true });
  };

  if (step === 0) {
    return (
      <div className="ob">
        <div className="ob-body">
          <div className="hero-mark">
            <Dumbbell color="#fff" size={36} strokeWidth={2} />
          </div>
          <h1 style={{ fontSize: 40 }}>Your personal coach.</h1>
          <p className="lead" style={{ fontSize: 19 }}>
            A few questions about you, your goals and your schedule. I’ll build a program around your answers and adjust it from what you actually lift.
          </p>
          <div className="stack-sm sub" style={{ marginTop: 28 }}>
            <div>• About 5 minutes</div>
            <div>• Everything is editable later</div>
            <div>• Your data stays on this device</div>
          </div>
        </div>
        <div className="ob-foot">
          <button className="btn" onClick={() => go(1)}>
            Get started
          </button>
        </div>
      </div>
    );
  }

  const isSummary = step === total - 1;
  const sec = SECTIONS[step - 1];

  return (
    <div className="ob">
      <div className="ob-top">
        <button className="icon-btn plain" aria-label="Back" onClick={() => go(step - 1)} style={{ marginLeft: -8 }}>
          <ChevronLeft size={26} />
        </button>
        <div className="ob-progress">
          <i style={{ width: `${(step / (total - 1)) * 100}%` }} />
        </div>
        <span className="foot num" style={{ minWidth: 36, textAlign: 'right' }}>
          {step}/{total - 1}
        </span>
      </div>
      <div className="ob-body">
        {isSummary ? (
          <Summary p={p} onEdit={(i) => go(i + 1)} />
        ) : (
          <>
            <div className="eyebrow">Step {step} of {SECTIONS.length}</div>
            <h1>{sec.title}</h1>
            <p className="lead">{sec.lead}</p>
            <sec.C p={p} set={set} />
          </>
        )}
      </div>
      <div className="ob-foot">
        {isSummary ? (
          <button className="btn" onClick={finish}>
            Build my program
          </button>
        ) : (
          <button className="btn" disabled={!sec.valid(p)} onClick={() => go(step + 1)}>
            Continue
          </button>
        )}
      </div>
    </div>
  );
}

function Summary({ p, onEdit }: { p: Draft; onEdit: (i: number) => void }) {
  const full = { ...DEFAULT_DRAFT, ...p } as Profile;
  const split = chooseSplit(full);
  const days = chooseTrainingDays(full);
  const goal = full.goals[0];
  const proposed: string[] = [];
  if (goal) proposed.push(`Primary focus: ${GOAL_LABEL[goal].toLowerCase()}${full.goals.length > 1 ? `, then ${full.goals.slice(1).map((g) => GOAL_LABEL[g].toLowerCase()).join(', ')}` : ''}.`);
  if (full.targetWeightLbs && full.weightLbs) {
    const diff = full.targetWeightLbs - full.weightLbs;
    const rate = diff < 0 ? full.weightLbs * 0.0075 : full.weightLbs * 0.0035; // lb/week
    const weeks = Math.ceil(Math.abs(diff) / rate);
    proposed.push(
      `${diff < 0 ? 'Lose' : 'Gain'} ${fmtNum(Math.abs(diff), 1)} lb to reach ${full.targetWeightLbs} lb — about ${weeks} weeks at a sustainable ~${fmtNum(rate, 1)} lb/week.`,
    );
  }
  if (full.milestone) proposed.push(`Milestone: ${full.milestone}.`);
  proposed.push(`${split.name}, ${full.daysPerWeek}×/week on ${days.map((d) => WEEKDAYS_LONG[d]).join(', ')}.`);

  const rows: [string, string, number][] = [
    ['About you', [full.name, `${full.age} yrs`, full.heightIn ? fmtHeight(full.heightIn) : '', `${full.weightLbs} lb`, full.bodyFatPct ? `${full.bodyFatPct}% BF` : ''].filter(Boolean).join(' · '), 0],
    ['Goals', full.goals.map((g) => GOAL_LABEL[g]).join(' → '), 1],
    ['Experience', `${full.experience ?? '—'} · ${full.trainingYears} yrs`, 2],
    ['Schedule', `${full.daysPerWeek} days · ${full.sessionMinutes} min`, 3],
    ['Equipment', `${full.location ?? '—'} · ${full.equipment.length} types`, 4],
    ['Preferences', `${full.style}${full.favoriteExercises.length ? ` · ${full.favoriteExercises.length} favorites` : ''}`, 5],
    ['Limitations', full.limitations.length ? full.limitations.map((l) => LIMIT_LABEL[l]).join(', ') : 'None', 6],
    ['Nutrition', full.nutritionGoal ?? '—', 7],
    ['Recovery', `${full.sleepHours} h sleep · stress ${full.stress}/5`, 8],
  ];

  return (
    <>
      <div className="eyebrow">Summary</div>
      <h1>Here’s what I heard.</h1>
      <p className="lead">Check it over. Tap any row to change it.</p>
      <div className="card ink">
        <div className="eyebrow" style={{ color: 'rgba(255,255,255,0.6)' }}>Proposed plan</div>
        <div className="stack-sm" style={{ marginTop: 8 }}>
          {proposed.map((x) => (
            <div key={x}>{x}</div>
          ))}
        </div>
        {full.idealPhysique && <div className="sub" style={{ marginTop: 12 }}>“{full.idealPhysique}”</div>}
      </div>
      <div className="list" style={{ marginTop: 16 }}>
        {rows.map(([t, v, i]) => (
          <button key={t} className="list-row" onClick={() => onEdit(i)}>
            <div className="grow">
              <div style={{ fontWeight: 500 }}>{t}</div>
              <div className="foot" style={{ textTransform: 'capitalize' }}>{v}</div>
            </div>
          </button>
        ))}
      </div>
    </>
  );
}
