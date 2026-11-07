import { Check } from 'lucide-react';
import { useMemo, useState } from 'react';
import { EXERCISES, MUSCLE_LABEL } from '../data/exercises';
import type { ExerciseDef, Muscle } from '../types';
import { SearchInput } from './ui';

const ORDER: Muscle[] = ['chest', 'back', 'shoulders', 'biceps', 'triceps', 'quads', 'hamstrings', 'glutes', 'calves', 'abs'];

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
  const groups = useMemo(() => {
    const ql = q.trim().toLowerCase();
    const list = EXERCISES.filter((e) => (!filter || filter(e)) && (!ql || e.name.toLowerCase().includes(ql) || MUSCLE_LABEL[e.muscle].toLowerCase().includes(ql)));
    return ORDER.map((m) => ({ m, items: list.filter((e) => e.muscle === m) })).filter((g) => g.items.length);
  }, [q, filter]);

  const row = (e: ExerciseDef) => {
    const on = selected?.includes(e.id);
    return (
      <button key={e.id} className="list-row" onClick={() => (onPick ? onPick(e) : onToggle?.(e.id))}>
        <div className="grow">
          <div style={{ fontWeight: 500 }}>{e.name}</div>
          <div className="foot">{MUSCLE_LABEL[e.muscle]}{e.secondary.length ? ` · ${e.secondary.map((m) => MUSCLE_LABEL[m]).join(', ')}` : ''}</div>
        </div>
        {selected && <span className={`check${on ? ' on' : ''}`} style={{ width: 28, height: 28, borderRadius: 8 }}>{on && <Check size={16} />}</span>}
      </button>
    );
  };

  return (
    <div className="stack">
      <SearchInput value={q} onChange={setQ} placeholder="Search exercises" />
      {suggested && !q && suggested.length > 0 && (
        <div>
          <div className="eyebrow" style={{ margin: '0 4px 8px' }}>Suggested swaps</div>
          <div className="list">{suggested.map(row)}</div>
        </div>
      )}
      {groups.map((g) => (
        <div key={g.m}>
          <div className="eyebrow" style={{ margin: '0 4px 8px' }}>{MUSCLE_LABEL[g.m]}</div>
          <div className="list">{g.items.map(row)}</div>
        </div>
      ))}
    </div>
  );
}
