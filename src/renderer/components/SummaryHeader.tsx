// src/renderer/components/SummaryHeader.tsx
import type { Summary } from '../../summary/summary';

function sinceLabel(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'long', day: 'numeric' });
}

interface StatChipProps {
  count: number;
  label: string;
  dotClass: string;
  countClass: string;
}

function StatChip({ count, label, dotClass, countClass }: StatChipProps) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-line bg-panel px-4 py-3 shadow-sm">
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dotClass}`} aria-hidden="true" />
      <div className="flex flex-col">
        <span className={`font-mono text-2xl font-bold leading-none tabular-nums ${countClass}`}>{count}</span>
        <span className="mt-0.5 text-[11px] text-ink-3 leading-tight">{label}</span>
      </div>
    </div>
  );
}

export function SummaryHeader({ summary, awaySince }: { summary: Summary; awaySince: string }) {
  return (
    <header className="px-0 pt-4 pb-3">
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-[.04em] text-ink-3">
        While you were out since {sinceLabel(awaySince)}
      </p>
      <div className="flex flex-wrap gap-3">
        <StatChip
          count={summary.needsTodayCount}
          label="need you today"
          dotClass="bg-today"
          countClass="text-today"
        />
        <StatChip
          count={summary.slaAtRiskCount}
          label="SLAs at risk"
          dotClass="bg-week"
          countClass="text-week"
        />
        <StatChip
          count={summary.thisWeekCount}
          label="this week"
          dotClass="bg-accent"
          countClass="text-ink"
        />
        <StatChip
          count={summary.resolvedWhileAwayCount}
          label="resolved while you were out"
          dotClass="bg-good"
          countClass="text-good"
        />
      </div>
    </header>
  );
}
