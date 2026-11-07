import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DayExercises, dayMeta } from '../components/DayList';
import { Page, Section } from '../components/ui';
import { db } from '../db';
import { generateProgram } from '../engine/generator';
import { activateProgram, logChange, useProfile } from '../lib/data';
import { WEEKDAYS } from '../lib/util';
import type { Weekday } from '../types';

export default function ProgramReview() {
  const nav = useNavigate();
  const profile = useProfile();
  const draft = useLiveQuery(() => db.programs.where('status').equals('draft').last(), [], null);
  const active = useLiveQuery(() => db.programs.where('status').equals('active').first(), [], null);

  useEffect(() => {
    if (profile === undefined) nav('/onboarding', { replace: true });
  }, [profile, nav]);

  useEffect(() => {
    // Profile exists but no draft and no active program → build one.
    if (profile && draft === undefined && active === undefined) {
      const p = generateProgram(profile);
      db.programs.put(p).then(() => logChange(p.id, 'created', `Generated “${p.name}”`, 'Built from your profile.'));
    }
  }, [profile, draft, active]);

  useEffect(() => {
    // Draft was just activated (or none pending) → go home.
    if (draft === undefined && active) nav('/', { replace: true });
  }, [draft, active, nav]);

  if (!draft) return <div className="app" />;

  const regenerate = async () => {
    if (!profile) return;
    const p = generateProgram(profile);
    await db.programs.delete(draft.id);
    await db.programs.put(p);
    await logChange(p.id, 'created', `Regenerated “${p.name}”`, 'Rebuilt from your current profile.');
  };

  const approve = async () => {
    await activateProgram(draft);
    nav('/', { replace: true });
  };

  const order: Weekday[] = [1, 2, 3, 4, 5, 6, 0];

  return (
    <Page noTabs>
      <div className="topbar">
        {active ? <button className="link-btn" onClick={() => nav(-1)}>Cancel</button> : <span />}
      </div>
      <div className="eyebrow">Your program</div>
      <h1 className="large-title">{draft.name}</h1>

      <div className="card">
        <div className="stack-sm">
          {draft.rationale.map((r) => (
            <div key={r} className="sub" style={{ color: 'var(--ink)' }}>{r}</div>
          ))}
        </div>
      </div>

      <Section title="Weekly schedule">
        <div className="row" style={{ gap: 6 }}>
          {order.map((d) => {
            const day = draft.days.find((x) => x.id === draft.schedule[d]);
            return (
              <div key={d} style={{ flex: 1, textAlign: 'center' }}>
                <div className="foot">{WEEKDAYS[d][0]}</div>
                <div className={`dot${day ? ' done' : ''}`} style={{ width: '100%', borderRadius: 10, height: 36, marginTop: 4 }}>
                  {day ? day.name.split(' ')[0].slice(0, 2) : ''}
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      {draft.days.map((day) => (
        <Section key={day.id} title={day.name} action={<span className="foot">{dayMeta(day)}</span>}>
          <div className="sub" style={{ margin: '-4px 4px 10px' }}>{day.focus}</div>
          <DayExercises day={day} />
        </Section>
      ))}

      <p className="foot" style={{ margin: '20px 4px' }}>
        After you approve, you can swap, reorder, add or remove exercises and change sets and reps anytime from the Program tab. Every change is recorded.
      </p>
      <div className="stack">
        <button className="btn" onClick={approve}>Approve & activate</button>
        <div className="btn-row">
          <button className="btn secondary" onClick={() => nav('/onboarding')}>Edit answers</button>
          <button className="btn secondary" onClick={regenerate}>Regenerate</button>
        </div>
      </div>
    </Page>
  );
}
