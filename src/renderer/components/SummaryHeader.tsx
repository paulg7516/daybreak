// src/renderer/components/SummaryHeader.tsx
import type { Summary } from '../../summary/summary';

function sinceLabel(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'long', day: 'numeric' });
}

export function SummaryHeader({ summary, awaySince }: { summary: Summary; awaySince: string }) {
  return (
    <header className="px-5 pt-[18px] pb-2">
      <p className="text-[11px] font-semibold uppercase tracking-[.04em] text-ink-3">
        While you were out since {sinceLabel(awaySince)}
      </p>
      <div className="mt-1.5 flex flex-wrap gap-x-[18px] gap-y-1.5 leading-tight">
        <span className="tabular-nums text-[18px] font-bold text-today">{summary.needsTodayCount} need you today</span>
        <span className="tabular-nums text-[18px] font-bold text-week">{summary.slaAtRiskCount} SLAs at risk</span>
        <span className="tabular-nums text-[18px] font-semibold text-ink">{summary.thisWeekCount} this week</span>
        <span className="tabular-nums text-[18px] font-bold text-good">{summary.resolvedWhileAwayCount} resolved while you were out</span>
      </div>
    </header>
  );
}
