// src/app/demo-data.ts
// Sample backlog for DAYBREAK_DEMO mode: a handful of realistic items fed through
// the real scorer so the triage UI can be seen and clicked without Microsoft Graph
// or any credentials. Nothing here touches the network or the keychain.
import type { DaybreakItem } from '../model/item';
import type { Rule } from './rules';

export const DEMO_ME = 'you@company.com';

// Demo include rule so the un-flagged company.com items (CFO, legal, design-lead,
// peer) land in lanes, while the vendor newsletter + invoice fall to Set-aside -
// showing both halves of the curated queue without any real rules configured.
export function demoRules(): Rule[] {
  return [
    { id: 'demo-include-company', field: 'from-domain', value: 'company.com', action: 'include', lane: null },
  ];
}

function daysAgo(nowISO: string, n: number): string {
  return new Date(Date.parse(nowISO) - n * 24 * 60 * 60 * 1000).toISOString();
}

function dateInDays(nowISO: string, n: number): string {
  return new Date(Date.parse(nowISO) + n * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

// Builds the demo backlog with receivedAt timestamps relative to `nowISO`, so the
// items always fall inside a recent away window regardless of when demo mode runs.
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
      id: 'demo-2',
      source: 'email_internal',
      subject: 'Need your sign-off to ship the Q3 forecast',
      from: 'cfo@company.com',
      receivedAt: daysAgo(nowISO, 3),
      toRecipients: [DEMO_ME],
      bodyText: 'I am blocked until you approve the numbers. Can you take a look today?',
      internetHeaders: { 'X-PTO-Triage': 'blocked' },
      webLink: 'https://outlook.example.com/owa/?ItemID=demo-2',
    },
    {
      id: 'demo-3',
      source: 'email_internal',
      subject: 'Review the vendor contract redlines',
      from: 'legal@company.com',
      receivedAt: daysAgo(nowISO, 4),
      toRecipients: [DEMO_ME],
      bodyText: 'When you are back, please review the redlined sections.',
      internetHeaders: { 'X-PTO-Triage': `action;by=${dateInDays(nowISO, 3)}` },
      webLink: 'https://outlook.example.com/owa/?ItemID=demo-3',
    },
    {
      id: 'demo-4',
      source: 'email_internal',
      subject: 'Can you approve the new onboarding flow?',
      from: 'design-lead@company.com',
      receivedAt: daysAgo(nowISO, 1),
      toRecipients: [DEMO_ME],
      bodyText: 'Could you review and approve this when you get a chance?',
      webLink: 'https://outlook.example.com/owa/?ItemID=demo-4',
    },
    {
      id: 'demo-5',
      source: 'email_vendor',
      subject: 'Invoice #4471 is due in 5 days',
      from: 'billing@datadoghq.com',
      receivedAt: daysAgo(nowISO, 5),
      bodyText: 'Your monthly invoice is due soon. No action needed if autopay is on.',
      webLink: 'https://vendor.example.com/invoice/4471',
    },
    {
      id: 'demo-6',
      source: 'email_internal',
      subject: "Notes from Tuesday's planning",
      from: 'pm@company.com',
      receivedAt: daysAgo(nowISO, 2),
      ccRecipients: [DEMO_ME],
      bodyText: 'Sharing the planning notes for visibility. No reply needed.',
      internetHeaders: { 'X-PTO-Triage': 'fyi' },
      webLink: 'https://outlook.example.com/owa/?ItemID=demo-6',
    },
    {
      id: 'demo-7',
      source: 'email_internal',
      subject: 'Question about the staging deploy',
      from: 'peer@company.com',
      receivedAt: daysAgo(nowISO, 6),
      toRecipients: [DEMO_ME],
      bodyText: 'Do you know why staging keeps failing the health check?',
      threadId: 'demo-thread-staging',
      threadMessages: [
        {
          from: 'peer@company.com',
          sentAt: daysAgo(nowISO, 5),
          bodyText: 'Never mind, sorted it - was a stale cache. Nothing needed from you.',
        },
      ],
      webLink: 'https://outlook.example.com/owa/?ItemID=demo-7',
    },
    {
      id: 'demo-8',
      source: 'email_vendor',
      subject: 'This week in cloud infrastructure',
      from: 'newsletter@cloudweekly.com',
      receivedAt: daysAgo(nowISO, 3),
      bodyText: 'The top infrastructure stories this week.',
      webLink: 'https://vendor.example.com/newsletter/latest',
    },
  ];
}
