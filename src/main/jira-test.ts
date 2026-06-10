// src/main/jira-test.ts
import { buildBasicAuth, getStoredJiraToken } from '../ingest/jsm-auth';

export interface JiraTestInput {
  baseUrl: string;
  email: string;
  token?: string; // when omitted, the keychain token is used
}
export type JiraTestResult = { ok: true; displayName: string } | { ok: false; error: string };

// Validates a Jira connection by calling /myself. Read-only.
export async function testJiraConnection(input: JiraTestInput): Promise<JiraTestResult> {
  const token = input.token || (await getStoredJiraToken());
  if (!input.baseUrl || !input.email || !token) {
    return { ok: false, error: 'Base URL, email, and token are all required.' };
  }
  const url = `${input.baseUrl.replace(/\/$/, '')}/rest/api/3/myself`;
  try {
    const resp = await fetch(url, {
      headers: { Authorization: buildBasicAuth(input.email, token), Accept: 'application/json' },
    });
    if (!resp.ok) {
      return { ok: false, error: resp.status === 401 ? 'Authentication failed - check the email and token.' : `Jira ${resp.status}` };
    }
    const me = (await resp.json()) as { displayName?: string };
    return { ok: true, displayName: me.displayName ?? input.email };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Could not reach Jira.' };
  }
}
