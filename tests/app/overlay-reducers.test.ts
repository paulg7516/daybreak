// tests/app/overlay-reducers.test.ts
import { describe, it, expect } from 'vitest';
import {
  emptyOverlay,
  setAwayWindow,
  clearItem,
  unclearItem,
  rerankItem,
  type Overlay,
} from '../../src/app/overlay';

describe('overlay reducers', () => {
  it('emptyOverlay has a null away window and no cleared/rerank entries', () => {
    expect(emptyOverlay()).toEqual({ awayWindow: null, cleared: {}, rerank: {} });
  });

  it('setAwayWindow records since + setAt without mutating the input', () => {
    const base = emptyOverlay();
    const next = setAwayWindow(base, '2026-05-25T00:00:00.000Z', '2026-06-09T08:00:00.000Z');
    expect(next.awayWindow).toEqual({
      since: '2026-05-25T00:00:00.000Z',
      setAt: '2026-06-09T08:00:00.000Z',
    });
    expect(base.awayWindow).toBeNull(); // input untouched
  });

  it('clearItem then unclearItem round-trips', () => {
    const a = clearItem(emptyOverlay(), 'm1');
    expect(a.cleared).toEqual({ m1: true });
    const b = unclearItem(a, 'm1');
    expect(b.cleared).toEqual({});
  });

  it('rerankItem records an overridden lane', () => {
    const next = rerankItem(emptyOverlay(), 'm1', 'today');
    expect(next.rerank).toEqual({ m1: 'today' });
  });
});
