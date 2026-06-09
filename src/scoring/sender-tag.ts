// src/scoring/sender-tag.ts
import type { SenderTag } from '../model/item';

export interface ParsedTag {
  tag: SenderTag;
  by?: string; // ISO date string, only meaningful when tag === 'action'
}

const HEADER = 'x-pto-triage';

export function parseSenderTag(headers?: Record<string, string>): ParsedTag | null {
  if (!headers) return null;
  const key = Object.keys(headers).find((k) => k.toLowerCase() === HEADER);
  if (!key) return null;

  const raw = headers[key].trim();
  const parts = raw.split(';').map((s) => s.trim());
  const tag = parts[0].toLowerCase();

  if (tag === 'blocked' || tag === 'whenever' || tag === 'fyi') {
    return { tag };
  }
  if (tag === 'action') {
    const byParam = parts.slice(1).find((p) => p.toLowerCase().startsWith('by='));
    const by = byParam ? byParam.slice(byParam.indexOf('=') + 1).trim() : undefined;
    return { tag: 'action', by };
  }
  return null;
}
