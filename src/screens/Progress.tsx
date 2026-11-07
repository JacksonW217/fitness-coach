import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Bars, LineChart } from '../components/LineChart';
import { LogWeightSheet } from '../components/LogWeightSheet';
import { Empty, Field, ListRow, NumberInput, Page, Section, Segmented, Sheet } from '../components/ui';
import { db } from '../db';
import { getExercise, MUSCLE_LABEL } from '../data/exercises';
import { weeklySetsByMuscle } from '../engine/insights';
import { analyzeTrend, bestE1rm, exposuresFor, sessionVolume, type Trend } from '../engine/progression';
import { useMeasurements, useProfile, useSessions, useWeights } from '../lib/data';
import { dateKey, fmtDate, fmtDuration, fmtNum, parseDateKey, startOfWeek, uid } from '../lib/util';
import type { BodyWeight, MeasurementKey, Muscle, Session } from '../types';
import { MEASURE_LABEL } from './profileSections';

type Tab = 'body' | 'strength' | 'workouts';

export default function Progress() {
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab) || 'body';
  return (
    <Page>
      <div style={{ paddingTop: 12 }}>
        <h1 className="large-title">Progress</h1>
      </div>
      <Segmented
        options={[
          { value: 'body', label: 'Body' },
          { value: 'strength', label: 'Strength' },
          { value: 'workouts', label: 'Workouts' },
        ]}
        value={tab}
        onChange={(v) => setParams({ tab: v }, { replace: true })}
      />
      {tab === 'body' && <BodyTab />}
      {tab === 'strength' && <StrengthTab />}
      {tab === 'workouts' && <WorkoutsTab />}
    </Page>
  );
}

function movingAvg(entries: BodyWeight[], days = 7) {
  return entries.map((e) => {
    const end = parseDateKey(e.date).getTime();
    const win = entries.filter((x) => {
      const t = parseDateKey(x.date).getTime();
      return t <= end && t > end - days * 86400000;
    });
    return { x: e.date, y: win.reduce((a, b) => a + b.lbs, 0) / win.length };
  });
}

