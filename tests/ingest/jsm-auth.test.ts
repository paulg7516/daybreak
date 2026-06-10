// tests/ingest/jsm-auth.test.ts
import { describe, it, expect } from 'vitest';
import { buildBasicAuth } from '../../src/ingest/jsm-auth';

describe('buildBasicAuth', () => {
  it('builds a Basic header from email + token', () => {
    const expected = 'Basic ' + Buffer.from('me@co.com:tok123').toString('base64');
    expect(buildBasicAuth('me@co.com', 'tok123')).toBe(expected);
  });
});
