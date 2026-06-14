// src/scoring/sender-tag.ts
import type { Lane } from '../model/item';

export interface DeclaredIntent {
  lane: Lane;        // the sender's declared action-type, which is the lane
  deadline?: string; // ISO date from a `;by=YYYY-MM-DD` suffix, if present
}

const HEADER = 'x-pto-triage';

// Map a raw X-PTO-Triage tag value to a lane. Accepts the current vocabulary
// (respond/approve/review/fyi) and the legacy expectation axis so any in-flight
// mail tagged by an older add-in still classifies.
const TAG_TO_LANE: Record<string, Lane> = {
  respond: 'respond',
  approve: 'approve',
  review: 'review',
  fyi: 'fyi',
  // legacy aliases
  blocked: 'respond',
  action: 'approve',
  whenever: 'review',
};

// Parse the sender's declared intent from the email headers. Returns null when the
// header is absent or the value is unrecognised - the caller drops untagged mail.
export function parseDeclaredIntent(headers?: Record<string, string>): DeclaredIntent | null {
  if (!headers) return null;
  const key = Object.keys(headers).find((k) => k.toLowerCase() === HEADER);
  if (!key) return null;

  const parts = headers[key].trim().split(';').map((s) => s.trim());
  const lane = TAG_TO_LANE[parts[0].toLowerCase()];
  if (!lane) return null;

  // FYI carries no deadline; for the rest, read an optional `by=` parameter.
  if (lane === 'fyi') return { lane };
  const byParam = parts.slice(1).find((p) => p.toLowerCase().startsWith('by='));
  const deadline = byParam ? byParam.slice(byParam.indexOf('=') + 1).trim() : undefined;
  return deadline ? { lane, deadline } : { lane };
}