function BodyTab() {
  const weights = useWeights() ?? [];
  const profile = useProfile();
  const measurements = useMeasurements() ?? [];
  const [range, setRange] = useState<'1M' | '3M' | '1Y' | 'All'>('3M');
  const [logOpen, setLogOpen] = useState(false);
  const [mOpen, setMOpen] = useState(false);

  const shown = useMemo(() => {
    const days = { '1M': 31, '3M': 92, '1Y': 366, All: 1e5 }[range];
    const cutoff = dateKey(new Date(Date.now() - days * 86400000));
    return weights.filter((w) => w.date >= cutoff);
  }, [weights, range]);

  const weekly = useMemo(() => {
    const m = new Map<string, number[]>();
    for (const w of weights) {
      const k = dateKey(startOfWeek(parseDateKey(w.date)));
      m.set(k, [...(m.get(k) ?? []), w.lbs]);
    }
    return [...m.entries()].map(([k, v]) => ({ week: k, avg: v.reduce((a, b) => a + b, 0) / v.length, n: v.length })).sort((a, b) => b.week.localeCompare(a.week));
  }, [weights]);

  const monthly = useMemo(() => {
    const m = new Map<string, number[]>();
    for (const w of weights) {
      const k = w.date.slice(0, 7);
      m.set(k, [...(m.get(k) ?? []), w.lbs]);
    }
    return [...m.entries()].map(([k, v]) => ({ month: k, avg: v.reduce((a, b) => a + b, 0) / v.length })).sort((a, b) => b.month.localeCompare(a.month));
  }, [weights]);

  const latest = weights.at(-1);
  const lastM = measurements.at(-1);

  return (
    <>
      <Section title="Body weight" action={<button className="link-btn" style={{ fontSize: 15 }} onClick={() => setLogOpen(true)}>Log</button>}>
        <div className="card">
          <div className="row between" style={{ alignItems: 'flex-end' }}>
            <div>
              <div className="big-num">{latest ? fmtNum(latest.lbs, 1) : '—'} <span className="sub" style={{ fontSize: 17 }}>lb</span></div>
              <div className="foot">{latest ? fmtDate(latest.date, { weekday: 'short', month: 'short', day: 'numeric' }) : 'No entries'}</div>
            </div>
            {weekly.length > 1 && (
              <div style={{ textAlign: 'right' }}>
                <div className="mid-num">{weekly[0].avg - weekly[1].avg >= 0 ? '+' : ''}{fmtNum(weekly[0].avg - weekly[1].avg, 1)}</div>
                <div className="foot">weekly avg change</div>
              </div>
            )}
          </div>
          <div style={{ marginTop: 12 }}>
            <Segmented options={(['1M', '3M', '1Y', 'All'] as const).map((r) => ({ value: r, label: r }))} value={range} onChange={setRange} />
          </div>
          {shown.length >= 2 ? (
            <div style={{ marginTop: 14 }}>
              <LineChart points={shown.map((w) => ({ x: w.date, y: w.lbs }))} smooth={shown.length >= 7 ? movingAvg(shown) : undefined} goal={profile?.targetWeightLbs} unit="lb" height={180} />
              {shown.length >= 7 && <div className="foot" style={{ marginTop: 6 }}>Line shows your 7-day average; dots are daily weigh-ins.</div>}
            </div>
          ) : (
            <div className="foot" style={{ marginTop: 12 }}>Log at least two days to see a chart.</div>
          )}
        </div>
      </Section>

      {weekly.length > 0 && (
        <Section title="Weekly averages">
          <div className="list">
            {weekly.slice(0, 8).map((w, i) => {
              const prev = weekly[i + 1];
              return (
                <ListRow
                  key={w.week}
                  title={`Week of ${fmtDate(w.week)}`}
                  subtitle={`${w.n} weigh-in${w.n > 1 ? 's' : ''}`}
                  value={`${fmtNum(w.avg, 1)} lb${prev ? `  ${w.avg - prev.avg >= 0 ? '+' : ''}${fmtNum(w.avg - prev.avg, 1)}` : ''}`}
                />
              );
            })}
          </div>
        </Section>
      )}

      {monthly.length > 1 && (
        <Section title="Monthly trend">
          <div className="list">
            {monthly.slice(0, 6).map((m, i) => {
              const prev = monthly[i + 1];
              return <ListRow key={m.month} title={parseDateKey(m.month + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} value={`${fmtNum(m.avg, 1)} lb${prev ? `  ${m.avg - prev.avg >= 0 ? '+' : ''}${fmtNum(m.avg - prev.avg, 1)}` : ''}`} />;
            })}
          </div>
        </Section>
      )}

      <Section title="Measurements" action={<button className="link-btn" style={{ fontSize: 15 }} onClick={() => setMOpen(true)}>Log</button>}>
        {lastM ? (
          <div className="card">
            <div className="foot" style={{ marginBottom: 8 }}>{fmtDate(lastM.date, { month: 'long', day: 'numeric', year: 'numeric' })}</div>
            <div className="grid-2">
              {(Object.keys(lastM.values) as MeasurementKey[]).filter((k) => lastM.values[k]).map((k) => {
                const prev = [...measurements].reverse().find((m) => m.date < lastM.date && m.values[k]);
                const d = prev ? lastM.values[k]! - prev.values[k]! : undefined;
                return (
                  <div key={k}>
                    <div className="foot">{MEASURE_LABEL[k]}</div>
                    <div style={{ fontWeight: 600 }} className="num">{lastM.values[k]}″ {d ? <span className="foot">{d > 0 ? '+' : ''}{fmtNum(d, 2)}</span> : null}</div>
                  </div>
                );
              })}
              {lastM.bodyFatPct && <div><div className="foot">Body fat</div><div style={{ fontWeight: 600 }}>{lastM.bodyFatPct}%</div></div>}
            </div>
          </div>
        ) : (
          <div className="card"><Empty title="No measurements yet">Waist, arms and more — tracked in inches.</Empty></div>
        )}
      </Section>

      {weights.length > 0 && (
        <Section title="All entries">
          <div className="list">
            {[...weights].reverse().slice(0, 60).map((w) => (
              <ListRow key={w.id} title={fmtDate(w.date, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })} value={`${fmtNum(w.lbs, 1)} lb`} onClick={() => confirm(`Delete ${w.lbs} lb on ${fmtDate(w.date)}?`) && db.bodyweights.delete(w.id)} chevron={false} />
            ))}
          </div>
          <div className="foot" style={{ margin: '8px 4px' }}>Tap an entry to delete it.</div>
        </Section>
      )}

      <LogWeightSheet open={logOpen} onClose={() => setLogOpen(false)} last={latest?.lbs ?? profile?.weightLbs} />
      <MeasureSheet open={mOpen} onClose={() => setMOpen(false)} last={lastM?.values} />
    </>
  );
}

