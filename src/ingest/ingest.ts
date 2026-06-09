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

export async function ingestBacklog(
  sinceISO: string,
  onDeviceCode?: (info: { verificationUri: string; userCode: string; message: string }) => void,
): Promise<IngestResult> {
  const token = await getAccessToken(onDeviceCode);
  const { address } = await getSignedInUser(token);
  const me = address.toLowerCase();
  const at = me.lastIndexOf('@');
  const internalDomains = at >= 0 ? [me.slice(at + 1)] : [];

  const raw = await fetchMessagesSince(token, sinceISO);
  const items = raw.map((m) => graphMessageToItem(m, internalDomains));
  return { me, internalDomains, items: assembleThreads(items) };
}
