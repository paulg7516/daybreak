// src/model/item.ts
export type Source = 'jsm' | 'email_internal' | 'email_vendor';

// The lane IS the sender's declared intent (or, for JSM, the ticket's derived
// action-type). There is no inference: an email's lane comes straight from the
// X-PTO-Triage tag the sender set via the add-in.
export type Lane = 'respond' | 'approve' | 'review' | 'fyi';

// Urgency is a separate axis from the lane: a badge + sort key derived from a
// declared deadline (email) or SLA/priority (JSM). It never decides the lane.
export type Urgency = 'overdue' | 'today' | 'this_week' | 'none';

// Display order of lanes on the board, most-actionable first.
export const LANE_ORDER: Lane[] = ['respond', 'approve', 'review', 'fyi'];

// Default display labels; the user can rename lanes in Settings (the underlying
// lane id / sender tag is fixed).
export const LANE_LABELS: Record<Lane, string> = {
  respond: 'Needs your reply',
  approve: 'Needs your decision',
  review: 'Needs your review',
  fyi: 'FYI',
};

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
  fromName?: string; // sender display name, when the source provides one
  receivedAt: string; // ISO timestamp
  // email fields
  toRecipients?: string[];
  ccRecipients?: string[];
  bodyText?: string;
  threadMessages?: ThreadMessage[]; // later messages in the same thread
  internetHeaders?: Record<string, string>; // includes X-PTO-Triage when present
  // ticketing fields
  jsm?: JsmFields;
  // ingestion metadata (populated by the ingestion layer)
  webLink?: string;   // deep link to open the item in Outlook/JSM
  threadId?: string;  // conversation/thread identifier for grouping
  isRead?: boolean;
}

// Context for triage. No inference inputs (managers/reports/contacts) any more -
// the sender declares intent, so all triage needs is who "me" is and the clock.
export interface TriageContext {
  me: string;
  since: string; // ISO date; the "catch up since" boundary, for display/context
  now: string;   // ISO timestamp; injected for deterministic triage and tests
}

// The result of triage: the declared lane plus a derived urgency badge. No rank
// (urgency + receivedAt sort), no resolved flag (resolved-while-away is gone).
export interface TriagedItem {
  item: DaybreakItem;
  lane: Lane;
  urgency: Urgency;
  deadline?: string; // ISO date, when the sender declared one
  reasons: string[];
}
