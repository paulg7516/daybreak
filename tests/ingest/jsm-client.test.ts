// tests/ingest/jsm-client.test.ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { buildJql, fetchAssignedTickets } from '../../src/ingest/jsm-client';
import type { JiraSearchResponse } from '../../src/ingest/jsm-types';

describe('buildJql', () => {
  it('scopes to the current user, not-Done, updated since the date (day precision)', () => {
    const jql = buildJql('2026-05-26T00:00:00.000Z');
    expect(jql).toContain('assignee = currentUser()');
    expect(jql).toContain('statusCategory != Done');
    expect(jql).toContain('updated >= "2026-05-26"');
    expect(jql).toContain('ORDER BY updated DESC');
  });
});

const auth = { baseUrl: 'https://co.atlassian.net', email: 'me@co.com', header: 'Basic abc' };

describe('fetchAssignedTickets', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('follows nextPageToken paging and sends the auth header', async () => {
    const page1: JiraSearchResponse = { issues: [{ key: 'A-1', fields: {} }], nextPageToken: 'tok2', isLast: false };
    const page2: JiraSearchResponse = { issues: [{ key: 'A-2', fields: {} }], isLast: true };
    const seenAuth: string[] = [];
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      seenAuth.push((init?.headers as Record<string, string>).Authorization);
      const body = fetchMock.mock.calls.length === 1 ? page1 : page2;
      return { ok: true, json: async () => body } as Response;
    });
    vi.stubGlobal('fetch', fetchMock);

    const issues = await fetchAssignedTickets(auth, '2026-05-26T00:00:00.000Z');
    expect(issues.map((i) => i.key)).toEqual(['A-1', 'A-2']);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(seenAuth.every((a) => a === 'Basic abc')).toBe(true);
  });

  it('throws on a non-OK response', async () => {
    const fetchMock = vi.fn(async () => ({ ok: false, status: 401, text: async () => 'Unauthorized' } as Response));
    vi.stubGlobal('fetch', fetchMock);
    await expect(fetchAssignedTickets(auth, '2026-05-26T00:00:00.000Z')).rejects.toThrow('Jira 401');
  });
});
