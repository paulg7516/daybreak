// src/main/ingest-runner.ts
import { ingestBacklog } from '../ingest/ingest';
import { scoreAll } from '../scoring/score';
import { buildSummary } from '../summary/summary';
import { applyOverlay } from '../app/overlay';
import { buildTriageView, type TriageView } from '../app/view-model';
import { getOverlay } from './store';

export type IngestPhase = 'auth' | 'fetching' | 'scoring' | 'done' | 'error';
export interface IngestEvents {
  onPhase: (phase: IngestPhase, message?: string) => void;
}

// Runs a full refresh for the given away window and returns the renderable view.
// The overlay (cleared / re-rank / away window) is read fresh so corrections made
// in a previous session survive re-ingest.
export async function buildView(sinceISO: string, events: IngestEvents): Promise<TriageView> {
  try {
    events.onPhase('fetching');
    const now = new Date().toISOString();
    const { me, items } = await ingestBacklog(sinceISO);

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
