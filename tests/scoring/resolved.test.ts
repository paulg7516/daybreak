// tests/scoring/resolved.test.ts
import { describe, it, expect } from 'vitest';
import { isResolvedWhileAway } from '../../src/scoring/resolved';
import type { DaybreakItem, ScoringContext } from '../../src/model/item';

const ctx: ScoringContext = {
  me: 'me@company.com',
  awaySince: '2026-05-25T00:00:00.000Z',
  now: '2026-06-08T08:00:00.000Z',
};

function withThread(messages: DaybreakItem['threadMessages']): DaybreakItem {
  return {
    id: 'e1', source: 'email_internal', subject: 's', from: 'peer@company.com',
    receivedAt: '2026-05-24T10:00:00.000Z', threadMessages: messages,
  };
}

describe('isResolvedWhileAway', () => {
  it('false when no thread messages', () => {
    expect(isResolvedWhileAway(withThread([]), ctx)).toBe(false);
    expect(isResolvedWhileAway(withThread(undefined), ctx)).toBe(false);
  });

  it('true when a later message says it is resolved', () => {
    const item = withThread([
      { from: 'peer@company.com', sentAt: '2026-05-28T09:00:00.000Z', bodyText: 'nvm, sorted it myself, thanks!' },
    ]);
    expect(isResolvedWhileAway(item, ctx)).toBe(true);
  });

  it('ignores resolution language from before the away window', () => {
    const item = withThread([
      { from: 'peer@company.com', sentAt: '2026-05-20T09:00:00.000Z', bodyText: 'all set now' },
    ]);
    expect(isResolvedWhileAway(item, ctx)).toBe(false);
  });

  it('false for an ordinary later reply with no resolution language', () => {
    const item = withThread([
      { from: 'peer@company.com', sentAt: '2026-05-28T09:00:00.000Z', bodyText: 'any update on this?' },
    ]);
    expect(isResolvedWhileAway(item, ctx)).toBe(false);
  });

  it('does not match "resolved" inside "unresolved"', () => {
    const item = withThread([
      { from: 'peer@company.com', sentAt: '2026-05-28T09:00:00.000Z', bodyText: 'this is still unresolved and a disaster' },
    ]);
    expect(isResolvedWhileAway(item, ctx)).toBe(false);
  });
});
