// src/renderer/components/ItemRow.tsx
import type { ScoredItemView } from '../../app/view-model';

function relTime(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

const TAG_LABEL: Record<string, string> = {
  blocked: 'Blocked', action: 'Action needed', whenever: 'Whenever', fyi: 'FYI',
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
  return (
    <div className={`flex items-start gap-3 px-4 py-3 border-b border-slate-100 dark:border-slate-800 ${row.resolved ? 'opacity-60' : ''}`}>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium">{row.subject}</span>
          {row.senderTag && (
            <span className="shrink-0 rounded px-1.5 py-0.5 text-xs bg-slate-200 dark:bg-slate-700">
              {TAG_LABEL[row.senderTag]}
            </span>
          )}
        </div>
        <div className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
          <span>{row.from}</span> <span className="tabular-nums">{relTime(row.receivedAt)}</span>
        </div>
        {row.reasons.length > 0 && (
          <div className="mt-1 text-xs text-slate-400">{row.reasons.join(' · ')}</div>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          className="rounded px-2 py-1 text-sm hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40"
          disabled={!row.webLink}
          onClick={() => row.webLink && onOpen(row.webLink)}
        >
          Open
        </button>
        <select
          aria-label="Re-rank"
          className="rounded border border-slate-200 dark:border-slate-700 bg-transparent px-1 py-1 text-sm"
          value={row.lane}
          onChange={(e) => onRerank(row.id, e.target.value as ScoredItemView['lane'])}
        >
          <option value="today">Today</option>
          <option value="this_week">This week</option>
          <option value="fyi">FYI</option>
        </select>
        <button
          type="button"
          className="rounded px-2 py-1 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
          onClick={() => onClear(row.id)}
        >
          Clear
        </button>
      </div>
    </div>
  );
}
