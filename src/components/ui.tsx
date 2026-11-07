import { Check, ChevronLeft, ChevronRight, Minus, Plus, Search, X } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

export function Page({ children, noTabs }: { children: ReactNode; noTabs?: boolean }) {
  return <main className={`page${noTabs ? ' no-tabs' : ''}`}>{children}</main>;
}

export function BackBar({ title, right, to }: { title?: string; right?: ReactNode; to?: string }) {
  const nav = useNavigate();
  return (
    <div className="topbar">
      <button className="icon-btn plain" aria-label="Back" onClick={() => (to ? nav(to) : nav(-1))} style={{ marginLeft: -8 }}>
        <ChevronLeft size={26} />
      </button>
      <div className="headline" style={{ flex: 1, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {title}
      </div>
      <div style={{ minWidth: 36, display: 'flex', justifyContent: 'flex-end' }}>{right}</div>
    </div>
  );
}

export function Section({ title, action, children }: { title?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="section">
      {(title || action) && (
        <div className="section-head">
          {title && <h2>{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function ListRow({
  title,
  subtitle,
  value,
  onClick,
  icon,
  chevron = !!onClick,
  right,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  value?: ReactNode;
  onClick?: () => void;
  icon?: ReactNode;
  chevron?: boolean;
  right?: ReactNode;
}) {
  const inner = (
    <>
      {icon}
      <div className="grow">
        <div style={{ fontWeight: 500 }}>{title}</div>
        {subtitle && <div className="foot" style={{ marginTop: 2 }}>{subtitle}</div>}
      </div>
      {value !== undefined && <div className="value num">{value}</div>}
      {right}
      {chevron && <ChevronRight size={18} className="chev" />}
    </>
  );
  return onClick ? (
    <button className="list-row" onClick={onClick}>
      {inner}
    </button>
  ) : (
    <div className="list-row">{inner}</div>
  );
}

export function Chips<T extends string>({ options, value, onChange, labels }: { options: readonly T[]; value: T[]; onChange: (v: T[]) => void; labels?: Partial<Record<T, string>> }) {
  return (
    <div className="chips">
      {options.map((o) => {
        const on = value.includes(o);
        return (
          <button key={o} type="button" className={`chip${on ? ' on' : ''}`} onClick={() => onChange(on ? value.filter((x) => x !== o) : [...value, o])}>
            {labels?.[o] ?? o}
          </button>
        );
      })}
    </div>
  );
}

export function Options<T extends string>({ options, value, onChange }: { options: { value: T; title: string; desc?: string }[]; value: T | undefined; onChange: (v: T) => void }) {
  return (
    <div className="options">
      {options.map((o) => (
        <button key={o.value} type="button" className={`option${value === o.value ? ' on' : ''}`} onClick={() => onChange(o.value)}>
          <span className="radio">{value === o.value && <Check size={14} strokeWidth={3} />}</span>
          <span>
            <div className="t">{o.title}</div>
            {o.desc && <div className="d">{o.desc}</div>}
          </span>
        </button>
      ))}
    </div>
  );
}

export function Segmented<T extends string | number>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="seg" role="tablist">
      {options.map((o) => (
        <button key={String(o.value)} type="button" role="tab" aria-selected={o.value === value} className={o.value === value ? 'on' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Stepper({ value, onChange, min = 0, max = 999, step = 1, format }: { value: number; onChange: (n: number) => void; min?: number; max?: number; step?: number; format?: (n: number) => string }) {
  return (
    <div className="stepper">
      <button type="button" aria-label="Decrease" onClick={() => onChange(Math.max(min, +(value - step).toFixed(2)))} disabled={value <= min}>
        <Minus size={20} />
      </button>
      <span className="v">{format ? format(value) : value}</span>
      <button type="button" aria-label="Increase" onClick={() => onChange(Math.min(max, +(value + step).toFixed(2)))} disabled={value >= max}>
        <Plus size={20} />
      </button>
    </div>
  );
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label?: string }) {
  return <button type="button" role="switch" aria-checked={on} aria-label={label} className={`toggle${on ? ' on' : ''}`} onClick={() => onChange(!on)} />;
}

/** Numeric input that keeps a local string so partial typing ("1.") works. */
export function NumberInput({ value, onChange, unit, placeholder, step, className = 'input', ...rest }: { value: number | undefined; onChange: (n: number | undefined) => void; unit?: string; placeholder?: string; step?: number; className?: string; 'aria-label'?: string }) {
  const [s, setS] = useState(value === undefined ? '' : String(value));
  useEffect(() => {
    setS((cur) => (Number(cur) === value || (cur === '' && value === undefined) ? cur : value === undefined ? '' : String(value)));
  }, [value]);
  const input = (
    <input
      className={className}
      inputMode="decimal"
      type="text"
      pattern="[0-9]*[.]?[0-9]*"
      placeholder={placeholder}
      value={s}
      step={step}
      onFocus={(e) => e.currentTarget.select()}
      onChange={(e) => {
        const v = e.target.value.replace(/[^0-9.]/g, '');
        setS(v);
        onChange(v === '' || v === '.' ? undefined : Number(v));
      }}
      {...rest}
    />
  );
  return unit ? (
    <div className="input-unit">
      {input}
      <em>{unit}</em>
    </div>
  ) : (
    input
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

export function Sheet({ open, onClose, title, children, right }: { open: boolean; onClose: () => void; title?: string; children: ReactNode; right?: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);
  if (!open) return null;
  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="grabber" />
        <div className="sheet-head">
          <button className="icon-btn" aria-label="Close" onClick={onClose}>
            <X size={18} />
          </button>
          <div className="headline">{title}</div>
          <div style={{ minWidth: 36, display: 'flex', justifyContent: 'flex-end' }}>{right}</div>
        </div>
        <div style={{ paddingTop: 8 }}>{children}</div>
      </div>
    </>
  );
}

export function SearchInput({ value, onChange, placeholder = 'Search' }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="search">
      <Search size={18} />
      <input className="input" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} type="search" />
    </div>
  );
}

export function Bar({ pct }: { pct: number }) {
  return (
    <div className="bar" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <i style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <div className="headline">{title}</div>
      {children && <div className="sub">{children}</div>}
    </div>
  );
}

export function Toast({ message, action, onAction, onDone, ms = 5000 }: { message: string; action?: string; onAction?: () => void; onDone: () => void; ms?: number }) {
  useEffect(() => {
    const t = setTimeout(onDone, ms);
    return () => clearTimeout(t);
  }, [onDone, ms, message]);
  return (
    <div className="toast" role="status">
      <span>{message}</span>
      {action && (
        <button
          onClick={() => {
            onAction?.();
            onDone();
          }}
        >
          {action}
        </button>
      )}
    </div>
  );
}
