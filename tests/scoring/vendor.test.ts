// tests/scoring/vendor.test.ts
import { describe, it, expect } from 'vitest';
import { scoreVendor } from '../../src/scoring/vendor';
import type { DaybreakItem } from '../../src/model/item';

function vendor(subject: string, body = ''): DaybreakItem {
  return {
    id: 'v1', source: 'email_vendor', subject, from: 'noreply@vendor.com',
    receivedAt: '2026-05-30T10:00:00.000Z', bodyText: body,
  };
}

describe('scoreVendor', () => {
  it('security advisory -> today', () => {
    const s = scoreVendor(vendor('Critical security advisory: CVE-2026-1234'));
    expect(s.lane).toBe('today');
  });

  it('renewal/expiry -> this_week', () => {
    const s = scoreVendor(vendor('Your license expires soon', 'Renew by end of month.'));
    expect(s.lane).toBe('this_week');
  });

  it('invoice -> this_week', () => {
    const s = scoreVendor(vendor('Invoice #5567', 'Payment due in 14 days.'));
    expect(s.lane).toBe('this_week');
  });

  it('plain marketing -> fyi', () => {
    const s = scoreVendor(vendor('Check out our new features!'));
    expect(s.lane).toBe('fyi');
  });
});
