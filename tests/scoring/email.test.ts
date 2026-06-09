// tests/scoring/email.test.ts
import { describe, it, expect } from 'vitest';
import { scoreEmail } from '../../src/scoring/email';
import type { DaybreakItem, ScoringContext } from '../../src/model/item';

const ctx: ScoringContext = {
  me: 'me@company.com',
  managers: ['boss@company.com'],
  reports: ['report@company.com'],
  frequentContacts: ['peer@company.com'],
  awaySince: '2026-05-25T00:00:00.000Z',
  now: '2026-06-08T08:00:00.000Z',
};

function email(over: Partial<DaybreakItem>): DaybreakItem {
  return {
    id: 'e1', source: 'email_internal', subject: 's', from: 'peer@company.com',
    receivedAt: '2026-05-30T10:00:00.000Z', toRecipients: ['me@company.com'], ...over,
  };
}

describe('scoreEmail', () => {
  it('sole direct recipient with a direct ask from manager -> today', () => {
    const s = scoreEmail(email({
      from: 'boss@company.com',
      toRecipients: ['me@company.com'],
      bodyText: 'Can you review this and sign off?',
    }), ctx);
    expect(s.lane).toBe('today');
    expect(s.reasons).toContain('addressed only to you');
    expect(s.reasons).toContain('from your manager');
    expect(s.reasons).toContain('contains a direct request');
  });

  it('cc-only newsletter-style mail -> fyi', () => {
    const s = scoreEmail(email({
      from: 'list@company.com',
      toRecipients: ['team@company.com'],
      ccRecipients: ['me@company.com'],
      bodyText: 'Monthly update for your awareness.',
    }), ctx);
    expect(s.lane).toBe('fyi');
    expect(s.reasons).toContain("you are only cc'd");
  });

  it('plain on-To note with no ask -> this_week', () => {
    const s = scoreEmail(email({
      from: 'peer@company.com',
      toRecipients: ['me@company.com', 'other@company.com'],
      bodyText: 'Sharing notes from the sync.',
    }), ctx);
    expect(s.lane).toBe('this_week');
  });

  it('does not trigger ask-phrase when word is only a substring (preview/reviewer)', () => {
    // "preview" contains "review" and "reviewer" contains "review" - neither is a whole word match
    const s = scoreEmail(email({
      from: 'peer@company.com',
      toRecipients: ['me@company.com'],
      bodyText: 'here is a preview of the reviewer feedback',
    }), ctx);
    expect(s.reasons).not.toContain('contains a direct request');
  });
});
