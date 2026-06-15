// src/app/overlay.ts
import type { Lane, TriagedItem } from '../model/item';
import { defaultLaneConfig, type LaneSetting } from './lane-config';

// Persisted recipient-side state. No rules / bulk / forced-include any more - the
// sender decides what enters, so the recipient only keeps corrections (cleared,
// re-rank), the catch-up boundary, lane display config, and the Jira connection.
export interface Overlay {
  awayWindow: { since: string; setAt: string } | null;
  lastOpenedAt: string | null; // for the "catch up since" default
  cleared: Record<string, true>;
  rerank: Record<string, Lane>;
  laneConfig: LaneSetting[]; // per-user lane order/labels/visibility
  jira: { baseUrl: string; email: string } | null;
}

export function emptyOverlay(): Overlay {
  return { awayWindow: null, lastOpenedAt: null, cleared: {}, rerank: {}, laneConfig: defaultLaneConfig(), jira: null };
}

export function setLaneConfig(o: Overlay, laneConfig: LaneSetting[]): Overlay {
  return { ...o, laneConfig };
}

export function setJiraConfig(o: Overlay, baseUrl: string, email: string): Overlay {
  return { ...o, jira: { baseUrl: baseUrl.trim().replace(/\/$/, ''), email: email.trim() } };
}

export function setAwayWindow(o: Overlay, sinceISO: string, nowISO: string): Overlay {
  return { ...o, awayWindow: { since: sinceISO, setAt: nowISO } };
}

export function setLastOpenedAt(o: Overlay, nowISO: string): Overlay {
  return { ...o, lastOpenedAt: nowISO };
}

export function clearAwayWindow(o: Overlay): Overlay {
  return { ...o, awayWindow: null };
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
  triaged: TriagedItem;
  lane: Lane;
  reranked: boolean;
}

export function applyOverlay(triaged: TriagedItem[], overlay: Overlay): OverlaidItem[] {
  const out: OverlaidItem[] = [];
  for (const t of triaged) {
    const id = t.item.id;
    if (overlay.cleared[id]) continue;
    const override = overlay.rerank[id];
    out.push({
      triaged: t,
      lane: override ?? t.lane,
      reranked: override !== undefined && override !== t.lane,
    });
  }
  return out;
}
