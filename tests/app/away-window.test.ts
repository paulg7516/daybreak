// tests/app/away-window.test.ts
import { describe, it, expect } from 'vitest';
import { validateAwayWindow } from '../../src/app/away-window';

const now = '2026-06-09T08:00:00.000Z';

describe('validateAwayWindow', () => {
  it('accepts a valid past date', () => {
    expect(validateAwayWindow('2026-05-25T00:00:00.000Z', now)).toEqual({ ok: true });
  });

  it('rejects an unparseable date', () => {
    const r = validateAwayWindow('not-a-date', now);
    expect(r.ok).toBe(false);
  });

  it('rejects a future date', () => {
    const r = validateAwayWindow('2026-06-20T00:00:00.000Z', now);
    expect(r).toEqual({ ok: false, reason: 'The date you were out since cannot be in the future.' });
  });

  it('rejects a date more than a year ago as likely a mistake', () => {
    const r = validateAwayWindow('2024-01-01T00:00:00.000Z', now);
    expect(r.ok).toBe(false);
  });
});
