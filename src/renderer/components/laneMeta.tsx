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

// Shared per-lane styling (title, rail colour, icon) so the stacked and column
// layouts render lanes identically.
export const LANE_META: Record<Lane, { title: string; rail: string; icon: React.ReactNode }> = {
  respond: { title: 'Respond', rail: 'bg-today', icon: <Reply size={14} strokeWidth={2} className="text-today" /> },
  approve: { title: 'Approve / Decide', rail: 'bg-week', icon: <Stamp size={14} strokeWidth={2} className="text-week" /> },
  review: { title: 'Review', rail: 'bg-accent', icon: <Eye size={14} strokeWidth={2} className="text-accent" /> },
  fyi: { title: 'FYI', rail: 'bg-fyi', icon: <Inbox size={14} strokeWidth={2} className="text-fyi" /> },
};
