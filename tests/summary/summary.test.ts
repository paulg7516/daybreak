// tests/summary/summary.test.ts
import { describe, it, expect } from 'vitest';
import { buildSummary } from '../../src/summary/summary';
import type { OverlaidItem } from '../../src/app/overlay';
import type { Lane, Urgency } from '../../src/model/item';

function o(lane: Lane, urgency: Urgency): OverlaidItem {
  return {
    triaged: { item: { id: `${lane}-${urgency}-${Math.round(0)}`, source: 'email_internal', subject: 's', from: 'a@co.com', receivedAt: '2026-06-10T10:00:00Z' }, lane, urgency, reasons: [] },
    lane,
    reranked: false,
  };
}

describe('buildSummary', () => {
  it('counts per lane, total, need-you and overdue', () => {
    const items = [
      o('input', 'overdue'),
      o('input', 'none'),
      o('decision', 'today'),
      o('input', 'none'),
      o('fyi', 'none'),
      o('fyi', 'overdue'),
    ];
    const s = buildSummary(items);
    expect(s.total).toBe(6);
    expect(s.byLane).toEqual({ decision: 1, input: 3, fyi: 2 });
    expect(s.needYou).toBe(4); // decision(1) + input(3)
    expect(s.overdue).toBe(2);
  });
});
