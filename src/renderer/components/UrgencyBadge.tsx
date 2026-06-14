// src/renderer/components/UrgencyBadge.tsx
import type { Urgency } from '../../model/item';

const META: Record<Exclude<Urgency, 'none'>, { label: string; cls: string }> = {
  overdue: { label: 'Overdue', cls: 'bg-today-tint text-today' },
  today: { label: 'Today', cls: 'bg-week-tint text-week' },
  this_week: { label: 'This week', cls: 'bg-fyi-tint text-ink-2' },
};

// A small urgency pill shown on a row. Urgency is derived from a declared deadline
// (or JSM SLA); 'none' renders nothing so undated items stay quiet.
export function UrgencyBadge({ urgency }: { urgency: Urgency }) {
  if (urgency === 'none') return null;
  const m = META[urgency];
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${m.cls}`}>
      <span className="h-1 w-1 rounded-full bg-current" aria-hidden="true" />
      {m.label}
    </span>
  );
}
