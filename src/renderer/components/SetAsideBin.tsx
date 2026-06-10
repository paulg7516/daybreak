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
    <section className="mt-4 rounded-lg border border-slate-200 dark:border-slate-700">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-2 text-sm text-slate-500"
      >
        <span>Set aside</span>
        <span className="tabular-nums">{view.total}</span>
      </button>
      {open && view.items.map((row: SetAsideItemView) => (
        <div key={row.id} className="flex items-center gap-3 px-4 py-2 border-t border-slate-100 dark:border-slate-800 text-sm">
          <span className="min-w-0 flex-1 truncate">{row.subject} <span className="text-slate-400">{row.from}</span></span>
          <span className="shrink-0 rounded px-1.5 py-0.5 text-xs bg-slate-100 dark:bg-slate-800">{REASON_LABEL[row.reason]}</span>
          <select
            aria-label={`Move ${row.subject} to lane`}
            defaultValue=""
            className="shrink-0 rounded border border-slate-200 dark:border-slate-700 bg-transparent px-1 py-1 text-xs"
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
