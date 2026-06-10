// src/renderer/components/SetAsideBin.tsx
import { useState } from 'react';
import { Archive, ChevronDown } from 'lucide-react';
import type { SetAsideView, SetAsideItemView } from '../../app/view-model';
import type { Lane } from '../../model/item';

const REASON_LABEL: Record<string, string> = {
  automated: 'Automated', rule: 'Rule', unmatched: 'Unmatched',
};

const REASON_CHIP: Record<string, string> = {
  automated: 'bg-fyi-tint text-fyi',
  rule: 'bg-week-tint text-week',
  unmatched: 'bg-panel-2 text-ink-3',
};

export function SetAsideBin({ view, onPromote }: { view: SetAsideView; onPromote: (id: string, lane: Lane) => void }) {
  const [open, setOpen] = useState(false);
  if (view.total === 0) return null;
  return (
    <section className="rounded-xl border border-dashed border-line bg-panel-2">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-2.5 text-[12px] font-medium text-ink-2 transition-colors hover:text-ink"
      >
        <Archive size={14} strokeWidth={2} className="shrink-0 text-ink-3" />
        <span>Set aside</span>
        <span className="font-mono tabular-nums ml-1">{view.total}</span>
        <ChevronDown
          size={12}
          strokeWidth={2}
          className={`ml-auto shrink-0 transition-transform duration-150 ${open ? '' : '-rotate-90'}`}
          aria-hidden="true"
        />
      </button>
      {open && view.items.map((row: SetAsideItemView) => (
        <div key={row.id} className="flex items-center gap-3 px-4 py-2 border-t border-line text-[12px]">
          <div className="min-w-0 flex-1">
            <span className="block truncate text-ink">{row.subject}</span>
            <span className="block truncate text-[11px] text-ink-3">{row.from}</span>
          </div>
          <span className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${REASON_CHIP[row.reason] ?? 'bg-panel-2 text-ink-3'}`}>
            {REASON_LABEL[row.reason]}
          </span>
          <select
            aria-label={`Move ${row.subject} to lane`}
            defaultValue=""
            className="shrink-0 rounded-md border border-line bg-panel px-1.5 py-1 text-[11px] text-ink-2 transition-colors hover:border-ink-3"
            onChange={(e) => { if (e.target.value) onPromote(row.id, e.target.value as Lane); }}
          >
            <option value="" disabled>Move to...</option>
            <option value="today">Today</option>
            <option value="this_week">This week</option>
            <option value="fyi">FYI</option>
          </select>
        </div>
      ))}
    </section>
  );
}
