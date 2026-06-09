// src/ingest/threads.ts
import type { DaybreakItem, ThreadMessage } from '../model/item';

export function assembleThreads(items: DaybreakItem[]): DaybreakItem[] {
  const byConversation = new Map<string, DaybreakItem[]>();
  const result: DaybreakItem[] = [];

  for (const it of items) {
    if (!it.threadId) {
      result.push(it);
      continue;
    }
    const group = byConversation.get(it.threadId) ?? [];
    group.push(it);
    byConversation.set(it.threadId, group);
  }

  for (const group of byConversation.values()) {
    group.sort((a, b) => new Date(a.receivedAt).getTime() - new Date(b.receivedAt).getTime());
    const [primary, ...rest] = group;
    const threadMessages: ThreadMessage[] = rest.map((m) => ({
      from: m.from,
      sentAt: m.receivedAt,
      bodyText: m.bodyText ?? '',
    }));
    result.push({ ...primary, threadMessages });
  }

  return result;
}
