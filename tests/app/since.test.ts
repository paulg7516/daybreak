// tests/app/since.test.ts
import { describe, it, expect } from 'vitest';
import { resolveCatchUpSince } from '../../src/app/since';
import { emptyOverlay, setAwayWindow, setLastOpenedAt } from '../../src/app/overlay';

const NOW = '2026-06-11T12:00:00.000Z';

describe('resolveCatchUpSince', () => {
  it('prefers an explicit away window when set', () => {
    const o = setAwayWindow(emptyOverlay(), '2026-05-20T00:00:00.000Z', NOW);
    expect(resolveCatchUpSince(o, NOW)).toBe('2026-05-20T00:00:00.000Z');
  });

  it('falls back to last-opened when there is no explicit window', () => {
    const o = setLastOpenedAt(emptyOverlay(), '2026-06-10T08:00:00.000Z');
    expect(resolveCatchUpSince(o, NOW)).toBe('2026-06-10T08:00:00.000Z');
  });

  it('defaults to seven days ago on a first run (no window, no last-opened)', () => {
    expect(resolveCatchUpSince(emptyOverlay(), NOW)).toBe('2026-06-04T12:00:00.000Z');
  });
});
