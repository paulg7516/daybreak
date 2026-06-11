// src/cli-ingest.ts
import { ingestMail } from './ingest/mail';
import { ingestJsm } from './ingest/jsm-ingest';
import { triageAll } from './scoring/triage';
import { applyOverlay, emptyOverlay } from './app/overlay';
import { buildSummary } from './summary/summary';

// Resolve the away window: --since <ISO> arg, then DAYBREAK_AWAY_SINCE env,
// else default to 14 days before now.
function resolveSince(now: Date): string {
  const argIndex = process.argv.indexOf('--since');
  const candidate = process.argv[argIndex + 1];
  // Guard against `--since --otherflag` swallowing a flag as the date, which would
  // surface only as an opaque Graph 400 about the filter expression.
  if (argIndex >= 0 && candidate && !candidate.startsWith('-')) {
    return candidate;
  }
  if (process.env.DAYBREAK_AWAY_SINCE) {
    return process.env.DAYBREAK_AWAY_SINCE;
  }
  const since = new Date(now);
  since.setDate(since.getDate() - 14);
  return since.toISOString();
}

async function main(): Promise<void> {
  const now = new Date();
  const sinceISO = resolveSince(now);

  const { me, items: emailItems } = await ingestMail(sinceISO);
  let items = emailItems;
  try {
    const jsmItems = await ingestJsm(sinceISO, me);
    if (jsmItems.length) items = [...emailItems, ...jsmItems];
  } catch (err) {
    console.warn('Daybreak: JSM ingest failed -', err instanceof Error ? err.message : err);
  }
  const triaged = triageAll(items, { me, since: sinceISO, now: now.toISOString() });
  const overlaid = applyOverlay(triaged, emptyOverlay());
  const summary = buildSummary(overlaid);

  console.log(
    JSON.stringify({ me, since: sinceISO, count: triaged.length, summary, triaged }, null, 2),
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
