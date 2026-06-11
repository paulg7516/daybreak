// src/ingest/gmail-ingest.ts
import { getAccessToken, getSignedInUser } from './gmail-auth';
import { fetchMessagesSince } from './gmail-client';
import { gmailMessageToItem } from './gmail-normalize';
import { assembleThreads } from './threads';
import type { AuthPrompt, IngestResult } from './ingest';

export async function ingestGmailBacklog(
  sinceISO: string,
  onAuthPrompt?: (prompt: AuthPrompt) => void,
): Promise<IngestResult> {
  const token = await getAccessToken((info) => onAuthPrompt?.({ provider: 'google', url: info.url }));
  const { address } = await getSignedInUser(token);
  const me = address.toLowerCase();
  const at = me.lastIndexOf('@');
  const internalDomains = at >= 0 ? [me.slice(at + 1)] : [];

  const raw = await fetchMessagesSince(token, sinceISO);
  const items = raw.map((m) => gmailMessageToItem(m, internalDomains));
  return { me, internalDomains, items: assembleThreads(items) };
}
