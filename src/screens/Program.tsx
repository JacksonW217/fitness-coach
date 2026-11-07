import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { dayMeta } from '../components/DayList';
import { ListRow, Options, Page, Section, Sheet } from '../components/ui';
import { db } from '../db';
import { generateProgram } from '../engine/generator';
import { logChange, saveProgram, useActiveProgram, useProfile } from '../lib/data';
import { fmtDate, WEEKDAYS_LONG } from '../lib/util';
import type { Weekday } from '../types';

export default function ProgramScreen() {
  const nav = useNavigate();
  const program = useActiveProgram();
  const profile = useProfile();
  const [why, setWhy] = useState(false);
  const [editDay, setEditDay] = useState<Weekday | null>(null);
  if (!program) return null;

  const order: Weekday[] = [1, 2, 3, 4, 5, 6, 0];
  const rebuild = async () => {
    if (!profile) return;
    if (!confirm('Build a new program from your current profile? You’ll review it before anything changes.')) return;
    const p = generateProgram(profile);
    await db.programs.where('status').equals('draft').delete();
    await db.programs.put(p);
    await logChange(p.id, 'created', `Generated “${p.name}”`, 'Rebuilt from your current profile.');
    nav('/review');
  };

  return (
    <Page>
      <div style={{ paddingTop: 12 }}>
        <div className="eyebrow">Active since {fmtDate(program.createdAt)}</div>
        <h1 className="large-title">{program.name}</h1>
      </div>

      <div className="card">
        <div className="sub" style={{ color: 'var(--ink)' }}>{program.rationale[0]}</div>
        {why && (
          <div className="stack-sm sub" style={{ marginTop: 8 }}>
            {program.rationale.slice(1).map((r) => <div key={r}>{r}</div>)}
          </div>
        )}
        <button className="link-btn" style={{ fontSize: 15, marginTop: 6 }} onClick={() => setWhy(!why)}>{why ? 'Less' : 'Why this program?'}</button>
      </div>

      <Section title="Week">
        <div className="list">
          {order.map((d) => {
            const day = program.days.find((x) => x.id === program.schedule[d]);
            return <ListRow key={d} title={WEEKDAYS_LONG[d]} value={day ? day.name : 'Rest'} onClick={() => setEditDay(d)} />;
          })}
        </div>
      </Section>

      <Section title="Workouts">
        <div className="list">
          {program.days.map((day) => (
            <ListRow key={day.id} title={day.name} subtitle={`${day.focus} · ${dayMeta(day)}`} onClick={() => nav(`/program/day/${day.id}`)} />
          ))}
        </div>
      </Section>

      <Section>
        <div className="list">
          <ListRow title="Change history" onClick={() => nav('/program/history')} />
          <ListRow title="Rebuild from my profile" subtitle="Generates a new program for you to review" onClick={rebuild} />
        </div>
      </Section>

      <Sheet open={editDay !== null} onClose={() => setEditDay(null)} title={editDay !== null ? WEEKDAYS_LONG[editDay] : ''}>
        {editDay !== null && (
          <Options
            value={program.schedule[editDay] ?? 'rest'}
            options={[{ value: 'rest', title: 'Rest day' }, ...program.days.map((d) => ({ value: d.id, title: d.name, desc: d.focus }))]}
            onChange={async (v) => {
              const p = structuredClone(program);
              const before = program.days.find((d) => d.id === program.schedule[editDay])?.name ?? 'Rest';
              p.schedule[editDay] = v === 'rest' ? null : v;
              const after = p.days.find((d) => d.id === p.schedule[editDay])?.name ?? 'Rest';
              await saveProgram(p, 'schedule', `${WEEKDAYS_LONG[editDay]}: ${before} → ${after}`, 'Manual schedule change.');
              setEditDay(null);
            }}
          />
        )}
      </Sheet>
    </Page>
  );
}
