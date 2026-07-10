// src/renderer/components/laneMeta.tsx
import { Reply, Stamp, Inbox } from 'lucide-react';
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
  decision: {
    title: 'Needs your decision',
    desc: 'Approvals and sign-offs waiting on you',
    rail: 'bg-week',
    icon: <Stamp size={14} strokeWidth={2} className="text-week" />,
  },
  input: {
    title: 'Needs your input',
    desc: 'Questions and feedback waiting on you',
    rail: 'bg-today',
    icon: <Reply size={14} strokeWidth={2} className="text-today" />,
  },
  fyi: {
    title: 'FYI',
    desc: 'No action needed, just so you know',
    rail: 'bg-fyi',
    icon: <Inbox size={14} strokeWidth={2} className="text-fyi" />,
  },
};
