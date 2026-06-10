// tests/ingest/jsm-normalize.test.ts
import { describe, it, expect } from 'vitest';
import { mapPriority, readSlaStatus, jsmIssueToItem } from '../../src/ingest/jsm-normalize';
import type { JiraIssue } from '../../src/ingest/jsm-types';

describe('mapPriority', () => {
  it('maps common scheme names to P1-P4', () => {
    expect(mapPriority('Highest')).toBe('P1');
    expect(mapPriority('Critical')).toBe('P1');
    expect(mapPriority('High')).toBe('P2');
    expect(mapPriority('Medium')).toBe('P3');
    expect(mapPriority('Low')).toBe('P4');
    expect(mapPriority('P1')).toBe('P1');
  });
  it('returns undefined for unknown or missing', () => {
    expect(mapPriority('Spicy')).toBeUndefined();
    expect(mapPriority(undefined)).toBeUndefined();
  });
});

describe('readSlaStatus', () => {
  it('reads breached from an ongoing cycle', () => {
    const fields = { customfield_1: { ongoingCycle: { breached: true, remainingTime: { millis: -1000 } } } };
    expect(readSlaStatus(fields)).toBe('breached');
  });
  it('reads at_risk when remaining time is at or below the threshold', () => {
    const fields = { customfield_1: { ongoingCycle: { breached: false, remainingTime: { millis: 60 * 60 * 1000 } } } };
    expect(readSlaStatus(fields)).toBe('at_risk');
  });
  it('reads ok with ample remaining time', () => {
    const fields = { customfield_1: { ongoingCycle: { breached: false, remainingTime: { millis: 48 * 60 * 60 * 1000 } } } };
    expect(readSlaStatus(fields)).toBe('ok');
  });
  it('returns none when no SLA object is present', () => {
    expect(readSlaStatus({ summary: 'x', status: { name: 'Open' } })).toBe('none');
  });
});

describe('jsmIssueToItem', () => {
  const issue: JiraIssue = {
    key: 'INC-4821',
    fields: {
      summary: 'Payments API returning 500s',
      status: { name: 'In Progress' },
      priority: { name: 'Highest' },
      reporter: { displayName: 'Pat Reporter' },
      created: '2026-05-05T09:00:00.000Z',
      updated: '2026-05-07T09:00:00.000Z',
      customfield_1: { ongoingCycle: { breached: true, remainingTime: { millis: -1 } } },
    },
  };

  it('maps an issue to a jsm DaybreakItem', () => {
    const item = jsmIssueToItem(issue, 'me@company.com', 'https://co.atlassian.net');
    expect(item.id).toBe('INC-4821');
    expect(item.source).toBe('jsm');
    expect(item.subject).toBe('Payments API returning 500s');
    expect(item.from).toBe('Pat Reporter');
    expect(item.receivedAt).toBe('2026-05-07T09:00:00.000Z');
    expect(item.webLink).toBe('https://co.atlassian.net/browse/INC-4821');
    expect(item.jsm).toEqual({ assignee: 'me@company.com', priority: 'P1', slaStatus: 'breached', state: 'In Progress' });
  });

  it('falls back gracefully on missing optional fields', () => {
    const bare: JiraIssue = { key: 'REQ-1', fields: { updated: '2026-05-07T09:00:00.000Z' } };
    const item = jsmIssueToItem(bare, 'me@company.com', 'https://co.atlassian.net');
    expect(item.subject).toBe('');
    expect(item.from).toBe('JSM');
    expect(item.jsm?.assignee).toBe('me@company.com');
    expect(item.jsm?.priority).toBeUndefined();
    expect(item.jsm?.slaStatus).toBe('none');
  });
});
