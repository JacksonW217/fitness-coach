import { useRef, useState } from 'react';
import { ListRow, Page, Section, Sheet } from '../components/ui';
import { db, exportAll, importAll, wipeAll } from '../db';
import { useProfile, useSessions, useWeights } from '../lib/data';
import { dateKey, fmtHeight, nowISO } from '../lib/util';
import { GOAL_LABEL, SECTIONS, type Draft } from './profileSections';

export default function ProfileScreen() {
  const profile = useProfile();
  const sessions = useSessions() ?? [];
  const weights = useWeights() ?? [];
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState<Draft>({});
  const [installOpen, setInstallOpen] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  if (!profile) return null;

  const open = (i: number) => {
    setDraft(structuredClone(profile));
    setEditing(i);
  };
  const sec = editing !== null ? SECTIONS[editing] : null;

  const backup = async () => {
    const data = await exportAll();
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const name = `forge-backup-${dateKey()}.json`;
    const file = new File([blob], name, { type: 'application/json' });
    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Forge backup' });
        localStorage.setItem('forge.lastBackup', nowISO());
        return;
      }
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    localStorage.setItem('forge.lastBackup', nowISO());
  };

  const restore = async (f: File) => {
    try {
      const json = JSON.parse(await f.text());
      if (!confirm('Restoring replaces everything currently in the app with the backup. Continue?')) return;
      await importAll(json);
      setMsg('Backup restored.');
    } catch (e) {
      setMsg((e as Error).message || 'Could not read that file.');
    }
  };

  const lastBackup = localStorage.getItem('forge.lastBackup');

  return (
    <Page>
      <div style={{ paddingTop: 12 }}>
        <h1 className="large-title">{profile.name || 'Profile'}</h1>
      </div>
      <div className="card">
        <div className="sub" style={{ color: 'var(--ink)' }}>
          {profile.age} yrs · {fmtHeight(profile.heightIn)} · {weights.at(-1)?.lbs ?? profile.weightLbs} lb
        </div>
        <div className="foot" style={{ marginTop: 4 }}>
          {profile.goals.map((g) => GOAL_LABEL[g]).join(' → ')} · {sessions.filter((s) => s.status === 'done').length} workouts logged
        </div>
      </div>

      <Section title="Your answers">
        <div className="list">
          {SECTIONS.map((s, i) => (
            <ListRow key={s.key} title={s.title} onClick={() => open(i)} />
          ))}
        </div>
        <p className="foot" style={{ margin: '8px 4px' }}>Changing answers doesn’t silently change your program. Rebuild it from the Program tab when you want it to reflect new answers.</p>
      </Section>

      <Section title="Your data">
        <div className="list">
          <ListRow title="Back up now" subtitle={lastBackup ? `Last backup ${new Date(lastBackup).toLocaleDateString()}` : 'Save a file to Files or iCloud Drive'} onClick={backup} />
          <ListRow title="Restore from backup" onClick={() => fileRef.current?.click()} />
          <ListRow title="Add to Home Screen" onClick={() => setInstallOpen(true)} />
        </div>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => e.target.files?.[0] && restore(e.target.files[0])} />
        {msg && <p className="sub" style={{ margin: '8px 4px' }}>{msg}</p>}
        <p className="foot" style={{ margin: '8px 4px' }}>All data lives only on this device. Deleting the app from your Home Screen deletes it, so back up regularly.</p>
      </Section>

      <Section>
        <div className="list">
          <button
            className="list-row"
            style={{ color: 'var(--bad)' }}
            onClick={async () => {
              if (!confirm('Erase all data and start over? This cannot be undone.')) return;
              if (!confirm('Are you sure? Consider backing up first.')) return;
              await wipeAll();
              location.href = '/';
            }}
          >
            Erase all data
          </button>
        </div>
      </Section>

      <Sheet
        open={!!sec}
        onClose={() => setEditing(null)}
        title={sec?.title}
        right={
          <button
            className="link-btn"
            disabled={sec ? !sec.valid(draft) : true}
            onClick={async () => {
              await db.profile.put({ ...profile, ...draft, id: 'me', updatedAt: nowISO() });
              setEditing(null);
            }}
          >
            Save
          </button>
        }
      >
        {sec && <sec.C p={draft} set={(patch) => setDraft((d) => ({ ...d, ...patch }))} />}
        <div className="kbd-pad" />
      </Sheet>

      <Sheet open={installOpen} onClose={() => setInstallOpen(false)} title="Add to Home Screen">
        <ol className="stack sub" style={{ color: 'var(--ink)', paddingLeft: 20, fontSize: 17 }}>
          <li>Open this app’s link in <b>Safari</b> on your iPhone.</li>
          <li>Tap the <b>Share</b> button (square with an arrow).</li>
          <li>Scroll down and tap <b>Add to Home Screen</b>.</li>
          <li>Tap <b>Add</b>. Open it from the new icon from now on.</li>
        </ol>
        <p className="foot">The Home Screen app keeps its own storage, separate from Safari. Set it up there first, then use it from the icon.</p>
      </Sheet>
    </Page>
  );
}
