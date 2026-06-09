// tests/scoring/score.test.ts
import { describe, it, expect } from 'vitest';
import { scoreItem, scoreAll } from '../../src/scoring/score';
import type { ReentryItem, ScoringContext } from '../../src/model/item';

const ctx: ScoringContext = {
  me: 'me@company.com',
  managers: ['boss@company.com'],
  awaySince: '2026-05-25T00:00:00.000Z',
  now: '2026-06-08T08:00:00.000Z', // Monday
};

describe('scoreItem', () => {
  it('a "blocked" sender tag lands today', () => {
    const item: ReentryItem = {
      id: 'e1', source: 'email_internal', subject: 'help', from: 'peer@company.com',
      receivedAt: '2026-05-30T10:00:00.000Z', toRecipients: ['me@company.com'],
      bodyText: 'whenever', internetHeaders: { 'X-PTO-Triage': 'blocked' },
    };
    const s = scoreItem(item, ctx);
    expect(s.lane).toBe('today');
    expect(s.reasons).toContain('sender is blocked, waiting on you');
  });

  it('resolved-while-away overrides a blocked tag to fyi', () => {
    const item: ReentryItem = {
      id: 'e2', source: 'email_internal', subject: 'help', from: 'peer@company.com',
      receivedAt: '2026-05-30T10:00:00.000Z', toRecipients: ['me@company.com'],
      internetHeaders: { 'X-PTO-Triage': 'blocked' },
      threadMessages: [{ from: 'peer@company.com', sentAt: '2026-05-31T10:00:00.000Z', bodyText: 'nvm, resolved' }],
    };
    const s = scoreItem(item, ctx);
    expect(s.lane).toBe('fyi');
    expect(s.resolved).toBe(true);
    expect(s.reasons).toContain('resolved while you were out');
  });

  it('a body deadline of today promotes an otherwise-weekly email to today', () => {
    const item: ReentryItem = {
      id: 'e3', source: 'email_internal', subject: 'note', from: 'peer@company.com',
      receivedAt: '2026-05-30T10:00:00.000Z', toRecipients: ['me@company.com', 'x@company.com'],
      bodyText: 'sharing the meeting notes; the figures are due by EOD',
    };
    const s = scoreItem(item, ctx);
    expect(s.lane).toBe('today');
    expect(s.reasons.some((r) => r.startsWith('deadline'))).toBe(true);
  });

  it('JSM P1 assigned to me lands today', () => {
    const item: ReentryItem = {
      id: 'J1', source: 'jsm', subject: 'down', from: 'jira@company.com',
      receivedAt: '2026-05-30T10:00:00.000Z',
      jsm: { assignee: 'me@company.com', priority: 'P1', slaStatus: 'ok', state: 'open' },
    };
    expect(scoreItem(item, ctx).lane).toBe('today');
  });
});

describe('scoreAll', () => {
  it('sorts today items before this_week before fyi', () => {
    const items: ReentryItem[] = [
      { id: 'fyi', source: 'email_vendor', subject: 'newsletter', from: 'n@v.com', receivedAt: '2026-05-30T10:00:00.000Z', bodyText: 'news' },
      { id: 'today', source: 'jsm', subject: 'down', from: 'jira@company.com', receivedAt: '2026-05-30T10:00:00.000Z', jsm: { assignee: 'me@company.com', priority: 'P1', state: 'open' } },
    ];
    const out = scoreAll(items, ctx);
    expect(out[0].item.id).toBe('today');
    expect(out[1].item.id).toBe('fyi');
  });
});
