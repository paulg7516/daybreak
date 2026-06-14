// src/ingest/mail-account.ts
// Provider-agnostic mail-source account helpers for the Settings "Data sources"
// view: report connection status, sign in, and sign out for whichever provider
// is active (Microsoft Graph or Gmail). The active provider is env/baked-selected
// via resolveMailProvider; this module never switches providers, it only manages
// the connection for the one in use.
import keytar from 'keytar';
import { resolveMailProvider, type MailProvider } from './mail';
import { getAccessToken as graphToken, getSignedInUser as graphUser } from './graph-auth';
import { getAccessToken as gmailToken, getSignedInUser as gmailUser, clearTokenCache as clearGmail } from './gmail-auth';
import { clearTokenCache as clearGraph } from './keychain-cache';

const SERVICE = 'Daybreak';

import type { MailStatus } from '../app/ipc-types';

// A unified auth prompt the renderer can render (mirrors AuthPanel's union).
export type MailAuthPrompt =
  | { provider: 'microsoft'; verificationUri: string; userCode: string; message?: string }
  | { provider: 'google'; url: string };

function graphConfigured(): boolean {
  return Boolean(process.env.DAYBREAK_CLIENT_ID && process.env.DAYBREAK_TENANT_ID);
}

async function hasToken(provider: MailProvider): Promise<boolean> {
  const account = provider === 'gmail' ? 'gmail-refresh-token' : 'msal-token-cache';
  return Boolean(await keytar.getPassword(SERVICE, account));
}

// `account` is the last-known signed-in address (persisted by the caller); it is
// only surfaced when a token is actually present.
export async function getMailStatus(account: string | null): Promise<MailStatus> {
  const provider = resolveMailProvider();
  const connected = await hasToken(provider);
  return { provider, connected, account: connected ? account : null, graphConfigured: graphConfigured() };
}

// Run the active provider's sign-in and return the signed-in address.
export async function connectMail(onPrompt: (p: MailAuthPrompt) => void): Promise<{ address: string }> {
  if (resolveMailProvider() === 'gmail') {
    const token = await gmailToken((info) => onPrompt({ provider: 'google', url: info.url }));
    return gmailUser(token);
  }
  const token = await graphToken((info) => onPrompt({ provider: 'microsoft', ...info }));
  return graphUser(token);
}

// Clear the active provider's cached token so the next connect re-prompts.
export async function disconnectMail(): Promise<void> {
  if (resolveMailProvider() === 'gmail') await clearGmail();
  else await clearGraph();
}
