// src/app/demo-data.ts
// Sample backlog for DAYBREAK_DEMO mode: declared-intent items fed through the real
// triage so the board can be seen and clicked without Microsoft Graph, Gmail, or any
// credentials. Every email here is tagged (untagged mail would not appear), so the
// demo exercises all four lanes and the urgency badges. No network, no keychain.
import type { DaybreakItem } from '../model/item';

export const DEMO_ME = 'you@company.com';

function daysAgo(nowISO: string, n: number): string {
  return new Date(Date.parse(nowISO) - n * 24 * 60 * 60 * 1000).toISOString();
}

function dateInDays(nowISO: string, n: number): string {
  return new Date(Date.parse(nowISO) + n * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function demoItems(nowISO: string): DaybreakItem[] {
  return [
    {
      id: 'demo-jsm-1',
      source: 'jsm',
      subject: 'INC-4821 - Payments API returning 500s',
      from: 'jira@company.com',
      receivedAt: daysAgo(nowISO, 2),
      jsm: { priority: 'P1', slaStatus: 'breached', state: 'open', assignee: DEMO_ME },
      webLink: 'https://jira.example.com/browse/INC-4821',
    },
    {
      id: 'demo-respond-1',
      source: 'email_internal',
      subject: 'Quick question on the staging rollout',
      from: 'peer@company.com',
      receivedAt: daysAgo(nowISO, 1),
      toRecipients: [DEMO_ME],
      bodyText: 'Do we cut staging over tonight or wait for the review?',
      internetHeaders: { 'X-PTO-Triage': `respond;by=${dateInDays(nowISO, 0)}` },
      webLink: 'https://outlook.example.com/owa/?ItemID=demo-respond-1',
    },
    {
      id: 'demo-approve-1',
      source: 'email_internal',
      subject: 'Sign-off needed on the Q3 forecast',
      from: 'cfo@company.com',
      receivedAt: daysAgo(nowISO, 3),
      toRecipients: [DEMO_ME],
      bodyText: 'I am blocked until you approve the numbers.',
      internetHeaders: { 'X-PTO-Triage': `approve;by=${dateInDays(nowISO, -1)}` },
      webLink: 'https://outlook.example.com/owa/?ItemID=demo-approve-1',
    },
    {
      id: 'demo-approve-2',
      source: 'email_internal',
      subject: 'Approve the new onboarding flow when you can',
      from: 'design-lead@company.com',
      receivedAt: daysAgo(nowISO, 2),
      toRecipients: [DEMO_ME],
      bodyText: 'No rush, but it needs your sign-off before launch.',
      internetHeaders: { 'X-PTO-Triage': 'approve' },
      webLink: 'https://outlook.example.com/owa/?ItemID=demo-approve-2',
    },
    {
      id: 'demo-review-1',
      source: 'email_internal',
      subject: 'Vendor contract redlines for a look',
      from: 'legal@company.com',
      receivedAt: daysAgo(nowISO, 4),
      toRecipients: [DEMO_ME],
      bodyText: 'When you are back, please skim the redlined sections.',
      internetHeaders: { 'X-PTO-Triage': `review;by=${dateInDays(nowISO, 4)}` },
      webLink: 'https://outlook.example.com/owa/?ItemID=demo-review-1',
    },
    {
      id: 'demo-fyi-1',
      source: 'email_internal',
      subject: "Notes from Tuesday's planning",
      from: 'pm@company.com',
      receivedAt: daysAgo(nowISO, 2),
      ccRecipients: [DEMO_ME],
      bodyText: 'Sharing the planning notes for visibility. No reply needed.',
      internetHeaders: { 'X-PTO-Triage': 'fyi' },
      webLink: 'https://outlook.example.com/owa/?ItemID=demo-fyi-1',
    },
    {
      id: 'demo-fyi-2',
      source: 'email_internal',
      subject: 'Heads up: office closed Friday',
      from: 'facilities@company.com',
      receivedAt: daysAgo(nowISO, 1),
      ccRecipients: [DEMO_ME],
      bodyText: 'The building is closed this Friday for maintenance.',
      internetHeaders: { 'X-PTO-Triage': 'fyi' },
      webLink: 'https://outlook.example.com/owa/?ItemID=demo-fyi-2',
    },
  ];
}
