// src/cli-ingest.ts
import { ingestBacklog } from './ingest/ingest';
import { scoreAll } from './scoring/score';
import { buildSummary } from './summary/summary';

// Resolve the away window: --since <ISO> arg, then DAYBREAK_AWAY_SINCE env,
// else default to 14 days before now.
function resolveSince(now: Date): string {
  const argIndex = process.argv.indexOf('--since');
  if (argIndex >= 0 && process.argv[argIndex + 1]) {
    return process.argv[argIndex + 1];
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

  const { me, items } = await ingestBacklog(sinceISO);
  const scored = scoreAll(items, { me, awaySince: sinceISO, now: now.toISOString() });
  const summary = buildSummary(scored);

  console.log(
    JSON.stringify({ me, awaySince: sinceISO, count: items.length, summary, scored }, null, 2),
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
