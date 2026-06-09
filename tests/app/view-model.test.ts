// tests/app/view-model.test.ts
import { describe, it, expect } from 'vitest';
import { buildTriageView } from '../../src/app/view-model';
import type { OverlaidItem } from '../../src/app/overlay';
import type { ScoredItem, Source, Lane } from '../../src/model/item';
import type { Summary } from '../../src/summary/summary';

function overlaid(
  id: string,
  source: Source,
  lane: Lane,
  rank: number,
  extra: Partial<ScoredItem['item']> = {},
): OverlaidItem {
  return {
    scored: {
      item: { id, source, subject: id, from: 'a@co.com', receivedAt: '2026-05-30T10:00:00.000Z', ...extra },
      lane,
      rank,
      reasons: ['because'],
      resolved: false,
    },
    lane,
    reranked: false,
  };
}

const summary: Summary = {
  needsTodayCount: 0, thisWeekCount: 0, fyiCount: 0, slaAtRiskCount: 0, resolvedWhileAwayCount: 0,
};

describe('buildTriageView', () => {
  it('groups a lane by source (System, Internal, Vendor) and sorts each group by rank desc', () => {
    const items: OverlaidItem[] = [
      overlaid('v1', 'email_vendor', 'today', 10),
      overlaid('i_low', 'email_internal', 'today', 20),
      overlaid('sys', 'jsm', 'today', 99),
      overlaid('i_high', 'email_internal', 'today', 80),
    ];
    const view = buildTriageView(items, summary, { me: 'me@co.com', awaySince: '2026-05-25T00:00:00.000Z' });
    const today = view.lanes.today;
    expect(today.total).toBe(4);
    expect(today.groups.map((g) => g.source)).toEqual(['jsm', 'email_internal', 'email_vendor']);
    const internal = today.groups.find((g) => g.source === 'email_internal')!;
    expect(internal.items.map((i) => i.id)).toEqual(['i_high', 'i_low']); // rank desc
  });

  it('maps the X-PTO-Triage header to a senderTag and carries reasons/webLink/resolved', () => {
    const items: OverlaidItem[] = [
      overlaid('a', 'email_internal', 'today', 50, {
        internetHeaders: { 'X-PTO-Triage': 'blocked' },
        webLink: 'https://outlook.example/a',
      }),
    ];
    const view = buildTriageView(items, summary, { me: 'me@co.com', awaySince: '2026-05-25T00:00:00.000Z' });
    const row = view.lanes.today.groups[0].items[0];
    expect(row.senderTag).toBe('blocked');
    expect(row.reasons).toEqual(['because']);
    expect(row.webLink).toBe('https://outlook.example/a');
    expect(row.resolved).toBe(false);
  });

  it('counts cleared items and leaves empty lanes empty', () => {
    const view = buildTriageView([], { ...summary }, {
      me: 'me@co.com', awaySince: '2026-05-25T00:00:00.000Z', clearedCount: 3,
    });
    expect(view.lanes.today.total).toBe(0);
    expect(view.lanes.this_week.groups).toEqual([]);
    expect(view.clearedCount).toBe(3);
  });
});
