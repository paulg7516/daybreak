// src/ingest/jsm-client.ts
import type { JiraIssue, JiraSearchResponse } from './jsm-types';
import type { JiraAuth } from './jsm-auth';

// JQL: assigned to me, not in a Done status category, updated on/after the away
// date. Jira JQL takes a day-precision date string, so trim the ISO timestamp.
export function buildJql(sinceISO: string): string {
  const day = sinceISO.slice(0, 10);
  return `assignee = currentUser() AND statusCategory != Done AND updated >= "${day}" ORDER BY updated DESC`;
}

const SEARCH_PATH = '/rest/api/3/search/jql';

// Fetch assigned, not-Done, in-window tickets, following token paging up to `cap`
// issues. Requests all fields so the per-instance SLA custom field is discoverable
// during normalization. Logs if the cap is hit; never runs unbounded.
export async function fetchAssignedTickets(
  auth: JiraAuth,
  sinceISO: string,
  cap = 200,
): Promise<JiraIssue[]> {
  const jql = buildJql(sinceISO);
  const out: JiraIssue[] = [];
  let nextPageToken: string | undefined;

  do {
    const resp: Response = await fetch(`${auth.baseUrl}${SEARCH_PATH}`, {
      method: 'POST',
      headers: {
        Authorization: auth.header,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ jql, fields: ['*all'], maxResults: 100, nextPageToken }),
    });
    if (!resp.ok) {
      throw new Error(`Jira ${resp.status}: ${await resp.text()}`);
    }
    const page = (await resp.json()) as JiraSearchResponse;
    out.push(...page.issues);
    nextPageToken = page.isLast ? undefined : page.nextPageToken;
  } while (nextPageToken && out.length < cap);

  if (nextPageToken) {
    console.warn(`Daybreak: reached the ${cap}-ticket cap; older tickets were not fetched.`);
  }
  return out.slice(0, cap);
}
