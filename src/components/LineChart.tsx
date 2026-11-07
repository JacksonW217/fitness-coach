import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { fmtDate, fmtNum } from '../lib/util';

export interface Point {
  x: string; // date key or ISO
  y: number;
}

/**
 * Single-series line chart: 2px black line, recessive axis labels, optional
 * dashed goal line, crosshair + tooltip on touch/hover.
 */
export function LineChart({
  points,
  height = 160,
  goal,
  unit = '',
  digits = 1,
  smooth,
}: {
  points: Point[];
  height?: number;
  goal?: number;
  unit?: string;
  digits?: number;
  /** Optional secondary series (e.g. 7-day average) drawn as the main line; raw points as dots. */
  smooth?: Point[];
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(320);
  const [hover, setHover] = useState<number | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    setW(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const padL = 4, padR = 40, padT = 26, padB = 22;
  const geo = useMemo(() => {
    if (!points.length) return null;
    const ts = points.map((p) => new Date(p.x.length === 10 ? p.x + 'T12:00:00' : p.x).getTime());
    const ys = points.map((p) => p.y).concat(goal !== undefined ? [goal] : []);
    let lo = Math.min(...ys), hi = Math.max(...ys);
    if (hi - lo < 1e-6) { lo -= 1; hi += 1; }
    const pad = (hi - lo) * 0.12;
    lo -= pad; hi += pad;
    const t0 = Math.min(...ts), t1 = Math.max(...ts);
    const sx = (t: number) => padL + (t1 === t0 ? (w - padL - padR) / 2 : ((t - t0) / (t1 - t0)) * (w - padL - padR));
    const sy = (y: number) => padT + (1 - (y - lo) / (hi - lo)) * (height - padT - padB);
    return { ts, sx, sy, lo, hi, t0, t1 };
  }, [points, goal, w, height]);

  if (!geo) return null;
  const { ts, sx, sy, lo, hi } = geo;
  const xy = points.map((p, i) => [sx(ts[i]), sy(p.y)] as const);
  const line = (pts: (readonly [number, number])[]) => pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const smoothXY = smooth?.map((p) => [sx(new Date(p.x.length === 10 ? p.x + 'T12:00:00' : p.x).getTime()), sy(p.y)] as const);

  const onMove = (clientX: number) => {
    const r = ref.current!.getBoundingClientRect();
    const x = clientX - r.left;
    let best = 0;
    xy.forEach((p, i) => { if (Math.abs(p[0] - x) < Math.abs(xy[best][0] - x)) best = i; });
    setHover(best);
  };

  const ticks = [hi - (hi - lo) * 0.12, lo + (hi - lo) * 0.12];
  const h = hover !== null ? xy[hover] : null;

  return (
    <div
      className="chart"
      ref={ref}
      style={{ height }}
      onPointerMove={(e) => onMove(e.clientX)}
      onPointerDown={(e) => onMove(e.clientX)}
      onPointerLeave={() => setHover(null)}
      role="img"
      aria-label={`Chart of ${points.length} entries from ${fmtNum(Math.min(...points.map((p) => p.y)), digits)} to ${fmtNum(Math.max(...points.map((p) => p.y)), digits)} ${unit}`}
    >
      <svg width={w} height={height}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={w - padR} y1={sy(t)} y2={sy(t)} stroke="var(--line)" strokeWidth={1} />
            <text x={w - padR + 6} y={sy(t) + 4} fontSize={11} fill="var(--ink-3)" className="num">{fmtNum(t, t > 100 ? 0 : 1)}</text>
          </g>
        ))}
        {goal !== undefined && (
          <g>
            <line x1={padL} x2={w - padR} y1={sy(goal)} y2={sy(goal)} stroke="var(--ink-2)" strokeDasharray="4 4" strokeWidth={1} />
            <text x={w - padR + 6} y={sy(goal) + 4} fontSize={11} fill="var(--ink-2)" fontWeight={600}>Goal</text>
          </g>
        )}
        {smoothXY ? (
          <>
            {xy.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r={2.5} fill="var(--ink-3)" />)}
            <path d={line(smoothXY)} fill="none" stroke="var(--ink)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          </>
        ) : (
          <>
            <path d={line(xy)} fill="none" stroke="var(--ink)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            {xy.length <= 24 && xy.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r={3.5} fill="var(--ink)" stroke="var(--bg)" strokeWidth={2} />)}
          </>
        )}
        <text x={padL} y={height - 4} fontSize={11} fill="var(--ink-3)">{fmtDate(points[0].x)}</text>
        {points.length > 1 && <text x={w - padR} y={height - 4} fontSize={11} fill="var(--ink-3)" textAnchor="end">{fmtDate(points.at(-1)!.x)}</text>}
        {h && (
          <g>
            <line x1={h[0]} x2={h[0]} y1={padT - 4} y2={height - padB} stroke="var(--ink-3)" strokeWidth={1} />
            <circle cx={h[0]} cy={h[1]} r={5} fill="var(--ink)" stroke="var(--bg)" strokeWidth={2} />
          </g>
        )}
      </svg>
      {hover !== null && h && (
        <div className="tip" style={{ left: Math.min(Math.max(h[0], 50), w - 50) }}>
          {fmtNum(points[hover].y, digits)} {unit} · {fmtDate(points[hover].x)}
        </div>
      )}
    </div>
  );
}

/** Simple vertical bars (e.g. weekly volume). */
export function Bars({ data, height = 120, unit = '' }: { data: { label: string; value: number }[]; height?: number; unit?: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div style={{ position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height }} onPointerLeave={() => setHover(null)}>
        {data.map((d, i) => (
          <div key={i} style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', cursor: 'default' }} onPointerEnter={() => setHover(i)} onPointerDown={() => setHover(i)}>
            <div
              style={{
                height: `${Math.max(d.value ? 3 : 0, (d.value / max) * 100)}%`,
                background: hover === i ? 'var(--ink)' : d.value ? 'var(--ink)' : 'transparent',
                opacity: hover === null || hover === i ? 1 : 0.35,
                borderRadius: '4px 4px 0 0',
              }}
            />
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
        {data.map((d, i) => (
          <div key={i} className="foot" style={{ flex: 1, textAlign: 'center', fontSize: 11 }}>{d.label}</div>
        ))}
      </div>
      {hover !== null && (
        <div className="foot num" style={{ position: 'absolute', top: -22, left: 0, right: 0, textAlign: 'center', color: 'var(--ink)', fontWeight: 600 }}>
          {data[hover].label}: {fmtNum(data[hover].value)} {unit}
        </div>
      )}
    </div>
  );
}
