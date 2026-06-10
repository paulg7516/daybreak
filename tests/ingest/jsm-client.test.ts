// tests/ingest/jsm-client.test.ts
import { describe, it, expect } from 'vitest';
import { buildJql } from '../../src/ingest/jsm-client';

describe('buildJql', () => {
  it('scopes to the current user, not-Done, updated since the date (day precision)', () => {
    const jql = buildJql('2026-05-26T00:00:00.000Z');
    expect(jql).toContain('assignee = currentUser()');
    expect(jql).toContain('statusCategory != Done');
    expect(jql).toContain('updated >= "2026-05-26"');
    expect(jql).toContain('ORDER BY updated DESC');
  });
});
