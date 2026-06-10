// src/ingest/jsm-client.ts
import type { JiraIssue, JiraSearchResponse } from './jsm-types';
import type { JiraAuth } from './jsm-auth';

// JQL: assigned to me, not in a Done status category, updated on/after the away
// date. Jira JQL takes a day-precision date string, so trim the ISO timestamp.
export function buildJql(sinceISO: string): string {
  const day = sinceISO.slice(0, 10);
  return `assignee = currentUser() AND statusCategory != Done AND updated >= "${day}" ORDER BY updated DESC`;
}
