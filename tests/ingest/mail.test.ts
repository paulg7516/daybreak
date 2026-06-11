// tests/ingest/mail.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ingestMail, resolveMailProvider } from '../../src/ingest/mail';
import { ingestBacklog } from '../../src/ingest/ingest';
import { ingestGmailBacklog } from '../../src/ingest/gmail-ingest';

vi.mock('../../src/ingest/ingest', () => ({
  ingestBacklog: vi.fn(async () => ({ me: 'graph@x.com', internalDomains: ['x.com'], items: [] })),
}));
vi.mock('../../src/ingest/gmail-ingest', () => ({
  ingestGmailBacklog: vi.fn(async () => ({ me: 'gmail@x.com', internalDomains: ['x.com'], items: [] })),
}));

describe('resolveMailProvider', () => {
  it('defaults to graph when unset', () => {
    expect(resolveMailProvider({})).toBe('graph');
  });
  it('selects gmail when DAYBREAK_MAIL_PROVIDER=gmail', () => {
    expect(resolveMailProvider({ DAYBREAK_MAIL_PROVIDER: 'gmail' })).toBe('gmail');
  });
  it('falls back to graph for any other value', () => {
    expect(resolveMailProvider({ DAYBREAK_MAIL_PROVIDER: 'imap' })).toBe('graph');
  });

  // A packaged app launched from Finder has no shell env, so a Gmail tester build
  // bakes DAYBREAK_MAIL_PROVIDER_BAKED into the bundle as the fallback.
  describe('baked provider fallback', () => {
    const original = process.env.DAYBREAK_MAIL_PROVIDER_BAKED;
    afterEach(() => {
      if (original === undefined) delete process.env.DAYBREAK_MAIL_PROVIDER_BAKED;
      else process.env.DAYBREAK_MAIL_PROVIDER_BAKED = original;
    });

    it('uses the baked provider when the env var is unset', () => {
      process.env.DAYBREAK_MAIL_PROVIDER_BAKED = 'gmail';
      expect(resolveMailProvider({})).toBe('gmail');
    });

    it('lets the env var override the baked provider', () => {
      process.env.DAYBREAK_MAIL_PROVIDER_BAKED = 'gmail';
      expect(resolveMailProvider({ DAYBREAK_MAIL_PROVIDER: 'graph' })).toBe('graph');
    });
  });
});

describe('ingestMail', () => {
  const original = process.env.DAYBREAK_MAIL_PROVIDER;
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => {
    if (original === undefined) delete process.env.DAYBREAK_MAIL_PROVIDER;
    else process.env.DAYBREAK_MAIL_PROVIDER = original;
  });

  it('routes to the Graph ingest by default', async () => {
    delete process.env.DAYBREAK_MAIL_PROVIDER;
    const result = await ingestMail('2026-05-25T00:00:00Z');
    expect(ingestBacklog).toHaveBeenCalledOnce();
    expect(ingestGmailBacklog).not.toHaveBeenCalled();
    expect(result.me).toBe('graph@x.com');
  });

  it('routes to the Gmail ingest when selected', async () => {
    process.env.DAYBREAK_MAIL_PROVIDER = 'gmail';
    const result = await ingestMail('2026-05-25T00:00:00Z');
    expect(ingestGmailBacklog).toHaveBeenCalledOnce();
    expect(ingestBacklog).not.toHaveBeenCalled();
    expect(result.me).toBe('gmail@x.com');
  });
});
