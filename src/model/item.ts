// src/model/item.ts
export type Source = 'jsm' | 'email_internal' | 'email_vendor';
export type Lane = 'today' | 'this_week' | 'fyi';
export type SenderTag = 'blocked' | 'action' | 'whenever' | 'fyi';

export interface ThreadMessage {
  from: string;
  sentAt: string; // ISO timestamp
  bodyText: string;
}

export interface JsmFields {
  assignee?: string;
  priority?: 'P1' | 'P2' | 'P3' | 'P4';
  slaStatus?: 'breached' | 'at_risk' | 'ok' | 'none';
  state?: string; // open, in progress, resolved, closed, done
}

export interface DaybreakItem {
  id: string;
  source: Source;
  subject: string;
  from: string;
  receivedAt: string; // ISO timestamp
  // email fields
  toRecipients?: string[];
  ccRecipients?: string[];
  bodyText?: string;
  threadMessages?: ThreadMessage[]; // later messages in the same thread
  internetHeaders?: Record<string, string>; // includes X-PTO-Triage when present
  // ticketing fields
  jsm?: JsmFields;
}

export interface ScoringContext {
  me: string;
  managers?: string[];
  reports?: string[];
  frequentContacts?: string[];
  awaySince: string; // ISO date; messages/replies after this are "while you were out"
  now: string;       // ISO timestamp; injected for deterministic scoring and tests
}

export interface ScoredItem {
  item: DaybreakItem;
  lane: Lane;
  rank: number;    // 0-100, higher is more urgent, used to sort within a lane
  reasons: string[];
  resolved: boolean; // resolved-while-away
}
