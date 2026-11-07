import { Check, ClipboardPaste, Copy, ExternalLink, MessageCircle } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Chips, Empty, ListRow, Page, Section, Sheet } from '../components/ui';
import { db } from '../db';
import { getExercise, MUSCLE_LABEL } from '../data/exercises';
import { buildCoachPrompt, extractChanges, PROJECT_INSTRUCTIONS, resolveChanges, TOPICS, type CoachTopic, type ResolvedChange } from '../engine/coach';
import { logChange, useActiveProgram, useCoachNotes, useMeasurements, useProfile, useSessions, useWeights } from '../lib/data';
import { fmtDate, nowISO, uid } from '../lib/util';
import type { CoachNote, Muscle } from '../types';

const SETUP_KEY = 'forge.coach.setup';
const CLAUDE_URL = 'https://claude.ai/projects';

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for older iOS
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}

export default function Coach() {
  const profile = useProfile();
  const program = useActiveProgram();
  const sessions = useSessions() ?? [];
  const weights = useWeights() ?? [];
  const measurements = useMeasurements() ?? [];
  const notes = useCoachNotes() ?? [];
  const [setupDone, setSetupDone] = useState(() => localStorage.getItem(SETUP_KEY) === '1');
  const [setupOpen, setSetupOpen] = useState(false);
  const [topic, setTopic] = useState<CoachTopic | 'custom' | null>(null);
  const [openNote, setOpenNote] = useState<string | null>(null);
  const [copiedInstr, setCopiedInstr] = useState(false);
  const trained = useMemo(() => [...new Set(sessions.filter((s) => s.status === 'done').flatMap((s) => s.exercises.map((e) => e.exerciseId)))], [sessions]);

  if (!profile) return null;

  const makePrompt = (question: string) =>
    buildCoachPrompt({ question, profile, program: program ?? undefined, sessions, weights, measurements, notes });

  const note = notes.find((n) => n.id === openNote);

  return (
    <Page>
      <div style={{ paddingTop: 12 }}>
        <h1 className="large-title">Coach</h1>
      </div>

      {!setupDone ? (
        <div className="card ink">
          <div className="eyebrow" style={{ color: 'rgba(255,255,255,0.6)' }}>One-time setup · 2 minutes</div>
          <div className="title" style={{ marginTop: 4 }}>Connect your Claude coach</div>
          <div className="sub" style={{ marginTop: 6 }}>
            Your coach runs in the Claude app you already have. A Claude Project keeps every coaching conversation together, so it remembers what you’ve discussed.
          </div>
          <button className="btn white" style={{ marginTop: 16 }} onClick={() => setSetupOpen(true)}>Set up</button>
        </div>
      ) : (
        <div className="card">
          <div className="row" style={{ gap: 12 }}>
            <MessageCircle size={22} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600 }}>How it works</div>
              <div className="sub" style={{ fontSize: 14 }}>Pick a question → your data is copied → paste it in your Fitness Coach project in Claude → save the answer back here.</div>
            </div>
          </div>
        </div>
      )}

      <Section title="Ask your coach">
        <button className="card" style={{ width: '100%', border: 'none', textAlign: 'left', marginBottom: 12 }} onClick={() => setTopic('custom')}>
          <div style={{ fontWeight: 600 }}>Ask anything…</div>
          <div className="foot">Your question plus your latest data</div>
        </button>
        <div className="list">
          {TOPICS.map((t) => (
            <ListRow key={t.id} title={t.title} onClick={() => setTopic(t)} />
          ))}
        </div>
      </Section>

      <Section title="Conversations">
        {notes.length ? (
          <div className="list">
            {notes.map((n) => (
              <ListRow
                key={n.id}
                title={n.question}
                subtitle={`${fmtDate(n.at)} · ${n.reply ? (n.applied?.length ? `${n.applied.length} change${n.applied.length > 1 ? 's' : ''} applied` : 'Answer saved') : 'Waiting for Claude’s answer'}`}
                right={!n.reply ? <span className="badge">Paste</span> : undefined}
                onClick={() => setOpenNote(n.id)}
              />
            ))}
          </div>
        ) : (
          <div className="card"><Empty title="No conversations yet">Ask a question above to start.</Empty></div>
        )}
        {setupDone && (
          <button className="link-btn" style={{ fontSize: 15, margin: '12px 4px' }} onClick={() => setSetupOpen(true)}>Coach setup instructions</button>
        )}
      </Section>

      <Sheet open={setupOpen} onClose={() => setSetupOpen(false)} title="Set up your coach">
        <ol className="stack" style={{ paddingLeft: 20, margin: 0 }}>
          <li>Tap <b>Copy instructions</b> below.</li>
          <li>Open the <b>Claude app</b> → <b>Projects</b> → <b>Create project</b>. Name it <b>Fitness Coach</b>.</li>
          <li>In the project, open <b>Instructions</b> (“Set project instructions”) and paste.</li>
          <li>Always start coaching chats inside that project.</li>
        </ol>
        <div className="stack" style={{ marginTop: 20 }}>
          <button className="btn" onClick={async () => setCopiedInstr(await copy(PROJECT_INSTRUCTIONS))}>
            {copiedInstr ? <><Check size={18} /> Copied</> : <><Copy size={18} /> Copy instructions</>}
          </button>
          <a className="btn secondary" href={CLAUDE_URL} target="_blank" rel="noreferrer"><ExternalLink size={18} /> Open Claude</a>
          <button
            className="btn outline"
            onClick={() => {
              localStorage.setItem(SETUP_KEY, '1');
              setSetupDone(true);
              setSetupOpen(false);
            }}
          >
            I’ve set it up
          </button>
        </div>
        <details style={{ marginTop: 16 }}>
          <summary className="foot">Preview instructions</summary>
          <pre className="foot" style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>{PROJECT_INSTRUCTIONS}</pre>
        </details>
      </Sheet>

      <AskSheet
        topic={topic}
        onClose={() => setTopic(null)}
        trainedExercises={trained}
        programExercises={program?.days.flatMap((d) => d.exercises.map((e) => e.exerciseId)) ?? []}
        makePrompt={makePrompt}
        onAsked={(id) => {
          setTopic(null);
          setOpenNote(id);
        }}
      />

      <NoteSheet note={note} onClose={() => setOpenNote(null)} makePrompt={makePrompt} />
    </Page>
  );
}

