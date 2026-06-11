// src/app/view-model.ts
import { LANE_ORDER, type Lane, type Source, type Urgency } from '../model/item';
import type { Summary } from '../summary/summary';
import type { OverlaidItem } from './overlay';
import { normalizeLaneConfig, type LaneSetting } from './lane-config';

// A flat, renderable row. The renderer can re-group these by lane (default),
// sender, or source, so the view model keeps them flat with the fields needed for
// any grouping plus the urgency badge.
export interface TriageRow {
  id: string;
  subject: string;
  from: string;
  receivedAt: string;
  lane: Lane;
  urgency: Urgency;
  deadline?: string;
  reasons: string[];
  source: Source;
  webLink?: string;
  reranked: boolean;
}

export interface LaneView {
  lane: Lane;
  total: number;
  items: TriageRow[];
}

export interface TriageView {
  me: string;
  since: string;
  summary: Summary;
  lanes: LaneView[]; // ordered by LANE_ORDER
  clearedCount: number;
}

export interface ViewMeta {
  me: string;
  since: string;
  clearedCount?: number;
}

const URGENCY_RANK: Record<Urgency, number> = { overdue: 3, today: 2, this_week: 1, none: 0 };

function toRow(o: OverlaidItem): TriageRow {
  const t = o.triaged;
  return {
    id: t.item.id,
    subject: t.item.subject,
    from: t.item.from,
    receivedAt: t.item.receivedAt,
    lane: o.lane,
    urgency: t.urgency,
    deadline: t.deadline,
    reasons: t.reasons,
    source: t.item.source,
    webLink: t.item.webLink,
    reranked: o.reranked,
  };
}

function buildLane(lane: Lane, items: OverlaidItem[]): LaneView {
  const rows = items
    .filter((o) => o.lane === lane)
    .map(toRow)
    .sort(
      (a, b) =>
        URGENCY_RANK[b.urgency] - URGENCY_RANK[a.urgency] ||
        new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime(),
    );
  return { lane, total: rows.length, items: rows };
}

export function buildTriageView(items: OverlaidItem[], summary: Summary, meta: ViewMeta): TriageView {
  return {
    me: meta.me,
    since: meta.since,
    summary,
    lanes: LANE_ORDER.map((lane) => buildLane(lane, items)),
    clearedCount: meta.clearedCount ?? 0,
  };
}

// A lane after the user's display config is applied (renamed, reordered, hidden).
export interface ConfiguredLane {
  lane: Lane;
  label: string;
  total: number;
  items: TriageRow[];
}

// Reorder/relabel/filter the view's lanes per the user's lane config. Hidden lanes
// are dropped from the result (their items simply are not shown).
export function applyLaneConfig(lanes: LaneView[], config: LaneSetting[] | undefined): ConfiguredLane[] {
  const byLane = new Map(lanes.map((l) => [l.lane, l]));
  return normalizeLaneConfig(config)
    .filter((c) => c.visible)
    .map((c) => {
      const lv = byLane.get(c.lane);
      return { lane: c.lane, label: c.label, total: lv?.total ?? 0, items: lv?.items ?? [] };
    });
}
