// tests/ingest/graph-types.test.ts
import { describe, it, expect } from 'vitest';
import type { GraphMessage } from '../../src/ingest/graph-types';

describe('GraphMessage type', () => {
  it('models the Graph message fields we consume', () => {
    const msg: GraphMessage = {
      id: 'AAMk-1',
      subject: 'Budget sign-off',
      from: { emailAddress: { address: 'boss@company.com', name: 'The Boss' } },
      toRecipients: [{ emailAddress: { address: 'me@company.com' } }],
      ccRecipients: [],
      bodyPreview: 'Can you approve by EOD?',
      conversationId: 'conv-1',
      webLink: 'https://outlook.office365.com/owa/?ItemID=AAMk-1',
      isRead: false,
      receivedDateTime: '2026-05-30T09:00:00Z',
      internetMessageHeaders: [{ name: 'X-PTO-Triage', value: 'action;by=2026-06-08' }],
    };
    expect(msg.from?.emailAddress.address).toBe('boss@company.com');
    expect(msg.internetMessageHeaders?.[0].name).toBe('X-PTO-Triage');
  });
});
