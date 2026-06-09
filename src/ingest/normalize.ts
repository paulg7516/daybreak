// src/ingest/normalize.ts
import type { DaybreakItem, Source } from '../model/item';
import type { GraphMessage } from './graph-types';

export function classifySource(fromAddress: string, internalDomains: string[]): Source {
  const at = fromAddress.lastIndexOf('@');
  if (at < 0) return 'email_vendor';
  const domain = fromAddress.slice(at + 1).toLowerCase();
  const internal = internalDomains.map((d) => d.toLowerCase());
  return internal.includes(domain) ? 'email_internal' : 'email_vendor';
}

export function graphMessageToItem(msg: GraphMessage, internalDomains: string[]): DaybreakItem {
  const from = msg.from?.emailAddress.address ?? '';
  const headers: Record<string, string> = {};
  for (const h of msg.internetMessageHeaders ?? []) {
    headers[h.name] = h.value;
  }
  return {
    id: msg.id,
    source: classifySource(from, internalDomains),
    subject: msg.subject ?? '',
    from,
    receivedAt: msg.receivedDateTime,
    toRecipients: (msg.toRecipients ?? []).map((r) => r.emailAddress.address),
    ccRecipients: (msg.ccRecipients ?? []).map((r) => r.emailAddress.address),
    bodyText: msg.bodyPreview ?? '',
    internetHeaders: headers,
    threadId: msg.conversationId,
    webLink: msg.webLink,
    isRead: msg.isRead,
  };
}
