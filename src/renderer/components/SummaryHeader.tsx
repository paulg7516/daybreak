// src/renderer/components/SummaryHeader.tsx
import type { Summary } from '../../summary/summary';

function sinceLabel(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'long', day: 'numeric' });
}

export function SummaryHeader({ summary, awaySince }: { summary: Summary; awaySince: string }) {
  const parts = [
    `${summary.needsTodayCount} need you today`,
    `${summary.slaAtRiskCount} SLAs at risk`,
    `${summary.thisWeekCount} this week`,
    `${summary.resolvedWhileAwayCount} resolved while you were out`,
  ];
  return (
    <header className="px-6 py-5 border-b border-slate-200 dark:border-slate-700">
      <p className="text-sm text-slate-500 dark:text-slate-400">
        While you were out since {sinceLabel(awaySince)}
      </p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{parts.join(' · ')}</p>
    </header>
  );
}
