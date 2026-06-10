// src/ingest/jsm-auth.ts
import keytar from 'keytar';

const SERVICE = 'Daybreak';
const ACCOUNT = 'jira-api-token';

export function buildBasicAuth(email: string, token: string): string {
  return 'Basic ' + Buffer.from(`${email}:${token}`).toString('base64');
}

export interface JiraAuth {
  baseUrl: string;
  email: string;
  header: string;
}

// Reads base URL + email from env and the API token from the OS keychain. Returns
// null when any piece is missing, so JSM ingestion is simply skipped (optional).
export async function getJiraAuth(): Promise<JiraAuth | null> {
  const baseUrl = process.env.DAYBREAK_JIRA_BASE_URL;
  const email = process.env.DAYBREAK_JIRA_EMAIL;
  const token = await keytar.getPassword(SERVICE, ACCOUNT);
  if (!baseUrl || !email || !token) return null;
  return { baseUrl: baseUrl.replace(/\/$/, ''), email, header: buildBasicAuth(email, token) };
}

export async function storeJiraToken(token: string): Promise<void> {
  await keytar.setPassword(SERVICE, ACCOUNT, token);
}

export async function clearJiraToken(): Promise<void> {
  await keytar.deletePassword(SERVICE, ACCOUNT);
}
