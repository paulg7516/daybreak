// src/summary/summary.ts
import type { ScoredItem } from '../model/item';

export interface Summary {
  needsTodayCount: number;
  thisWeekCount: number;
  fyiCount: number;
  slaAtRiskCount: number;
  resolvedWhileAwayCount: number;
}

export function buildSummary(scored: ScoredItem[]): Summary {
  return {
    needsTodayCount: scored.filter((s) => s.lane === 'today').length,
    thisWeekCount: scored.filter((s) => s.lane === 'this_week').length,
    fyiCount: scored.filter((s) => s.lane === 'fyi').length,
    slaAtRiskCount: scored.filter(
      (s) => s.item.jsm && (s.item.jsm.slaStatus === 'breached' || s.item.jsm.slaStatus === 'at_risk'),
    ).length,
    resolvedWhileAwayCount: scored.filter((s) => s.resolved).length,
  };
}