function AskSheet({
  topic,
  onClose,
  trainedExercises,
  programExercises,
  makePrompt,
  onAsked,
}: {
  topic: CoachTopic | 'custom' | null;
  onClose: () => void;
  trainedExercises: string[];
  programExercises: string[];
  makePrompt: (q: string) => string;
  onAsked: (noteId: string) => void;
}) {
  const [arg, setArg] = useState<string | undefined>();
  const [custom, setCustom] = useState('');
  const [edited, setEdited] = useState<string | null>(null);
  const t = topic === 'custom' ? null : topic;
  const exOptions = [...new Set([...trainedExercises, ...programExercises])];
  const base = t ? t.question(t.needs === 'exercise' ? (arg ? getExercise(arg).name.toLowerCase() : undefined) : t.needs === 'muscle' ? (arg ? MUSCLE_LABEL[arg as Muscle].toLowerCase() : undefined) : undefined) : custom;
  const question = edited ?? base;

  const close = () => {
    setArg(undefined);
    setCustom('');
    setEdited(null);
    onClose();
  };

  const ask = async () => {
    // Copy synchronously within the tap so iOS allows clipboard access.
    await copy(makePrompt(question));
    const id = uid();
    await db.coach.add({ id, at: nowISO(), topic: t?.id ?? 'custom', question });
    close();
    onAsked(id);
  };

  return (
    <Sheet open={!!topic} onClose={close} title={t ? t.title : 'Ask anything'}>
      <div className="stack">
        {t?.needs === 'exercise' && (
          <div>
            <div className="eyebrow" style={{ margin: '0 4px 8px' }}>Which lift?</div>
            <div className="chips">
              {exOptions.map((id) => (
                <button key={id} className={`chip${arg === id ? ' on' : ''}`} onClick={() => { setArg(id); setEdited(null); }}>{getExercise(id).name}</button>
              ))}
            </div>
          </div>
        )}
        {t?.needs === 'muscle' && (
          <div>
            <div className="eyebrow" style={{ margin: '0 4px 8px' }}>Which muscle?</div>
            <Chips options={Object.keys(MUSCLE_LABEL) as Muscle[]} value={arg ? [arg as Muscle] : []} onChange={(v) => { setArg(v.at(-1)); setEdited(null); }} labels={MUSCLE_LABEL} />
          </div>
        )}
        <label className="field">
          <span>Your question</span>
          <textarea className="input" value={question} onChange={(e) => (t ? setEdited(e.target.value) : setCustom(e.target.value))} placeholder="e.g. Should I add a 5th training day?" />
        </label>
        <p className="foot">Your profile, program, recent workouts, body-weight trend and recent coaching are copied along with the question. Nothing is sent anywhere until you paste it into Claude.</p>
        <button className="btn" disabled={!question.trim() || (t?.needs !== undefined && !arg)} onClick={ask}>
          <Copy size={18} /> Copy my data & question
        </button>
      </div>
    </Sheet>
  );
}

