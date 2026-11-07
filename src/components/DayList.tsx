import { getExercise, MUSCLE_LABEL } from '../data/exercises';
import { estimateMinutes } from '../engine/generator';
import type { ProgramDay } from '../types';

export const fmtRest = (s: number) => (s >= 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : `${s}s`);

export function DayExercises({ day }: { day: ProgramDay }) {
  return (
    <div className="list" style={{ background: 'var(--bg)', border: '1px solid var(--line)' }}>
      {day.exercises.map((pe, i) => {
        const ex = getExercise(pe.exerciseId);
        return (
          <div className="list-row" key={pe.id}>
            <span className="foot num" style={{ width: 16 }}>{i + 1}</span>
            <div className="grow">
              <div style={{ fontWeight: 500 }}>{ex.name}</div>
              <div className="foot">
                {MUSCLE_LABEL[ex.muscle]} · rest {fmtRest(pe.restSec)}
                {pe.warmup ? ' · warm-up sets' : ''}
              </div>
            </div>
            <div className="value num" style={{ fontWeight: 600, color: 'var(--ink)' }}>
              {pe.sets} × {pe.repMin}–{pe.repMax}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function dayMeta(day: ProgramDay) {
  return `${day.exercises.length} exercises · ~${estimateMinutes(day.exercises)} min`;
}
