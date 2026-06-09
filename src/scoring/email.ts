// src/scoring/email.ts
import type { ReentryItem, ScoringContext, Lane } from '../model/item';

export interface EmailSignal {
  lane: Lane;
  rank: number;
  reasons: string[];
}

const ASK_PHRASES = [
  'can you', 'could you', 'would you', 'please', 'need your', 'your sign',
  'sign off', 'sign-off', 'approve', 'review', 'let me know', 'your input',
  'your feedback', 'waiting on you', 'blocked on you', 'action required',
];

function clamp(n: number): number {
  return Math.max(0, Math.min(100, n));
}

export function scoreEmail(item: ReentryItem, ctx: ScoringContext): EmailSignal {
  const me = ctx.me.toLowerCase();
  const to = (item.toRecipients ?? []).map((s) => s.toLowerCase());
  const cc = (item.ccRecipients ?? []).map((s) => s.toLowerCase());
  const from = item.from.toLowerCase();
  const reasons: string[] = [];
  let rank = 30;

  const directTo = to.includes(me);
  const soleTo = directTo && to.length === 1;
  const ccOnly = !directTo && cc.includes(me);
  if (soleTo) { rank += 25; reasons.push('addressed only to you'); }
  else if (directTo) { rank += 15; reasons.push('on the To line'); }
  else if (ccOnly) { rank -= 20; reasons.push("you are only cc'd"); }

  const body = (item.bodyText ?? '').toLowerCase();
  const hasAsk = ASK_PHRASES.some((p) => new RegExp(`\\b${p}\\b`).test(body));
  const hasQuestion = body.includes('?');
  if (hasAsk || (hasQuestion && directTo)) { rank += 20; reasons.push('contains a direct request'); }

  const managers = (ctx.managers ?? []).map((s) => s.toLowerCase());
  const reports = (ctx.reports ?? []).map((s) => s.toLowerCase());
  const frequent = (ctx.frequentContacts ?? []).map((s) => s.toLowerCase());
  if (managers.includes(from)) { rank += 20; reasons.push('from your manager'); }
  else if (reports.includes(from)) { rank += 10; reasons.push('from your report'); }
  else if (frequent.includes(from)) { rank += 5; reasons.push('frequent correspondent'); }

  let lane: Lane;
  if (rank >= 60) lane = 'today';
  else if (rank >= 25) lane = 'this_week';
  else lane = 'fyi';

  return { lane, rank: clamp(rank), reasons };
}
