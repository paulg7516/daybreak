// src/ingest/ingest.ts
import { getAccessToken, getSignedInUser } from './graph-auth';
import { fetchMessagesSince } from './graph-client';
import { graphMessageToItem } from './normalize';
import { assembleThreads } from './threads';
import type { DaybreakItem } from '../model/item';

export interface IngestResult {
  me: string;
  internalDomains: string[];
  items: DaybreakItem[];
}

// A provider-agnostic sign-in prompt surfaced to the UI/CLI during ingest.
// Microsoft uses device-code (visit a URL, enter a code); Google uses a loopback
// redirect (just open a URL). The `provider` discriminator lets the UI render the
// right copy.
export type AuthPrompt =
  | { provider: 'microsoft'; verificationUri: string; userCode: string; message: string }
  | { provider: 'google'; url: string };

export async function ingestBacklog(
  sinceISO: string,
  onAuthPrompt?: (prompt: AuthPrompt) => void,
): Promise<IngestResult> {
  const token = await getAccessToken((info) =>
    onAuthPrompt?.({
      provider: 'microsoft',
      verificationUri: info.verificationUri,
      userCode: info.userCode,
      message: info.message,
    }),
  );
  const { address } = await getSignedInUser(token);
  const me = address.toLowerCase();
  const at = me.lastIndexOf('@');
  const internalDomains = at >= 0 ? [me.slice(at + 1)] : [];

  const raw = await fetchMessagesSince(token, sinceISO);
  const items = raw.map((m) => graphMessageToItem(m, internalDomains));
  return { me, internalDomains, items: assembleThreads(items) };
}
