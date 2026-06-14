// src/renderer/components/LaneSection.tsx
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { Lane } from '../../model/item';
import type { TriageRow } from '../../app/view-model';
import { ItemRow } from './ItemRow';
import { LANE_META, groupRowsBySender } from './laneMeta';

export function LaneSection({
  lane,
  label,
  items,
  collapsed,
  onToggle,
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
  collapsed: boolean;
  onToggle: () => void;
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
    <ItemRow
      key={row.id}
      row={row}
      selected={selected.has(row.id)}
      focused={focusedId === row.id}
      onToggleSelect={onToggleSelect}
      onOpen={onOpen}
      onClear={onClear}
      onRerank={onRerank}
    />
  );

  return (
    <section className="elev-panel overflow-hidden rounded-xl">
      <div className={`h-[3px] w-full ${meta.rail}`} aria-hidden="true" />
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={!collapsed}
        className="flex w-full items-center justify-between gap-2 px-3.5 py-2.5 text-left transition-colors hover:bg-panel-2"
      >
        <div className="flex items-center gap-2">
          {collapsed ? <ChevronRight size={14} className="text-ink-3" /> : <ChevronDown size={14} className="text-ink-3" />}
          {meta.icon}
          <h2 className="text-[13px] font-semibold tracking-[-0.01em] text-ink">{label ?? meta.title}</h2>
        </div>
        <span className="rounded-full border border-line bg-panel-2 px-2 py-px font-mono text-[12px] font-semibold tabular-nums text-ink-2">{items.length}</span>
      </button>

      {!collapsed && (
        items.length === 0 ? (
          <p className="border-t border-line px-4 py-5 text-center text-[13px] text-ink-3">You&apos;re all caught up here.</p>
        ) : bySender ? (
          groupRowsBySender(items).map((g) => (
            <div key={g.sender}>
              <div className="border-t border-line bg-panel-2/40 px-3.5 py-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-ink-3">{g.sender}</div>
              {g.rows.map(renderRow)}
            </div>
          ))
        ) : (
          items.map(renderRow)
        )
      )}
    </section>
  );
}
