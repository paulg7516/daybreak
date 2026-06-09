// tests/app/apply-overlay.test.ts
import { describe, it, expect } from 'vitest';
import { applyOverlay, emptyOverlay, clearItem, rerankItem } from '../../src/app/overlay';
import type { ScoredItem } from '../../src/model/item';

function scored(id: string, lane: ScoredItem['lane']): ScoredItem {
  return {
    item: { id, source: 'email_internal', subject: id, from: 'a@co.com', receivedAt: '2026-05-30T10:00:00.000Z' },
    lane,
    rank: 50,
    reasons: [],
    resolved: false,
  };
}

describe('applyOverlay', () => {
  it('passes items through unchanged with an empty overlay', () => {
    const out = applyOverlay([scored('a', 'today'), scored('b', 'fyi')], emptyOverlay());
    expect(out.map((o) => [o.scored.item.id, o.lane, o.reranked])).toEqual([
      ['a', 'today', false],
      ['b', 'fyi', false],
    ]);
  });

  it('drops cleared items', () => {
    const out = applyOverlay([scored('a', 'today'), scored('b', 'fyi')], clearItem(emptyOverlay(), 'a'));
    expect(out.map((o) => o.scored.item.id)).toEqual(['b']);
  });

  it('applies a re-rank override and flags it', () => {
    const out = applyOverlay([scored('a', 'fyi')], rerankItem(emptyOverlay(), 'a', 'today'));
    expect(out[0].lane).toBe('today');
    expect(out[0].reranked).toBe(true);
  });

  it('an override equal to the scored lane is not flagged as reranked', () => {
    const out = applyOverlay([scored('a', 'today')], rerankItem(emptyOverlay(), 'a', 'today'));
    expect(out[0].reranked).toBe(false);
  });
});
