// tests/summary/summary.test.ts
import { describe, it, expect } from 'vitest';
import { buildSummary } from '../../src/summary/summary';
import type { ScoredItem } from '../../src/model/item';

function scored(over: Partial<ScoredItem>): ScoredItem {
  return {
    item: { id: 'x', source: 'email_internal', subject: 's', from: 'a@b.com', receivedAt: '2026-05-30T10:00:00.000Z' },
    lane: 'this_week', rank: 30, reasons: [], resolved: false, ...over,
  };
}

describe('buildSummary', () => {
  it('counts items per lane, SLA risk, and resolved-while-away', () => {
    const items: ScoredItem[] = [
      scored({ lane: 'today' }),
      scored({ lane: 'today', item: { id: 'j', source: 'jsm', subject: 's', from: 'jira', receivedAt: '2026-05-30T10:00:00.000Z', jsm: { slaStatus: 'at_risk' } } }),
      scored({ lane: 'this_week' }),
      scored({ lane: 'fyi', resolved: true }),
    ];
    const s = buildSummary(items);
    expect(s.needsTodayCount).toBe(2);
    expect(s.thisWeekCount).toBe(1);
    expect(s.fyiCount).toBe(1);
    expect(s.slaAtRiskCount).toBe(1);
    expect(s.resolvedWhileAwayCount).toBe(1);
  });
});
