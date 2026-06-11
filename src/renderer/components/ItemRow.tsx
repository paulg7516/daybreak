// src/renderer/components/ItemRow.tsx
import { ExternalLink, X } from 'lucide-react';
import type { Lane } from '../../model/item';
import type { TriageRow } from '../../app/view-model';
import { UrgencyBadge } from './UrgencyBadge';

const LANE_OPTIONS: { value: Lane; label: string }[] = [
  { value: 'respond', label: 'Respond' },
  { value: 'approve', label: 'Approve' },
  { value: 'review', label: 'Review' },
  { value: 'fyi', label: 'FYI' },
];

function relTime(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function ItemRow({
  row,
  selected = false,
  focused = false,
  onToggleSelect,
  onOpen,
  onClear,
  onRerank,
}: {
  row: TriageRow;
  selected?: boolean;
  focused?: boolean;
  onToggleSelect?: (id: string) => void;
  onOpen: (webLink: string) => void;
  onClear: (id: string) => void;
  onRerank: (id: string, lane: Lane) => void;
}) {
  return (
    <div
      data-row-id={row.id}
      className={`group flex items-start gap-3 border-t border-line px-3.5 py-2.5 transition-colors ${focused ? 'bg-panel-2 ring-1 ring-inset ring-accent/50' : 'hover:bg-panel-2'} ${selected ? 'bg-accent/5' : ''}`}
    >
      {onToggleSelect && (
        <input
          type="checkbox"
          aria-label={`Select ${row.subject}`}
          checked={selected}
          onChange={() => onToggleSelect(row.id)}
          className={`mt-0.5 accent-accent transition-opacity ${selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
        />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <UrgencyBadge urgency={row.urgency} />
          <span className="truncate text-[13px] font-medium text-ink">{row.subject}</span>
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-[12px] text-ink-2">
          <span className="truncate">{row.from}</span>
          <span className="text-ink-3">·</span>
          <span className="shrink-0 font-mono tabular-nums text-ink-3">{relTime(row.receivedAt)}</span>
          {row.reranked && <span className="shrink-0 text-[10.5px] text-ink-3">· moved by you</span>}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
        <button
          type="button"
          aria-label="Open"
          title="Open"
          disabled={!row.webLink}
          onClick={() => row.webLink && onOpen(row.webLink)}
          className="grid h-7 w-7 place-items-center rounded-md text-ink-3 transition-colors hover:bg-panel hover:text-ink disabled:opacity-40"
        >
          <ExternalLink size={14} />
        </button>
        <select
          aria-label="Move to lane"
          value={row.lane}
          onChange={(e) => onRerank(row.id, e.target.value as Lane)}
          className="rounded-md border border-line bg-panel px-1.5 py-1 text-[11px] font-medium text-ink-2 transition-colors hover:border-ink-3"
        >
          {LANE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <button
          type="button"
          aria-label="Clear"
          title="Clear"
          onClick={() => onClear(row.id)}
          className="grid h-7 w-7 place-items-center rounded-md text-ink-3 transition-colors hover:bg-today-tint hover:text-today"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
