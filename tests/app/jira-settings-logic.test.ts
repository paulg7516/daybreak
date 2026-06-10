// tests/app/jira-settings-logic.test.ts
import { describe, it, expect } from 'vitest';
import { setJiraConfig, emptyOverlay } from '../../src/app/overlay';

describe('setJiraConfig reducer', () => {
  it('stores trimmed base URL (no trailing slash) and email without mutating input', () => {
    const base = emptyOverlay();
    const next = setJiraConfig(base, '  https://co.atlassian.net/  ', '  me@co.com ');
    expect(next.jira).toEqual({ baseUrl: 'https://co.atlassian.net', email: 'me@co.com' });
    expect(base.jira).toBeNull();
  });
});
