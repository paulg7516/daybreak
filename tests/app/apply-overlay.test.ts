// tests/app/apply-overlay.test.ts
import { describe, it, expect } from 'vitest';
import { applyOverlay, emptyOverlay, clearItem, rerankItem } from '../../src/app/overlay';
import type { Lane, TriagedItem } from '../../src/model/item';

function triaged(id: string, lane: Lane): TriagedItem {
  return {
    item: { id, source: 'email_internal', subject: id, from: 'a@co.com', receivedAt: '2026-05-30T10:00:00.000Z' },
    lane,
    urgency: 'none',
    reasons: [],
  };
}

describe('applyOverlay', () => {
  it('passes items through unchanged with an empty overlay', () => {
    const out = applyOverlay([triaged('a', 'input'), triaged('b', 'fyi')], emptyOverlay());
    expect(out.map((o) => [o.triaged.item.id, o.lane, o.reranked])).toEqual([
      ['a', 'input', false],
      ['b', 'fyi', false],
    ]);
  });

  it('drops cleared items', () => {
    const out = applyOverlay([triaged('a', 'input'), triaged('b', 'fyi')], clearItem(emptyOverlay(), 'a'));
    expect(out.map((o) => o.triaged.item.id)).toEqual(['b']);
  });

  it('applies a re-rank override and flags it', () => {
    const out = applyOverlay([triaged('a', 'fyi')], rerankItem(emptyOverlay(), 'a', 'input'));
    expect(out[0].lane).toBe('input');
    expect(out[0].reranked).toBe(true);
  });

  it('an override equal to the triaged lane is not flagged as reranked', () => {
    const out = applyOverlay([triaged('a', 'input')], rerankItem(emptyOverlay(), 'a', 'input'));
    expect(out[0].reranked).toBe(false);
  });
});
