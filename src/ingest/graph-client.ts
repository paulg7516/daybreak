// src/ingest/graph-client.ts
import type { GraphMessage, GraphMessagePage } from './graph-types';

const SELECT_FIELDS = [
  'subject',
  'from',
  'toRecipients',
  'ccRecipients',
  'bodyPreview',
  'conversationId',
  'webLink',
  'isRead',
  'receivedDateTime',
  'internetMessageHeaders',
];

export function buildMessagesUrl(sinceISO: string, top = 50): string {
  const params = new URLSearchParams({
    '$select': SELECT_FIELDS.join(','),
    '$filter': `receivedDateTime ge ${sinceISO}`,
    '$orderby': 'receivedDateTime desc',
    '$top': String(top),
  });
  // URLSearchParams encodes spaces as '+'; replace with '%20' so that
  // decodeURIComponent restores the original string in tests and callers.
  return `https://graph.microsoft.com/v1.0/me/messages?${params.toString().replace(/\+/g, '%20')}`;
}

// Fetch messages received on or after sinceISO, following paging up to `cap`
// messages. Caps total volume so a huge backlog cannot run unbounded; logs if hit.
export async function fetchMessagesSince(
  token: string,
  sinceISO: string,
  cap = 500,
): Promise<GraphMessage[]> {
  let url: string | undefined = buildMessagesUrl(sinceISO);
  const out: GraphMessage[] = [];

  while (url && out.length < cap) {
    const resp: Response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Prefer: 'outlook.body-content-type="text"',
      },
    });
    if (!resp.ok) {
      throw new Error(`Graph ${resp.status}: ${await resp.text()}`);
    }
    const page = (await resp.json()) as GraphMessagePage;
    out.push(...page.value);
    url = page['@odata.nextLink'];
  }

  if (url) {
    console.warn(`Daybreak: reached the ${cap}-message cap; older mail was not fetched.`);
  }
  return out.slice(0, cap);
}
