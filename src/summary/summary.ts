// src/summary/summary.ts
import type { Lane } from '../model/item';
import type { OverlaidItem } from '../app/overlay';

// Counts behind the one-line board headline ("8 need you - 2 overdue"). Computed
// after the overlay (cleared removed, re-ranks applied) so it matches the lanes.
export interface Summary {
  total: number;
  needYou: number; // respond + approve (the lanes that ask something of you)
  overdue: number;
  byLane: Record<Lane, number>;
}

export function buildSummary(items: OverlaidItem[]): Summary {
  const byLane: Record<Lane, number> = { respond: 0, approve: 0, review: 0, fyi: 0 };
  let overdue = 0;
  for (const o of items) {
    byLane[o.lane] += 1;
    if (o.triaged.urgency === 'overdue') overdue += 1;
  }
  return {
    total: items.length,
    needYou: byLane.respond + byLane.approve,
    overdue,
    byLane,
  };
}
