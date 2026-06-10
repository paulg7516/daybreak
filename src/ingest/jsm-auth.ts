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

export interface JiraConfigInput {
  baseUrl?: string;
  email?: string;
}

// Pure: merge an explicit config over env, normalizing the base URL. Null if a
// required piece (base URL or email) is missing from both.
export function resolveJiraSettings(
  config: JiraConfigInput | undefined,
  env: { baseUrl?: string; email?: string },
): { baseUrl: string; email: string } | null {
  const baseUrl = config?.baseUrl || env.baseUrl;
  const email = config?.email || env.email;
  if (!baseUrl || !email) return null;
  return { baseUrl: baseUrl.replace(/\/$/, ''), email };
}

export async function getStoredJiraToken(): Promise<string | null> {
  return keytar.getPassword(SERVICE, ACCOUNT);
}

// Resolves config-or-env, then reads the token from the keychain. Null when any
// piece is missing, so JSM ingestion is simply skipped.
export async function getJiraAuth(config?: JiraConfigInput): Promise<JiraAuth | null> {
  const resolved = resolveJiraSettings(config, {
    baseUrl: process.env.DAYBREAK_JIRA_BASE_URL,
    email: process.env.DAYBREAK_JIRA_EMAIL,
  });
  if (!resolved) return null;
  const token = await keytar.getPassword(SERVICE, ACCOUNT);
  if (!token) return null;
  return { baseUrl: resolved.baseUrl, email: resolved.email, header: buildBasicAuth(resolved.email, token) };
}

export async function storeJiraToken(token: string): Promise<void> {
  await keytar.setPassword(SERVICE, ACCOUNT, token);
}

export async function clearJiraToken(): Promise<void> {
  await keytar.deletePassword(SERVICE, ACCOUNT);
}