function MeasureSheet({ open, onClose, last }: { open: boolean; onClose: () => void; last?: Partial<Record<MeasurementKey, number>> }) {
  const [vals, setVals] = useState<Partial<Record<MeasurementKey, number>>>({});
  const [bf, setBf] = useState<number | undefined>();
  return (
    <Sheet open={open} onClose={onClose} title="Log measurements">
      <div className="grid-2">
        {(Object.keys(MEASURE_LABEL) as MeasurementKey[]).map((k) => (
          <Field key={k} label={MEASURE_LABEL[k]}>
            <NumberInput value={vals[k]} onChange={(v) => setVals({ ...vals, [k]: v })} unit="in" placeholder={last?.[k] ? String(last[k]) : ''} />
          </Field>
        ))}
        <Field label="Body fat">
          <NumberInput value={bf} onChange={setBf} unit="%" />
        </Field>
      </div>
      <button
        className="btn"
        style={{ marginTop: 16 }}
        disabled={!Object.values(vals).some(Boolean) && !bf}
        onClick={async () => {
          const clean = Object.fromEntries(Object.entries(vals).filter(([, v]) => v));
          await db.measurements.add({ id: uid(), date: dateKey(), values: clean, bodyFatPct: bf });
          const p = await db.profile.get('me');
          if (p) await db.profile.update('me', { measurements: { ...p.measurements, ...clean }, ...(bf ? { bodyFatPct: bf } : {}) });
          setVals({});
          setBf(undefined);
          onClose();
        }}
      >
        Save
      </button>
    </Sheet>
  );
}

export const TREND_BADGE: Record<Trend, { label: string; cls: string }> = {
  new: { label: 'New', cls: '' },
  steady: { label: 'Building', cls: '' },
  improving: { label: '▲ Improving', cls: 'good' },
  stalled: { label: '■ Stalled', cls: 'warn' },
  declining: { label: '▼ Declining', cls: 'bad' },
};

