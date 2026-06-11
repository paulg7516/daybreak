// tests/ingest/gmail-client.test.ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { buildListUrl, buildGetUrl, fetchMessagesSince } from '../../src/ingest/gmail-client';

describe('buildListUrl', () => {
  it('queries messages after the since date in epoch seconds, excluding chats', () => {
    const url = buildListUrl('2026-05-25T00:00:00Z');
    expect(url).toContain('https://gmail.googleapis.com/gmail/v1/users/me/messages');
    const q = decodeURIComponent(url);
    expect(q).toContain('after:1779667200'); // 2026-05-25T00:00:00Z in epoch seconds
    expect(q).toContain('-in:chats');
  });

  it('includes a pageToken when provided', () => {
    expect(buildListUrl('2026-05-25T00:00:00Z', 'TOKEN_ABC')).toContain('pageToken=TOKEN_ABC');
  });
});

describe('buildGetUrl', () => {
  it('requests metadata format with the headers Daybreak needs', () => {
    const url = buildGetUrl('m1');
    expect(url).toContain('/messages/m1');
    expect(url).toContain('format=metadata');
    const decoded = decodeURIComponent(url);
    expect(decoded).toContain('metadataHeaders=From');
    expect(decoded).toContain('metadataHeaders=X-PTO-Triage');
  });
});

describe('fetchMessagesSince', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('pages the list then fetches each message, preserving order and sending the token', async () => {
    const seenAuth: string[] = [];
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      seenAuth.push((init?.headers as Record<string, string>).Authorization);
      if (url.includes('/messages?')) {
        const body = url.includes('pageToken=tok')
          ? { messages: [{ id: 'm3' }] }
          : { messages: [{ id: 'm1' }, { id: 'm2' }], nextPageToken: 'tok' };
        return { ok: true, json: async () => body } as Response;
      }
      const id = url.split('/messages/')[1].split('?')[0];
      return { ok: true, json: async () => ({ id, snippet: `body ${id}` }) } as Response;
    });
    vi.stubGlobal('fetch', fetchMock);

    const msgs = await fetchMessagesSince('TOKEN123', '2026-05-25T00:00:00Z');
    expect(msgs.map((m) => m.id)).toEqual(['m1', 'm2', 'm3']);
    expect(seenAuth.every((a) => a === 'Bearer TOKEN123')).toBe(true);
  });

  it('caps the total number of messages fetched', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('/messages?')) {
        return { ok: true, json: async () => ({ messages: [{ id: 'a' }, { id: 'b' }, { id: 'c' }] }) } as Response;
      }
      const id = url.split('/messages/')[1].split('?')[0];
      return { ok: true, json: async () => ({ id }) } as Response;
    });
    vi.stubGlobal('fetch', fetchMock);

    const msgs = await fetchMessagesSince('T', '2026-05-25T00:00:00Z', 2);
    expect(msgs).toHaveLength(2);
  });

  it('throws on a non-OK response', async () => {
    const fetchMock = vi.fn(async () => ({ ok: false, status: 401, text: async () => 'Unauthorized' } as Response));
    vi.stubGlobal('fetch', fetchMock);
    await expect(fetchMessagesSince('T', '2026-05-25T00:00:00Z')).rejects.toThrow('Gmail 401');
  });
});
