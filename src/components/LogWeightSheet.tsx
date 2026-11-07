import { useEffect, useState } from 'react';
import { logWeight } from '../lib/data';
import { dateKey } from '../lib/util';
import { Field, NumberInput, Sheet } from './ui';

export function LogWeightSheet({ open, onClose, last }: { open: boolean; onClose: () => void; last?: number }) {
  const [lbs, setLbs] = useState<number | undefined>(last);
  const [date, setDate] = useState(dateKey());
  useEffect(() => {
    if (open) {
      setLbs(last);
      setDate(dateKey());
    }
  }, [open, last]);
  return (
    <Sheet open={open} onClose={onClose} title="Log weight">
      <div className="stack">
        <Field label="Body weight">
          <NumberInput value={lbs} onChange={setLbs} unit="lb" placeholder="175.0" aria-label="Body weight in pounds" />
        </Field>
        <Field label="Date">
          <input className="input" type="date" value={date} max={dateKey()} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <p className="foot">Weigh in at the same time each day (ideally morning, after the bathroom) for the cleanest trend. Logging the same date again replaces that entry.</p>
        <button
          className="btn"
          disabled={!lbs || lbs < 50 || lbs > 700}
          onClick={async () => {
            await logWeight(lbs!, date);
            onClose();
          }}
        >
          Save
        </button>
      </div>
    </Sheet>
  );
}
