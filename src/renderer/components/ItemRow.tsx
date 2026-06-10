// src/renderer/components/ItemRow.tsx
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
  const pillClass = row.senderTag ? (PILL_CLASS[row.senderTag] ?? 'bg-surface-2 text-ink-3') : '';
  return (
    <div className={`group flex gap-[10px] px-3 py-[9px] pl-[14px] border-t border-line transition-colors hover:bg-surface-2 cursor-default${row.resolved ? ' opacity-55' : ''}`}>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-[7px]">
          <span className="truncate text-[13px] font-semibold text-ink">{row.subject}</span>
          {row.senderTag && (
            <span className={`shrink-0 rounded-full px-[7px] py-px text-[10px] font-semibold tracking-[.02em] ${pillClass}`}>
              {TAG_LABEL[row.senderTag]}
            </span>
          )}
        </div>
        <div className="mt-px flex gap-2 text-[12px] text-ink-2">
          <span>{row.from}</span>
          <span className="tabular-nums">{relTime(row.receivedAt)}</span>
        </div>
        {row.reasons.length > 0 && (
          <div className="mt-[3px] text-[11.5px] text-ink-3">{row.reasons.join(' · ')}</div>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-[120ms]">
        <button
          type="button"
          className="border border-line-strong bg-surface rounded-[5px] px-2 py-[3px] text-[11.5px] font-medium text-ink-2 cursor-pointer transition-colors hover:text-ink hover:border-ink-3 disabled:opacity-40"
          disabled={!row.webLink}
          onClick={() => row.webLink && onOpen(row.webLink)}
        >
          Open
        </button>
        <select
          aria-label="Re-rank"
          className="border border-line-strong bg-surface rounded-[5px] px-1 py-[3px] text-[11.5px] font-medium text-ink-2 cursor-pointer transition-colors hover:border-ink-3"
          value={row.lane}
          onChange={(e) => onRerank(row.id, e.target.value as ScoredItemView['lane'])}
        >
          <option value="today">Today</option>
          <option value="this_week">This week</option>
          <option value="fyi">FYI</option>
        </select>
        <button
          type="button"
          className="border border-line-strong bg-surface rounded-[5px] px-2 py-[3px] text-[11.5px] font-medium text-ink-2 cursor-pointer transition-colors hover:text-today hover:border-today"
          onClick={() => onClear(row.id)}
        >
          Clear
        </button>
      </div>
    </div>
  );
}
