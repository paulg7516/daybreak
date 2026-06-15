// src/renderer/components/LaneColumn.tsx
import type { Lane } from '../../model/item';
import type { TriageRow } from '../../app/view-model';
import { ItemRow } from './ItemRow';
import { LANE_META, groupRowsBySender } from './laneMeta';

// Kanban-style column: one lane as a fixed-width vertical card. Used by the Columns
// layout; the stacked layout uses LaneSection instead. Same lane styling + rows.
export function LaneColumn({
  lane,
  label,
  items,
  bySender = false,
  selected,
  focusedId,
  onToggleSelect,
  onOpen,
  onClear,
  onRerank,
}: {
  lane: Lane;
  label?: string;
  items: TriageRow[];
  bySender?: boolean;
  selected: Set<string>;
  focusedId: string | null;
  onToggleSelect: (id: string) => void;
  onOpen: (webLink: string) => void;
  onClear: (id: string) => void;
  onRerank: (id: string, lane: Lane) => void;
}) {
  const meta = LANE_META[lane];
  const renderRow = (row: TriageRow) => (
    <ItemRow key={row.id} row={row} selected={selected.has(row.id)} focused={focusedId === row.id} onToggleSelect={onToggleSelect} onOpen={onOpen} onClear={onClear} onRerank={onRerank} />
  );
  return (
    <section className="elev-panel flex min-w-[15rem] flex-1 flex-col overflow-hidden rounded-xl">
      <div className={`h-[3px] w-full ${meta.rail}`} aria-hidden="true" />
      <div className="flex items-center justify-between gap-2 border-b border-line px-3.5 py-2.5">
        <div className="flex min-w-0 items-start gap-2">
          <span className="mt-0.5 shrink-0">{meta.icon}</span>
          <div className="min-w-0">
            <h2 className="truncate text-[13px] font-semibold tracking-[-0.01em] text-ink">{label ?? meta.title}</h2>
            <p className="mt-0.5 truncate text-[11px] leading-tight text-ink-3">{meta.desc}</p>
          </div>
        </div>
        <span className="rounded-full border border-line bg-panel-2 px-2 py-px font-mono text-[12px] font-semibold tabular-nums text-ink-2">{items.length}</span>
      </div>
      <div className="min-h-[80px]">
        {items.length === 0 ? (
          <p className="px-4 py-6 text-center text-[12px] text-ink-3">All caught up</p>
        ) : bySender ? (
          groupRowsBySender(items).map((g) => (
            <div key={g.sender}>
              <div className="border-t border-line bg-panel-2/40 px-3.5 py-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-ink-3">{g.sender}</div>
              {g.rows.map(renderRow)}
            </div>
          ))
        ) : (
          items.map(renderRow)
        )}
      </div>
    </section>
  );
}
