// tests/app/demo-data.test.ts
import { describe, it, expect } from 'vitest';
import { DEMO_ME, demoItems } from '../../src/app/demo-data';
import { triageAll } from '../../src/scoring/triage';
import { applyOverlay, emptyOverlay } from '../../src/app/overlay';
import { buildTriageView } from '../../src/app/view-model';
import { buildSummary } from '../../src/summary/summary';

const NOW = '2026-06-11T12:00:00.000Z';

describe('demo backlog', () => {
  it('triages every demo item into a lane (all are tagged or JSM)', () => {
    const triaged = triageAll(demoItems(NOW), { me: DEMO_ME, since: NOW, now: NOW });
    expect(triaged.length).toBe(demoItems(NOW).length);
  });

  it('populates all four lanes', () => {
    const triaged = triageAll(demoItems(NOW), { me: DEMO_ME, since: NOW, now: NOW });
    const overlaid = applyOverlay(triaged, emptyOverlay());
    const view = buildTriageView(overlaid, buildSummary(overlaid), { me: DEMO_ME, since: NOW });
    const byLane = Object.fromEntries(view.lanes.map((l) => [l.lane, l.total]));
    expect(byLane.respond).toBeGreaterThan(0);
    expect(byLane.approve).toBeGreaterThan(0);
    expect(byLane.review).toBeGreaterThan(0);
    expect(byLane.fyi).toBeGreaterThan(0);
  });

  it('surfaces overdue urgency in the summary', () => {
    const triaged = triageAll(demoItems(NOW), { me: DEMO_ME, since: NOW, now: NOW });
    const overlaid = applyOverlay(triaged, emptyOverlay());
    expect(buildSummary(overlaid).overdue).toBeGreaterThan(0);
  });
});
