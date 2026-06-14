// tests/model/item.test.ts
import { describe, it, expect } from 'vitest';
import { LANE_ORDER, type DaybreakItem, type TriageContext, type TriagedItem } from '../../src/model/item';

describe('data model', () => {
  it('constructs a JSM item and a triaged item', () => {
    const item: DaybreakItem = {
      id: 'JSM-1',
      source: 'jsm',
      subject: 'Server down',
      from: 'jira@company.com',
      receivedAt: '2026-05-30T09:00:00.000Z',
      jsm: { assignee: 'me@company.com', priority: 'P1', slaStatus: 'at_risk', state: 'open' },
    };
    const ctx: TriageContext = {
      me: 'me@company.com',
      since: '2026-05-25T00:00:00.000Z',
      now: '2026-06-08T08:00:00.000Z',
    };
    const triaged: TriagedItem = { item, lane: 'respond', urgency: 'today', reasons: ['assigned ticket'] };
    expect(triaged.item.id).toBe('JSM-1');
    expect(ctx.me).toBe('me@company.com');
    expect(triaged.lane).toBe('respond');
  });

  it('lists lanes most-actionable first', () => {
    expect(LANE_ORDER).toEqual(['respond', 'approve', 'review', 'fyi']);
  });
});
