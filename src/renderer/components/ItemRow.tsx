// src/renderer/components/ItemRow.tsx
import { ExternalLink, X } from 'lucide-react';
import { LANE_LABELS, LANE_ORDER, type Lane } from '../../model/item';
import type { TriageRow } from '../../app/view-model';
import { UrgencyBadge } from './UrgencyBadge';

// Single source of truth: the rerank dropdown mirrors the lane labels in the model.
const LANE_OPTIONS: { value: Lane; label: string }[] = LANE_ORDER.map((value) => ({ value, label: LANE_LABELS[value] }));

function relTime(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// Stable per-sender initials + hue for the avatar (adds scannability to the rows).
function senderInitials(from: string): string {
  const name = from.split('<')[0].trim() || from;
  const base = name.includes('@') ? name.split('@')[0] : name;
  const parts = base.split(/[.\s_-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? base[0] ?? '?') + (parts[1]?.[0] ?? '')).toUpperCase();
}
function senderHue(from: string): number {
  let h = 0;
  for (const c of from) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h % 360;
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
  const hue = senderHue(row.from);
  return (
    <div
      data-row-id={row.id}
      className={`group relative flex items-start gap-3 border-t border-line px-4 py-3 transition-colors ${focused ? 'bg-panel-2 ring-1 ring-inset ring-accent/50' : 'hover:bg-panel-2'} ${selected ? 'bg-accent/5' : ''}`}
    >
      {/* sender avatar, swapping to a checkbox on hover / when selected */}
      <div className="relative mt-0.5 h-7 w-7 shrink-0">
        <div
          aria-hidden="true"
          className={`grid h-7 w-7 place-items-center rounded-full text-[11px] font-semibold text-white transition-opacity ${selected ? 'opacity-0' : 'group-hover:opacity-0'}`}
          style={{ background: `hsl(${hue} 45% 55%)` }}
        >
          {senderInitials(row.from)}
        </div>
        {onToggleSelect && (
          <input
            type="checkbox"
            aria-label={`Select ${row.subject}`}
            checked={selected}
            onChange={() => onToggleSelect(row.id)}
            className={`absolute inset-0 m-auto h-4 w-4 cursor-pointer accent-accent transition-opacity ${selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
          />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <UrgencyBadge urgency={row.urgency} />
          <span className="truncate text-[13.5px] font-medium text-ink">{row.subject}</span>
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-[12px] text-ink-2">
          <span className="truncate">{row.from}</span>
          <span className="text-ink-3">·</span>
          <span className="shrink-0 font-mono tabular-nums text-ink-3">{relTime(row.receivedAt)}</span>
          {row.reranked && <span className="shrink-0 text-[10.5px] text-ink-3">· moved by you</span>}
        </div>
      </div>

      {/* action toolbar - absolutely positioned so it never reserves layout width
          (inline it squeezed the subject to "T..." in narrow Columns cards) */}
      <div className="absolute right-2.5 top-2 flex items-center gap-1 rounded-lg bg-panel-2 px-1 py-0.5 opacity-0 shadow-sm ring-1 ring-line transition-opacity duration-150 group-hover:opacity-100">
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
