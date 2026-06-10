// tests/app/view-model-setaside.test.ts
import { describe, it, expect } from 'vitest';
import { buildTriageView, type SetAsideEntry } from '../../src/app/view-model';
import type { Summary } from '../../src/summary/summary';

const summary: Summary = { needsTodayCount: 0, thisWeekCount: 0, fyiCount: 0, slaAtRiskCount: 0, resolvedWhileAwayCount: 0 };

describe('buildTriageView set-aside', () => {
  it('maps set-aside entries newest-first with their reason and counts them', () => {
    const setAside: SetAsideEntry[] = [
      { item: { id: 'a', source: 'email_vendor', subject: 'Newsletter', from: 'news@v.com', receivedAt: '2026-05-28T10:00:00.000Z' }, reason: 'automated' },
      { item: { id: 'b', source: 'email_internal', subject: 'Random', from: 'x@y.com', receivedAt: '2026-05-30T10:00:00.000Z' }, reason: 'unmatched' },
    ];
    const view = buildTriageView([], summary, { me: 'me@co.com', awaySince: '2026-05-25T00:00:00.000Z' }, setAside);
    expect(view.setAside.total).toBe(2);
    expect(view.setAside.items.map((i) => i.id)).toEqual(['b', 'a']); // newest first
    expect(view.setAside.items[0].reason).toBe('unmatched');
  });

  it('defaults set-aside to empty when the argument is omitted', () => {
    const view = buildTriageView([], summary, { me: 'me@co.com', awaySince: '2026-05-25T00:00:00.000Z' });
    expect(view.setAside).toEqual({ total: 0, items: [] });
  });
});
