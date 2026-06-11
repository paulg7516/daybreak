// src/app/lane-config.ts
// Per-user lane display config: order, custom labels, and visibility. The lane id
// (= the sender's declared intent) is fixed; this only changes how lanes are shown.
// Leaf module - imports only the model, so the overlay and view-model can both use
// it without an import cycle.
import { LANE_LABELS, LANE_ORDER, type Lane } from '../model/item';

export interface LaneSetting {
  lane: Lane;
  label: string;
  visible: boolean;
}

export function defaultLaneConfig(): LaneSetting[] {
  return LANE_ORDER.map((lane) => ({ lane, label: LANE_LABELS[lane], visible: true }));
}

// Reconcile a possibly stale/partial stored config with the known lanes: every lane
// appears exactly once, stored order first, missing lanes appended, unknown/dupes
// dropped, blank labels filled from the defaults.
export function normalizeLaneConfig(config: LaneSetting[] | undefined): LaneSetting[] {
  if (!config || config.length === 0) return defaultLaneConfig();
  const seen = new Set<Lane>();
  const out: LaneSetting[] = [];
  for (const c of config) {
    if (LANE_ORDER.includes(c.lane) && !seen.has(c.lane)) {
      out.push({ lane: c.lane, label: c.label || LANE_LABELS[c.lane], visible: c.visible !== false });
      seen.add(c.lane);
    }
  }
  for (const lane of LANE_ORDER) {
    if (!seen.has(lane)) out.push({ lane, label: LANE_LABELS[lane], visible: true });
  }
  return out;
}
