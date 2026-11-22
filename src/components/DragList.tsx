import { GripVertical } from 'lucide-react';
import { useRef, useState, type ReactNode } from 'react';

/** Index an item dragged from `from` lands on, given its centre and the rows' midpoints. */
export function dropIndex(from: number, centre: number, mids: number[]): number {
  let to = from;
  for (let i = 0; i < mids.length; i++) {
    if (i < from && centre < mids[i]) return i;
    if (i > from && centre > mids[i]) to = i;
  }
  return to;
}

/** Move one item in an array. Pure. */
export function moveItem<T>(xs: T[], from: number, to: number): T[] {
  const out = [...xs];
  const [x] = out.splice(from, 1);
  out.splice(to, 0, x);
  return out;
}

interface Drag {
  from: number;
  to: number;
  startY: number;
  dy: number;
  /** Height of the dragged row, including the gap to the next one. */
  size: number;
  mids: number[];
}

/**
 * A list you reorder by dragging the grip on each row. Works with touch,
 * mouse and pen (pointer events). The grip also responds to the arrow keys.
 */
export function DragList<T>({
  items,
  itemKey,
  render,
  onReorder,
  className = 'list',
}: {
  items: T[];
  itemKey: (item: T) => string;
  render: (item: T, index: number) => ReactNode;
  onReorder: (from: number, to: number) => void;
  className?: string;
}) {
  const rows = useRef<(HTMLDivElement | null)[]>([]);
  const [drag, setDrag] = useState<Drag | null>(null);

  const start = (e: React.PointerEvent, i: number) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const rects = rows.current.slice(0, items.length).map((r) => r!.getBoundingClientRect());
    const size = i < rects.length - 1 ? rects[i + 1].top - rects[i].top : rects[i].height;
    navigator.vibrate?.(10);
    setDrag({ from: i, to: i, startY: e.clientY, dy: 0, size, mids: rects.map((r) => r.top + r.height / 2) });
  };

  const move = (e: React.PointerEvent) => {
    if (!drag) return;
    e.preventDefault();
    const dy = e.clientY - drag.startY;
    const to = dropIndex(drag.from, drag.mids[drag.from] + dy, drag.mids);
    if (to !== drag.to) navigator.vibrate?.(5);
    setDrag({ ...drag, dy, to });
  };

  const end = () => {
    if (!drag) return;
    const { from, to } = drag;
    setDrag(null);
    if (from !== to) onReorder(from, to);
  };

  const key = (e: React.KeyboardEvent, i: number) => {
    if (e.key === 'ArrowUp' && i > 0) {
      e.preventDefault();
      onReorder(i, i - 1);
    } else if (e.key === 'ArrowDown' && i < items.length - 1) {
      e.preventDefault();
      onReorder(i, i + 1);
    }
  };

  /** How far each row should slide to make room for the one being dragged. */
  const offset = (i: number) => {
    if (!drag) return 0;
    if (i === drag.from) return drag.dy;
    if (drag.from < drag.to && i > drag.from && i <= drag.to) return -drag.size;
    if (drag.from > drag.to && i >= drag.to && i < drag.from) return drag.size;
    return 0;
  };

  return (
    <div className={`${className} drag-list${drag ? ' dragging' : ''}`}>
      {items.map((item, i) => {
        const active = drag?.from === i;
        return (
          <div
            key={itemKey(item)}
            ref={(el) => void (rows.current[i] = el)}
            className={`drag-row${active ? ' active' : ''}`}
            style={{ transform: `translateY(${offset(i)}px)`, transition: active ? 'none' : drag ? 'transform 0.18s ease' : 'none' }}
          >
            <button
              type="button"
              className="drag-handle"
              aria-label="Drag to reorder. Arrow keys also move it."
              onPointerDown={(e) => start(e, i)}
              onPointerMove={move}
              onPointerUp={end}
              onPointerCancel={end}
              onKeyDown={(e) => key(e, i)}
            >
              <GripVertical size={20} />
            </button>
            <div className="drag-body">{render(item, i)}</div>
          </div>
        );
      })}
    </div>
  );
}
