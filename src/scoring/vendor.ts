// src/scoring/vendor.ts
import type { ReentryItem, Lane } from '../model/item';

export interface VendorSignal {
  lane: Lane;
  rank: number;
  reasons: string[];
}

const SECURITY = ['security advisory', 'vulnerability', 'cve-', 'breach', 'patch now', 'critical update', 'critical security'];
const EXPIRY = ['expires', 'expiring', 'renewal', 'renew by', 'contract end', 'will lapse', 'suspension', 'license expires'];
const INVOICE = ['invoice', 'payment due', 'past due', 'overdue'];

export function scoreVendor(item: ReentryItem): VendorSignal {
  const text = `${item.subject} ${item.bodyText ?? ''}`.toLowerCase();
  if (SECURITY.some((k) => text.includes(k))) {
    return { lane: 'today', rank: 80, reasons: ['vendor security advisory'] };
  }
  if (EXPIRY.some((k) => text.includes(k)) || INVOICE.some((k) => text.includes(k))) {
    return { lane: 'this_week', rank: 55, reasons: ['vendor renewal / invoice / expiry'] };
  }
  return { lane: 'fyi', rank: 15, reasons: ['vendor / automated, no action signal'] };
}
