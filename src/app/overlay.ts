// src/app/overlay.ts
import type { Lane, ScoredItem } from '../model/item';
import type { Rule } from './rules';

export interface Overlay {
  awayWindow: { since: string; setAt: string } | null;
  cleared: Record<string, true>;
  rerank: Record<string, Lane>;
  rules: Rule[];
  bulkExcludeEnabled: boolean;
  forcedInclude: Record<string, Lane>; // one-off promotes out of Set-aside, keyed by item id
  jira: { baseUrl: string; email: string } | null;
}

export function emptyOverlay(): Overlay {
  return { awayWindow: null, cleared: {}, rerank: {}, rules: [], bulkExcludeEnabled: true, forcedInclude: {}, jira: null };
}

export function setJiraConfig(o: Overlay, baseUrl: string, email: string): Overlay {
  return { ...o, jira: { baseUrl: baseUrl.trim().replace(/\/$/, ''), email: email.trim() } };
}

export function setAwayWindow(o: Overlay, sinceISO: string, nowISO: string): Overlay {
  return { ...o, awayWindow: { since: sinceISO, setAt: nowISO } };
}

export function clearItem(o: Overlay, id: string): Overlay {
  return { ...o, cleared: { ...o.cleared, [id]: true } };
}

export function unclearItem(o: Overlay, id: string): Overlay {
  const cleared = { ...o.cleared };
  delete cleared[id];
  return { ...o, cleared };
}

export function rerankItem(o: Overlay, id: string, lane: Lane): Overlay {
  return { ...o, rerank: { ...o.rerank, [id]: lane } };
}

// An overlaid item carries its effective lane (after a possible re-rank override)
// and whether that lane came from a manual correction.
export interface OverlaidItem {
  scored: ScoredItem;
  lane: Lane;
  reranked: boolean;
}

export function applyOverlay(scored: ScoredItem[], overlay: Overlay): OverlaidItem[] {
  const out: OverlaidItem[] = [];
  for (const s of scored) {
    const id = s.item.id;
    if (overlay.cleared[id]) continue;
    const override = overlay.rerank[id];
    out.push({
      scored: s,
      lane: override ?? s.lane,
      reranked: override !== undefined && override !== s.lane,
    });
  }
  return out;
}
