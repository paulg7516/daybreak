// tests/app/rules.test.ts
import { describe, it, expect } from 'vitest';
import { addRule, removeRule, setBulkExclude, forceInclude, type Rule } from '../../src/app/rules';
import { emptyOverlay } from '../../src/app/overlay';

const rule: Rule = { id: 'r1', field: 'from-domain', value: 'company.com', action: 'include', lane: 'today' };

describe('rule reducers', () => {
  it('addRule appends without mutating input', () => {
    const base = emptyOverlay();
    const next = addRule(base, rule);
    expect(next.rules).toEqual([rule]);
    expect(base.rules).toEqual([]);
  });

  it('removeRule drops by id', () => {
    const o = addRule(emptyOverlay(), rule);
    expect(removeRule(o, 'r1').rules).toEqual([]);
    expect(removeRule(o, 'nope').rules).toEqual([rule]); // unknown id is a no-op
  });

  it('setBulkExclude toggles the flag', () => {
    expect(setBulkExclude(emptyOverlay(), false).bulkExcludeEnabled).toBe(false);
  });

  it('forceInclude records a one-off promote lane', () => {
    expect(forceInclude(emptyOverlay(), 'm1', 'fyi').forcedInclude).toEqual({ m1: 'fyi' });
  });
});
