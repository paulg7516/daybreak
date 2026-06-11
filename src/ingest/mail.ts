// src/ingest/mail.ts
import { ingestBacklog, type AuthPrompt, type IngestResult } from './ingest';
import { ingestGmailBacklog } from './gmail-ingest';

export type MailProvider = 'graph' | 'gmail';

// Pick the mail provider. The runtime env var wins; otherwise fall back to a value
// baked into the bundle at build time (DAYBREAK_MAIL_PROVIDER_BAKED, set only by a
// Gmail tester build - see scripts/build-main.mjs), since a packaged app launched
// from Finder has no shell env. Defaults to Graph so existing Microsoft 365 behavior
// is unchanged.
export function resolveMailProvider(env: NodeJS.ProcessEnv = process.env): MailProvider {
  const provider = env.DAYBREAK_MAIL_PROVIDER || process.env.DAYBREAK_MAIL_PROVIDER_BAKED;
  return provider === 'gmail' ? 'gmail' : 'graph';
}

// Provider-agnostic mail ingest. Both backends return the same IngestResult and
// take the same unified AuthPrompt callback.
export function ingestMail(
  sinceISO: string,
  onAuthPrompt?: (prompt: AuthPrompt) => void,
): Promise<IngestResult> {
  return resolveMailProvider() === 'gmail'
    ? ingestGmailBacklog(sinceISO, onAuthPrompt)
    : ingestBacklog(sinceISO, onAuthPrompt);
}
