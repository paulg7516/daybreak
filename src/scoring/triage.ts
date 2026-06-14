// src/scoring/triage.ts
import { LANE_ORDER, type DaybreakItem, type JsmFields, type Lane, type TriageContext, type TriagedItem, type Urgency } from '../model/item';
import { parseDeclaredIntent } from './sender-tag';
import { urgencyFor } from './urgency';

const URGENCY_RANK: Record<Urgency, number> = { overdue: 3, today: 2, this_week: 1, none: 0 };

function jsmUrgency(jsm: JsmFields): Urgency {
  if (jsm.slaStatus === 'breached') return 'overdue';
  if (jsm.slaStatus === 'at_risk') return 'today';
  if (jsm.priority === 'P1') return 'today';
  if (jsm.priority === 'P2') return 'this_week';
  return 'none';
}

// JSM tickets carry declared structure (assignee, state, SLA). Only open tickets
// assigned to me are actionable; everything else is dropped (no inference).
function triageJsm(item: DaybreakItem, ctx: TriageContext): TriagedItem | null {
  const jsm = item.jsm;
  if (!jsm) return null;
  const state = (jsm.state ?? '').toLowerCase();
  const closed = state === 'resolved' || state === 'closed' || state === 'done';
  const mine = !!jsm.assignee && jsm.assignee.toLowerCase() === ctx.me.toLowerCase();
  if (closed || !mine) return null;

  const urgency = jsmUrgency(jsm);
  const reasons = ['assigned ticket'];
  if (jsm.priority) reasons.push(`priority ${jsm.priority}`);
  if (jsm.slaStatus === 'breached' || jsm.slaStatus === 'at_risk') reasons.push(`SLA ${jsm.slaStatus}`);
  return { item, lane: 'respond', urgency, reasons };
}

// Triage one item to its declared lane, or null if it should not appear on the
// board (untagged email, closed/unassigned ticket).
export function triageItem(item: DaybreakItem, ctx: TriageContext): TriagedItem | null {
  if (item.source === 'jsm') return triageJsm(item, ctx);

  const intent = parseDeclaredIntent(item.internetHeaders);
  if (!intent) return null; // untagged email never enters the board

  const urgency = urgencyFor(intent.deadline, new Date(ctx.now));
  const reasons = [`sender: ${intent.lane}`];
  if (intent.deadline) reasons.push(`due ${intent.deadline}`);
  return { item, lane: intent.lane, urgency, deadline: intent.deadline, reasons };
}

function laneRank(l: Lane): number {
  return LANE_ORDER.length - LANE_ORDER.indexOf(l);
}

// Triage all items, dropping the non-actionable ones, sorted by lane, then urgency,
// then most-recent first.
export function triageAll(items: DaybreakItem[], ctx: TriageContext): TriagedItem[] {
  return items
    .map((i) => triageItem(i, ctx))
    .filter((t): t is TriagedItem => t !== null)
    .sort(
      (a, b) =>
        laneRank(b.lane) - laneRank(a.lane) ||
        URGENCY_RANK[b.urgency] - URGENCY_RANK[a.urgency] ||
        new Date(b.item.receivedAt).getTime() - new Date(a.item.receivedAt).getTime(),
    );
}
