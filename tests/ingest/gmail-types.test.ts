// tests/ingest/gmail-types.test.ts
import { describe, it, expect } from 'vitest';
import type { GmailMessage } from '../../src/ingest/gmail-types';

describe('GmailMessage type', () => {
  it('models the Gmail message fields we consume', () => {
    const msg: GmailMessage = {
      id: '18f-1',
      threadId: 'thread-1',
      labelIds: ['INBOX', 'UNREAD'],
      snippet: 'Can you approve by EOD?',
      internalDate: '1780131600000',
      payload: { headers: [{ name: 'X-PTO-Triage', value: 'action;by=2026-06-08' }] },
    };
    expect(msg.payload?.headers?.[0].name).toBe('X-PTO-Triage');
    expect(msg.labelIds).toContain('UNREAD');
  });
});
