// src/app/since.ts
import type { Overlay } from './overlay';

// The default board shows everything still open. There is no date filter by
// default, so this resolves the *fetch* boundary: a generous one-year window
// (the validateAwayWindow cap), unless the user set an explicit date filter.
const DEFAULT_LOOKBACK_DAYS = 365;

export function resolveCatchUpSince(overlay: Overlay, nowISO: string): string {
  if (overlay.awayWindow?.since) return overlay.awayWindow.since;
  return new Date(Date.parse(nowISO) - DEFAULT_LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString();
}
