// tests/ingest/normalize.test.ts
import { describe, it, expect } from 'vitest';
import { classifySource, graphMessageToItem } from '../../src/ingest/normalize';
import type { GraphMessage } from '../../src/ingest/graph-types';

const internal = ['company.com'];

describe('classifySource', () => {
  it('classifies same-domain senders as internal', () => {
    expect(classifySource('boss@company.com', internal)).toBe('email_internal');
    expect(classifySource('BOSS@Company.com', internal)).toBe('email_internal');
  });
  it('classifies other domains as vendor', () => {
    expect(classifySource('noreply@vendor.com', internal)).toBe('email_vendor');
    expect(classifySource('', internal)).toBe('email_vendor');
  });
});

describe('graphMessageToItem', () => {
  const msg: GraphMessage = {
    id: 'AAMk-1',
    subject: 'Budget sign-off',
    from: { emailAddress: { address: 'boss@company.com' } },
    toRecipients: [{ emailAddress: { address: 'me@company.com' } }],
    ccRecipients: [{ emailAddress: { address: 'peer@company.com' } }],
    bodyPreview: 'Can you approve by EOD?',
    conversationId: 'conv-1',
    webLink: 'https://outlook.office365.com/owa/?ItemID=AAMk-1',
    isRead: false,
    receivedDateTime: '2026-05-30T09:00:00Z',
    internetMessageHeaders: [{ name: 'X-PTO-Triage', value: 'action;by=2026-06-08' }],
  };

  it('maps all consumed fields onto a DaybreakItem', () => {
    const item = graphMessageToItem(msg, internal);
    expect(item.id).toBe('AAMk-1');
    expect(item.source).toBe('email_internal');
    expect(item.subject).toBe('Budget sign-off');
    expect(item.from).toBe('boss@company.com');
    expect(item.receivedAt).toBe('2026-05-30T09:00:00Z');
    expect(item.toRecipients).toEqual(['me@company.com']);
    expect(item.ccRecipients).toEqual(['peer@company.com']);
    expect(item.bodyText).toBe('Can you approve by EOD?');
    expect(item.threadId).toBe('conv-1');
    expect(item.webLink).toContain('outlook');
    expect(item.isRead).toBe(false);
    expect(item.internetHeaders).toEqual({ 'X-PTO-Triage': 'action;by=2026-06-08' });
  });

  it('tolerates missing optional fields', () => {
    const bare: GraphMessage = { id: 'x', receivedDateTime: '2026-05-30T09:00:00Z' };
    const item = graphMessageToItem(bare, internal);
    expect(item.from).toBe('');
    expect(item.subject).toBe('');
    expect(item.toRecipients).toEqual([]);
    expect(item.bodyText).toBe('');
    expect(item.internetHeaders).toEqual({});
    expect(item.source).toBe('email_vendor'); // empty sender -> not internal
  });
});
