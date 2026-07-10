// src/summary/summary.ts
import type { Lane } from '../model/item';
import type { OverlaidItem } from '../app/overlay';

// Counts behind the one-line board headline ("8 need you - 2 overdue"). Computed
// after the overlay (cleared removed, re-ranks applied) so it matches the lanes.
export interface Summary {
  total: number;
  needYou: number; // decision + input (the lanes that ask something of you)
  overdue: number;
  byLane: Record<Lane, number>;
}

export function buildSummary(items: OverlaidItem[]): Summary {
  const byLane: Record<Lane, number> = { decision: 0, input: 0, fyi: 0 };
  let overdue = 0;
  for (const o of items) {
    byLane[o.lane] += 1;
    if (o.triaged.urgency === 'overdue') overdue += 1;
  }
  return {
    total: items.length,
    needYou: byLane.decision + byLane.input,
    overdue,
    byLane,
  };
}
