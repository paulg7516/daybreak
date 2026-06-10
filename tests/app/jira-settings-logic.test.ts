// tests/app/jira-settings-logic.test.ts
import { describe, it, expect } from 'vitest';
import { setJiraConfig, emptyOverlay } from '../../src/app/overlay';
import { resolveJiraSettings } from '../../src/ingest/jsm-auth';

describe('setJiraConfig reducer', () => {
  it('stores trimmed base URL (no trailing slash) and email without mutating input', () => {
    const base = emptyOverlay();
    const next = setJiraConfig(base, '  https://co.atlassian.net/  ', '  me@co.com ');
    expect(next.jira).toEqual({ baseUrl: 'https://co.atlassian.net', email: 'me@co.com' });
    expect(base.jira).toBeNull();
  });
});

describe('resolveJiraSettings', () => {
  it('prefers the explicit config over env and strips a trailing slash', () => {
    const r = resolveJiraSettings(
      { baseUrl: 'https://a.atlassian.net/', email: 'a@co.com' },
      { baseUrl: 'https://env.atlassian.net', email: 'env@co.com' },
    );
    expect(r).toEqual({ baseUrl: 'https://a.atlassian.net', email: 'a@co.com' });
  });
  it('falls back to env when config is absent', () => {
    const r = resolveJiraSettings(undefined, { baseUrl: 'https://env.atlassian.net', email: 'env@co.com' });
    expect(r).toEqual({ baseUrl: 'https://env.atlassian.net', email: 'env@co.com' });
  });
  it('returns null when neither config nor env supplies a piece', () => {
    expect(resolveJiraSettings(undefined, {})).toBeNull();
    expect(resolveJiraSettings({ baseUrl: 'https://a.net' }, {})).toBeNull();
  });
});
