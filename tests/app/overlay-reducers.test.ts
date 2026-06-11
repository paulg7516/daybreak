// tests/app/overlay-reducers.test.ts
import { describe, it, expect } from 'vitest';
import {
  emptyOverlay,
  setAwayWindow,
  setLastOpenedAt,
  clearItem,
  unclearItem,
  rerankItem,
} from '../../src/app/overlay';

describe('overlay reducers', () => {
  it('emptyOverlay is the minimal declared-intent overlay', () => {
    expect(emptyOverlay()).toEqual({
      awayWindow: null,
      lastOpenedAt: null,
      cleared: {},
      rerank: {},
      jira: null,
    });
  });

  it('setAwayWindow records since + setAt without mutating the input', () => {
    const base = emptyOverlay();
    const next = setAwayWindow(base, '2026-05-25T00:00:00.000Z', '2026-06-09T08:00:00.000Z');
    expect(next.awayWindow).toEqual({ since: '2026-05-25T00:00:00.000Z', setAt: '2026-06-09T08:00:00.000Z' });
    expect(base.awayWindow).toBeNull();
  });

  it('setLastOpenedAt records the timestamp', () => {
    expect(setLastOpenedAt(emptyOverlay(), '2026-06-11T08:00:00.000Z').lastOpenedAt).toBe('2026-06-11T08:00:00.000Z');
  });

  it('clearItem then unclearItem round-trips', () => {
    const a = clearItem(emptyOverlay(), 'm1');
    expect(a.cleared).toEqual({ m1: true });
    expect(unclearItem(a, 'm1').cleared).toEqual({});
  });

  it('rerankItem records an overridden lane', () => {
    expect(rerankItem(emptyOverlay(), 'm1', 'approve').rerank).toEqual({ m1: 'approve' });
  });
});
