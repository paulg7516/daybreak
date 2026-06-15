// src/renderer/components/laneMeta.tsx
import { Reply, Stamp, Eye, Inbox } from 'lucide-react';
import type { Lane } from '../../model/item';
import type { TriageRow } from '../../app/view-model';

// Group a lane's rows by sender, preserving first-seen order.
export function groupRowsBySender(items: TriageRow[]): { sender: string; rows: TriageRow[] }[] {
  const map = new Map<string, TriageRow[]>();
  for (const r of items) {
    const list = map.get(r.from) ?? [];
    list.push(r);
    map.set(r.from, list);
  }
  return [...map.entries()].map(([sender, rows]) => ({ sender, rows }));
}

// Shared per-lane styling so the stacked + column layouts render identically:
// title, one-line descriptor, rail colour, icon. Actions (open / done) are uniform
// across lanes - the lane is the category, not a different verb - so they live on the
// row, not here.
export const LANE_META: Record<
  Lane,
  { title: string; desc: string; rail: string; icon: React.ReactNode }
> = {
  respond: {
    title: 'Needs your reply',
    desc: 'People waiting on your answer',
    rail: 'bg-today',
    icon: <Reply size={14} strokeWidth={2} className="text-today" />,
  },
  approve: {
    title: 'Needs your decision',
    desc: 'Sign-offs and decisions for you',
    rail: 'bg-week',
    icon: <Stamp size={14} strokeWidth={2} className="text-week" />,
  },
  review: {
    title: 'Needs your review',
    desc: 'Worth a look when you can',
    rail: 'bg-accent',
    icon: <Eye size={14} strokeWidth={2} className="text-accent" />,
  },
  fyi: {
    title: 'FYI',
    desc: 'No action needed, just so you know',
    rail: 'bg-fyi',
    icon: <Inbox size={14} strokeWidth={2} className="text-fyi" />,
  },
};
