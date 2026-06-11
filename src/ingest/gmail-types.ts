// src/ingest/gmail-types.ts

export interface GmailHeader {
  name: string;
  value: string;
}

// Only the fields Daybreak requests via format=metadata + metadataHeaders.
// The Gmail API returns much more on a full-format fetch.
export interface GmailMessage {
  id: string;
  threadId?: string;
  labelIds?: string[];
  snippet?: string;
  internalDate?: string; // epoch milliseconds, as a string
  payload?: { headers?: GmailHeader[] };
}

// A reference in a users.messages.list page; only id/threadId are returned.
export interface GmailListMessageRef {
  id: string;
  threadId?: string;
}

// Shape of a users.messages.list response page.
export interface GmailListPage {
  messages?: GmailListMessageRef[];
  nextPageToken?: string;
  resultSizeEstimate?: number;
}
