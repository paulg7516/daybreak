// src/ingest/gmail-client.ts
import type { GmailListPage, GmailMessage } from './gmail-types';

const BASE = 'https://gmail.googleapis.com/gmail/v1/users/me/messages';

// Headers Daybreak needs from each message; requested via metadataHeaders so the
// API returns only these rather than the full payload.
const METADATA_HEADERS = ['From', 'To', 'Cc', 'Subject', 'Date', 'X-PTO-Triage'];

// Build the list URL. Gmail's `after:` operator takes epoch seconds; `-in:chats`
// excludes Google Chat messages that would otherwise pollute the inbox triage.
export function buildListUrl(sinceISO: string, pageToken?: string): string {
  const epochSeconds = Math.floor(new Date(sinceISO).getTime() / 1000);
  const params = new URLSearchParams({
    q: `after:${epochSeconds} -in:chats`,
    maxResults: '100',
  });
  if (pageToken) params.set('pageToken', pageToken);
  return `${BASE}?${params.toString().replace(/\+/g, '%20')}`;
}

export function buildGetUrl(id: string): string {
  const params = new URLSearchParams({ format: 'metadata' });
  for (const h of METADATA_HEADERS) params.append('metadataHeaders', h);
  return `${BASE}/${encodeURIComponent(id)}?${params.toString().replace(/\+/g, '%20')}`;
}

async function getJson<T>(url: string, token: string): Promise<T> {
  const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!resp.ok) {
    throw new Error(`Gmail ${resp.status}: ${await resp.text()}`);
  }
  return (await resp.json()) as T;
}

// Resolve each thunk with bounded concurrency, preserving input order.
async function mapPool<I, O>(items: I[], limit: number, fn: (item: I) => Promise<O>): Promise<O[]> {
  const out = new Array<O>(items.length);
  let next = 0;
  async function worker(): Promise<void> {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

// List message ids received on or after sinceISO (following paging up to `cap`),
// then fetch each message's metadata. Caps total volume so a huge backlog cannot
// run unbounded; logs if the cap is hit.
export async function fetchMessagesSince(
  token: string,
  sinceISO: string,
  cap = 500,
): Promise<GmailMessage[]> {
  const ids: string[] = [];
  let pageToken: string | undefined;
  let capped = false;

  do {
    const page = await getJson<GmailListPage>(buildListUrl(sinceISO, pageToken), token);
    for (const ref of page.messages ?? []) {
      if (ids.length >= cap) {
        capped = true;
        break;
      }
      ids.push(ref.id);
    }
    pageToken = capped ? undefined : page.nextPageToken;
  } while (pageToken);

  if (capped) {
    console.warn(`Daybreak: reached the ${cap}-message cap; older mail was not fetched.`);
  }

  return mapPool(ids, 8, (id) => getJson<GmailMessage>(buildGetUrl(id), token));
}
