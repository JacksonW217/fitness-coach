import { Check, ClipboardPaste, Copy, ExternalLink, MessageCircle } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Chips, Empty, ListRow, Page, Section, Sheet } from '../components/ui';
import { db } from '../db';
import { getExercise, MUSCLE_LABEL } from '../data/exercises';
import { buildCoachPrompt, extractChanges, PROJECT_INSTRUCTIONS, resolveChanges, TOPICS, type CoachTopic, type ResolvedChange } from '../engine/coach';
import { claudeUrl, clearPending, copyNow, getPending, getProjectUrl, looksLikeOurPrompt, setPending, setProjectUrl } from '../lib/coachBridge';
import { logChange, useActiveProgram, useCheckins, useCoachNotes, useFood, useMeasurements, useProfile, useSessions, useWeights } from '../lib/data';
import { fmtDate, nowISO, uid } from '../lib/util';
import type { CoachNote, Muscle } from '../types';

export default function Coach() {
  const profile = useProfile();
  const program = useActiveProgram();
  const sessions = useSessions() ?? [];
  const weights = useWeights() ?? [];
  const measurements = useMeasurements() ?? [];
  const notes = useCoachNotes() ?? [];
  const food = useFood() ?? [];
  const checkins = useCheckins() ?? [];
  const [params, setParams] = useSearchParams();
  const [setupOpen, setSetupOpen] = useState(false);
  const [picker, setPicker] = useState<CoachTopic | 'custom' | null>(null);
  const [openNote, setOpenNote] = useState<string | null>(null);
  const trained = useMemo(() => [...new Set(sessions.filter((s) => s.status === 'done').flatMap((s) => s.exercises.map((e) => e.exerciseId)))], [sessions]);

  // Returning from Claude → jump straight to the conversation.
  const noteParam = params.get('note');
  useEffect(() => {
    if (noteParam) {
      setOpenNote(noteParam);
      setParams({}, { replace: true });
    }
  }, [noteParam, setParams]);

  if (!profile) return null;

  /** One tap: copy data + question, open Claude, remember what we asked. */
  const ask = (question: string, topicId: string) => {
    const text = buildCoachPrompt({ question, profile, program: program ?? undefined, sessions, weights, measurements, notes, food, checkins });
    copyNow(text);
    window.open(claudeUrl(), '_blank');
    const id = uid();
    setPending(id);
    db.coach.add({ id, at: nowISO(), topic: topicId, question });
    setPicker(null);
  };

  const note = notes.find((n) => n.id === openNote);
  const pendingId = getPending();
  const hasProject = !!getProjectUrl();

  return (
    <Page>
      <div style={{ paddingTop: 12 }}>
        <h1 className="large-title">Coach</h1>
      </div>

      <div className="card">
        <div className="row" style={{ gap: 12, alignItems: 'flex-start' }}>
          <MessageCircle size={22} style={{ flex: 'none', marginTop: 2 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600 }}>Tap a question → paste in Claude</div>
            <div className="sub" style={{ fontSize: 14 }}>
              Your data is copied and Claude opens. Paste and send. Want the answer saved or changes applied? Copy Claude’s reply and come back — Forge picks it up.
            </div>
            <button className="link-btn" style={{ fontSize: 14, marginTop: 4 }} onClick={() => setSetupOpen(true)}>
              {hasProject ? 'Coach project linked ✓' : 'Optional: link a Claude Project so it remembers past chats'}
            </button>
          </div>
        </div>
      </div>

      <Section title="Ask your coach">
        <button className="card" style={{ width: '100%', border: 'none', textAlign: 'left', marginBottom: 12 }} onClick={() => setPicker('custom')}>
          <div style={{ fontWeight: 600 }}>Ask anything…</div>
          <div className="foot">Your question plus your latest data</div>
        </button>
        <div className="list">
          {TOPICS.map((t) => (
            <ListRow key={t.id} title={t.title} onClick={() => (t.needs ? setPicker(t) : ask(t.question(), t.id))} right={!t.needs ? <ExternalLink size={16} className="chev" /> : undefined} chevron={!!t.needs} />
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
                subtitle={`${fmtDate(n.at)} · ${n.reply ? (n.applied?.length ? `${n.applied.length} change${n.applied.length > 1 ? 's' : ''} applied` : 'Answer saved') : 'Answer not saved'}`}
                right={n.id === pendingId && !n.reply ? <span className="badge ink">Paste answer</span> : undefined}
                onClick={() => setOpenNote(n.id)}
              />
            ))}
          </div>
        ) : (
          <div className="card"><Empty title="No conversations yet">Tap a question above to start.</Empty></div>
        )}
      </Section>

      <SetupSheet open={setupOpen} onClose={() => setSetupOpen(false)} />

      <PickerSheet
        topic={picker}
        onClose={() => setPicker(null)}
        exercises={[...new Set([...trained, ...(program?.days.flatMap((d) => d.exercises.map((e) => e.exerciseId)) ?? [])])]}
        onAsk={ask}
      />

      <NoteSheet
        note={note}
        onClose={() => setOpenNote(null)}
        onAskAgain={(n) => ask(n.question, n.topic)}
      />
    </Page>
  );
}

function SetupSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const [url, setUrl] = useState(getProjectUrl());
  const valid = !url || /^https:\/\/claude\.ai\//.test(url.trim());
  return (
    <Sheet open={open} onClose={onClose} title="Coach project">
      <p className="sub" style={{ marginTop: 0 }}>
        Optional. Every question already includes coaching instructions, so any Claude chat works. A Project keeps all your coaching chats together so Claude remembers what you’ve discussed.
      </p>
      <ol className="stack" style={{ paddingLeft: 20 }}>
        <li>In Claude: <b>Projects → Create project</b>, name it <b>Fitness Coach</b>.</li>
        <li>
          Tap <b>Copy instructions</b> and paste them into the project’s <b>Instructions</b>.
          <button className="btn secondary sm" style={{ marginTop: 8 }} onClick={() => { copyNow(PROJECT_INSTRUCTIONS); setCopied(true); }}>
            {copied ? <><Check size={16} /> Copied</> : <><Copy size={16} /> Copy instructions</>}
          </button>
        </li>
        <li>
          In the project, tap <b>Share → Copy link</b> (or copy the address in a browser) and paste it here. Forge will open straight into the project.
          <input className="input" style={{ marginTop: 8 }} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://claude.ai/project/…" inputMode="url" />
          {!valid && <div className="foot" style={{ color: 'var(--bad)', marginTop: 4 }}>That doesn’t look like a claude.ai link.</div>}
        </li>
      </ol>
      <button className="btn" style={{ marginTop: 8 }} disabled={!valid} onClick={() => { setProjectUrl(url.trim()); onClose(); }}>Save</button>
    </Sheet>
  );
}

function PickerSheet({ topic, onClose, exercises, onAsk }: { topic: CoachTopic | 'custom' | null; onClose: () => void; exercises: string[]; onAsk: (q: string, topicId: string) => void }) {
  const [custom, setCustom] = useState('');
  const t = topic === 'custom' ? null : topic;
  const close = () => {
    setCustom('');
    onClose();
  };
  return (
    <Sheet open={!!topic} onClose={close} title={t ? t.title : 'Ask anything'}>
      <div className="stack">
        {t?.needs === 'exercise' && (
          <>
            <div className="eyebrow" style={{ margin: '0 4px' }}>Tap a lift to ask</div>
            <div className="chips">
              {exercises.map((id) => (
                <button key={id} className="chip" onClick={() => { onAsk(t.question(getExercise(id).name.toLowerCase()), t.id); close(); }}>{getExercise(id).name}</button>
              ))}
            </div>
          </>
        )}
        {t?.needs === 'muscle' && (
          <>
            <div className="eyebrow" style={{ margin: '0 4px' }}>Tap a muscle to ask</div>
            <Chips
              options={Object.keys(MUSCLE_LABEL) as Muscle[]}
              value={[]}
              onChange={(v) => { const m = v.at(-1)!; onAsk(t.question(MUSCLE_LABEL[m].toLowerCase()), t.id); close(); }}
              labels={MUSCLE_LABEL}
            />
          </>
        )}
        {!t && (
          <>
            <textarea className="input" autoFocus value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="e.g. Should I add a 5th training day?" />
            <button className="btn" disabled={!custom.trim()} onClick={() => { onAsk(custom.trim(), 'custom'); close(); }}>
              <ExternalLink size={18} /> Ask Claude
            </button>
          </>
        )}
        <p className="foot">Your profile, program, recent workouts and body-weight trend are copied with the question. Nothing leaves your phone until you paste it into Claude.</p>
      </div>
    </Sheet>
  );
}

