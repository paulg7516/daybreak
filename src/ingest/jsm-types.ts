// src/ingest/jsm-types.ts

export interface JiraUser {
  displayName?: string;
  emailAddress?: string;
}

// Only the fields Daybreak reads. The SLA field is a custom field whose key varies
// per instance, discovered generically in normalization (an object with an ongoingCycle).
export interface JiraIssueFields {
  summary?: string;
  status?: { name?: string };
  priority?: { name?: string };
  assignee?: JiraUser | null;
  reporter?: JiraUser | null;
  created?: string;
  updated?: string;
  [key: string]: unknown;
}

export interface JiraIssue {
  key: string;
  fields: JiraIssueFields;
}

export interface JiraSearchResponse {
  issues: JiraIssue[];
  nextPageToken?: string;
  isLast?: boolean;
}
