import { ChevronLeft, ChevronRight, Plus, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { BackBar, Bar, Field, NumberInput, Page, Section, Sheet } from '../components/ui';
import { db } from '../db';
import { byDate, calculateTargets, frequentFoods, targetsFor, totals } from '../engine/nutrition';
import { useFood, useProfile, useWeights } from '../lib/data';
import { dateKey, fmtDate, fmtNum, nowISO, parseDateKey, uid } from '../lib/util';
import type { FoodEntry, NutritionTargets } from '../types';

export default function Nutrition() {
  const profile = useProfile();
  const food = useFood() ?? [];
  const weights = useWeights() ?? [];
  const [date, setDate] = useState(dateKey());
  const [adding, setAdding] = useState(false);
  const [editTargets, setEditTargets] = useState(false);
  const latest = weights.at(-1)?.lbs;
  const frequent = useMemo(() => frequentFoods(food), [food]);
  const week = useMemo(() => {
    const days = byDate(food);
    const out: { date: string; kcal: number; protein: number; logged: boolean }[] = [];
    for (let i = 6; i >= 0; i--) {
      const k = dateKey(new Date(Date.now() - i * 86400000));
      const t = days.get(k);
      out.push({ date: k, kcal: t?.kcal ?? 0, protein: t?.protein ?? 0, logged: !!t });
    }
    return out;
  }, [food]);
  if (!profile) return null;

  const t = targetsFor(profile, latest);
  const entries = food.filter((f) => f.date === date).sort((a, b) => a.at.localeCompare(b.at));
  const day = totals(entries);
  const loggedDays = week.filter((d) => d.logged);
  const avgK = loggedDays.length ? loggedDays.reduce((a, d) => a + d.kcal, 0) / loggedDays.length : 0;
  const avgP = loggedDays.length ? loggedDays.reduce((a, d) => a + d.protein, 0) / loggedDays.length : 0;
  const shift = (n: number) => {
    const d = parseDateKey(date);
    d.setDate(d.getDate() + n);
    if (dateKey(d) <= dateKey()) setDate(dateKey(d));
  };
  const quickAdd = async (f: FoodEntry) => {
    await db.food.add({ ...f, id: uid(), date, at: nowISO() });
  };

  const macro = (label: string, val: number, target: number, unit: string) => (
    <div>
      <div className="row between"><span className="foot">{label}</span><span className="foot num">{fmtNum(val)} / {fmtNum(target)} {unit}</span></div>
      <div style={{ marginTop: 4 }}><Bar pct={(val / Math.max(1, target)) * 100} /></div>
    </div>
  );

  return (
    <Page noTabs>
      <BackBar title="Nutrition" />
      <div className="row between" style={{ margin: '8px 0 12px' }}>
        <button className="icon-btn" aria-label="Previous day" onClick={() => shift(-1)}><ChevronLeft size={18} /></button>
        <div className="headline">{date === dateKey() ? 'Today' : fmtDate(date, { weekday: 'long', month: 'short', day: 'numeric' })}</div>
        <button className="icon-btn" aria-label="Next day" onClick={() => shift(1)} style={{ opacity: date === dateKey() ? 0.3 : 1 }}><ChevronRight size={18} /></button>
      </div>

      <div className="card">
        <div className="row between" style={{ alignItems: 'flex-end' }}>
          <div>
            <div className="foot">Calories</div>
            <div className="big-num">{fmtNum(day.kcal)}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="mid-num">{fmtNum(Math.abs(t.kcal - day.kcal))}</div>
            <div className="foot">{day.kcal <= t.kcal ? 'remaining' : 'over'} of {fmtNum(t.kcal)}</div>
          </div>
        </div>
        <div style={{ marginTop: 10 }}><Bar pct={(day.kcal / t.kcal) * 100} /></div>
        <div className="stack" style={{ marginTop: 16 }}>
          {macro('Protein', day.protein, t.protein, 'g')}
          {macro('Carbs', day.carbs, t.carbs, 'g')}
          {macro('Fat', day.fat, t.fat, 'g')}
        </div>
      </div>

      <button className="btn" style={{ marginTop: 12 }} onClick={() => setAdding(true)}><Plus size={18} /> Log food</button>

      {frequent.length > 0 && (
        <Section title="Quick add">
          <div className="chips">
            {frequent.map((f) => (
              <button key={f.id} className="chip" onClick={() => quickAdd(f)}>
                {f.name} <span className="foot">{f.kcal}</span>
              </button>
            ))}
          </div>
          <div className="foot" style={{ margin: '8px 4px 0' }}>Tap to log again on this day.</div>
        </Section>
      )}

      <Section title="Logged">
        {entries.length ? (
          <div className="list">
            {entries.map((e) => (
              <div className="list-row" key={e.id}>
                <div className="grow">
                  <div style={{ fontWeight: 500 }}>{e.name || 'Food'}</div>
                  <div className="foot num">{e.protein}p{e.carbs !== undefined ? ` · ${e.carbs}c` : ''}{e.fat !== undefined ? ` · ${e.fat}f` : ''}</div>
                </div>
                <div className="value num">{e.kcal}</div>
                <button className="icon-btn plain" aria-label="Delete" onClick={() => db.food.delete(e.id)}><X size={16} /></button>
              </div>
            ))}
          </div>
        ) : (
          <div className="card foot">Nothing logged for this day.</div>
        )}
      </Section>

      <Section title="Last 7 days">
        <div className="card">
          <div className="grid-2">
            <div><div className="foot">Avg calories</div><div className="mid-num">{loggedDays.length ? fmtNum(avgK) : '—'}</div><div className="foot">target {fmtNum(t.kcal)}</div></div>
            <div><div className="foot">Avg protein</div><div className="mid-num">{loggedDays.length ? `${fmtNum(avgP)} g` : '—'}</div><div className="foot">target {t.protein} g</div></div>
          </div>
          <div className="dots" style={{ marginTop: 14, justifyContent: 'space-between' }}>
            {week.map((d) => (
              <div key={d.date} className={`dot${d.logged ? (Math.abs(d.kcal - t.kcal) <= t.kcal * 0.1 ? ' done' : ' planned') : ''}${d.date === date ? ' today' : ''}`} title={`${d.date}: ${d.kcal} kcal`}>
                {parseDateKey(d.date).toLocaleDateString('en-US', { weekday: 'narrow' })}
              </div>
            ))}
          </div>
          <div className="foot" style={{ marginTop: 8 }}>Filled = within 10% of your calorie target. Averages count logged days only ({loggedDays.length}/7).</div>
        </div>
      </Section>

      <Section title="Targets" action={<button className="link-btn" style={{ fontSize: 15 }} onClick={() => setEditTargets(true)}>Edit</button>}>
        <div className="card sub" style={{ fontSize: 14 }}>
          {t.custom
            ? `Custom targets: ${t.kcal} kcal · ${t.protein} g protein · ${t.carbs} g carbs · ${t.fat} g fat.`
            : `Estimated from your size, age, activity and ${profile.daysPerWeek} training days, with a ${profile.nutritionGoal === 'lose' ? '20% deficit' : profile.nutritionGoal === 'gain' ? '10% surplus' : 'maintenance intake'}. Protein ~${profile.nutritionGoal === 'lose' ? '1.0' : '0.8'} g/lb. It’s a starting estimate — your weight trend shows the truth, and Program review will suggest adjustments.`}
        </div>
      </Section>

      <AddFoodSheet open={adding} onClose={() => setAdding(false)} date={date} />
      <TargetsSheet open={editTargets} onClose={() => setEditTargets(false)} current={t} calculated={calculateTargets(profile, latest)} />
    </Page>
  );
}

function AddFoodSheet({ open, onClose, date }: { open: boolean; onClose: () => void; date: string }) {
  const [name, setName] = useState('');
  const [kcal, setKcal] = useState<number | undefined>();
  const [protein, setProtein] = useState<number | undefined>();
  const [carbs, setCarbs] = useState<number | undefined>();
  const [fat, setFat] = useState<number | undefined>();
  const reset = () => { setName(''); setKcal(undefined); setProtein(undefined); setCarbs(undefined); setFat(undefined); };
  const save = async (again: boolean) => {
    await db.food.add({ id: uid(), date, at: nowISO(), name: name.trim(), kcal: kcal ?? 0, protein: protein ?? 0, carbs, fat });
    reset();
    if (!again) onClose();
  };
  return (
    <Sheet open={open} onClose={() => { reset(); onClose(); }} title="Log food">
      <div className="stack">
        <Field label="What">
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Chicken & rice bowl" />
        </Field>
        <div className="grid-2">
          <Field label="Calories"><NumberInput value={kcal} onChange={setKcal} unit="kcal" /></Field>
          <Field label="Protein"><NumberInput value={protein} onChange={setProtein} unit="g" /></Field>
          <Field label="Carbs (optional)"><NumberInput value={carbs} onChange={setCarbs} unit="g" /></Field>
          <Field label="Fat (optional)"><NumberInput value={fat} onChange={setFat} unit="g" /></Field>
        </div>
        <p className="foot">Rough numbers are fine — consistency matters more than precision. Frequent foods appear as one-tap quick adds.</p>
        <div className="btn-row">
          <button className="btn secondary" disabled={!kcal} onClick={() => save(true)}>Save & add another</button>
          <button className="btn" disabled={!kcal} onClick={() => save(false)}>Save</button>
        </div>
      </div>
    </Sheet>
  );
}

function TargetsSheet({ open, onClose, current, calculated }: { open: boolean; onClose: () => void; current: NutritionTargets; calculated: NutritionTargets }) {
  const [t, setT] = useState(current);
  return (
    <Sheet open={open} onClose={onClose} title="Daily targets" right={<button className="link-btn" onClick={async () => { await db.profile.update('me', { nutritionTargets: { ...t, custom: true } }); onClose(); }}>Save</button>}>
      <div className="grid-2">
        <Field label="Calories"><NumberInput value={t.kcal} onChange={(v) => setT({ ...t, kcal: v ?? 0 })} unit="kcal" /></Field>
        <Field label="Protein"><NumberInput value={t.protein} onChange={(v) => setT({ ...t, protein: v ?? 0 })} unit="g" /></Field>
        <Field label="Carbs"><NumberInput value={t.carbs} onChange={(v) => setT({ ...t, carbs: v ?? 0 })} unit="g" /></Field>
        <Field label="Fat"><NumberInput value={t.fat} onChange={(v) => setT({ ...t, fat: v ?? 0 })} unit="g" /></Field>
      </div>
      <p className="foot" style={{ marginTop: 12 }}>Macros add up to {fmtNum(t.protein * 4 + t.carbs * 4 + t.fat * 9)} kcal.</p>
      <button className="btn secondary" style={{ marginTop: 8 }} onClick={async () => { await db.profile.update('me', { nutritionTargets: undefined }); setT(calculated); onClose(); }}>
        Use calculated targets ({calculated.kcal} kcal)
      </button>
    </Sheet>
  );
}
