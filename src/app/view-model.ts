// src/app/view-model.ts
import type { Lane, SenderTag, Source } from '../model/item';
import type { Summary } from '../summary/summary';
import { parseSenderTag } from '../scoring/sender-tag';
import type { OverlaidItem } from './overlay';

export interface ScoredItemView {
  id: string;
  subject: string;
  from: string;
  receivedAt: string;
  reasons: string[];
  resolved: boolean;
  senderTag?: SenderTag;
  webLink?: string;
  lane: Lane;
  reranked: boolean;
}

export interface SourceGroupView {
  source: Source;
  items: ScoredItemView[];
}

export interface LaneView {
  lane: Lane;
  total: number;
  groups: SourceGroupView[];
}

export interface TriageView {
  me: string;
  awaySince: string;
  summary: Summary;
  lanes: Record<Lane, LaneView>;
  clearedCount: number;
}

export interface ViewMeta {
  me: string;
  awaySince: string;
  clearedCount?: number;
}

const LANES: Lane[] = ['today', 'this_week', 'fyi'];
const SOURCE_ORDER: Source[] = ['jsm', 'email_internal', 'email_vendor'];

function toRow(o: OverlaidItem): ScoredItemView {
  const it = o.scored.item;
  const tag = parseSenderTag(it.internetHeaders);
  return {
    id: it.id,
    subject: it.subject,
    from: it.from,
    receivedAt: it.receivedAt,
    reasons: o.scored.reasons,
    resolved: o.scored.resolved,
    senderTag: tag?.tag,
    webLink: it.webLink,
    lane: o.lane,
    reranked: o.reranked,
  };
}

function buildLane(lane: Lane, items: OverlaidItem[]): LaneView {
  const inLane = items.filter((o) => o.lane === lane);
  const groups: SourceGroupView[] = [];
  for (const source of SOURCE_ORDER) {
    const rows = inLane
      .filter((o) => o.scored.item.source === source)
      .sort((a, b) => b.scored.rank - a.scored.rank)
      .map(toRow);
    if (rows.length > 0) groups.push({ source, items: rows });
  }
  return { lane, total: inLane.length, groups };
}

export function buildTriageView(items: OverlaidItem[], summary: Summary, meta: ViewMeta): TriageView {
  const lanes = {} as Record<Lane, LaneView>;
  for (const lane of LANES) lanes[lane] = buildLane(lane, items);
  return {
    me: meta.me,
    awaySince: meta.awaySince,
    summary,
    lanes,
    clearedCount: meta.clearedCount ?? 0,
  };
}
