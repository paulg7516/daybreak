// src/scoring/score.ts
import type { ReentryItem, ScoringContext, ScoredItem, Lane } from '../model/item';
import { scoreJsm } from './jsm';
import { scoreEmail } from './email';
import { scoreVendor } from './vendor';
import { parseSenderTag, type ParsedTag } from './sender-tag';
import { extractDeadline } from './deadline';
import { isResolvedWhileAway } from './resolved';

function laneRankOrder(l: Lane): number {
  return l === 'today' ? 3 : l === 'this_week' ? 2 : 1;
}

function laneForDeadline(deadline: Date, now: Date): Lane {
  const day = 24 * 60 * 60 * 1000;
  const ms = deadline.getTime() - now.getTime();
  if (ms <= day) return 'today';
  if (ms <= 7 * day) return 'this_week';
  return 'fyi';
}

function applyTag(tag: ParsedTag, now: Date): { lane: Lane; rank: number; reasons: string[] } {
  switch (tag.tag) {
    case 'blocked':
      return { lane: 'today', rank: 90, reasons: ['sender is blocked, waiting on you'] };
    case 'action': {
      if (tag.by) {
        const by = new Date(`${tag.by}T17:00:00`);
        if (!Number.isNaN(by.getTime())) {
          const lane = laneForDeadline(by, now);
          return { lane, rank: lane === 'today' ? 80 : 55, reasons: [`sender: action by ${tag.by}`] };
        }
      }
      return { lane: 'this_week', rank: 55, reasons: ['sender: action needed'] };
    }
    case 'whenever':
      return { lane: 'this_week', rank: 25, reasons: ['sender: whenever you get to it'] };
    case 'fyi':
      return { lane: 'fyi', rank: 10, reasons: ['sender: FYI, no reply needed'] };
  }
}

export function scoreItem(item: ReentryItem, ctx: ScoringContext): ScoredItem {
  const now = new Date(ctx.now);
  let lane: Lane;
  let rank: number;
  let reasons: string[];
  let resolved = false;

  if (item.source === 'jsm' && item.jsm) {
    const s = scoreJsm(item.jsm, ctx.me);
    ({ lane, rank, reasons, resolved } = s);
  } else if (item.source === 'email_vendor') {
    const s = scoreVendor(item);
    ({ lane, rank, reasons } = s);
  } else {
    const tag = parseSenderTag(item.internetHeaders);
    if (tag) {
      const s = applyTag(tag, now);
      ({ lane, rank, reasons } = s);
    } else {
      const s = scoreEmail(item, ctx);
      ({ lane, rank, reasons } = s);
    }
    const dl = extractDeadline(item.bodyText ?? '', now);
    if (dl) {
      const promoted = laneForDeadline(dl, now);
      if (laneRankOrder(promoted) > laneRankOrder(lane)) {
        lane = promoted;
        rank = Math.max(rank, promoted === 'today' ? 85 : 50);
        reasons = [...reasons, `deadline ${dl.toISOString().slice(0, 10)}`];
      }
    }
  }

  // recipient view wins: a thread resolved while away drops to fyi regardless of any tag
  if (item.source !== 'jsm' && isResolvedWhileAway(item, ctx)) {
    return { item, lane: 'fyi', rank: 5, reasons: ['resolved while you were out'], resolved: true };
  }

  return { item, lane, rank, reasons, resolved };
}

export function scoreAll(items: ReentryItem[], ctx: ScoringContext): ScoredItem[] {
  return items
    .map((i) => scoreItem(i, ctx))
    .sort((a, b) => laneRankOrder(b.lane) - laneRankOrder(a.lane) || b.rank - a.rank);
}
