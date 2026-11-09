import { Check, ChevronDown, MoreHorizontal, Pause, Play, Plus, Undo2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fmtRest } from '../components/DayList';
import { ExercisePicker } from '../components/ExercisePicker';
import { NumberInput, Page, Sheet, Toast, Toggle } from '../components/ui';
import { db } from '../db';
import { EXERCISES, getExercise, hasEquipment, MUSCLE_LABEL } from '../data/exercises';
import { exposuresFor, recommend, sessionVolume, warmupSets } from '../engine/progression';
import { logChange, useActiveProgram, useActiveSession, useProfile, useSessions } from '../lib/data';
import { fmtDate, fmtDuration, fmtNum, nowISO, uid } from '../lib/util';
import type { ExerciseDef, LoggedSet, Session, SessionExercise } from '../types';

const RPE = [6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10];

function elapsed(s: Session, now: number) {
  const paused = s.pausedMs + (s.pausedAt ? now - new Date(s.pausedAt).getTime() : 0);
  return now - new Date(s.startedAt).getTime() - paused;
}

function useNow(ms = 1000) {
  const [n, setN] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setN(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return n;
}

let audioCtx: AudioContext | undefined;
function beep() {
  try {
    audioCtx ??= new AudioContext();
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.2, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.4);
    o.connect(g).connect(audioCtx.destination);
    o.start();
    o.stop(audioCtx.currentTime + 0.4);
    navigator.vibrate?.([200, 100, 200]);
  } catch {
    /* ignore */
  }
}

