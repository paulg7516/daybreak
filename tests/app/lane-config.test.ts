// tests/app/lane-config.test.ts
import { describe, it, expect } from 'vitest';
import { defaultLaneConfig, normalizeLaneConfig } from '../../src/app/lane-config';

describe('lane config', () => {
  it('defaults to all four lanes, in order, visible, default labels', () => {
    expect(defaultLaneConfig()).toEqual([
      { lane: 'respond', label: 'Needs your reply', visible: true },
      { lane: 'approve', label: 'Needs your decision', visible: true },
      { lane: 'review', label: 'Needs your review', visible: true },
      { lane: 'fyi', label: 'FYI', visible: true },
    ]);
  });

  it('falls back to defaults for empty/undefined config', () => {
    expect(normalizeLaneConfig(undefined)).toEqual(defaultLaneConfig());
    expect(normalizeLaneConfig([])).toEqual(defaultLaneConfig());
  });

  it('preserves the stored order and appends any missing lanes', () => {
    const stored = [
      { lane: 'fyi' as const, label: 'Skim', visible: false },
      { lane: 'respond' as const, label: 'Reply now', visible: true },
    ];
    const out = normalizeLaneConfig(stored);
    expect(out.map((c) => c.lane)).toEqual(['fyi', 'respond', 'approve', 'review']);
    expect(out[0]).toEqual({ lane: 'fyi', label: 'Skim', visible: false });
    expect(out[1].label).toBe('Reply now');
  });

  it('drops unknown lanes and de-dupes', () => {
    const stored = [
      { lane: 'respond' as const, label: 'A', visible: true },
      { lane: 'respond' as const, label: 'dup', visible: false },
      { lane: 'bogus' as unknown as 'fyi', label: 'x', visible: true },
    ];
    const out = normalizeLaneConfig(stored);
    expect(out.filter((c) => c.lane === 'respond')).toHaveLength(1);
    expect(out.map((c) => c.lane).sort()).toEqual(['approve', 'fyi', 'respond', 'review']);
  });
});
