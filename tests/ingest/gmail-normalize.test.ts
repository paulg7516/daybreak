// tests/ingest/gmail-normalize.test.ts
import { describe, it, expect } from 'vitest';
import { gmailMessageToItem } from '../../src/ingest/gmail-normalize';
import type { GmailMessage } from '../../src/ingest/gmail-types';

const internal = ['company.com'];

describe('gmailMessageToItem', () => {
  const msg: GmailMessage = {
    id: '18f-1',
    threadId: 'thread-1',
    labelIds: ['INBOX', 'UNREAD'],
    snippet: 'Can you approve by EOD?',
    internalDate: '1780131600000', // 2026-05-30T09:00:00Z
    payload: {
      headers: [
        { name: 'From', value: 'The Boss <boss@company.com>' },
        { name: 'To', value: 'Me <me@company.com>' },
        { name: 'Cc', value: 'peer@company.com, Other <other@company.com>' },
        { name: 'Subject', value: 'Budget sign-off' },
        { name: 'Date', value: 'Sat, 30 May 2026 09:00:00 +0000' },
        { name: 'X-PTO-Triage', value: 'action;by=2026-06-08' },
      ],
    },
  };

  it('maps headers and message fields onto a DaybreakItem', () => {
    const item = gmailMessageToItem(msg, internal);
    expect(item.id).toBe('18f-1');
    expect(item.source).toBe('email_internal');
    expect(item.subject).toBe('Budget sign-off');
    expect(item.from).toBe('boss@company.com');
    expect(item.receivedAt).toBe('2026-05-30T09:00:00.000Z');
    expect(item.toRecipients).toEqual(['me@company.com']);
    expect(item.ccRecipients).toEqual(['peer@company.com', 'other@company.com']);
    expect(item.bodyText).toBe('Can you approve by EOD?');
    expect(item.threadId).toBe('thread-1');
    expect(item.webLink).toBe('https://mail.google.com/mail/u/0/#inbox/18f-1');
    expect(item.isRead).toBe(false); // UNREAD label present
  });

  it('preserves X-PTO-Triage so sender-tag scoring still works', () => {
    const item = gmailMessageToItem(msg, internal);
    const key = Object.keys(item.internetHeaders ?? {}).find((k) => k.toLowerCase() === 'x-pto-triage');
    expect(key).toBeDefined();
    expect(item.internetHeaders![key!]).toBe('action;by=2026-06-08');
  });

  it('marks a message read when there is no UNREAD label', () => {
    const read: GmailMessage = { ...msg, labelIds: ['INBOX'] };
    expect(gmailMessageToItem(read, internal).isRead).toBe(true);
  });

  it('classifies an external sender as vendor', () => {
    const ext: GmailMessage = {
      ...msg,
      payload: { headers: [{ name: 'From', value: 'noreply@vendor.com' }] },
    };
    expect(gmailMessageToItem(ext, internal).source).toBe('email_vendor');
  });

  it('tolerates a message with no headers or fields', () => {
    const bare: GmailMessage = { id: 'x' };
    const item = gmailMessageToItem(bare, internal);
    expect(item.from).toBe('');
    expect(item.subject).toBe('');
    expect(item.toRecipients).toEqual([]);
    expect(item.ccRecipients).toEqual([]);
    expect(item.bodyText).toBe('');
    expect(item.source).toBe('email_vendor');
  });

  it('falls back to internalDate when the Date header is missing', () => {
    const noDate: GmailMessage = {
      id: 'y',
      internalDate: '1780131600000',
      payload: { headers: [{ name: 'From', value: 'boss@company.com' }] },
    };
    expect(gmailMessageToItem(noDate, internal).receivedAt).toBe('2026-05-30T09:00:00.000Z');
  });
});
