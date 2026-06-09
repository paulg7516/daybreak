// src/main/ingest-runner.ts
import { ingestBacklog } from '../ingest/ingest';
import { scoreAll } from '../scoring/score';
import { buildSummary } from '../summary/summary';
import { applyOverlay } from '../app/overlay';
import { buildTriageView, type TriageView } from '../app/view-model';
import { DEMO_ME, demoItems } from '../app/demo-data';
import type { DaybreakItem } from '../model/item';
import { getOverlay } from './store';

export type IngestPhase = 'auth' | 'fetching' | 'scoring' | 'done' | 'error';
export interface IngestEvents {
  onPhase: (phase: IngestPhase, message?: string) => void;
}

export function isDemoMode(): boolean {
  return Boolean(process.env.DAYBREAK_DEMO);
}

// Runs a full refresh for the given away window and returns the renderable view.
// The overlay (cleared / re-rank / away window) is read fresh so corrections made
// in a previous session survive re-ingest. In demo mode the Graph fetch and auth
// are skipped and sample items are scored instead, so the UI can be seen without
// any credentials.
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
      const ingested = await ingestBacklog(sinceISO, (info) =>
        events.onPhase('auth', JSON.stringify({ verificationUri: info.verificationUri, userCode: info.userCode })),
      );
      me = ingested.me;
      items = ingested.items;
    }

    events.onPhase('scoring');
    const scored = scoreAll(items, { me, awaySince: sinceISO, now });
    const summary = buildSummary(scored);

    const overlay = getOverlay();
    const overlaid = applyOverlay(scored, overlay);
    const clearedCount = Object.keys(overlay.cleared).length;

    events.onPhase('done');
    return buildTriageView(overlaid, summary, { me, awaySince: sinceISO, clearedCount });
  } catch (err) {
    events.onPhase('error', err instanceof Error ? err.message : String(err));
    throw err;
  }
}
