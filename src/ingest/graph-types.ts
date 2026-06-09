// src/ingest/graph-types.ts

export interface GraphEmailAddress {
  address: string;
  name?: string;
}

export interface GraphRecipient {
  emailAddress: GraphEmailAddress;
}

export interface GraphHeader {
  name: string;
  value: string;
}

// Only the fields Daybreak requests via $select. Graph returns much more.
export interface GraphMessage {
  id: string;
  subject?: string;
  from?: { emailAddress: GraphEmailAddress };
  toRecipients?: GraphRecipient[];
  ccRecipients?: GraphRecipient[];
  bodyPreview?: string;
  conversationId?: string;
  webLink?: string;
  isRead?: boolean;
  receivedDateTime: string; // ISO timestamp
  internetMessageHeaders?: GraphHeader[];
}

// Shape of a Graph collection response page.
export interface GraphMessagePage {
  value: GraphMessage[];
  '@odata.nextLink'?: string;
}
