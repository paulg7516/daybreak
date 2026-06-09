// tests/ingest/graph-client.test.ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { buildMessagesUrl, fetchMessagesSince } from '../../src/ingest/graph-client';
import type { GraphMessagePage } from '../../src/ingest/graph-types';

describe('buildMessagesUrl', () => {
  it('selects the needed fields and filters by receivedDateTime', () => {
    const url = buildMessagesUrl('2026-05-25T00:00:00Z');
    expect(url).toContain('https://graph.microsoft.com/v1.0/me/messages');
    expect(url).toContain('internetMessageHeaders');
    expect(url).toContain('conversationId');
    expect(decodeURIComponent(url)).toContain('receivedDateTime ge 2026-05-25T00:00:00Z');
    expect(decodeURIComponent(url)).toContain('$orderby=receivedDateTime desc');
  });
});

describe('fetchMessagesSince', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('follows nextLink paging and sends the bearer token', async () => {
    const page1: GraphMessagePage = {
      value: [{ id: 'm1', receivedDateTime: '2026-05-30T09:00:00Z' }],
      '@odata.nextLink': 'https://graph.microsoft.com/next',
    };
    const page2: GraphMessagePage = {
      value: [{ id: 'm2', receivedDateTime: '2026-05-29T09:00:00Z' }],
    };
    const seenAuth: string[] = [];
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      seenAuth.push((init?.headers as Record<string, string>).Authorization);
      const body = fetchMock.mock.calls.length === 1 ? page1 : page2;
      return { ok: true, json: async () => body } as Response;
    });
    vi.stubGlobal('fetch', fetchMock);

    const msgs = await fetchMessagesSince('TOKEN123', '2026-05-25T00:00:00Z');
    expect(msgs.map((m) => m.id)).toEqual(['m1', 'm2']);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(seenAuth.every((a) => a === 'Bearer TOKEN123')).toBe(true);
  });

  it('throws on a non-OK response', async () => {
    const fetchMock = vi.fn(async () => ({ ok: false, status: 403, text: async () => 'Forbidden' } as Response));
    vi.stubGlobal('fetch', fetchMock);
    await expect(fetchMessagesSince('T', '2026-05-25T00:00:00Z')).rejects.toThrow('Graph 403');
  });
});
