// tests/model/item.test.ts
import { describe, it, expect } from 'vitest';
import type { DaybreakItem, ScoringContext, ScoredItem } from '../../src/model/item';

describe('data model', () => {
  it('constructs a minimal JSM item and a scored item', () => {
    const item: DaybreakItem = {
      id: 'JSM-1',
      source: 'jsm',
      subject: 'Server down',
      from: 'jira@company.com',
      receivedAt: '2026-05-30T09:00:00.000Z',
      jsm: { assignee: 'me@company.com', priority: 'P1', slaStatus: 'at_risk', state: 'open' },
    };
    const ctx: ScoringContext = {
      me: 'me@company.com',
      awaySince: '2026-05-25T00:00:00.000Z',
      now: '2026-06-08T08:00:00.000Z',
    };
    const scored: ScoredItem = {
      item,
      lane: 'today',
      rank: 95,
      reasons: ['assigned to you'],
      resolved: false,
    };
    expect(scored.item.id).toBe('JSM-1');
    expect(ctx.me).toBe('me@company.com');
    expect(scored.lane).toBe('today');
  });
});
