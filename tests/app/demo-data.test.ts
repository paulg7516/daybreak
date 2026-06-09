// tests/app/demo-data.test.ts
import { describe, it, expect } from 'vitest';
import { DEMO_ME, demoItems } from '../../src/app/demo-data';
import { scoreAll } from '../../src/scoring/score';
import { buildSummary } from '../../src/summary/summary';
import { applyOverlay, emptyOverlay } from '../../src/app/overlay';
import { buildTriageView } from '../../src/app/view-model';

const now = '2026-06-09T08:00:00.000Z';
const awaySince = '2026-05-26T00:00:00.000Z';

describe('demo data', () => {
  it('produces several items all received within the away window', () => {
    const items = demoItems(now);
    expect(items.length).toBeGreaterThanOrEqual(6);
    for (const it of items) {
      expect(Date.parse(it.receivedAt)).toBeGreaterThan(Date.parse(awaySince));
      expect(Date.parse(it.receivedAt)).toBeLessThanOrEqual(Date.parse(now));
    }
  });

  it('flows through the real scorer into a populated triage view across lanes and sources', () => {
    const items = demoItems(now);
    const scored = scoreAll(items, { me: DEMO_ME, awaySince, now });
    expect(scored.length).toBe(items.length);

    const view = buildTriageView(
      applyOverlay(scored, emptyOverlay()),
      buildSummary(scored),
      { me: DEMO_ME, awaySince },
    );

    // Every item lands in exactly one lane (nothing dropped).
    const laneTotal = view.lanes.today.total + view.lanes.this_week.total + view.lanes.fyi.total;
    expect(laneTotal).toBe(items.length);

    // The "Needs you today" lane is not empty (P1 ticket + blocked tag belong there).
    expect(view.lanes.today.total).toBeGreaterThan(0);

    // At least two distinct sources are represented (system + email).
    const sources = new Set(
      [view.lanes.today, view.lanes.this_week, view.lanes.fyi].flatMap((l) => l.groups.map((g) => g.source)),
    );
    expect(sources.size).toBeGreaterThanOrEqual(2);

    // At least one item resolved while away (the "nvm, sorted" reply thread).
    expect(view.summary.resolvedWhileAwayCount).toBeGreaterThan(0);

    // At least one sender-tag badge is present somewhere.
    const hasTag = [view.lanes.today, view.lanes.this_week, view.lanes.fyi]
      .flatMap((l) => l.groups)
      .flatMap((g) => g.items)
      .some((i) => i.senderTag !== undefined);
    expect(hasTag).toBe(true);
  });
});
