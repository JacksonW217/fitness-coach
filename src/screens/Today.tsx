import { Activity, AlertTriangle, BarChart3, CalendarDays, Dumbbell, Info, Play, Scale, TrendingUp, Trophy } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { dayMeta } from '../components/DayList';
import { LineChart } from '../components/LineChart';
import { LogWeightSheet } from '../components/LogWeightSheet';
import { StartWorkoutSheet } from '../components/StartWorkoutSheet';
import { Bar, Page, Section } from '../components/ui';
import { getExercise } from '../data/exercises';
import { buildInsights, consistency, nextTrainingDay, recentPRs, todaysDay, weekStats, weightTrend, type Insight } from '../engine/insights';
import { bestE1rm, exposuresFor, sessionVolume } from '../engine/progression';
import { useActiveProgram, useActiveSession, useProfile, useSessions, useWeights } from '../lib/data';
import { dateKey, fmtDate, fmtDuration, fmtNum, startOfWeek, WEEKDAYS, WEEKDAYS_LONG } from '../lib/util';
import type { Profile, Program, Session, Weekday } from '../types';

const toneIcon = (t: Insight['tone']) => (t === 'progress' ? <TrendingUp size={18} /> : t === 'caution' ? <AlertTriangle size={18} /> : <Info size={18} />);

