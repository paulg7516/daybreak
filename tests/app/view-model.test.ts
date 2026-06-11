// tests/app/view-model.test.ts
import { describe, it, expect } from 'vitest';
import { buildTriageView, applyLaneConfig } from '../../src/app/view-model';
import { buildSummary } from '../../src/summary/summary';
import type { OverlaidItem } from '../../src/app/overlay';
import type { Lane, Urgency } from '../../src/model/item';

function o(id: string, lane: Lane, urgency: Urgency, receivedAt = '2026-06-10T10:00:00Z'): OverlaidItem {
  return {
    triaged: {
      item: { id, source: 'email_internal', subject: id, from: 'a@co.com', receivedAt },
      lane,
      urgency,
      reasons: [],
    },
    lane,
    reranked: false,
  };
}

const meta = { me: 'me@co.com', since: '2026-06-01T00:00:00Z' };

describe('buildTriageView', () => {
  it('returns lanes in canonical order with totals', () => {
    const items = [o('a', 'respond', 'none'), o('b', 'fyi', 'none'), o('c', 'approve', 'none')];
    const view = buildTriageView(items, buildSummary(items), meta);
    expect(view.lanes.map((l) => l.lane)).toEqual(['respond', 'approve', 'review', 'fyi']);
    expect(view.lanes.find((l) => l.lane === 'respond')!.total).toBe(1);
    expect(view.lanes.find((l) => l.lane === 'review')!.total).toBe(0);
  });

  it('sorts items within a lane by urgency then recency', () => {
    const items = [
      o('none1', 'respond', 'none', '2026-06-10T10:00:00Z'),
      o('overdue1', 'respond', 'overdue', '2026-06-09T10:00:00Z'),
      o('today1', 'respond', 'today', '2026-06-08T10:00:00Z'),
    ];
    const view = buildTriageView(items, buildSummary(items), meta);
    expect(view.lanes.find((l) => l.lane === 'respond')!.items.map((i) => i.id)).toEqual([
      'overdue1',
      'today1',
      'none1',
    ]);
  });

  it('carries the urgency badge onto each row', () => {
    const items = [o('x', 'approve', 'overdue')];
    const view = buildTriageView(items, buildSummary(items), meta);
    expect(view.lanes.find((l) => l.lane === 'approve')!.items[0].urgency).toBe('overdue');
  });
});

describe('applyLaneConfig', () => {
  const items = [o('a', 'respond', 'none'), o('b', 'fyi', 'none')];
  const lanes = buildTriageView(items, buildSummary(items), meta).lanes;

  it('reorders, relabels, and hides lanes per the config', () => {
    const out = applyLaneConfig(lanes, [
      { lane: 'fyi', label: 'Skim', visible: true },
      { lane: 'respond', label: 'Reply now', visible: true },
      { lane: 'approve', label: 'Approve', visible: false },
      { lane: 'review', label: 'Review', visible: false },
    ]);
    expect(out.map((c) => [c.lane, c.label])).toEqual([
      ['fyi', 'Skim'],
      ['respond', 'Reply now'],
    ]);
    expect(out[1].items.map((i) => i.id)).toEqual(['a']);
  });

  it('falls back to all visible lanes for an empty config', () => {
    expect(applyLaneConfig(lanes, []).map((c) => c.lane)).toEqual(['respond', 'approve', 'review', 'fyi']);
  });
});