export default function Workout() {
  const nav = useNavigate();
  const session = useActiveSession();
  const history = useSessions();
  const program = useActiveProgram();
  const now = useNow();
  const undoStack = useRef<Session[]>([]);
  const [toast, setToast] = useState<{ msg: string; undo?: boolean } | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [swapFor, setSwapFor] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [setMenu, setSetMenu] = useState<{ ex: string; set: string } | null>(null);
  const [notesOpen, setNotesOpen] = useState(false);

  const done = useMemo(() => (history ?? []).filter((s) => s.status === 'done'), [history]);

  const leaving = useRef(false);
  useEffect(() => {
    if (session === undefined && !leaving.current) nav('/', { replace: true });
  }, [session, nav]);

  const save = useCallback(
    async (next: Session, opts: { undoable?: boolean } = {}) => {
      if (opts.undoable && session) {
        undoStack.current.push(structuredClone(session));
        if (undoStack.current.length > 30) undoStack.current.shift();
      }
      await db.sessions.put(next);
    },
    [session],
  );

  const mutate = useCallback(
    (fn: (s: Session) => void, opts: { undoable?: boolean } = {}) => {
      if (!session) return;
      const next = structuredClone(session);
      fn(next);
      return save(next, opts);
    },
    [session, save],
  );

  const undo = useCallback(async () => {
    const prev = undoStack.current.pop();
    if (prev) await db.sessions.put(prev);
  }, []);

  // Rest timer completion alert
  const restLeft = session?.restEndsAt ? Math.ceil((new Date(session.restEndsAt).getTime() - now) / 1000) : null;
  const alerted = useRef<string | null>(null);
  useEffect(() => {
    if (session?.restEndsAt && restLeft !== null && restLeft <= 0 && alerted.current !== session.restEndsAt) {
      alerted.current = session.restEndsAt;
      beep();
      setTimeout(() => mutate((s) => void (s.restEndsAt = undefined)), 1500);
    }
  }, [restLeft, session?.restEndsAt, mutate]);

  if (!session || !history) return null;

  const paused = !!session.pausedAt;
  const vol = sessionVolume(session);
  const allWork = session.exercises.flatMap((e) => e.sets.filter((s) => s.kind === 'work'));
  const doneCount = allWork.filter((s) => s.status === 'done').length;
  const currentIdx = session.exercises.findIndex((e) => e.sets.some((s) => s.status === 'pending'));

  const completeSet = (exId: string, setId: string) =>
    mutate(
      (s) => {
        const ex = s.exercises.find((e) => e.id === exId)!;
        const idx = ex.sets.findIndex((x) => x.id === setId);
        const set = ex.sets[idx];
        if (set.status === 'done') {
          set.status = 'pending';
          set.completedAt = undefined;
          return;
        }
        const ph = placeholders(ex, idx);
        set.weight ??= ph.weight;
        set.reps ??= ph.reps;
        set.status = 'done';
        set.completedAt = nowISO();
        const lastDone = s.exercises
          .flatMap((e) => e.sets)
          .filter((x) => x.completedAt && x.id !== set.id)
          .map((x) => x.completedAt!)
          .sort()
          .at(-1);
        if (lastDone) set.restSec = Math.round((Date.now() - new Date(lastDone).getTime()) / 1000);
        const isLastOverall = !s.exercises.some((e) => e.sets.some((x) => x.status === 'pending'));
        const rest = set.kind === 'warmup' ? Math.min(60, ex.restSec) : ex.restSec;
        s.restEndsAt = isLastOverall ? undefined : new Date(Date.now() + rest * 1000).toISOString();
      },
      { undoable: true },
    )?.then(() => setToast({ msg: 'Set logged', undo: true }));

  const updateSet = (exId: string, setId: string, patch: Partial<LoggedSet>) =>
    mutate((s) => {
      const set = s.exercises.find((e) => e.id === exId)!.sets.find((x) => x.id === setId)!;
      Object.assign(set, patch);
    });

  const togglePause = () =>
    mutate((s) => {
      if (s.pausedAt) {
        s.pausedMs += Date.now() - new Date(s.pausedAt).getTime();
        s.pausedAt = undefined;
      } else {
        s.pausedAt = nowISO();
        s.restEndsAt = undefined;
      }
    });

  const finish = async () => {
    leaving.current = true;
    await mutate((s) => {
      if (s.pausedAt) {
        s.pausedMs += Date.now() - new Date(s.pausedAt).getTime();
        s.pausedAt = undefined;
      }
      s.status = 'done';
      s.endedAt = nowISO();
      s.restEndsAt = undefined;
    });
    nav(`/workout/${session.id}/summary`, { replace: true });
  };

  const discard = async () => {
    if (!confirm('Discard this workout? Nothing from it will be saved.')) return;
    leaving.current = true;
    await db.sessions.delete(session.id);
    nav('/', { replace: true });
  };

  const newExercise = (def: ExerciseDef, base?: SessionExercise): SessionExercise => {
    const repMin = base?.repMin ?? 8, repMax = base?.repMax ?? 12;
    const sets = base?.sets.filter((x) => x.kind === 'work').length || 3;
    const rec = recommend(def, { sets, repMin, repMax }, exposuresFor(def.id, done));
    const w = rec.needsConfirm ? rec.previousWeight : rec.targets[0]?.weight;
    return {
      id: uid(),
      exerciseId: def.id,
      programExerciseId: base?.programExerciseId,
      repMin,
      repMax,
      restSec: base?.restSec ?? 90,
      recommendation: rec.message,
      sets: [
        ...(base?.sets.some((x) => x.kind === 'warmup') ? warmupSets(def, w).map((t): LoggedSet => ({ id: uid(), kind: 'warmup', targetWeight: t.weight, targetReps: t.reps, status: 'pending' })) : []),
        ...rec.targets.map((t): LoggedSet => ({ id: uid(), kind: 'work', targetWeight: rec.needsConfirm ? rec.previousWeight : t.weight, targetReps: t.reps, status: 'pending' })),
      ],
    };
  };

  const menuEx = session.exercises.find((e) => e.id === menuFor);
  const swapEx = session.exercises.find((e) => e.id === swapFor);

  return (
    <Page noTabs>
      <div className="wk-head">
        <div className="row between">
          <button className="link-btn" style={{ fontWeight: 500, fontSize: 16 }} onClick={() => nav('/')}>
            <ChevronDown size={22} style={{ verticalAlign: -5 }} /> Hide
          </button>
          <div className="row" style={{ gap: 8 }}>
            {undoStack.current.length > 0 && (
              <button className="icon-btn" aria-label="Undo" onClick={undo}>
                <Undo2 size={18} />
              </button>
            )}
            <button className="icon-btn" aria-label={paused ? 'Resume' : 'Pause'} onClick={togglePause}>
              {paused ? <Play size={16} /> : <Pause size={16} />}
            </button>
            <button className="btn sm" onClick={() => setFinishing(true)}>Finish</button>
          </div>
        </div>
        <div className="title" style={{ marginTop: 6 }}>{session.dayName}</div>
        <div className="wk-stats" style={{ marginTop: 6 }}>
          <div><b>{fmtDuration(elapsed(session, now))}</b><small>{paused ? 'Paused' : 'Duration'}</small></div>
          <div><b>{fmtNum(vol)}</b><small>Volume (lb)</small></div>
          <div><b>{doneCount}/{allWork.length}</b><small>Sets</small></div>
        </div>
      </div>

      {session.optimized && (
        <details className="card" style={{ marginTop: 12 }}>
          <summary style={{ fontWeight: 600, cursor: 'pointer' }}>Optimized{session.optimized.minutes ? ` for ${session.optimized.minutes} min` : ''} · {session.optimized.feeling}</summary>
          <ul className="sub" style={{ fontSize: 14, margin: '8px 0 0', paddingLeft: 18 }}>{session.optimized.changes.map((c) => <li key={c}>{c}</li>)}</ul>
          <div className="foot" style={{ marginTop: 8 }}>{session.optimized.stimulusNote}</div>
        </details>
      )}

      {paused && (
        <div className="card ink" style={{ marginTop: 12 }}>
          <div className="row between">
            <div><div className="headline">Workout paused</div><div className="sub">Timer stopped. Your progress is saved.</div></div>
            <button className="btn white sm" onClick={togglePause}>Resume</button>
          </div>
        </div>
      )}

      {session.exercises.map((ex, i) => (
        <ExerciseCard
          key={ex.id}
          ex={ex}
          current={i === currentIdx}
          history={done}
          onComplete={(setId) => completeSet(ex.id, setId)}
          onUpdate={(setId, patch) => updateSet(ex.id, setId, patch)}
          onMenu={() => setMenuFor(ex.id)}
          onSetMenu={(setId) => setSetMenu({ ex: ex.id, set: setId })}
          onPending={(accept) =>
            mutate(
              (s) => {
                const e = s.exercises.find((x) => x.id === ex.id)!;
                if (!e.pending) return;
                e.pending.resolved = accept ? 'accepted' : 'declined';
                if (accept && e.pending.to) {
                  const def = getExercise(e.exerciseId);
                  for (const set of e.sets) if (set.kind === 'work' && set.status === 'pending') { set.targetWeight = e.pending.to; set.targetReps = e.pending.reps ?? e.repMin; }
                  const pendingWarm = e.sets.filter((x) => x.kind === 'warmup' && x.status === 'pending');
                  if (pendingWarm.length) {
                    e.sets = e.sets.filter((x) => !(x.kind === 'warmup' && x.status === 'pending'));
                    const w = warmupSets(def, e.pending.to).map((t): LoggedSet => ({ id: uid(), kind: 'warmup', targetWeight: t.weight, targetReps: t.reps, status: 'pending' }));
                    const firstWork = e.sets.findIndex((x) => x.kind === 'work');
                    e.sets.splice(Math.max(0, firstWork), 0, ...w);
                  }
                }
              },
              { undoable: true },
            )
          }
          onAddSet={() =>
            mutate(
              (s) => {
                const e = s.exercises.find((x) => x.id === ex.id)!;
                const last = [...e.sets].reverse().find((x) => x.kind === 'work');
                e.sets.push({ id: uid(), kind: 'work', targetWeight: last?.weight ?? last?.targetWeight, targetReps: last?.targetReps ?? e.repMin, status: 'pending' });
              },
              { undoable: true },
            )
          }
          onNotes={(notes) => mutate((s) => void (s.exercises.find((x) => x.id === ex.id)!.notes = notes))}
        />
      ))}

      <button className="btn secondary" style={{ marginTop: 16 }} onClick={() => setAdding(true)}>
        <Plus size={18} /> Add exercise
      </button>

      <div className="card" style={{ marginTop: 16 }}>
        <button className="row between" style={{ width: '100%', border: 'none', background: 'none', padding: 0 }} onClick={() => setNotesOpen(!notesOpen)}>
          <span style={{ fontWeight: 600 }}>Workout notes</span>
          <span className="foot">{session.notes ? 'Edit' : 'Add'}</span>
        </button>
        {notesOpen && (
          <textarea className="input" style={{ marginTop: 10, background: 'var(--bg)' }} value={session.notes ?? ''} onChange={(e) => mutate((s) => void (s.notes = e.target.value))} placeholder="How did it go?" />
        )}
      </div>
      <button className="btn danger" style={{ marginTop: 16 }} onClick={discard}>Discard workout</button>
      <div style={{ height: 90 }} />

      {session.restEndsAt && restLeft !== null && !paused && (
        <RestBar
          left={restLeft}
          total={session.exercises[Math.max(0, currentIdx)]?.restSec ?? 90}
          onAdjust={(d) => mutate((s) => void (s.restEndsAt = new Date(new Date(s.restEndsAt!).getTime() + d * 1000).toISOString()))}
          onSkip={() => mutate((s) => void (s.restEndsAt = undefined))}
        />
      )}
      {!session.restEndsAt && !paused && currentIdx >= 0 && (
        <div style={{ position: 'fixed', right: 16, bottom: 'calc(var(--safe-b) + 16px)', zIndex: 25 }}>
          <button className="btn sm" style={{ height: 44, borderRadius: 22, boxShadow: '0 6px 20px rgba(0,0,0,.2)' }} onClick={() => mutate((s) => void (s.restEndsAt = new Date(Date.now() + (s.exercises[currentIdx]?.restSec ?? 90) * 1000).toISOString()))}>
            Rest timer
          </button>
        </div>
      )}

      {toast && <Toast message={toast.msg} action={toast.undo ? 'Undo' : undefined} onAction={undo} onDone={() => setToast(null)} />}

      {/* Exercise menu */}
      <Sheet open={!!menuEx} onClose={() => setMenuFor(null)} title={menuEx ? getExercise(menuEx.exerciseId).name : ''}>
        {menuEx && (
          <div className="list">
            <button className="list-row" onClick={() => { setSwapFor(menuEx.id); setMenuFor(null); }}>Swap exercise</button>
            <button
              className="list-row"
              onClick={() => {
                mutate((s) => { for (const x of s.exercises.find((e) => e.id === menuEx.id)!.sets) if (x.status === 'pending') x.status = 'skipped'; }, { undoable: true });
                setMenuFor(null);
              }}
            >
              Skip remaining sets
            </button>
            {(() => {
              const i = session.exercises.findIndex((e) => e.id === menuEx.id);
              return (
                <>
                  {i > 0 && <button className="list-row" onClick={() => { mutate((s) => { const [x] = s.exercises.splice(i, 1); s.exercises.splice(i - 1, 0, x); }, { undoable: true }); setMenuFor(null); }}>Move up</button>}
                  {i < session.exercises.length - 1 && <button className="list-row" onClick={() => { mutate((s) => { const [x] = s.exercises.splice(i, 1); s.exercises.splice(i + 1, 0, x); }, { undoable: true }); setMenuFor(null); }}>Move down</button>}
                </>
              );
            })()}
            <button className="list-row" style={{ color: 'var(--bad)' }} onClick={() => { mutate((s) => void (s.exercises = s.exercises.filter((e) => e.id !== menuEx.id)), { undoable: true }); setMenuFor(null); setToast({ msg: 'Exercise removed', undo: true }); }}>
              Remove from today
            </button>
          </div>
        )}
      </Sheet>

      {/* Set menu */}
      <Sheet open={!!setMenu} onClose={() => setSetMenu(null)} title="Set">
        {setMenu && (
          <div className="list">
            <button className="list-row" onClick={() => { mutate((s) => { const set = s.exercises.find((e) => e.id === setMenu.ex)!.sets.find((x) => x.id === setMenu.set)!; set.status = set.status === 'skipped' ? 'pending' : 'skipped'; }, { undoable: true }); setSetMenu(null); }}>
              Skip / unskip set
            </button>
            <button className="list-row" onClick={() => { mutate((s) => { const set = s.exercises.find((e) => e.id === setMenu.ex)!.sets.find((x) => x.id === setMenu.set)!; set.kind = set.kind === 'warmup' ? 'work' : 'warmup'; }, { undoable: true }); setSetMenu(null); }}>
              Toggle warm-up / working set
            </button>
            <button className="list-row" style={{ color: 'var(--bad)' }} onClick={() => { mutate((s) => { const e = s.exercises.find((x) => x.id === setMenu.ex)!; e.sets = e.sets.filter((x) => x.id !== setMenu.set); }, { undoable: true }); setSetMenu(null); setToast({ msg: 'Set deleted', undo: true }); }}>
              Delete set
            </button>
          </div>
        )}
      </Sheet>

      {/* Swap */}
      <SwapSheet
        ex={swapEx}
        onClose={() => setSwapFor(null)}
        onPick={async (def, permanent) => {
          if (!swapEx) return;
          const replaced = newExercise(def, swapEx);
          await mutate((s) => { s.exercises = s.exercises.map((e) => (e.id === swapEx.id ? replaced : e)); }, { undoable: true });
          if (permanent && program && swapEx.programExerciseId) {
            const p = structuredClone(program);
            for (const d of p.days) for (const pe of d.exercises) if (pe.id === swapEx.programExerciseId) pe.exerciseId = def.id;
            await db.programs.put(p);
            await logChange(p.id, 'swap', `${session.dayName}: ${getExercise(swapEx.exerciseId).name} → ${def.name}`, 'Swapped during a workout.');
          }
          setSwapFor(null);
        }}
      />

      <Sheet open={adding} onClose={() => setAdding(false)} title="Add exercise">
        <ExercisePicker
          onPick={(def) => {
            mutate((s) => void s.exercises.push(newExercise(def)), { undoable: true });
            setAdding(false);
          }}
        />
      </Sheet>

      <Sheet open={finishing} onClose={() => setFinishing(false)} title="Finish workout">
        <div className="stack">
          {allWork.some((s) => s.status === 'pending') && (
            <p className="sub">{allWork.filter((s) => s.status === 'pending').length} working sets aren’t logged. They won’t count toward your history.</p>
          )}
          <button className="btn" onClick={finish}>Finish & save</button>
          <button className="btn secondary" onClick={() => setFinishing(false)}>Keep training</button>
        </div>
      </Sheet>
    </Page>
  );
}

