import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { LineChart } from '../components/LineChart';
import { BackBar, Page, Section } from '../components/ui';
import { getExercise, MUSCLE_LABEL } from '../data/exercises';
import { analyzeTrend, bestE1rm, exposuresFor, topWeight } from '../engine/progression';
import { useSessions } from '../lib/data';
import { fmtDate, fmtNum } from '../lib/util';
import { TREND_BADGE } from './Progress';

export default function ExerciseDetail() {
  const { id } = useParams();
  const sessions = useSessions();
  const def = getExercise(id!);
  const hist = useMemo(() => exposuresFor(id!, (sessions ?? []).filter((s) => s.status === 'done')), [id, sessions]);
  if (!sessions) return null;
  const trend = analyzeTrend(hist);
  const chron = [...hist].reverse();
  const loaded = def.increment > 0;
  const best = Math.max(0, ...hist.map(bestE1rm));
  const b = TREND_BADGE[trend.trend];

  return (
    <Page noTabs>
      <BackBar title={def.name} />
      <div className="row between" style={{ margin: '8px 4px 0' }}>
        <span className="sub">{MUSCLE_LABEL[def.muscle]}</span>
        <span className={`badge ${b.cls}`}>{b.label}</span>
      </div>
      <div className="grid-2" style={{ marginTop: 16 }}>
        <div className="card">
          <div className="foot">{loaded ? 'Best est. 1-rep max' : 'Best reps'}</div>
          <div className="mid-num">{fmtNum(best)}{loaded && <span className="foot"> lb</span>}</div>
        </div>
        <div className="card" style={{ marginTop: 0 }}>
          <div className="foot">Sessions</div>
          <div className="mid-num">{hist.length}</div>
        </div>
      </div>
      <p className="sub" style={{ margin: '12px 4px 0' }}>{trend.detail}</p>

      {chron.length >= 2 && (
        <Section title={loaded ? 'Estimated max' : 'Best set'}>
          <div className="card">
            <LineChart points={chron.map((x) => ({ x: x.date, y: bestE1rm(x) }))} unit={loaded ? 'lb' : 'reps'} digits={0} />
            {loaded && <div className="foot" style={{ marginTop: 6 }}>Estimated with the Epley formula from your best set each session.</div>}
          </div>
        </Section>
      )}
      {loaded && chron.length >= 2 && (
        <Section title="Top working weight">
          <div className="card">
            <LineChart points={chron.map((x) => ({ x: x.date, y: topWeight(x) }))} unit="lb" digits={0} />
          </div>
        </Section>
      )}

      <Section title="History">
        <div className="list">
          {hist.map((x) => (
            <div className="list-row" key={x.sessionId}>
              <div className="grow">
                <div style={{ fontWeight: 500 }}>{fmtDate(x.date, { weekday: 'short', month: 'short', day: 'numeric' })}</div>
                <div className="foot num">{x.sets.map((s) => (s.weight ? `${s.weight}×${s.reps}` : `${s.reps}`) + (s.rpe ? `@${s.rpe}` : '')).join(' · ')}</div>
              </div>
              {loaded && <div className="value num">{fmtNum(bestE1rm(x))}</div>}
            </div>
          ))}
        </div>
      </Section>

      <Section title="Technique">
        <div className="card">
          <ul className="sub" style={{ margin: 0, paddingLeft: 18 }}>{def.cues.map((c) => <li key={c}>{c}</li>)}</ul>
        </div>
      </Section>
    </Page>
  );
}
