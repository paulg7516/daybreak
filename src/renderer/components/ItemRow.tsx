// src/renderer/components/ItemRow.tsx
import { ExternalLink, X, CheckCircle2 } from 'lucide-react';
import type { ScoredItemView } from '../../app/view-model';

function relTime(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

const TAG_LABEL: Record<string, string> = {
  blocked: 'Blocked', action: 'Action needed', whenever: 'Whenever', fyi: 'FYI',
};

const PILL_CLASS: Record<string, string> = {
  blocked: 'bg-today-tint text-today',
  action: 'bg-week-tint text-week',
  whenever: 'bg-fyi-tint text-fyi',
  fyi: 'bg-fyi-tint text-fyi',
};

export function ItemRow({
  row,
  onOpen,
  onClear,
  onRerank,
}: {
  row: ScoredItemView;
  onOpen: (webLink: string) => void;
  onClear: (id: string) => void;
  onRerank: (id: string, lane: ScoredItemView['lane']) => void;
}) {
  const pillClass = row.senderTag ? (PILL_CLASS[row.senderTag] ?? 'bg-panel-2 text-ink-3') : '';
  return (
    <div className={`group flex items-start gap-3 border-t border-line px-3.5 py-2.5 transition-colors hover:bg-panel-2${row.resolved ? ' opacity-60' : ''}`}>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {row.resolved && <CheckCircle2 size={13} className="shrink-0 text-good" />}
          <span className="truncate text-[13px] font-medium text-ink">{row.subject}</span>
          {row.senderTag && (
            <span className={`inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${pillClass}`}>
              <span className="h-1 w-1 rounded-full bg-current" aria-hidden="true" />
              {TAG_LABEL[row.senderTag]}
            </span>
          )}
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-[12px] text-ink-2">
          <span className="truncate">{row.from}</span>
          <span className="text-ink-3">·</span>
          <span className="shrink-0 font-mono tabular-nums text-ink-3">{relTime(row.receivedAt)}</span>
        </div>
        {row.reasons.length > 0 && (
          <div className="mt-1 truncate text-[11.5px] text-ink-3">{row.reasons.join(' · ')}</div>
        )}
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
          aria-label="Re-rank"
          value={row.lane}
          onChange={(e) => onRerank(row.id, e.target.value as ScoredItemView['lane'])}
          className="rounded-md border border-line bg-panel px-1.5 py-1 text-[11px] font-medium text-ink-2 transition-colors hover:border-ink-3"
        >
          <option value="today">Today</option>
          <option value="this_week">This week</option>
          <option value="fyi">FYI</option>
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