function StrengthTab() {
  const nav = useNavigate();
  const sessions = useSessions() ?? [];
  const done = sessions.filter((s) => s.status === 'done');
  const rows = useMemo(() => {
    const ids = [...new Set(done.flatMap((s) => s.exercises.map((e) => e.exerciseId)))];
    return ids
      .map((id) => {
        const ex = exposuresFor(id, done);
        return { id, ex, best: Math.max(...ex.map(bestE1rm)), trend: analyzeTrend(ex), last: ex[0] };
      })
      .filter((r) => r.ex.length)
      .sort((a, b) => b.last.date.localeCompare(a.last.date));
  }, [done]);
  if (!rows.length) return <div className="card" style={{ marginTop: 20 }}><Empty title="No lifts logged yet">Finish a workout and your strength trends appear here.</Empty></div>;
  return (
    <Section>
      <div className="list">
        {rows.map((r) => {
          const def = getExercise(r.id);
          const top = r.last.sets.reduce((a, s) => (bestE1rm({ ...r.last, sets: [s] }) > bestE1rm({ ...r.last, sets: [a] }) ? s : a));
          const b = TREND_BADGE[r.trend.trend];
          return (
            <ListRow
              key={r.id}
              title={def.name}
              subtitle={`Last: ${top.weight ? `${top.weight} × ${top.reps}` : `${top.reps} reps`} · ${fmtDate(r.last.date)}${def.increment ? ` · est. max ${fmtNum(r.best)} lb` : ''}`}
              right={<span className={`badge ${b.cls}`}>{b.label}</span>}
              onClick={() => nav(`/progress/exercise/${r.id}`)}
            />
          );
        })}
      </div>
    </Section>
  );
}

function WorkoutsTab() {
  const nav = useNavigate();
  const sessions = useSessions() ?? [];
  const done = sessions.filter((s) => s.status === 'done');
  const weeks = useMemo(() => {
    const out: { label: string; value: number }[] = [];
    const start = startOfWeek();
    for (let i = 7; i >= 0; i--) {
      const ws = new Date(start);
      ws.setDate(ws.getDate() - i * 7);
      const we = new Date(ws);
      we.setDate(we.getDate() + 7);
      const v = done.filter((s) => new Date(s.startedAt) >= ws && new Date(s.startedAt) < we).reduce((a, s) => a + sessionVolume(s), 0);
      out.push({ label: `${ws.getMonth() + 1}/${ws.getDate()}`, value: v });
    }
    return out;
  }, [done]);
  const sets = weeklySetsByMuscle(done, startOfWeek());
  const muscles = (Object.keys(MUSCLE_LABEL) as Muscle[]).filter((m) => (sets[m] ?? 0) > 0).sort((a, b) => (sets[b] ?? 0) - (sets[a] ?? 0));

  if (!done.length) return <div className="card" style={{ marginTop: 20 }}><Empty title="No workouts yet">Your history, volume and weekly sets will show here.</Empty></div>;
  return (
    <>
      <Section title="Weekly volume">
        <div className="card" style={{ paddingTop: 30 }}>
          <Bars data={weeks} unit="lb" />
        </div>
      </Section>
      {muscles.length > 0 && (
        <Section title="Sets per muscle this week">
          <div className="card stack-sm">
            {muscles.map((m) => (
              <div key={m} className="row" style={{ gap: 10 }}>
                <span style={{ width: 92 }} className="sub">{MUSCLE_LABEL[m]}</span>
                <div style={{ flex: 1 }} className="bar"><i style={{ width: `${Math.min(100, ((sets[m] ?? 0) / 20) * 100)}%` }} /></div>
                <span className="num" style={{ width: 32, textAlign: 'right', fontWeight: 600 }}>{fmtNum(sets[m] ?? 0, 1)}</span>
              </div>
            ))}
            <div className="foot" style={{ marginTop: 8 }}>Secondary muscles count as half a set. Bar fills at 20 sets.</div>
          </div>
        </Section>
      )}
      <Section title="History">
        <div className="list">
          {done.map((s: Session) => (
            <ListRow
              key={s.id}
              title={s.dayName}
              subtitle={`${fmtDate(s.startedAt, { weekday: 'short', month: 'short', day: 'numeric' })} · ${s.endedAt ? fmtDuration(new Date(s.endedAt).getTime() - new Date(s.startedAt).getTime() - s.pausedMs) : ''} · ${fmtNum(sessionVolume(s))} lb`}
              onClick={() => nav(`/workout/${s.id}/summary`)}
            />
          ))}
        </div>
      </Section>
    </>
  );
}
