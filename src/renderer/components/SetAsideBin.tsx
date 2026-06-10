// src/renderer/components/SetAsideBin.tsx
import { useState } from 'react';
import type { SetAsideView, SetAsideItemView } from '../../app/view-model';
import type { Lane } from '../../model/item';

const REASON_LABEL: Record<string, string> = {
  automated: 'Automated', rule: 'Rule', unmatched: 'Unmatched',
};

export function SetAsideBin({ view, onPromote }: { view: SetAsideView; onPromote: (id: string, lane: Lane) => void }) {
  const [open, setOpen] = useState(false);
  if (view.total === 0) return null;
  return (
    <section className="bg-surface-2 border border-dashed border-line-strong rounded-lg">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-[14px] py-[9px] text-[12px] font-medium text-ink-2 transition-colors hover:text-ink"
      >
        <span>Set aside</span>
        <span className="tabular-nums">{view.total}</span>
      </button>
      {open && view.items.map((row: SetAsideItemView) => (
        <div key={row.id} className="flex items-center gap-[10px] px-[14px] py-[7px] border-t border-line text-[12px] text-ink-2">
          <span className="min-w-0 flex-1 truncate text-ink">{row.subject} <span className="text-ink-3">{row.from}</span></span>
          <span className="shrink-0 rounded-full border border-line bg-surface px-[7px] py-px text-[10px] font-semibold text-ink-3">{REASON_LABEL[row.reason]}</span>
          <select
            aria-label={`Move ${row.subject} to lane`}
            defaultValue=""
            className="shrink-0 rounded-[5px] border border-line-strong bg-surface px-1 py-[2px] text-[11px] text-ink-2 transition-colors hover:border-ink-3"
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
