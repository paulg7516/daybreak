// src/renderer/preview.tsx
// Standalone visual preview: mounts the REAL App with a mocked window.daybreak so
// the redesigned components can be seen in a plain browser (no Electron, no dmg).
// Not part of the shipped app - only built for design review.
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';
import type { TriageView } from '../app/view-model';
import type { Source, Lane } from '../model/item';

function row(
  id: string,
  source: Source,
  subject: string,
  from: string,
  receivedAt: string,
  reasons: string[],
  extra: { senderTag?: 'blocked' | 'action' | 'whenever' | 'fyi'; resolved?: boolean; webLink?: string } = {},
) {
  return { id, subject, from, receivedAt, reasons, resolved: extra.resolved ?? false, senderTag: extra.senderTag, webLink: extra.webLink ?? 'https://example.com', lane: 'today' as Lane, reranked: false, source };
}

const view: TriageView = {
  me: 'you@company.com',
  awaySince: '2026-05-26T00:00:00.000Z',
  summary: { needsTodayCount: 3, thisWeekCount: 2, fyiCount: 2, slaAtRiskCount: 2, resolvedWhileAwayCount: 14 },
  lanes: {
    today: {
      lane: 'today', total: 3,
      groups: [
        { source: 'jsm', items: [row('s1', 'jsm', 'INC-4821 - Payments API returning 500s', 'jira@company.com', '2026-05-07T09:00:00.000Z', ['P1', 'SLA breached', 'assigned to you'])] },
        { source: 'email_internal', items: [
          row('e1', 'email_internal', 'Need your sign-off to ship the Q3 forecast', 'cfo@company.com', '2026-05-06T09:00:00.000Z', ['Direct ask', 'blocked on you', 'manager'], { senderTag: 'blocked' }),
          row('e2', 'email_internal', 'Can you approve the new onboarding flow?', 'design-lead@company.com', '2026-05-08T09:00:00.000Z', ['Direct ask', 'addressed to you']),
        ] },
      ],
    },
    this_week: {
      lane: 'this_week', total: 2,
      groups: [
        { source: 'email_internal', items: [row('e3', 'email_internal', 'Review the vendor contract redlines', 'legal@company.com', '2026-05-05T09:00:00.000Z', ['Action needed by Jun 12'], { senderTag: 'action' })] },
        { source: 'email_vendor', items: [row('v1', 'email_vendor', 'Invoice #4471 is due in 5 days', 'billing@datadoghq.com', '2026-05-04T09:00:00.000Z', ['Renewal', 'amount due soon'])] },
      ],
    },
    fyi: {
      lane: 'fyi', total: 2,
      groups: [
        { source: 'email_internal', items: [
          row('e4', 'email_internal', "Notes from Tuesday's planning", 'pm@company.com', '2026-05-07T09:00:00.000Z', ["cc'd", 'no reply needed'], { senderTag: 'fyi' }),
          row('e5', 'email_internal', 'Question about the staging deploy', 'peer@company.com', '2026-05-03T09:00:00.000Z', ['Resolved while you were out'], { resolved: true }),
        ] },
      ],
    },
  },
  clearedCount: 0,
  setAside: {
    total: 2,
    items: [
      { id: 'a1', subject: 'This week in cloud infrastructure', from: 'newsletter@cloudweekly.com', receivedAt: '2026-05-06T09:00:00.000Z', reason: 'automated' },
      { id: 'a2', subject: 'Your AWS usage report is ready', from: 'no-reply@aws.com', receivedAt: '2026-05-05T09:00:00.000Z', reason: 'automated' },
    ],
  },
};

const noop = async () => view as unknown;
(window as unknown as { daybreak: unknown }).daybreak = {
  getView: async () => view,
  setAwayWindow: noop, refresh: async () => view,
  clearItem: async () => {}, unclearItem: async () => {}, rerankItem: async () => {}, openItem: async () => {},
  getRules: async () => ({ rules: [], bulkExcludeEnabled: true }),
  addRule: async () => view, removeRule: async () => view, setBulkExclude: async () => view, promoteSetAside: async () => view,
  onIngest: () => () => {},
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
