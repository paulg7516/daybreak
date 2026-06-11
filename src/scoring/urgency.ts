// src/scoring/urgency.ts
import type { Urgency } from '../model/item';

const DAY = 24 * 60 * 60 * 1000;

function startOfDay(d: Date): number {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c.getTime();
}

// Derive an urgency badge from a declared deadline (ISO date) relative to now,
// compared by calendar day: past -> overdue, today -> today, within a week ->
// this_week, otherwise none. No deadline -> none.
export function urgencyFor(deadline: string | undefined, now: Date): Urgency {
  if (!deadline) return 'none';
  const due = new Date(`${deadline}T00:00:00`);
  if (Number.isNaN(due.getTime())) return 'none';

  const diffDays = Math.round((startOfDay(due) - startOfDay(now)) / DAY);
  if (diffDays < 0) return 'overdue';
  if (diffDays === 0) return 'today';
  if (diffDays <= 7) return 'this_week';
  return 'none';
}