function NoteSheet({ note, onClose, onAskAgain }: { note?: CoachNote; onClose: () => void; onAskAgain: (n: CoachNote) => void }) {
  const program = useActiveProgram();
  const profile = useProfile();
  const [draft, setDraft] = useState('');
  const [manual, setManual] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [selected, setSelected] = useState<Record<number, boolean>>({});
  const [applied, setApplied] = useState<string | null>(null);

  const resolved: ResolvedChange[] = useMemo(() => {
    if (!note?.reply || !program) return [];
    const ch = extractChanges(note.reply);
    return ch ? resolveChanges(ch, program, profile ?? undefined) : [];
  }, [note?.reply, program, profile]);

  const close = () => {
    setDraft('');
    setManual(false);
    setMsg(null);
    setSelected({});
    setApplied(null);
    onClose();
  };
  if (!note) return <Sheet open={false} onClose={close}>{null}</Sheet>;

  const doneIdx = new Set(note.appliedIdx ?? []);
  const saveReply = async (text: string) => {
    if (!text.trim()) return setMsg('Nothing to save — the clipboard is empty.');
    if (looksLikeOurPrompt(text)) return setMsg('Your clipboard still has your data, not Claude’s answer. In Claude, tap Copy under the reply, then come back and tap Paste again.');
    await db.coach.update(note.id, { reply: text.trim(), repliedAt: nowISO() });
    if (getPending() === note.id) clearPending();
    setDraft('');
    setMsg(null);
  };

  const pasteFromClipboard = async () => {
    try {
      await saveReply(await navigator.clipboard.readText());
    } catch {
      setManual(true);
      setMsg('Couldn’t read the clipboard — long-press the box below and choose Paste.');
    }
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
            <button className="btn" style={{ height: 60, fontSize: 18 }} onClick={pasteFromClipboard}>
              <ClipboardPaste size={20} /> Paste Claude’s answer
            </button>
            <p className="foot" style={{ margin: '0 4px' }}>In Claude, tap <b>Copy</b> under the reply first. Only needed if you want it saved here or want to apply program changes.</p>
            {msg && <p className="sub" style={{ margin: '0 4px', color: 'var(--ink)' }}>{msg}</p>}
            {manual && (
              <>
                <textarea className="input" style={{ minHeight: 140 }} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Paste Claude’s answer here" />
                <button className="btn secondary" disabled={!draft.trim()} onClick={() => saveReply(draft)}>Save answer</button>
              </>
            )}
            <div className="btn-row">
              <button className="btn secondary" onClick={() => onAskAgain(note)}><ExternalLink size={16} /> Ask again</button>
              <button className="btn secondary" onClick={() => { if (getPending() === note.id) clearPending(); close(); }}>Done</button>
            </div>
            {!manual && <button className="link-btn" style={{ fontSize: 14, color: 'var(--ink-2)' }} onClick={() => setManual(true)}>Paste manually instead</button>}
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
            <div className="btn-row">
              <button className="btn secondary" onClick={() => onAskAgain(note)}><ExternalLink size={16} /> Ask again</button>
              <button className="btn secondary" onClick={() => db.coach.update(note.id, { reply: undefined, appliedIdx: [] })}>Replace answer</button>
            </div>
          </>
        )}
        <button className="btn danger" onClick={async () => { if (confirm('Delete this conversation from the app?')) { if (getPending() === note.id) clearPending(); await db.coach.delete(note.id); close(); } }}>Delete</button>
      </div>
    </Sheet>
  );
}
