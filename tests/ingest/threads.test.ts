// tests/ingest/threads.test.ts
import { describe, it, expect } from 'vitest';
import { assembleThreads } from '../../src/ingest/threads';
import type { DaybreakItem } from '../../src/model/item';

function item(over: Partial<DaybreakItem>): DaybreakItem {
  return {
    id: 'x', source: 'email_internal', subject: 's', from: 'a@company.com',
    receivedAt: '2026-05-30T10:00:00.000Z', bodyText: '', ...over,
  };
}

describe('assembleThreads', () => {
  it('uses the earliest message as primary and attaches later ones as threadMessages', () => {
    const items: DaybreakItem[] = [
      item({ id: 'b', threadId: 'c1', receivedAt: '2026-05-28T10:00:00.000Z', from: 'peer@company.com', bodyText: 'nvm, sorted' }),
      item({ id: 'a', threadId: 'c1', receivedAt: '2026-05-26T10:00:00.000Z', from: 'peer@company.com', bodyText: 'quick question?' }),
    ];
    const out = assembleThreads(items);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe('a'); // earliest is primary
    expect(out[0].threadMessages).toHaveLength(1);
    expect(out[0].threadMessages![0].bodyText).toBe('nvm, sorted');
    expect(out[0].threadMessages![0].sentAt).toBe('2026-05-28T10:00:00.000Z');
  });

  it('passes through items with no threadId, single-message threads get empty threadMessages', () => {
    const items: DaybreakItem[] = [
      item({ id: 'solo', threadId: undefined }),
      item({ id: 'only', threadId: 'c2', receivedAt: '2026-05-27T10:00:00.000Z' }),
    ];
    const out = assembleThreads(items);
    const byId = (id: string) => out.find((i) => i.id === id)!;
    expect(out).toHaveLength(2);
    expect(byId('solo').threadMessages).toBeUndefined();
    expect(byId('only').threadMessages).toEqual([]);
  });
});
