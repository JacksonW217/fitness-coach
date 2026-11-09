import { Check, Pencil, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { EXERCISES, MUSCLE_LABEL } from '../data/exercises';
import { saveCustomExercise } from '../db';
import type { ExerciseDef, Muscle } from '../types';
import { CustomExerciseForm } from './CustomExerciseForm';
import { SearchInput } from './ui';

const ORDER: Muscle[] = ['chest', 'back', 'shoulders', 'traps', 'biceps', 'triceps', 'forearms', 'quads', 'hamstrings', 'glutes', 'calves', 'abs'];

/** Searchable exercise list grouped by muscle. Multi-select via `selected`, or single via `onPick`. */
export function ExercisePicker({
  selected,
  onToggle,
  onPick,
  suggested,
  filter,
}: {
  selected?: string[];
  onToggle?: (id: string) => void;
  onPick?: (ex: ExerciseDef) => void;
  suggested?: ExerciseDef[];
  filter?: (ex: ExerciseDef) => boolean;
}) {
  const [q, setQ] = useState('');
  const [form, setForm] = useState<{ edit?: ExerciseDef } | null>(null);
  const [version, setVersion] = useState(0);

  const groups = useMemo(() => {
    const ql = q.trim().toLowerCase();
    // Your own exercises always show: you told Forge you can do them.
    const list = EXERCISES.filter((e) => !e.archived && (e.custom || !filter || filter(e)) && (!ql || e.name.toLowerCase().includes(ql) || MUSCLE_LABEL[e.muscle].toLowerCase().includes(ql)));
    const mine = list.filter((e) => e.custom);
    const byMuscle = ORDER.map((m) => ({ key: m, label: MUSCLE_LABEL[m], items: list.filter((e) => e.muscle === m && !e.custom) })).filter((g) => g.items.length);
    return mine.length ? [{ key: 'mine', label: 'My exercises', items: mine }, ...byMuscle] : byMuscle;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, filter, version]);

  if (form) {
    return (
      <div className="stack">
        <div className="headline">{form.edit ? 'Edit exercise' : 'New exercise'}</div>
        <CustomExerciseForm
          initial={form.edit}
          initialName={form.edit ? undefined : q.trim()}
          onCancel={() => setForm(null)}
          onSaved={(ex) => {
            setForm(null);
            setVersion((v) => v + 1);
            if (form.edit) return;
            setQ('');
            if (onPick) onPick(ex);
            else onToggle?.(ex.id);
          }}
        />
        {form.edit && (
          <button
            type="button"
            className="btn danger"
            onClick={async () => {
              if (!confirm(`Remove “${form.edit!.name}” from your exercise list? Workouts you already logged keep it.`)) return;
              await saveCustomExercise({ ...form.edit!, archived: true });
              setForm(null);
              setVersion((v) => v + 1);
            }}
          >
            Remove exercise
          </button>
        )}
      </div>
    );
  }

  const row = (e: ExerciseDef) => {
    const on = selected?.includes(e.id);
    return (
      <div key={e.id} className="list-row" style={{ padding: 0 }}>
        <button className="list-row" style={{ flex: 1 }} onClick={() => (onPick ? onPick(e) : onToggle?.(e.id))}>
          <div className="grow">
            <div style={{ fontWeight: 500 }}>{e.name}</div>
            <div className="foot">{MUSCLE_LABEL[e.muscle]}{e.secondary.length ? ` · ${e.secondary.map((m) => MUSCLE_LABEL[m]).join(', ')}` : ''}</div>
          </div>
          {selected && <span className={`check${on ? ' on' : ''}`} style={{ width: 28, height: 28, borderRadius: 8 }}>{on && <Check size={16} />}</span>}
        </button>
        {e.custom && (
          <button className="icon-btn plain" style={{ marginRight: 8 }} aria-label={`Edit ${e.name}`} onClick={() => setForm({ edit: e })}>
            <Pencil size={16} />
          </button>
        )}
      </div>
    );
  };

  const empty = groups.length === 0;
  return (
    <div className="stack">
      <SearchInput value={q} onChange={setQ} placeholder="Search exercises" />
      <button className="list-row list" style={{ color: 'var(--accent)', fontWeight: 600 }} onClick={() => setForm({})}>
        <Plus size={20} />
        <span className="grow">{q.trim() && empty ? `Create “${q.trim()}”` : 'Create exercise'}</span>
      </button>
      {empty && <p className="foot" style={{ margin: '0 4px' }}>No exercise matches “{q.trim()}”. Create it and Forge will track it like any other lift.</p>}
      {suggested && !q && suggested.length > 0 && (
        <div>
          <div className="eyebrow" style={{ margin: '0 4px 8px' }}>Suggested swaps</div>
          <div className="list">{suggested.map(row)}</div>
        </div>
      )}
      {groups.map((g) => (
        <div key={g.key}>
          <div className="eyebrow" style={{ margin: '0 4px 8px' }}>{g.label}</div>
          <div className="list">{g.items.map(row)}</div>
        </div>
      ))}
    </div>
  );
}
