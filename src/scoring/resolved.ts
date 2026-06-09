// src/scoring/resolved.ts
import type { ReentryItem, ScoringContext } from '../model/item';

const RESOLVED_PHRASES = [
  'resolved', 'sorted', 'nvm', 'never mind', 'no longer needed', 'all set',
  'disregard', 'please ignore', 'already handled', 'this is done', 'closing this out',
];

export function isResolvedWhileAway(item: ReentryItem, ctx: ScoringContext): boolean {
  const msgs = item.threadMessages ?? [];
  const awaySince = new Date(ctx.awaySince).getTime();
  for (const m of msgs) {
    if (new Date(m.sentAt).getTime() < awaySince) continue;
    const body = (m.bodyText ?? '').toLowerCase();
    if (RESOLVED_PHRASES.some((p) => new RegExp(`\\b${p}\\b`).test(body))) return true;
  }
  return false;
}
