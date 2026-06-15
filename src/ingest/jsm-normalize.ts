// src/ingest/jsm-normalize.ts
import type { DaybreakItem, JsmFields } from '../model/item';
import type { JiraIssue, JiraIssueFields } from './jsm-types';

const PRIORITY = new Map<string, JsmFields['priority']>([
  ['highest', 'P1'], ['critical', 'P1'], ['p1', 'P1'],
  ['high', 'P2'], ['major', 'P2'], ['p2', 'P2'],
  ['medium', 'P3'], ['p3', 'P3'],
  ['low', 'P4'], ['minor', 'P4'], ['lowest', 'P4'], ['p4', 'P4'],
]);

export function mapPriority(name?: string): JsmFields['priority'] {
  if (!name) return undefined;
  return PRIORITY.get(name.trim().toLowerCase());
}

const AT_RISK_MS = 4 * 60 * 60 * 1000;

// JSM SLA fields are custom fields whose key varies per instance, so find the value
// generically: an object carrying an `ongoingCycle`. Best-effort by design.
export function readSlaStatus(fields: JiraIssueFields): JsmFields['slaStatus'] {
  for (const value of Object.values(fields)) {
    if (value && typeof value === 'object' && 'ongoingCycle' in value) {
      const cycle = (value as { ongoingCycle?: { breached?: boolean; remainingTime?: { millis?: number } } }).ongoingCycle;
      if (!cycle) continue;
      if (cycle.breached) return 'breached';
      const millis = cycle.remainingTime?.millis;
      if (typeof millis === 'number' && millis <= AT_RISK_MS) return 'at_risk';
      return 'ok';
    }
  }
  return 'none';
}

export function jsmIssueToItem(issue: JiraIssue, me: string, baseUrl: string): DaybreakItem {
  const f = issue.fields;
  return {
    id: issue.key,
    source: 'jsm',
    subject: f.summary ?? '',
    from: f.reporter?.displayName ?? 'JSM',
    fromName: f.reporter?.displayName,
    receivedAt: f.updated ?? f.created ?? '',
    webLink: `${baseUrl}/browse/${issue.key}`,
    jsm: {
      assignee: me,
      priority: mapPriority(f.priority?.name),
      slaStatus: readSlaStatus(f),
      state: f.status?.name,
    },
  };
}
