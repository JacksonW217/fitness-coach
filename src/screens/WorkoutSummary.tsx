import { useLiveQuery } from 'dexie-react-hooks';
import { Trophy } from 'lucide-react';
import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { BackBar, Page, Section } from '../components/ui';
import { db } from '../db';
import { getExercise } from '../data/exercises';
import { bestE1rm, exposuresFor, recommend, sessionPRs, sessionVolume } from '../engine/progression';
import { useSessions } from '../lib/data';
import { fmtDate, fmtDuration, fmtNum } from '../lib/util';

export default function WorkoutSummary() {
  const { id } = useParams();
  const nav = useNavigate();
  const session = useLiveQuery(() => db.sessions.get(id!), [id], null);
  const all = useSessions();
  const done = useMemo(() => (all ?? []).filter((s) => s.status === 'done'), [all]);
  if (!session || !all) return null;

  const before = done.filter((s) => s.startedAt < session.startedAt);
  const prs = sessionPRs(session, before);
  const dur = session.endedAt ? new Date(session.endedAt).getTime() - new Date(session.startedAt).getTime() - session.pausedMs : 0;
  const work = session.exercises.flatMap((e) => e.sets.filter((s) => s.kind === 'work'));
  const doneSets = work.filter((s) => s.status === 'done').length;
  const prevSame = before.filter((s) => s.dayId && s.dayId === session.dayId).sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0];
  const vol = sessionVolume(session);
  const prevVol = prevSame ? sessionVolume(prevSame) : undefined;

  return (
    <Page noTabs>
      <BackBar title="" to="/" right={<button className="link-btn" onClick={() => nav('/')}>Done</button>} />
      <div className="eyebrow">{fmtDate(session.startedAt, { weekday: 'long', month: 'short', day: 'numeric' })}</div>
      <h1 className="large-title">{session.dayName}</h1>

      <div className="grid-2">
        <div className="card"><div className="foot">Duration</div><div className="mid-num">{fmtDuration(dur)}</div></div>
        <div className="card" style={{ marginTop: 0 }}>
          <div className="foot">Volume</div>
          <div className="mid-num">{fmtNum(vol)} <span className="foot">lb</span></div>
          {prevVol !== undefined && prevVol > 0 && <div className="foot">{vol >= prevVol ? '+' : ''}{fmtNum(((vol - prevVol) / prevVol) * 100)}% vs last {session.dayName}</div>}
        </div>
        <div className="card" style={{ marginTop: 0 }}><div className="foot">Working sets</div><div className="mid-num">{doneSets}/{work.length}</div></div>
        <div className="card" style={{ marginTop: 0 }}><div className="foot">Personal records</div><div className="mid-num">{prs.length}</div></div>
      </div>

      {prs.length > 0 && (
        <Section title="New records">
          <div className="card ink">
            {prs.map((p) => (
              <div key={p.exerciseId} className="row between" style={{ padding: '4px 0' }}>
                <span className="row" style={{ gap: 8 }}><Trophy size={16} /> {getExercise(p.exerciseId).name}</span>
                <span className="num" style={{ fontWeight: 700 }}>{p.weight ? `${p.weight} × ${p.reps}` : `${p.reps} reps`}</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      <Section title="Exercises">
        <div className="stack">
          {session.exercises.map((ex) => {
            const def = getExercise(ex.exerciseId);
            const sets = ex.sets.filter((s) => s.kind === 'work' && s.status === 'done');
            const hist = exposuresFor(ex.exerciseId, [...before, session]);
            const prior = exposuresFor(ex.exerciseId, before)[0];
            const cur = hist.find((h) => h.sessionId === session.id);
            const delta = cur && prior ? bestE1rm(cur) - bestE1rm(prior) : undefined;
            const next = recommend(def, { sets: Math.max(1, ex.sets.filter((s) => s.kind === 'work').length), repMin: ex.repMin, repMax: ex.repMax }, hist);
            return (
              <div key={ex.id} className="card">
                <div className="row between">
                  <div className="headline">{def.name}</div>
                  {delta !== undefined && Math.abs(delta) >= 0.5 && (
                    <span className={`badge ${delta > 0 ? 'good' : 'warn'}`}>{delta > 0 ? '▲' : '▼'} {fmtNum(Math.abs(delta))} lb est. max</span>
                  )}
                </div>
                <div className="sub num" style={{ marginTop: 4 }}>
                  {sets.length ? sets.map((s) => (s.weight ? `${s.weight}×${s.reps}` : `${s.reps}`) + (s.rpe ? ` @${s.rpe}` : '')).join(' · ') : 'No working sets logged'}
                </div>
                {ex.notes && <div className="foot" style={{ marginTop: 4 }}>“{ex.notes}”</div>}
                {sets.length > 0 && <div className="rec" style={{ marginTop: 8 }}><b>Next time:</b> {next.message}</div>}
              </div>
            );
          })}
        </div>
      </Section>
      {session.notes && (
        <Section title="Notes">
          <div className="card sub" style={{ color: 'var(--ink)' }}>{session.notes}</div>
        </Section>
      )}
      {session.optimized && (
        <Section title="Optimized session">
          <div className="card sub" style={{ fontSize: 14 }}>{session.optimized.stimulusNote}</div>
        </Section>
      )}
      {session.feeling && <p className="foot" style={{ margin: '16px 4px' }}>Started feeling: {session.feeling}</p>}
    </Page>
  );
}
