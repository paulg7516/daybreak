// src/renderer/components/Headline.tsx
import type { Summary } from '../../summary/summary';

// Board headline. The populated counts lived here once, but they duplicated the lane
// counts and the "Catch up since" control, so now this only surfaces the all-caught-up
// state - a clear, global "nothing's waiting" beat that the per-lane empties don't give.
export function Headline({ summary, since }: { summary: Summary; since: string }) {
  if (summary.total > 0) return null;
  const sinceLabel = new Date(since).toLocaleDateString(undefined, { month: 'long', day: 'numeric' });
  return (
    <header className="pt-4 pb-3">
      <p className="text-[15px] font-semibold text-ink">You&apos;re all caught up.</p>
      <p className="mt-0.5 text-[12px] text-ink-3">Nothing tagged for you since {sinceLabel}.</p>
    </header>
  );
}
