// tests/app/since.test.ts
import { describe, it, expect } from 'vitest';
import { resolveCatchUpSince } from '../../src/app/since';
import { emptyOverlay, setAwayWindow, setLastOpenedAt } from '../../src/app/overlay';

const NOW = '2026-06-11T12:00:00.000Z';
const ONE_YEAR_AGO = '2025-06-11T12:00:00.000Z';

describe('resolveCatchUpSince', () => {
  it('prefers an explicit date filter when set', () => {
    const o = setAwayWindow(emptyOverlay(), '2026-05-20T00:00:00.000Z', NOW);
    expect(resolveCatchUpSince(o, NOW)).toBe('2026-05-20T00:00:00.000Z');
  });

  it('defaults to a one-year fetch window when there is no filter', () => {
    expect(resolveCatchUpSince(emptyOverlay(), NOW)).toBe(ONE_YEAR_AGO);
  });

  it('ignores last-opened (the board shows everything open by default now)', () => {
    const o = setLastOpenedAt(emptyOverlay(), '2026-06-10T08:00:00.000Z');
    expect(resolveCatchUpSince(o, NOW)).toBe(ONE_YEAR_AGO);
  });
});
