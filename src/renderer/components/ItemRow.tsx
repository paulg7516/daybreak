// src/renderer/components/ItemRow.tsx
import { Check, Mail, Ticket } from 'lucide-react';
import { LANE_LABELS, LANE_ORDER, type Lane, type Source } from '../../model/item';
import type { TriageRow } from '../../app/view-model';
import { UrgencyBadge } from './UrgencyBadge';

// Single source of truth: the rerank dropdown mirrors the lane labels in the model.
const LANE_OPTIONS: { value: Lane; label: string }[] = LANE_ORDER.map((value) => ({ value, label: LANE_LABELS[value] }));

function relTime(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// Prefer the sender's real display name; otherwise tidy the address
// ("dana.whitfield@co" -> "Dana Whitfield") so a row never shows a raw mailbox.
function senderName(row: TriageRow): string {
  if (row.fromName && row.fromName.trim()) return row.fromName.trim();
  const from = row.from || '';
  const local = from.includes('@') ? from.slice(0, from.indexOf('@')) : from;
  const tidy = local
    .split(/[.\-_]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ');
  return tidy || from || 'Unknown sender';
}
function senderInitials(row: TriageRow): string {
  const parts = senderName(row).split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '?') + (parts[1]?.[0] ?? '')).toUpperCase();
}
function senderHue(from: string): number {
  let h = 0;
  for (const c of from) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h % 360;
}

// Where the item came from, shown as a small channel badge next to the sender.
const SOURCE_META: Record<Source, { label: string; Icon: typeof Mail }> = {
  jsm: { label: 'JSM', Icon: Ticket },
  email_internal: { label: 'Mail', Icon: Mail },
  email_vendor: { label: 'Mail', Icon: Mail },
};

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
  const src = SOURCE_META[row.source];
  // The "why it's here" line. The sender's intent tag is implicit in the lane, so we
  // drop that internal reason and surface the human-meaningful ones (deadline, SLA).
  const reason = row.reasons.filter((r) => !/^sender\b/i.test(r)).join(' · ');
  // Opening the item (in Outlook / Gmail / JSM) is where you actually act, so the whole
  // row opens on click - like any inbox. The only on-board action is "Done", which
  // clears it. Both are uniform across lanes; the lane is just the category.
  const open = () => { if (row.webLink) onOpen(row.webLink); };

  return (
    <div
      data-row-id={row.id}
      onClick={open}
      className={`group relative flex items-start gap-3 border-t border-line px-4 py-3 transition-colors ${row.webLink ? 'cursor-pointer' : ''} ${focused ? 'bg-panel-2 ring-1 ring-inset ring-accent/50' : 'hover:bg-panel-2'} ${selected ? 'bg-accent/5' : ''}`}
    >
      {/* sender avatar, swapping to a checkbox on hover / when selected */}
      <div className="relative mt-0.5 h-7 w-7 shrink-0" onClick={(e) => e.stopPropagation()}>
        <div
          aria-hidden="true"
          className={`grid h-7 w-7 place-items-center rounded-full text-[11px] font-semibold text-white transition-opacity ${selected ? 'opacity-0' : 'group-hover:opacity-0'}`}
          style={{ background: `hsl(${hue} 45% 55%)` }}
        >
          {senderInitials(row)}
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
        {/* line 1: urgency + the ask */}
        <div className="flex items-center gap-2">
          <UrgencyBadge urgency={row.urgency} />
          <span className="truncate text-[13.5px] font-medium text-ink">{row.subject}</span>
        </div>
        {/* line 2: who + where + when */}
        <div className="mt-1 flex items-center gap-1.5 text-[12px]">
          <span className="truncate font-medium text-ink-2">{senderName(row)}</span>
          <span className="inline-flex shrink-0 items-center gap-1 rounded border border-line px-1.5 py-px text-[10px] font-medium uppercase tracking-wide text-ink-3">
            <src.Icon size={10} strokeWidth={2} />
            {src.label}
          </span>
          <span className="text-ink-3">·</span>
          <span className="shrink-0 font-mono tabular-nums text-ink-3">{relTime(row.receivedAt)}</span>
          {row.reranked && <span className="shrink-0 text-ink-3">· moved by you</span>}
        </div>
        {/* line 3: why it's waiting on you */}
        {reason && <div className="mt-1 truncate text-[12px] text-ink-3">{reason}</div>}
      </div>

      {/* on-board actions - absolutely positioned so they never reserve layout width
          (inline, the controls squeezed the subject to "T..." in narrow Columns cards).
          Done clears the item; the dropdown fixes a miscategorised lane. */}
      <div
        className="absolute right-2.5 top-2 flex items-center gap-1 rounded-lg bg-panel-2 px-1 py-0.5 opacity-0 shadow-sm ring-1 ring-line transition-opacity duration-150 group-hover:opacity-100"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          aria-label="Done"
          title="Mark done (clears it off the board)"
          onClick={() => onClear(row.id)}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11.5px] font-medium text-ink-2 transition-colors hover:bg-good-tint hover:text-good"
        >
          <Check size={13} strokeWidth={2.5} />
          Done
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
      </div>
    </div>
  );
}