function NoteSheet({ note, onClose, makePrompt }: { note?: CoachNote; onClose: () => void; makePrompt: (q: string) => string }) {
  const program = useActiveProgram();
  const profile = useProfile();
  const [draft, setDraft] = useState('');
  const [selected, setSelected] = useState<Record<number, boolean>>({});
  const [copied, setCopied] = useState(false);
  const [applied, setApplied] = useState<string | null>(null);

  const resolved: ResolvedChange[] = useMemo(() => {
    if (!note?.reply || !program) return [];
    const ch = extractChanges(note.reply);
    return ch ? resolveChanges(ch, program, profile ?? undefined) : [];
  }, [note?.reply, program, profile]);

  const close = () => {
    setDraft('');
    setSelected({});
    setCopied(false);
    setApplied(null);
    onClose();
  };
  if (!note) return <Sheet open={false} onClose={close}>{null}</Sheet>;

  const doneIdx = new Set(note.appliedIdx ?? []);
  const saveReply = async (text: string) => {
    await db.coach.update(note.id, { reply: text.trim(), repliedAt: nowISO() });
    setDraft('');
  };

  const apply = async () => {
    if (!program) return;
    const chosen = resolved.filter((r, i) => r.ok && !doneIdx.has(i) && selected[i] !== false);
    if (!chosen.length) return;
    const p = structuredClone(program);
    for (const c of chosen) c.apply!(p);
    await db.programs.put(p);
    for (const c of chosen) await logChange(p.id, 'coach', c.summary, `Coach (Claude): ${c.reason ?? 'recommended in coaching conversation'}`);
    const idx = resolved.map((r, i) => (chosen.includes(r) ? i : -1)).filter((i) => i >= 0);
    await db.coach.update(note.id, { applied: [...(note.applied ?? []), ...chosen.map((c) => c.summary)], appliedIdx: [...(note.appliedIdx ?? []), ...idx] });
    setApplied(`${chosen.length} change${chosen.length > 1 ? 's' : ''} applied to your program.`);
  };

  const display = note.reply?.replace(/```forge-changes[\s\S]*?```/g, '').trim();


  return (
    <Sheet open onClose={close} title={fmtDate(note.at, { month: 'short', day: 'numeric' })}>
      <div className="stack">
        <div className="card">
          <div className="foot">You asked</div>
          <div style={{ fontWeight: 600 }}>{note.question}</div>
        </div>

        {!note.reply ? (
          <>
            <ol className="sub" style={{ paddingLeft: 20, margin: 0, color: 'var(--ink)' }}>
              <li>Your data and question are copied. Tap <b>Open Claude</b>, go to your <b>Fitness Coach</b> project, start a chat and paste.</li>
              <li>When Claude answers, copy the whole reply and paste it below.</li>
            </ol>
            <div className="btn-row">
              <a className="btn sm" style={{ height: 44 }} href={CLAUDE_URL} target="_blank" rel="noreferrer"><ExternalLink size={16} /> Open Claude</a>
              <button className="btn secondary sm" style={{ height: 44 }} onClick={async () => setCopied(await copy(makePrompt(note.question)))}>
                {copied ? <><Check size={16} /> Copied</> : <><Copy size={16} /> Copy again</>}
              </button>
            </div>
            <textarea className="input" style={{ minHeight: 160 }} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Paste Claude’s answer here" />
            <div className="btn-row">
              <button
                className="btn secondary"
                onClick={async () => {
                  try {
                    setDraft(await navigator.clipboard.readText());
                  } catch {
                    /* user can paste manually */
                  }
                }}
              >
                <ClipboardPaste size={18} /> Paste
              </button>
              <button className="btn" disabled={!draft.trim()} onClick={() => saveReply(draft)}>Save answer</button>
            </div>
          </>
        ) : (
          <>
            <div className="card outline">
              <div className="foot" style={{ marginBottom: 6 }}>Claude’s answer</div>
              <div style={{ whiteSpace: 'pre-wrap', fontSize: 15, lineHeight: 1.45 }}>{display?.replace(/\*\*(.+?)\*\*/g, '$1').replace(/^#+\s*/gm, '')}</div>
            </div>
            {resolved.length > 0 && (
              <div>
                <div className="eyebrow" style={{ margin: '4px 4px 8px' }}>Proposed program changes</div>
                <div className="list">
                  {resolved.map((r, i) => {
                    const done = doneIdx.has(i);
                    const on = r.ok && !done && selected[i] !== false;
                    return (
                      <button key={i} className="list-row" style={{ alignItems: 'flex-start' }} disabled={!r.ok || done} onClick={() => setSelected({ ...selected, [i]: !on })}>
                        <span className={`check${on ? ' on' : ''}`} style={{ width: 26, height: 26, borderRadius: 7, flex: 'none', opacity: r.ok ? 1 : 0.3 }}>{(on || done) && <Check size={14} />}</span>
                        <div className="grow">
                          <div style={{ fontWeight: 500 }}>{r.summary}</div>
                          {r.reason && <div className="foot">{r.reason}</div>}
                          {!r.ok && <div className="foot" style={{ color: 'var(--bad)' }}>Can’t apply: {r.error}</div>}
                          {done && <div className="foot">Applied</div>}
                        </div>
                      </button>
                    );
                  })}
                </div>
                {resolved.some((r, i) => r.ok && !doneIdx.has(i) && selected[i] !== false) && (
                  <button className="btn" style={{ marginTop: 12 }} onClick={apply}>Apply selected changes</button>
                )}
                {applied && <p className="sub" style={{ margin: '8px 4px' }}>{applied} Every change is in your program’s change history.</p>}
              </div>
            )}
            <button className="btn secondary" onClick={() => db.coach.update(note.id, { reply: undefined, appliedIdx: [] })}>Replace answer</button>
          </>
        )}
        <button className="btn danger" onClick={async () => { if (confirm('Delete this conversation from the app?')) { await db.coach.delete(note.id); close(); } }}>Delete</button>
      </div>
    </Sheet>
  );
}
