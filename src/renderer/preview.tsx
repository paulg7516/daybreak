// src/renderer/preview.tsx
// Standalone visual preview: mounts the REAL App with a mocked window.daybreak so
// the redesigned declared-intent board can be seen in a plain browser (no Electron).
// Not part of the shipped app - only built for design review.
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';
import type { TriageView, TriageRow, LaneView } from '../app/view-model';
import type { Lane, Source, Urgency } from '../model/item';

function row(
  id: string,
  lane: Lane,
  source: Source,
  subject: string,
  from: string,
  receivedAt: string,
  urgency: Urgency,
  reasons: string[],
): TriageRow {
  return { id, subject, from, receivedAt, lane, urgency, reasons, source, webLink: 'https://example.com', reranked: false };
}

function lane(l: Lane, items: TriageRow[]): LaneView {
  return { lane: l, total: items.length, items };
}

const lanes: LaneView[] = [
  lane('respond', [
    row('s1', 'respond', 'jsm', 'INC-4821 - Payments API returning 500s', 'jira@company.com', '2026-06-09T09:00:00.000Z', 'overdue', ['assigned ticket', 'priority P1', 'SLA breached']),
    row('e1', 'respond', 'email_internal', 'Quick question on the staging rollout', 'peer@company.com', '2026-06-10T09:00:00.000Z', 'today', ['sender: respond', 'due 2026-06-11']),
  ]),
  lane('approve', [
    row('e2', 'approve', 'email_internal', 'Sign-off needed on the Q3 forecast', 'cfo@company.com', '2026-06-08T09:00:00.000Z', 'overdue', ['sender: approve', 'due 2026-06-10']),
    row('e3', 'approve', 'email_internal', 'Approve the new onboarding flow when you can', 'design-lead@company.com', '2026-06-09T09:00:00.000Z', 'none', ['sender: approve']),
  ]),
  lane('review', [
    row('e4', 'review', 'email_internal', 'Vendor contract redlines for a look', 'legal@company.com', '2026-06-07T09:00:00.000Z', 'this_week', ['sender: review', 'due 2026-06-15']),
  ]),
  lane('fyi', [
    row('e5', 'fyi', 'email_internal', "Notes from Tuesday's planning", 'pm@company.com', '2026-06-09T09:00:00.000Z', 'none', ['sender: fyi']),
    row('e6', 'fyi', 'email_internal', 'Heads up: office closed Friday', 'facilities@company.com', '2026-06-10T09:00:00.000Z', 'none', ['sender: fyi']),
  ]),
];

const view: TriageView = {
  me: 'you@company.com',
  since: '2026-06-04T00:00:00.000Z',
  summary: { total: 7, needYou: 4, overdue: 2, byLane: { respond: 2, approve: 2, review: 1, fyi: 2 } },
  lanes,
  cleared: [],
};

(window as unknown as { daybreak: unknown }).daybreak = {
  getView: async () => view,
  setAwayWindow: async () => view,
  refresh: async () => view,
  clearItem: async () => {},
  unclearItem: async () => {},
  rerankItem: async () => {},
  openItem: async () => {},
  getLaneConfig: async () => [],
  setLaneConfig: async () => {},
  getJiraConfig: async () => ({ baseUrl: '', email: '', hasToken: false }),
  setJiraConfig: async () => {},
  testJiraConnection: async () => ({ ok: true, displayName: 'You' }),
  clearJiraToken: async () => {},
  getMailStatus: async () => ({ provider: 'gmail', connected: true, account: 'p.gerios@gmail.com', graphConfigured: false }),
  connectMail: async () => ({ ok: true, account: 'p.gerios@gmail.com' }),
  disconnectMail: async () => {},
  onIngest: () => () => {},
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
