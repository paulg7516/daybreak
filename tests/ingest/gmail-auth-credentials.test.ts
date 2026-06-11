// tests/ingest/gmail-auth-credentials.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { clientId, clientSecret } from '../../src/ingest/gmail-auth';

// The four vars that participate in credential resolution. Tests own them fully:
// saved and cleared before each case, restored after, so a credential present in
// the runner's own environment cannot leak into an assertion.
const VARS = [
  'DAYBREAK_GOOGLE_CLIENT_ID',
  'DAYBREAK_GOOGLE_CLIENT_ID_BAKED',
  'DAYBREAK_GOOGLE_CLIENT_SECRET',
  'DAYBREAK_GOOGLE_CLIENT_SECRET_BAKED',
];

describe('Google credential resolution', () => {
  const saved: Record<string, string | undefined> = {};
  beforeEach(() => {
    for (const v of VARS) {
      saved[v] = process.env[v];
      delete process.env[v];
    }
  });
  afterEach(() => {
    for (const v of VARS) {
      if (saved[v] === undefined) delete process.env[v];
      else process.env[v] = saved[v];
    }
  });

  it('uses the environment client id when set', () => {
    process.env.DAYBREAK_GOOGLE_CLIENT_ID = 'env-id';
    expect(clientId()).toBe('env-id');
  });

  it('falls back to the baked client id when the env var is unset', () => {
    process.env.DAYBREAK_GOOGLE_CLIENT_ID_BAKED = 'baked-id';
    expect(clientId()).toBe('baked-id');
  });

  it('prefers the env client id over the baked one (override wins)', () => {
    process.env.DAYBREAK_GOOGLE_CLIENT_ID = 'env-id';
    process.env.DAYBREAK_GOOGLE_CLIENT_ID_BAKED = 'baked-id';
    expect(clientId()).toBe('env-id');
  });

  it('throws when neither env nor baked client id is set', () => {
    expect(() => clientId()).toThrow('DAYBREAK_GOOGLE_CLIENT_ID');
  });

  it('uses the environment client secret when set', () => {
    process.env.DAYBREAK_GOOGLE_CLIENT_SECRET = 'env-secret';
    expect(clientSecret()).toBe('env-secret');
  });

  it('falls back to the baked client secret when the env var is unset', () => {
    process.env.DAYBREAK_GOOGLE_CLIENT_SECRET_BAKED = 'baked-secret';
    expect(clientSecret()).toBe('baked-secret');
  });

  it('throws when neither env nor baked client secret is set', () => {
    expect(() => clientSecret()).toThrow('DAYBREAK_GOOGLE_CLIENT_SECRET');
  });
});
