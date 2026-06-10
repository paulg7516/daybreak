// tests/app/rules-isbulk.test.ts
import { describe, it, expect } from 'vitest';
import { isBulk } from '../../src/app/rules';
import type { DaybreakItem } from '../../src/model/item';

function item(over: Partial<DaybreakItem>): DaybreakItem {
  return { id: 'x', source: 'email_vendor', subject: 's', from: 'a@vendor.com', receivedAt: '2026-05-30T10:00:00.000Z', ...over };
}

describe('isBulk', () => {
  it('flags messages with a List-Unsubscribe header', () => {
    expect(isBulk(item({ internetHeaders: { 'List-Unsubscribe': '<mailto:u@vendor.com>' } }))).toBe(true);
  });
  it('flags Precedence: bulk and Auto-Submitted', () => {
    expect(isBulk(item({ internetHeaders: { Precedence: 'bulk' } }))).toBe(true);
    expect(isBulk(item({ internetHeaders: { 'Auto-Submitted': 'auto-generated' } }))).toBe(true);
  });
  it('flags no-reply style senders', () => {
    expect(isBulk(item({ from: 'no-reply@service.com' }))).toBe(true);
    expect(isBulk(item({ from: 'noreply@service.com' }))).toBe(true);
    expect(isBulk(item({ from: 'notifications@service.com' }))).toBe(true);
  });
  it('does not flag a normal person', () => {
    expect(isBulk(item({ from: 'jane@company.com', internetHeaders: {} }))).toBe(false);
  });
});
