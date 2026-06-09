// src/scoring/jsm.ts
import type { JsmFields, Lane } from '../model/item';

export interface JsmSignal {
  lane: Lane;
  rank: number;
  reasons: string[];
  resolved: boolean;
}

export function scoreJsm(jsm: JsmFields, me: string): JsmSignal {
  const state = (jsm.state ?? '').toLowerCase();
  const closed = state === 'resolved' || state === 'closed' || state === 'done';
  if (closed) {
    return { lane: 'fyi', rank: 10, reasons: ['ticket already resolved/closed'], resolved: true };
  }

  const assignedToMe = !!jsm.assignee && jsm.assignee.toLowerCase() === me.toLowerCase();
  const reasons: string[] = [assignedToMe ? 'assigned to you' : 'you were notified (not assignee)'];

  if (!assignedToMe) {
    return { lane: 'fyi', rank: 20, reasons, resolved: false };
  }

  const p1 = jsm.priority === 'P1';
  const slaBad = jsm.slaStatus === 'breached' || jsm.slaStatus === 'at_risk';
  if (p1 || slaBad) {
    if (p1) reasons.push('priority P1');
    if (slaBad) reasons.push(`SLA ${jsm.slaStatus}`);
    return { lane: 'today', rank: 95, reasons, resolved: false };
  }

  if (jsm.priority === 'P2' || jsm.priority === 'P3') {
    reasons.push(`priority ${jsm.priority}`);
    return { lane: 'this_week', rank: 60, reasons, resolved: false };
  }

  return { lane: 'this_week', rank: 40, reasons, resolved: false };
}
