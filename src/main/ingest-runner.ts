// src/main/ingest-runner.ts
import { ingestMail } from '../ingest/mail';
import { ingestJsm } from '../ingest/jsm-ingest';
import { triageAll } from '../scoring/triage';
import { buildSummary } from '../summary/summary';
import { applyOverlay } from '../app/overlay';
import { buildTriageView, type TriageView } from '../app/view-model';
import { DEMO_ME, demoItems } from '../app/demo-data';
import type { DaybreakItem } from '../model/item';
import { getOverlay, getJiraConfig } from './store';

export type IngestPhase = 'auth' | 'fetching' | 'scoring' | 'done' | 'error';
export interface IngestEvents {
  onPhase: (phase: IngestPhase, message?: string) => void;
}

export function isDemoMode(): boolean {
  return Boolean(process.env.DAYBREAK_DEMO);
}

// Runs a full refresh for the given catch-up window and returns the renderable
// board. Declared-intent: triageAll drops untagged email and closed/unassigned
// tickets, so only deliberately-routed items reach the lanes. The overlay (cleared
// / re-rank) is read fresh so corrections survive re-ingest. In demo mode the fetch
// and auth are skipped and sample items are triaged instead.
export async function buildView(sinceISO: string, events: IngestEvents): Promise<TriageView> {
  try {
    events.onPhase('fetching');
    const now = new Date().toISOString();
    let me: string;
    let items: DaybreakItem[];
    if (isDemoMode()) {
      me = DEMO_ME;
      items = demoItems(now);
    } else {
      const ingested = await ingestMail(sinceISO, (prompt) =>
        events.onPhase('auth', JSON.stringify(prompt)),
      );
      me = ingested.me;
      items = ingested.items;
      try {
        const jsmItems = await ingestJsm(sinceISO, me, getJiraConfig() ?? undefined);
        if (jsmItems.length) items = [...items, ...jsmItems];
      } catch (err) {
        // JSM is optional; a Jira failure must not break email triage.
        console.warn('Daybreak: JSM ingest failed -', err instanceof Error ? err.message : err);
      }
    }

    events.onPhase('scoring');
    const overlay = getOverlay();
    const triaged = triageAll(items, { me, since: sinceISO, now });
    const overlaid = applyOverlay(triaged, overlay);
    const summary = buildSummary(overlaid);
    // Items the user cleared (still within the catch-up window) - the recovery list.
    const cleared = triaged
      .filter((t) => overlay.cleared[t.item.id])
      .map((t) => ({ id: t.item.id, subject: t.item.subject, from: t.item.from, receivedAt: t.item.receivedAt }));

    events.onPhase('done');
    return buildTriageView(overlaid, summary, { me, since: sinceISO }, cleared);
  } catch (err) {
    events.onPhase('error', err instanceof Error ? err.message : String(err));
    throw err;
  }
}
