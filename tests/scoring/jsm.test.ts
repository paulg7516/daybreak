// tests/scoring/jsm.test.ts
import { describe, it, expect } from 'vitest';
import { scoreJsm } from '../../src/scoring/jsm';

const me = 'me@company.com';

describe('scoreJsm', () => {
  it('assigned to me + P1 -> today', () => {
    const s = scoreJsm({ assignee: me, priority: 'P1', slaStatus: 'ok', state: 'open' }, me);
    expect(s.lane).toBe('today');
    expect(s.reasons).toContain('priority P1');
  });

  it('assigned to me + SLA at risk -> today', () => {
    const s = scoreJsm({ assignee: me, priority: 'P3', slaStatus: 'at_risk', state: 'open' }, me);
    expect(s.lane).toBe('today');
  });

  it('assigned to me + P3, SLA ok -> this_week', () => {
    const s = scoreJsm({ assignee: me, priority: 'P3', slaStatus: 'ok', state: 'open' }, me);
    expect(s.lane).toBe('this_week');
  });

  it('not assigned to me (notified) -> fyi', () => {
    const s = scoreJsm({ assignee: 'someone@company.com', priority: 'P1', state: 'open' }, me);
    expect(s.lane).toBe('fyi');
    expect(s.reasons).toContain('you were notified (not assignee)');
  });

  it('resolved/closed -> fyi and resolved flag', () => {
    const s = scoreJsm({ assignee: me, priority: 'P1', state: 'resolved' }, me);
    expect(s.lane).toBe('fyi');
    expect(s.resolved).toBe(true);
  });
});
