// src/renderer/components/Headline.tsx
import type { Summary } from '../../summary/summary';

// One-line board headline, replacing the old four stat tiles. Leads with how much
// is asking something of you, and flags anything overdue.
export function Headline({ summary, since }: { summary: Summary; since: string }) {
  const sinceLabel = new Date(since).toLocaleDateString(undefined, { month: 'long', day: 'numeric' });

  if (summary.total === 0) {
    return (
      <header className="pt-4 pb-3">
        <p className="text-[15px] font-semibold text-ink">You&apos;re all caught up.</p>
        <p className="mt-0.5 text-[12px] text-ink-3">Nothing tagged for you since {sinceLabel}.</p>
      </header>
    );
  }

  return (
    <header className="flex flex-wrap items-baseline gap-x-2 gap-y-1 pt-4 pb-3">
      <span className="text-[15px] font-semibold text-ink">
        <span className="font-mono tabular-nums">{summary.needYou}</span> need you
      </span>
      {summary.overdue > 0 && (
        <span className="text-[15px] font-semibold text-today">
          · <span className="font-mono tabular-nums">{summary.overdue}</span> overdue
        </span>
      )}
      <span className="text-[12px] text-ink-3">· since {sinceLabel}</span>
    </header>
  );
}