function placeholders(ex: SessionExercise, idx: number) {
  const set = ex.sets[idx];
  let weight = set.targetWeight;
  if (weight === undefined) {
    for (let j = idx - 1; j >= 0; j--) {
      const p = ex.sets[j];
      if (p.kind === set.kind && p.weight !== undefined) { weight = p.weight; break; }
    }
  }
  return { weight, reps: set.targetReps };
}

function ExerciseCard({
  ex, current, history, onComplete, onUpdate, onMenu, onSetMenu, onPending, onAddSet, onNotes,
}: {
  ex: SessionExercise;
  current: boolean;
  history: Session[];
  onComplete: (setId: string) => void;
  onUpdate: (setId: string, patch: Partial<LoggedSet>) => void;
  onMenu: () => void;
  onSetMenu: (setId: string) => void;
  onPending: (accept: boolean) => void;
  onAddSet: () => void;
  onNotes: (n: string) => void;
}) {
  const def = getExercise(ex.exerciseId);
  const [cues, setCues] = useState(false);
  const [notes, setNotes] = useState(!!ex.notes);
  const last = useMemo(() => exposuresFor(ex.exerciseId, history)[0], [ex.exerciseId, history]);
  const allDone = ex.sets.every((s) => s.status !== 'pending');
  let workN = 0;

  return (
    <div className={`ex-card${current ? ' current' : ''}${allDone ? ' done' : ''}`}>
      <div className="row between" style={{ alignItems: 'flex-start' }}>
        <button style={{ border: 'none', background: 'none', padding: 0, textAlign: 'left', flex: 1 }} onClick={() => setCues(!cues)}>
          <div className="headline">{def.name}</div>
          <div className="foot">
            {MUSCLE_LABEL[def.muscle]} · {ex.repMin}–{ex.repMax} {def.timed ? 'sec' : 'reps'} · rest {fmtRest(ex.restSec)}
            {def.perHand ? ' · lb per hand' : ''}
          </div>
        </button>
        <button className="icon-btn plain" aria-label="Exercise options" onClick={onMenu} style={{ marginRight: -6 }}>
          <MoreHorizontal size={20} />
        </button>
      </div>

      {cues && (
        <ul className="sub" style={{ fontSize: 14, margin: '8px 0 0', paddingLeft: 18 }}>
          {def.cues.map((c) => <li key={c}>{c}</li>)}
        </ul>
      )}

      <div className="prev-line" style={{ marginTop: 8 }}>
        {last ? (
          <>Last · {fmtDate(last.date)}: {last.sets.map((s) => (s.weight ? `${s.weight}×${s.reps}` : `${s.reps}`)).join(', ')}</>
        ) : (
          <>No previous sessions logged</>
        )}
      </div>

      {ex.pending && !ex.pending.resolved && (
        <div className="rec" style={{ borderColor: 'var(--accent)', background: 'var(--bg)' }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>
            {ex.pending.kind === 'increase' ? `Ready for ${ex.pending.to} lb?` : `Reset to ${ex.pending.to} lb?`}
          </div>
          <div className="sub" style={{ fontSize: 13 }}>{ex.recommendation}</div>
          <div className="btn-row" style={{ marginTop: 10 }}>
            <button className="btn sm" onClick={() => onPending(true)}>Use {ex.pending.to} lb</button>
            <button className="btn sm secondary" onClick={() => onPending(false)}>Stay at {ex.pending.from} lb</button>
          </div>
        </div>
      )}
      {(!ex.pending || ex.pending.resolved) && ex.recommendation && current && <div className="rec">{ex.recommendation}</div>}

      <div className="set-grid head">
        <span style={{ textAlign: 'center' }}>Set</span>
        <span style={{ textAlign: 'center' }}>lb</span>
        <span style={{ textAlign: 'center' }}>{def.timed ? 'Sec' : 'Reps'}</span>
        <span style={{ textAlign: 'center' }}>RPE</span>
        <span />
      </div>
      {ex.sets.map((set, idx) => {
        const label = set.kind === 'warmup' ? 'W' : String(++workN);
        const ph = placeholders(ex, idx);
        return (
          <div key={set.id} className={`set-grid set-row${set.status === 'done' ? ' is-done' : ''}${set.status === 'skipped' ? ' is-skipped' : ''}`}>
            <button className={`set-label${set.kind === 'warmup' ? ' wu' : ''}`} onClick={() => onSetMenu(set.id)} aria-label={`Set ${label} options`}>
              {label}
            </button>
            <NumberInput className="set-input" value={set.weight} onChange={(v) => onUpdate(set.id, { weight: v })} placeholder={ph.weight !== undefined ? String(ph.weight) : def.increment ? 'lb' : 'BW'} aria-label="Weight" />
            <NumberInput className="set-input" value={set.reps} onChange={(v) => onUpdate(set.id, { reps: v })} placeholder={ph.reps !== undefined ? String(ph.reps) : '—'} aria-label="Reps" />
            {set.kind === 'work' ? (
              <select className="set-rpe" value={set.rpe ?? ''} onChange={(e) => onUpdate(set.id, { rpe: e.target.value ? Number(e.target.value) : undefined })} aria-label="RPE">
                <option value="">–</option>
                {RPE.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            ) : (
              <span />
            )}
            <button
              className={`check${set.status === 'done' ? ' on' : set.status === 'skipped' ? ' skip' : ''}`}
              aria-label={set.status === 'done' ? 'Mark not done' : 'Complete set'}
              disabled={set.status === 'skipped' || (set.reps === undefined && ph.reps === undefined)}
              onClick={() => onComplete(set.id)}
            >
              <Check size={20} strokeWidth={3} />
            </button>
          </div>
        );
      })}
      <div className="row" style={{ marginTop: 8, gap: 4 }}>
        <button className="link-btn" style={{ fontSize: 14 }} onClick={onAddSet}>+ Add set</button>
        <span className="spacer" style={{ flex: 1 }} />
        <button className="link-btn" style={{ fontSize: 14, color: 'var(--ink-2)' }} onClick={() => setNotes(!notes)}>{ex.notes ? 'Note ✓' : 'Note'}</button>
      </div>
      {notes && <textarea className="input" style={{ marginTop: 6, minHeight: 60, background: 'var(--bg)' }} value={ex.notes ?? ''} onChange={(e) => onNotes(e.target.value)} placeholder="Technique, setup, how it felt…" />}
    </div>
  );
}

function RestBar({ left, total, onAdjust, onSkip }: { left: number; total: number; onAdjust: (d: number) => void; onSkip: () => void }) {
  const over = left <= 0;
  return (
    <div className="rest-bar" role="timer" aria-live="polite">
      <div>
        <div style={{ fontSize: 11, opacity: 0.7, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em' }}>{over ? 'Rest over' : 'Rest'}</div>
        <div className="t">{over ? 'Go' : fmtDuration(left * 1000)}</div>
      </div>
      <span style={{ flex: 1 }} />
      <button onClick={() => onAdjust(-15)}>−15</button>
      <button onClick={() => onAdjust(15)}>+15</button>
      <button onClick={onSkip}>Skip</button>
      <div className="prog"><i style={{ width: `${Math.max(0, Math.min(100, (1 - left / total) * 100))}%` }} /></div>
    </div>
  );
}

function SwapSheet({ ex, onClose, onPick }: { ex?: SessionExercise; onClose: () => void; onPick: (def: ExerciseDef, permanent: boolean) => void }) {
  const [permanent, setPermanent] = useState(false);
  const def = ex ? getExercise(ex.exerciseId) : undefined;
  const program = useActiveProgram();
  const profile = useProfile();
  const suggested = useMemo(() => {
    if (!def) return [];
    return EXERCISES.filter((e) => e.id !== def.id && (e.pattern === def.pattern || (e.muscle === def.muscle && e.compound === def.compound)) && (!profile || hasEquipment(e, profile.equipment))).slice(0, 6);
  }, [def, profile]);
  return (
    <Sheet open={!!ex} onClose={onClose} title={`Swap ${def?.name ?? ''}`}>
      {ex?.programExerciseId && program && (
        <div className="row between card" style={{ marginBottom: 12 }}>
          <div>
            <div style={{ fontWeight: 600 }}>Also change my program</div>
            <div className="foot">Otherwise this swap is for today only</div>
          </div>
          <Toggle on={permanent} onChange={setPermanent} />
        </div>
      )}
      <ExercisePicker suggested={suggested} onPick={(d) => onPick(d, permanent)} />
    </Sheet>
  );
}
