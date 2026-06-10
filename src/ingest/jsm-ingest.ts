// src/ingest/jsm-ingest.ts
import { getJiraAuth } from './jsm-auth';
import { fetchAssignedTickets } from './jsm-client';
import { jsmIssueToItem } from './jsm-normalize';
import type { DaybreakItem } from '../model/item';

// Ingest the user's assigned, in-window JSM tickets as DaybreakItems. Returns an
// empty array when Jira is not configured, so callers can merge unconditionally.
// `me` is the cross-source identity; if absent it falls back to the Jira email.
export async function ingestJsm(sinceISO: string, me?: string): Promise<DaybreakItem[]> {
  const auth = await getJiraAuth();
  if (!auth) return [];
  const who = me ?? auth.email.toLowerCase();
  const issues = await fetchAssignedTickets(auth, sinceISO);
  return issues.map((issue) => jsmIssueToItem(issue, who, auth.baseUrl));
}
