// src/app/since.ts
import type { Overlay } from './overlay';

const DEFAULT_LOOKBACK_DAYS = 7;

// Resolve the "catch up since" boundary without forcing the user to set one:
// an explicit away window wins; otherwise show everything since they last opened
// Daybreak; on a first run, default to a week ago.
export function resolveCatchUpSince(overlay: Overlay, nowISO: string): string {
  if (overlay.awayWindow?.since) return overlay.awayWindow.since;
  if (overlay.lastOpenedAt) return overlay.lastOpenedAt;
  return new Date(Date.parse(nowISO) - DEFAULT_LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString();
}
