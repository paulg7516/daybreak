// tests/scoring/triage.test.ts
import { describe, it, expect } from 'vitest';
import { triageItem, triageAll } from '../../src/scoring/triage';
import type { DaybreakItem, TriageContext } from '../../src/model/item';

const ctx: TriageContext = { me: 'me@co.com', since: '2026-06-01T00:00:00Z', now: '2026-06-11T12:00:00Z' };

function email(id: string, tag: string | undefined, extra: Partial<DaybreakItem> = {}): DaybreakItem {
  return {
    id,
    source: 'email_internal',
    subject: `subject ${id}`,
    from: 'sender@co.com',
    receivedAt: '2026-06-10T09:00:00Z',
    internetHeaders: tag ? { 'X-PTO-Triage': tag } : undefined,
    ...extra,
  };
}

describe('triageItem - email', () => {
  it('routes each declared intent to its lane', () => {
    expect(triageItem(email('a', 'respond'), ctx)?.lane).toBe('respond');
    expect(triageItem(email('b', 'approve'), ctx)?.lane).toBe('approve');
    expect(triageItem(email('c', 'review'), ctx)?.lane).toBe('review');
    expect(triageItem(email('d', 'fyi'), ctx)?.lane).toBe('fyi');
  });

  it('drops untagged email (returns null)', () => {
    expect(triageItem(email('e', undefined), ctx)).toBeNull();
  });

  it('derives urgency and deadline from the declared by= date', () => {
    const t = triageItem(email('f', 'approve;by=2026-06-12'), ctx);
    expect(t?.lane).toBe('approve');
    expect(t?.deadline).toBe('2026-06-12');
    expect(t?.urgency).toBe('this_week');
  });

  it('has urgency none when no deadline is declared', () => {
    expect(triageItem(email('g', 'respond'), ctx)?.urgency).toBe('none');
  });
});

describe('triageItem - JSM', () => {
  function ticket(id: string, jsm: DaybreakItem['jsm']): DaybreakItem {
    return { id, source: 'jsm', subject: id, from: 'jira@co.com', receivedAt: '2026-06-10T09:00:00Z', jsm };
  }

  it('routes an open assigned ticket to respond', () => {
    const t = triageItem(ticket('t1', { assignee: 'me@co.com', state: 'open', priority: 'P2' }), ctx);
    expect(t?.lane).toBe('respond');
  });

  it('maps SLA to urgency', () => {
    expect(triageItem(ticket('t2', { assignee: 'me@co.com', state: 'open', slaStatus: 'breached' }), ctx)?.urgency).toBe('overdue');
    expect(triageItem(ticket('t3', { assignee: 'me@co.com', state: 'open', slaStatus: 'at_risk' }), ctx)?.urgency).toBe('today');
  });

  it('drops closed tickets and tickets not assigned to me', () => {
    expect(triageItem(ticket('t4', { assignee: 'me@co.com', state: 'closed' }), ctx)).toBeNull();
    expect(triageItem(ticket('t5', { assignee: 'someone@co.com', state: 'open' }), ctx)).toBeNull();
  });
});

describe('triageAll', () => {
  it('drops nulls and sorts by lane then urgency', () => {
    const items = [
      email('fyi1', 'fyi'),
      email('untagged', undefined),
      email('respond-soon', 'respond;by=2026-06-11'), // today
      email('respond-none', 'respond'),               // none
      email('approve1', 'approve'),
    ];
    const out = triageAll(items, ctx);
    expect(out.map((t) => t.item.id)).toEqual(['respond-soon', 'respond-none', 'approve1', 'fyi1']);
  });
});
