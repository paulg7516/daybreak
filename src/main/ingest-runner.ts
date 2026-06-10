// src/main/ingest-runner.ts
import { ingestBacklog } from '../ingest/ingest';
import { scoreAll } from '../scoring/score';
import { buildSummary } from '../summary/summary';
import { applyOverlay } from '../app/overlay';
import { buildTriageView, type TriageView, type SetAsideEntry } from '../app/view-model';
import { DEMO_ME, demoItems, demoRules } from '../app/demo-data';
import type { DaybreakItem, Lane } from '../model/item';
import { getOverlay } from './store';
import { classifyItem } from '../app/rules';

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
    // In demo mode, seed an include rule so company.com items populate the lanes
    // while vendor/bulk mail falls to Set-aside, exercising the whole curated queue.
    const overlay = isDemoMode()
      ? { ...getOverlay(), rules: [...getOverlay().rules, ...demoRules()] }
      : getOverlay();

    // Inclusion gate: only included items are scored into lanes; the rest are set aside.
    const included: typeof items = [];
    const forcedLane = new Map<string, Lane>();
    const setAside: SetAsideEntry[] = [];
    for (const it of items) {
      const decision = classifyItem(it, overlay);
      if (decision.kind === 'include') {
        included.push(it);
        if (decision.lane) forcedLane.set(it.id, decision.lane);
      } else {
        setAside.push({ item: it, reason: decision.reason });
      }
    }

    const scored = scoreAll(included, { me, awaySince: sinceISO, now }).map((s) =>
      forcedLane.has(s.item.id) ? { ...s, lane: forcedLane.get(s.item.id)! } : s,
    );
    const summary = buildSummary(scored);
    const overlaid = applyOverlay(scored, overlay);
    const clearedCount = Object.keys(overlay.cleared).length;

    events.onPhase('done');
    return buildTriageView(overlaid, summary, { me, awaySince: sinceISO, clearedCount }, setAside);
  } catch (err) {
    events.onPhase('error', err instanceof Error ? err.message : String(err));
    throw err;
  }
}