export default function Today() {
  const nav = useNavigate();
  const profile = useProfile();
  const program = useActiveProgram();
  const sessions = useSessions() ?? [];
  const weights = useWeights() ?? [];
  const active = useActiveSession();
  const [weightOpen, setWeightOpen] = useState(false);
  const [startOpen, setStartOpen] = useState(false);

  const done = useMemo(() => sessions.filter((s) => s.status === 'done'), [sessions]);
  const insights = useMemo(() => (profile ? buildInsights({ profile, program: program ?? undefined, sessions, weights }) : []), [profile, program, sessions, weights]);
  if (!profile || !program) return null;

  const now = new Date();
  const today = todaysDay(program);
  const next = nextTrainingDay(program);
  const doneToday = done.find((s) => dateKey(new Date(s.startedAt)) === dateKey());
  const trainingIds = ([1, 2, 3, 4, 5, 6, 0] as Weekday[]).map((d) => program.schedule[d]).filter(Boolean) as string[];
  const position = today ? trainingIds.indexOf(today.id) + 1 : 0;
  const hour = now.getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const goal = profile.goals[0];
  const bodyFirst = goal === 'fatLoss' || goal === 'physique' || goal === 'maintain';

  const body = <BodyCard profile={profile} weights={weights} onLog={() => setWeightOpen(true)} onOpen={() => nav('/progress')} />;
  const perf = <PerformanceCard sessions={done} onOpen={() => nav('/progress?tab=strength')} programRef={program} />;

  return (
    <Page>
      <div style={{ paddingTop: 12 }}>
        <div className="eyebrow">{now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</div>
        <h1 className="large-title">{greet}{profile.name ? `, ${profile.name.split(' ')[0]}` : ''}</h1>
      </div>

      {active && (
        <button className="card ink" style={{ width: '100%', textAlign: 'left', border: 'none', marginBottom: 12 }} onClick={() => nav('/workout')}>
          <div className="row between">
            <div>
              <div className="eyebrow" style={{ color: 'rgba(255,255,255,0.6)' }}>{active.pausedAt ? 'Paused' : 'In progress'}</div>
              <div className="title" style={{ marginTop: 2 }}>{active.dayName}</div>
              <div className="sub">Started {fmtDuration(Date.now() - new Date(active.startedAt).getTime() - active.pausedMs)} ago</div>
            </div>
            <span className="btn white sm">Resume</span>
          </div>
        </button>
      )}

      {!active && (
        <div className="card ink">
          {today ? (
            <>
              <div className="eyebrow" style={{ color: 'rgba(255,255,255,0.6)' }}>
                Today · Day {position} of {trainingIds.length} · {program.split}
              </div>
              <div className="title" style={{ fontSize: 28, marginTop: 4 }}>{today.name}</div>
              <div className="sub" style={{ marginTop: 2 }}>{today.focus}</div>
              <div className="sub" style={{ marginTop: 2 }}>{dayMeta(today)}</div>
              {doneToday ? (
                <div className="row" style={{ marginTop: 16, gap: 10 }}>
                  <span className="badge" style={{ background: 'rgba(255,255,255,0.16)', color: '#fff' }}>✓ Completed</span>
                  <button className="btn white sm" onClick={() => nav(`/workout/${doneToday.id}/summary`)}>View summary</button>
                </div>
              ) : (
                <div className="btn-row" style={{ marginTop: 16 }}>
                  <button className="btn white" onClick={() => setStartOpen(true)}>
                    <Play size={18} fill="#000" /> Start workout
                  </button>
                  <button className="btn sm" style={{ height: 50, background: 'rgba(255,255,255,0.14)', flex: 'none', width: 'auto' }} onClick={() => nav(`/program/day/${today.id}`)}>
                    Preview
                  </button>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="eyebrow" style={{ color: 'rgba(255,255,255,0.6)' }}>Today</div>
              <div className="title" style={{ fontSize: 28, marginTop: 4 }}>Rest & recover</div>
              <div className="sub" style={{ marginTop: 4 }}>
                {next ? `Next: ${next.day.name} on ${WEEKDAYS_LONG[next.date.getDay()]}.` : ''} Light walking or mobility is a good idea on rest days.
              </div>
              <button className="btn white sm" style={{ marginTop: 16 }} onClick={() => setStartOpen(true)}>
                Train anyway
              </button>
            </>
          )}
        </div>
      )}

      <Section title="Coach">
        <div className="card">
          {insights.slice(0, 5).map((i) => (
            <div className="insight" key={i.id}>
              <div className="ic">{toneIcon(i.tone)}</div>
              <div>
                <div style={{ fontWeight: 600 }}>{i.title}</div>
                <div className="sub" style={{ fontSize: 14, marginTop: 2 }}>{i.body}</div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {bodyFirst ? (
        <>
          {body}
          {perf}
        </>
      ) : (
        <>
          {perf}
          {body}
        </>
      )}

      <Milestones profile={profile} sessions={done} weights={weights} />

      <Section title="Quick actions">
        <div className="grid-2">
          <QuickAction icon={<Dumbbell size={20} />} label="Start workout" onClick={() => (active ? nav('/workout') : setStartOpen(true))} />
          <QuickAction icon={<Scale size={20} />} label="Log weight" onClick={() => setWeightOpen(true)} />
          <QuickAction icon={<BarChart3 size={20} />} label="View progress" onClick={() => nav('/progress')} />
          <QuickAction icon={<CalendarDays size={20} />} label="Edit program" onClick={() => nav('/program')} />
        </div>
      </Section>

      <LogWeightSheet open={weightOpen} onClose={() => setWeightOpen(false)} last={weights.at(-1)?.lbs ?? profile.weightLbs} />
      <StartWorkoutSheet open={startOpen} onClose={() => setStartOpen(false)} days={program.days} programId={program.id} defaultDayId={today?.id ?? next?.day.id} />
    </Page>
  );
}

function QuickAction({ icon, label, onClick }: { icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <button className="card" style={{ border: 'none', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 18, margin: 0 }} onClick={onClick}>
      {icon}
      <span style={{ fontWeight: 600 }}>{label}</span>
    </button>
  );
}

function BodyCard({ profile, weights, onLog, onOpen }: { profile: Profile; weights: { date: string; lbs: number }[]; onLog: () => void; onOpen: () => void }) {
  const trend = weightTrend(weights as never);
  const recent = weights.slice(-30);
  const latest = weights.at(-1);
  return (
    <Section title="Body" action={<button className="link-btn" style={{ fontSize: 15 }} onClick={onLog}>Log weight</button>}>
      <div className="card" onClick={onOpen} style={{ cursor: 'pointer' }}>
        <div className="row between" style={{ alignItems: 'flex-end' }}>
          <div>
            <div className="foot">Current weight</div>
            <div className="big-num">
              {latest ? fmtNum(latest.lbs, 1) : '—'}
              <span className="sub" style={{ fontSize: 17, fontWeight: 500 }}> lb</span>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            {trend?.weeklyChange !== undefined ? (
              <>
                <div className="mid-num">{trend.weeklyChange >= 0 ? '+' : ''}{fmtNum(trend.weeklyChange, 1)}</div>
                <div className="foot">vs last week’s avg</div>
              </>
            ) : (
              <div className="foot">Log a few days to see your trend</div>
            )}
          </div>
        </div>
        {recent.length >= 2 && (
          <div style={{ marginTop: 14 }}>
            <LineChart points={recent.map((w) => ({ x: w.date, y: w.lbs }))} height={120} goal={profile.targetWeightLbs} unit="lb" />
          </div>
        )}
        {profile.targetWeightLbs && latest && (
          <div className="foot" style={{ marginTop: 8 }}>
            Goal {profile.targetWeightLbs} lb · {fmtNum(Math.abs(profile.targetWeightLbs - latest.lbs), 1)} lb to go
          </div>
        )}
        {profile.measurements?.waist && <div className="foot">Waist {profile.measurements.waist}″</div>}
      </div>
    </Section>
  );
}

function PerformanceCard({ sessions, onOpen, programRef }: { sessions: Session[]; onOpen: () => void; programRef: Program }) {
  const wk = weekStats(sessions);
  const cons = consistency(programRef, sessions);
  const prs = recentPRs(sessions, 3);
  const vol = wk.sessions.reduce((a, s) => a + sessionVolume(s), 0);
  const start = startOfWeek();
  const todayKey = dateKey();
  const order: Weekday[] = [1, 2, 3, 4, 5, 6, 0];
  return (
    <Section title="Performance" action={<button className="link-btn" style={{ fontSize: 15 }} onClick={onOpen}>Details</button>}>
      <div className="card">
        <div className="row between">
          <div className="dots">
            {order.map((d, i) => {
              const date = new Date(start);
              date.setDate(start.getDate() + i);
              const k = dateKey(date);
              const did = sessions.some((s) => dateKey(new Date(s.startedAt)) === k);
              const planned = !!programRef.schedule[d];
              return (
                <div key={d} className={`dot${did ? ' done' : planned ? ' planned' : ''}${k === todayKey ? ' today' : ''}`} title={WEEKDAYS[d]}>
                  {WEEKDAYS[d][0]}
                </div>
              );
            })}
          </div>
        </div>
        <div className="grid-2" style={{ marginTop: 16 }}>
          <div>
            <div className="foot">Volume this week</div>
            <div className="mid-num">{fmtNum(vol)} <span className="foot">lb</span></div>
          </div>
          <div>
            <div className="foot">Consistency (4 wk)</div>
            <div className="mid-num">{cons ? `${cons.pct}%` : '—'}</div>
            {cons && <div style={{ marginTop: 6 }}><Bar pct={cons.pct} /></div>}
          </div>
        </div>
        {prs.length > 0 && (
          <>
            <div className="divider" />
            <div className="foot" style={{ marginBottom: 6 }}>Recent personal records</div>
            {prs.map((p) => (
              <div key={p.date + p.exerciseId} className="row between" style={{ padding: '4px 0' }}>
                <span className="row" style={{ gap: 8 }}><Trophy size={15} /> {getExercise(p.exerciseId).name}</span>
                <span className="num" style={{ fontWeight: 600 }}>{p.weight ? `${p.weight} × ${p.reps}` : `${p.reps} reps`} <span className="foot">{fmtDate(p.date)}</span></span>
              </div>
            ))}
          </>
        )}
        {!sessions.length && <div className="foot" style={{ marginTop: 12 }}>Complete a workout to start tracking volume, PRs and consistency.</div>}
      </div>
    </Section>
  );
}

function Milestones({ profile, sessions, weights }: { profile: Profile; sessions: Session[]; weights: { date: string; lbs: number }[] }) {
  const items: { label: string; detail: string; pct: number }[] = [];
  const latest = weights.at(-1)?.lbs;
  const first = weights[0]?.lbs;
  if (profile.targetWeightLbs && latest && first !== undefined) {
    const total = profile.targetWeightLbs - first;
    const doneAmt = latest - first;
    const pct = total === 0 ? 100 : Math.max(0, Math.min(100, (doneAmt / total) * 100));
    items.push({ label: `Reach ${profile.targetWeightLbs} lb`, detail: `${fmtNum(first, 1)} → ${fmtNum(latest, 1)} lb`, pct });
  }
  const n = sessions.length;
  const nextCount = [1, 5, 10, 25, 50, 100, 150, 200, 300, 500].find((x) => x > n) ?? n + 100;
  items.push({ label: nextCount === 1 ? 'First workout' : `${nextCount} workouts`, detail: `${n} completed`, pct: (n / nextCount) * 100 });
  const bw = latest ?? profile.weightLbs;
  const lifts: [string, number, string][] = [
    ['bench-press', 1, 'Bench press bodyweight'],
    ['back-squat', 1.5, 'Squat 1.5× bodyweight'],
    ['deadlift', 2, 'Deadlift 2× bodyweight'],
  ];
  for (const [id, mult, label] of lifts) {
    const ex = exposuresFor(id, sessions);
    if (!ex.length) continue;
    const best = Math.max(...ex.map(bestE1rm));
    const target = bw * mult;
    if (best < target) items.push({ label, detail: `Est. max ${fmtNum(best)} of ${fmtNum(target)} lb`, pct: (best / target) * 100 });
  }
  return (
    <Section title="Milestones">
      <div className="card">
        {profile.milestone && (
          <div className="row" style={{ gap: 10, marginBottom: 14 }}>
            <Activity size={18} />
            <div><div style={{ fontWeight: 600 }}>{profile.milestone}</div><div className="foot">Your personal milestone</div></div>
          </div>
        )}
        <div className="stack">
          {items.map((m) => (
            <div key={m.label}>
              <div className="row between">
                <span style={{ fontWeight: 600 }}>{m.label}</span>
                <span className="foot num">{m.detail}</span>
              </div>
              <div style={{ marginTop: 6 }}><Bar pct={m.pct} /></div>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}
