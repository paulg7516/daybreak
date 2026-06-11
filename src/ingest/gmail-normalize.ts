// src/ingest/gmail-normalize.ts
import type { DaybreakItem } from '../model/item';
import { classifySource } from './normalize';
import type { GmailHeader, GmailMessage } from './gmail-types';

// Extract the bare address from an RFC 5322 field value, e.g.
// "The Boss <boss@company.com>" -> "boss@company.com". Gmail returns the full
// formatted header, unlike Graph which gives a clean address object.
export function parseAddress(value: string): string {
  const angled = value.match(/<([^>]+)>/);
  return (angled ? angled[1] : value).trim();
}

// Split a recipient header ("a@x.com, Name <b@x.com>") into bare addresses.
function parseAddressList(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((part) => parseAddress(part))
    .filter((addr) => addr.length > 0);
}

function headerMap(headers: GmailHeader[] | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const h of headers ?? []) out[h.name] = h.value;
  return out;
}

// Case-insensitive header lookup; Gmail preserves the sender's original casing.
function get(headers: Record<string, string>, name: string): string | undefined {
  const key = Object.keys(headers).find((k) => k.toLowerCase() === name.toLowerCase());
  return key ? headers[key] : undefined;
}

export function gmailMessageToItem(msg: GmailMessage, internalDomains: string[]): DaybreakItem {
  const headers = headerMap(msg.payload?.headers);
  const from = parseAddress(get(headers, 'From') ?? '');

  // Prefer the Date header; fall back to internalDate (epoch ms) when absent.
  const dateHeader = get(headers, 'Date');
  let receivedAt = '';
  if (dateHeader) {
    receivedAt = new Date(dateHeader).toISOString();
  } else if (msg.internalDate) {
    receivedAt = new Date(Number(msg.internalDate)).toISOString();
  }

  return {
    id: msg.id,
    source: classifySource(from, internalDomains),
    subject: get(headers, 'Subject') ?? '',
    from,
    receivedAt,
    toRecipients: parseAddressList(get(headers, 'To')),
    ccRecipients: parseAddressList(get(headers, 'Cc')),
    bodyText: msg.snippet ?? '',
    internetHeaders: headers,
    threadId: msg.threadId,
    webLink: `https://mail.google.com/mail/u/0/#inbox/${msg.id}`,
    isRead: !(msg.labelIds ?? []).includes('UNREAD'),
  };
}
