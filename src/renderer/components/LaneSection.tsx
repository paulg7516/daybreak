// src/renderer/components/LaneSection.tsx
import { useState } from 'react';
import { Reply, Stamp, Eye, Inbox, ChevronDown, ChevronRight } from 'lucide-react';
import type { Lane } from '../../model/item';
import type { TriageRow } from '../../app/view-model';
import { ItemRow } from './ItemRow';

const LANE_META: Record<Lane, { title: string; rail: string; icon: React.ReactNode }> = {
  respond: { title: 'Respond', rail: 'bg-today', icon: <Reply size={14} strokeWidth={2} className="text-today" /> },
  approve: { title: 'Approve / Decide', rail: 'bg-week', icon: <Stamp size={14} strokeWidth={2} className="text-week" /> },
  review: { title: 'Review', rail: 'bg-accent', icon: <Eye size={14} strokeWidth={2} className="text-accent" /> },
  fyi: { title: 'FYI', rail: 'bg-fyi', icon: <Inbox size={14} strokeWidth={2} className="text-fyi" /> },
};

function groupBySender(items: TriageRow[]): { sender: string; rows: TriageRow[] }[] {
  const map = new Map<string, TriageRow[]>();
  for (const r of items) {
    const list = map.get(r.from) ?? [];
    list.push(r);
    map.set(r.from, list);
  }
  return [...map.entries()].map(([sender, rows]) => ({ sender, rows }));
}

export function LaneSection({
  lane,
  label,
  items,
  defaultCollapsed = false,
  bySender = false,
  onOpen,
  onClear,
  onRerank,
}: {
  lane: Lane;
  label?: string;
  items: TriageRow[];
  defaultCollapsed?: boolean;
  bySender?: boolean;
  onOpen: (webLink: string) => void;
  onClear: (id: string) => void;
  onRerank: (id: string, lane: Lane) => void;
}) {
  const meta = LANE_META[lane];
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  return (
    <section className="elev-panel overflow-hidden rounded-xl">
      <div className={`h-[3px] w-full ${meta.rail}`} aria-hidden="true" />
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
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
          groupBySender(items).map((g) => (
            <div key={g.sender}>
              <div className="border-t border-line bg-panel-2/40 px-3.5 py-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-ink-3">{g.sender}</div>
              {g.rows.map((row) => (
                <ItemRow key={row.id} row={row} onOpen={onOpen} onClear={onClear} onRerank={onRerank} />
              ))}
            </div>
          ))
        ) : (
          items.map((row) => (
            <ItemRow key={row.id} row={row} onOpen={onOpen} onClear={onClear} onRerank={onRerank} />
          ))
        )
      )}
    </section>
  );
}
