// src/app/rules.ts
import type { DaybreakItem, Lane } from '../model/item';
import { parseSenderTag } from '../scoring/sender-tag';
import type { Overlay } from './overlay';

export type RuleField = 'from' | 'from-domain';

export interface Rule {
  id: string;
  field: RuleField;
  value: string;                  // address or domain, compared case-insensitively
  action: 'include' | 'exclude';
  lane: Lane | null;              // include only: pin a lane, or null to let the scorer decide
}

export function addRule(o: Overlay, rule: Rule): Overlay {
  return { ...o, rules: [...o.rules, rule] };
}

export function removeRule(o: Overlay, id: string): Overlay {
  return { ...o, rules: o.rules.filter((r) => r.id !== id) };
}

export function setBulkExclude(o: Overlay, enabled: boolean): Overlay {
  return { ...o, bulkExcludeEnabled: enabled };
}

export function forceInclude(o: Overlay, id: string, lane: Lane): Overlay {
  return { ...o, forcedInclude: { ...o.forcedInclude, [id]: lane } };
}

function headerValue(item: DaybreakItem, name: string): string | undefined {
  const headers = item.internetHeaders ?? {};
  const key = Object.keys(headers).find((k) => k.toLowerCase() === name);
  return key ? headers[key] : undefined;
}

const BULK_SENDER = /^(no-?reply|do-?not-?reply|donotreply|notifications?|mailer-daemon|bounce)/i;

// Detects mail that is machine-generated or sent to a list: newsletters, system
// notifications, automated digests. These are the default Set-aside candidates.
export function isBulk(item: DaybreakItem): boolean {
  if (headerValue(item, 'list-unsubscribe') !== undefined) return true;
  if (headerValue(item, 'auto-submitted') !== undefined) return true;
  const prec = headerValue(item, 'precedence')?.toLowerCase();
  if (prec === 'bulk' || prec === 'list' || prec === 'junk') return true;
  const localPart = item.from.split('@')[0] ?? '';
  return BULK_SENDER.test(localPart);
}

export type SetAsideReason = 'rule' | 'automated' | 'unmatched';
export type Inclusion =
  | { kind: 'include'; lane: Lane | null }
  | { kind: 'aside'; reason: SetAsideReason };

function senderDomain(from: string): string {
  const at = from.lastIndexOf('@');
  return at >= 0 ? from.slice(at + 1).toLowerCase() : '';
}

function ruleMatches(item: DaybreakItem, rule: Rule): boolean {
  const from = item.from.toLowerCase();
  if (rule.field === 'from') return from === rule.value.toLowerCase();
  return senderDomain(item.from) === rule.value.toLowerCase();
}

export function classifyItem(item: DaybreakItem, overlay: Overlay): Inclusion {
  const forced = overlay.forcedInclude[item.id];
  if (forced) return { kind: 'include', lane: forced };

  // Tickets/system notifications always flow in; they carry their own priority.
  if (item.source === 'jsm') return { kind: 'include', lane: null };

  // A sender flag is an explicit "put this in your queue"; the scorer reads the
  // X-PTO-Triage header to assign the lane, so leave lane null here.
  if (parseSenderTag(item.internetHeaders)) return { kind: 'include', lane: null };

  const include = overlay.rules.find((r) => r.action === 'include' && ruleMatches(item, r));
  if (include) return { kind: 'include', lane: include.lane };

  const exclude = overlay.rules.find((r) => r.action === 'exclude' && ruleMatches(item, r));
  if (exclude) return { kind: 'aside', reason: 'rule' };

  if (overlay.bulkExcludeEnabled && isBulk(item)) return { kind: 'aside', reason: 'automated' };

  return { kind: 'aside', reason: 'unmatched' };
}
