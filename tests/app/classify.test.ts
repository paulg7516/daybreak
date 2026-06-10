// tests/app/classify.test.ts
import { describe, it, expect } from 'vitest';
import { classifyItem, addRule, setBulkExclude, forceInclude, type Rule } from '../../src/app/rules';
import { emptyOverlay } from '../../src/app/overlay';
import type { DaybreakItem } from '../../src/model/item';

function item(over: Partial<DaybreakItem>): DaybreakItem {
  return { id: 'x', source: 'email_internal', subject: 's', from: 'jane@company.com', receivedAt: '2026-05-30T10:00:00.000Z', ...over };
}

describe('classifyItem', () => {
  it('sets aside unmatched mail by default', () => {
    expect(classifyItem(item({}), emptyOverlay())).toEqual({ kind: 'aside', reason: 'unmatched' });
  });

  it('includes JSM/system items regardless of rules', () => {
    expect(classifyItem(item({ source: 'jsm' }), emptyOverlay())).toEqual({ kind: 'include', lane: null });
  });

  it('includes flagged mail (lane left to the scorer)', () => {
    const flagged = item({ internetHeaders: { 'X-PTO-Triage': 'blocked' } });
    expect(classifyItem(flagged, emptyOverlay())).toEqual({ kind: 'include', lane: null });
  });

  it('includes via an include rule and pins the rule lane', () => {
    const rule: Rule = { id: 'r1', field: 'from-domain', value: 'company.com', action: 'include', lane: 'today' };
    expect(classifyItem(item({}), addRule(emptyOverlay(), rule))).toEqual({ kind: 'include', lane: 'today' });
  });

  it('sets aside via an exclude rule', () => {
    const rule: Rule = { id: 'r2', field: 'from', value: 'jane@company.com', action: 'exclude', lane: null };
    expect(classifyItem(item({}), addRule(emptyOverlay(), rule))).toEqual({ kind: 'aside', reason: 'rule' });
  });

  it('sets aside bulk mail as automated, unless bulk-exclude is off', () => {
    const news = item({ from: 'news@vendor.com', source: 'email_vendor', internetHeaders: { 'List-Unsubscribe': '<x>' } });
    expect(classifyItem(news, emptyOverlay())).toEqual({ kind: 'aside', reason: 'automated' });
    expect(classifyItem(news, setBulkExclude(emptyOverlay(), false))).toEqual({ kind: 'aside', reason: 'unmatched' });
  });

  it('a one-off promote wins over everything', () => {
    const news = item({ id: 'm1', from: 'news@vendor.com', internetHeaders: { 'List-Unsubscribe': '<x>' } });
    expect(classifyItem(news, forceInclude(emptyOverlay(), 'm1', 'fyi'))).toEqual({ kind: 'include', lane: 'fyi' });
  });

  it('an include rule beats an exclude rule on the same item', () => {
    let o = addRule(emptyOverlay(), { id: 'i', field: 'from-domain', value: 'company.com', action: 'include', lane: 'this_week' });
    o = addRule(o, { id: 'e', field: 'from', value: 'jane@company.com', action: 'exclude', lane: null });
    expect(classifyItem(item({}), o)).toEqual({ kind: 'include', lane: 'this_week' });
  });
});
