// tests/model/item-ingest-fields.test.ts
import { describe, it, expect } from 'vitest';
import type { DaybreakItem } from '../../src/model/item';

describe('DaybreakItem ingestion fields', () => {
  it('accepts webLink, threadId, and isRead', () => {
    const item: DaybreakItem = {
      id: 'm1',
      source: 'email_internal',
      subject: 'hi',
      from: 'a@company.com',
      receivedAt: '2026-05-30T10:00:00.000Z',
      webLink: 'https://outlook.office365.com/owa/?ItemID=abc',
      threadId: 'conv-123',
      isRead: false,
    };
    expect(item.webLink).toContain('outlook');
    expect(item.threadId).toBe('conv-123');
    expect(item.isRead).toBe(false);
  });
});
