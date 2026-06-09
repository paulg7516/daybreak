# Daybreak Scoring Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a pure, fully-tested TypeScript library (plus a CLI) that takes normalized email and JSM items and assigns each to an urgency lane (today / this_week / fyi) with a rank, reasons, and a resolved-while-away flag, then produces a "while you were out" summary.

**Architecture:** No Electron, no network, no auth. Pure functions: `scoreItem` / `scoreAll` take a `DaybreakItem` plus a `ScoringContext` (who "me" is, the away window, and an injected `now` for deterministic tests) and return `ScoredItem`s. Priority is derived per source: JSM from its structured payload, internal email from a sender tag header when present else from addressing/ask/relationship heuristics, vendor mail from keyword patterns. A deadline found in body text can promote an email upward. Resolved-while-away detection overrides everything to fyi. This package locks the data contracts (`DaybreakItem`, `Lane`, etc.) that later plans (Graph ingestion, JSM ingestion, UI) conform to.

**Tech Stack:** TypeScript (strict), Node ESM, Vitest for tests, tsx for the CLI. No runtime dependencies.

**House rules:** No em dashes anywhere in code or comments - use regular hyphens.

---

## File Structure

- `package.json`, `tsconfig.json` - project config
- `src/model/item.ts` - all shared types (the data contract)
- `src/scoring/sender-tag.ts` - parse the `X-PTO-Triage` header
- `src/scoring/deadline.ts` - extract a deadline date from free text
- `src/scoring/jsm.ts` - map a JSM payload to a lane signal
- `src/scoring/email.ts` - internal-email heuristics
- `src/scoring/vendor.ts` - vendor/external keyword patterns
- `src/scoring/resolved.ts` - resolved-while-away detection
- `src/scoring/score.ts` - orchestrator: `scoreItem` / `scoreAll`
- `src/summary/summary.ts` - build the "while you were out" summary
- `src/cli.ts` - run scoring against a fixture JSON file
- `tests/...` - one test file per module above
- `fixtures/sample-backlog.json` - a realistic input for the CLI

---

## Task 0: Project scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "daybreak-scoring",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit",
    "score": "tsx src/cli.ts"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "tsx": "^4.19.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "noEmit": true,
    "lib": ["ES2022"]
  },
  "include": ["src", "tests"]
}
```

- [ ] **Step 3: Install dependencies**

Run: `npm install`
Expected: `node_modules/` created, no errors.

- [ ] **Step 4: Verify the test runner works (no tests yet)**

Run: `npx vitest run`
Expected: exits cleanly reporting "No test files found" (this is fine at this stage).

- [ ] **Step 5: Commit**

```bash
git add package.json tsconfig.json package-lock.json
git commit -m "chore: scaffold daybreak-scoring package"
```

---

## Task 1: Data model (the contract)

**Files:**
- Create: `src/model/item.ts`
- Test: `tests/model/item.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/model/item.test.ts
import { describe, it, expect } from 'vitest';
import type { DaybreakItem, ScoringContext, ScoredItem } from '../../src/model/item';

describe('data model', () => {
  it('constructs a minimal JSM item and a scored item', () => {
    const item: DaybreakItem = {
      id: 'JSM-1',
      source: 'jsm',
      subject: 'Server down',
      from: 'jira@company.com',
      receivedAt: '2026-05-30T09:00:00.000Z',
      jsm: { assignee: 'me@company.com', priority: 'P1', slaStatus: 'at_risk', state: 'open' },
    };
    const ctx: ScoringContext = {
      me: 'me@company.com',
      awaySince: '2026-05-25T00:00:00.000Z',
      now: '2026-06-08T08:00:00.000Z',
    };
    const scored: ScoredItem = {
      item,
      lane: 'today',
      rank: 95,
      reasons: ['assigned to you'],
      resolved: false,
    };
    expect(scored.item.id).toBe('JSM-1');
    expect(ctx.me).toBe('me@company.com');
    expect(scored.lane).toBe('today');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/model/item.test.ts`
Expected: FAIL - cannot find module `../../src/model/item`.

- [ ] **Step 3: Write the model**

```typescript
// src/model/item.ts
export type Source = 'jsm' | 'email_internal' | 'email_vendor';
export type Lane = 'today' | 'this_week' | 'fyi';
export type SenderTag = 'blocked' | 'action' | 'whenever' | 'fyi';

export interface ThreadMessage {
  from: string;
  sentAt: string; // ISO timestamp
  bodyText: string;
}

export interface JsmFields {
  assignee?: string;
  priority?: 'P1' | 'P2' | 'P3' | 'P4';
  slaStatus?: 'breached' | 'at_risk' | 'ok' | 'none';
  state?: string; // open, in progress, resolved, closed, done
}

export interface DaybreakItem {
  id: string;
  source: Source;
  subject: string;
  from: string;
  receivedAt: string; // ISO timestamp
  // email fields
  toRecipients?: string[];
  ccRecipients?: string[];
  bodyText?: string;
  threadMessages?: ThreadMessage[]; // later messages in the same thread
  internetHeaders?: Record<string, string>; // includes X-PTO-Triage when present
  // ticketing fields
  jsm?: JsmFields;
}

export interface ScoringContext {
  me: string;
  managers?: string[];
  reports?: string[];
  frequentContacts?: string[];
  awaySince: string; // ISO date; messages/replies after this are "while you were out"
  now: string;       // ISO timestamp; injected for deterministic scoring and tests
}

export interface ScoredItem {
  item: DaybreakItem;
  lane: Lane;
  rank: number;    // 0-100, higher is more urgent, used to sort within a lane
  reasons: string[];
  resolved: boolean; // resolved-while-away
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/model/item.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/model/item.ts tests/model/item.test.ts
git commit -m "feat: add daybreak scoring data model"
```

---

## Task 2: Sender-tag header parser

**Files:**
- Create: `src/scoring/sender-tag.ts`
- Test: `tests/scoring/sender-tag.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/scoring/sender-tag.test.ts
import { describe, it, expect } from 'vitest';
import { parseSenderTag } from '../../src/scoring/sender-tag';

describe('parseSenderTag', () => {
  it('returns null when no header present', () => {
    expect(parseSenderTag(undefined)).toBeNull();
    expect(parseSenderTag({ 'X-Other': 'foo' })).toBeNull();
  });

  it('parses simple tags case-insensitively', () => {
    expect(parseSenderTag({ 'x-pto-triage': 'blocked' })).toEqual({ tag: 'blocked' });
    expect(parseSenderTag({ 'X-PTO-Triage': 'WHENEVER' })).toEqual({ tag: 'whenever' });
    expect(parseSenderTag({ 'X-Pto-Triage': 'fyi' })).toEqual({ tag: 'fyi' });
  });

  it('parses an action tag with a by= date', () => {
    expect(parseSenderTag({ 'X-PTO-Triage': 'action;by=2026-06-20' }))
      .toEqual({ tag: 'action', by: '2026-06-20' });
  });

  it('parses an action tag with no date', () => {
    expect(parseSenderTag({ 'X-PTO-Triage': 'action' })).toEqual({ tag: 'action', by: undefined });
  });

  it('returns null for an unknown tag value', () => {
    expect(parseSenderTag({ 'X-PTO-Triage': 'urgent' })).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/scoring/sender-tag.test.ts`
Expected: FAIL - cannot find module `sender-tag`.

- [ ] **Step 3: Write the implementation**

```typescript
// src/scoring/sender-tag.ts
import type { SenderTag } from '../model/item';

export interface ParsedTag {
  tag: SenderTag;
  by?: string; // ISO date string, only meaningful when tag === 'action'
}

const HEADER = 'x-pto-triage';

export function parseSenderTag(headers?: Record<string, string>): ParsedTag | null {
  if (!headers) return null;
  const key = Object.keys(headers).find((k) => k.toLowerCase() === HEADER);
  if (!key) return null;

  const raw = headers[key].trim();
  const parts = raw.split(';').map((s) => s.trim());
  const tag = parts[0].toLowerCase();

  if (tag === 'blocked' || tag === 'whenever' || tag === 'fyi') {
    return { tag };
  }
  if (tag === 'action') {
    const byParam = parts.slice(1).find((p) => p.toLowerCase().startsWith('by='));
    const by = byParam ? byParam.slice(byParam.indexOf('=') + 1).trim() : undefined;
    return { tag: 'action', by };
  }
  return null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/scoring/sender-tag.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/scoring/sender-tag.ts tests/scoring/sender-tag.test.ts
git commit -m "feat: parse X-PTO-Triage sender tag header"
```

---

## Task 3: Deadline extractor

Extracts the earliest relevant deadline from free text. Supports: ISO dates (`YYYY-MM-DD`), `today`/`EOD`/`COB`, `tomorrow`, and weekday names (full and 3-letter). Returns the soonest future-or-today deadline, or `null`. "End of working day" is modeled as 17:00 local.

**Files:**
- Create: `src/scoring/deadline.ts`
- Test: `tests/scoring/deadline.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/scoring/deadline.test.ts
import { describe, it, expect } from 'vitest';
import { extractDeadline } from '../../src/scoring/deadline';

// Monday 2026-06-08 08:00 local
const now = new Date('2026-06-08T08:00:00');

describe('extractDeadline', () => {
  it('returns null when there is no deadline', () => {
    expect(extractDeadline('just a friendly note, no rush', now)).toBeNull();
    expect(extractDeadline('', now)).toBeNull();
  });

  it('extracts an ISO date', () => {
    const d = extractDeadline('please finish by 2026-06-20', now);
    expect(d).not.toBeNull();
    expect(d!.toISOString().slice(0, 10)).toBe('2026-06-20');
  });

  it('treats EOD and today as end of today', () => {
    const d = extractDeadline('need this by EOD', now);
    expect(d!.getFullYear()).toBe(2026);
    expect(d!.getMonth()).toBe(5); // June (0-indexed)
    expect(d!.getDate()).toBe(8);
    expect(d!.getHours()).toBe(17);
  });

  it('extracts tomorrow', () => {
    const d = extractDeadline('can you reply by tomorrow?', now);
    expect(d!.getDate()).toBe(9);
  });

  it('extracts the next occurrence of a weekday', () => {
    // now is Monday; "by Friday" -> the coming Friday (the 12th)
    const d = extractDeadline('let me know by Friday', now);
    expect(d!.getDate()).toBe(12);
  });

  it('returns the earliest of multiple deadlines', () => {
    const d = extractDeadline('ideally by Friday but hard stop 2026-06-09', now);
    expect(d!.getDate()).toBe(9);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/scoring/deadline.test.ts`
Expected: FAIL - cannot find module `deadline`.

- [ ] **Step 3: Write the implementation**

```typescript
// src/scoring/deadline.ts

const DOW: Record<string, number> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
  sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6,
};

function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(17, 0, 0, 0); // 17:00 local as "end of working day"
  return x;
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function nextWeekday(now: Date, dow: number): Date {
  const x = new Date(now);
  const diff = ((dow - x.getDay() + 7) % 7) || 7; // strictly the next occurrence, never today
  x.setDate(x.getDate() + diff);
  return endOfDay(x);
}

export function extractDeadline(text: string, now: Date): Date | null {
  if (!text) return null;
  const lower = text.toLowerCase();
  const candidates: Date[] = [];

  // ISO dates YYYY-MM-DD
  const isoMatches = lower.match(/\b\d{4}-\d{2}-\d{2}\b/g);
  if (isoMatches) {
    for (const m of isoMatches) {
      const d = new Date(`${m}T17:00:00`);
      if (!Number.isNaN(d.getTime())) candidates.push(d);
    }
  }

  // today / EOD / COB -> end of today
  if (/\b(eod|cob|end of day|close of business|by today|today)\b/.test(lower)) {
    candidates.push(endOfDay(now));
  }

  // tomorrow
  if (/\btomorrow\b/.test(lower)) {
    const t = new Date(now);
    t.setDate(t.getDate() + 1);
    candidates.push(endOfDay(t));
  }

  // weekday names
  for (const [name, dow] of Object.entries(DOW)) {
    if (new RegExp(`\\b${name}\\b`).test(lower)) {
      candidates.push(nextWeekday(now, dow));
    }
  }

  if (candidates.length === 0) return null;

  const floor = startOfDay(now).getTime();
  const future = candidates.filter((d) => d.getTime() >= floor);
  const pool = future.length ? future : candidates;
  pool.sort((a, b) => a.getTime() - b.getTime());
  return pool[0];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/scoring/deadline.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/scoring/deadline.ts tests/scoring/deadline.test.ts
git commit -m "feat: extract deadlines from email body text"
```

---

## Task 4: JSM scorer

**Files:**
- Create: `src/scoring/jsm.ts`
- Test: `tests/scoring/jsm.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/scoring/jsm.test.ts
import { describe, it, expect } from 'vitest';
import { scoreJsm } from '../../src/scoring/jsm';

const me = 'me@company.com';

describe('scoreJsm', () => {
  it('assigned to me + P1 -> today', () => {
    const s = scoreJsm({ assignee: me, priority: 'P1', slaStatus: 'ok', state: 'open' }, me);
    expect(s.lane).toBe('today');
    expect(s.reasons).toContain('priority P1');
  });

  it('assigned to me + SLA at risk -> today', () => {
    const s = scoreJsm({ assignee: me, priority: 'P3', slaStatus: 'at_risk', state: 'open' }, me);
    expect(s.lane).toBe('today');
  });

  it('assigned to me + P3, SLA ok -> this_week', () => {
    const s = scoreJsm({ assignee: me, priority: 'P3', slaStatus: 'ok', state: 'open' }, me);
    expect(s.lane).toBe('this_week');
  });

  it('not assigned to me (notified) -> fyi', () => {
    const s = scoreJsm({ assignee: 'someone@company.com', priority: 'P1', state: 'open' }, me);
    expect(s.lane).toBe('fyi');
    expect(s.reasons).toContain('you were notified (not assignee)');
  });

  it('resolved/closed -> fyi and resolved flag', () => {
    const s = scoreJsm({ assignee: me, priority: 'P1', state: 'resolved' }, me);
    expect(s.lane).toBe('fyi');
    expect(s.resolved).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/scoring/jsm.test.ts`
Expected: FAIL - cannot find module `jsm`.

- [ ] **Step 3: Write the implementation**

```typescript
// src/scoring/jsm.ts
import type { JsmFields, Lane } from '../model/item';

export interface JsmSignal {
  lane: Lane;
  rank: number;
  reasons: string[];
  resolved: boolean;
}

export function scoreJsm(jsm: JsmFields, me: string): JsmSignal {
  const state = (jsm.state ?? '').toLowerCase();
  const closed = state === 'resolved' || state === 'closed' || state === 'done';
  if (closed) {
    return { lane: 'fyi', rank: 10, reasons: ['ticket already resolved/closed'], resolved: true };
  }

  const assignedToMe = !!jsm.assignee && jsm.assignee.toLowerCase() === me.toLowerCase();
  const reasons: string[] = [assignedToMe ? 'assigned to you' : 'you were notified (not assignee)'];

  if (!assignedToMe) {
    return { lane: 'fyi', rank: 20, reasons, resolved: false };
  }

  const p1 = jsm.priority === 'P1';
  const slaBad = jsm.slaStatus === 'breached' || jsm.slaStatus === 'at_risk';
  if (p1 || slaBad) {
    if (p1) reasons.push('priority P1');
    if (slaBad) reasons.push(`SLA ${jsm.slaStatus}`);
    return { lane: 'today', rank: 95, reasons, resolved: false };
  }

  if (jsm.priority === 'P2' || jsm.priority === 'P3') {
    reasons.push(`priority ${jsm.priority}`);
    return { lane: 'this_week', rank: 60, reasons, resolved: false };
  }

  return { lane: 'this_week', rank: 40, reasons, resolved: false };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/scoring/jsm.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/scoring/jsm.ts tests/scoring/jsm.test.ts
git commit -m "feat: score JSM items from structured payload"
```

---

## Task 5: Internal-email scorer

Scores internal email from metadata only (no sender tag - that is handled in the orchestrator). Starts at a neutral base and adjusts for addressing, a direct ask, and sender relationship, then maps the score to a lane.

**Files:**
- Create: `src/scoring/email.ts`
- Test: `tests/scoring/email.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/scoring/email.test.ts
import { describe, it, expect } from 'vitest';
import { scoreEmail } from '../../src/scoring/email';
import type { DaybreakItem, ScoringContext } from '../../src/model/item';

const ctx: ScoringContext = {
  me: 'me@company.com',
  managers: ['boss@company.com'],
  reports: ['report@company.com'],
  frequentContacts: ['peer@company.com'],
  awaySince: '2026-05-25T00:00:00.000Z',
  now: '2026-06-08T08:00:00.000Z',
};

function email(over: Partial<DaybreakItem>): DaybreakItem {
  return {
    id: 'e1', source: 'email_internal', subject: 's', from: 'peer@company.com',
    receivedAt: '2026-05-30T10:00:00.000Z', toRecipients: ['me@company.com'], ...over,
  };
}

describe('scoreEmail', () => {
  it('sole direct recipient with a direct ask from manager -> today', () => {
    const s = scoreEmail(email({
      from: 'boss@company.com',
      toRecipients: ['me@company.com'],
      bodyText: 'Can you review this and sign off?',
    }), ctx);
    expect(s.lane).toBe('today');
    expect(s.reasons).toContain('addressed only to you');
    expect(s.reasons).toContain('from your manager');
    expect(s.reasons).toContain('contains a direct request');
  });

  it('cc-only newsletter-style mail -> fyi', () => {
    const s = scoreEmail(email({
      from: 'list@company.com',
      toRecipients: ['team@company.com'],
      ccRecipients: ['me@company.com'],
      bodyText: 'Monthly update for your awareness.',
    }), ctx);
    expect(s.lane).toBe('fyi');
    expect(s.reasons).toContain("you are only cc'd");
  });

  it('plain on-To note with no ask -> this_week', () => {
    const s = scoreEmail(email({
      from: 'peer@company.com',
      toRecipients: ['me@company.com', 'other@company.com'],
      bodyText: 'Sharing notes from the sync.',
    }), ctx);
    expect(s.lane).toBe('this_week');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/scoring/email.test.ts`
Expected: FAIL - cannot find module `email`.

- [ ] **Step 3: Write the implementation**

```typescript
// src/scoring/email.ts
import type { DaybreakItem, ScoringContext, Lane } from '../model/item';

export interface EmailSignal {
  lane: Lane;
  rank: number;
  reasons: string[];
}

const ASK_PHRASES = [
  'can you', 'could you', 'would you', 'please', 'need your', 'your sign',
  'sign off', 'sign-off', 'approve', 'review', 'let me know', 'your input',
  'your feedback', 'waiting on you', 'blocked on you', 'action required',
];

function clamp(n: number): number {
  return Math.max(0, Math.min(100, n));
}

export function scoreEmail(item: DaybreakItem, ctx: ScoringContext): EmailSignal {
  const me = ctx.me.toLowerCase();
  const to = (item.toRecipients ?? []).map((s) => s.toLowerCase());
  const cc = (item.ccRecipients ?? []).map((s) => s.toLowerCase());
  const from = item.from.toLowerCase();
  const reasons: string[] = [];
  let rank = 30;

  const directTo = to.includes(me);
  const soleTo = directTo && to.length === 1;
  const ccOnly = !directTo && cc.includes(me);
  if (soleTo) { rank += 25; reasons.push('addressed only to you'); }
  else if (directTo) { rank += 15; reasons.push('on the To line'); }
  else if (ccOnly) { rank -= 20; reasons.push("you are only cc'd"); }

  const body = (item.bodyText ?? '').toLowerCase();
  const hasAsk = ASK_PHRASES.some((p) => body.includes(p));
  const hasQuestion = body.includes('?');
  if (hasAsk || (hasQuestion && directTo)) { rank += 20; reasons.push('contains a direct request'); }

  const managers = (ctx.managers ?? []).map((s) => s.toLowerCase());
  const reports = (ctx.reports ?? []).map((s) => s.toLowerCase());
  const frequent = (ctx.frequentContacts ?? []).map((s) => s.toLowerCase());
  if (managers.includes(from)) { rank += 20; reasons.push('from your manager'); }
  else if (reports.includes(from)) { rank += 10; reasons.push('from your report'); }
  else if (frequent.includes(from)) { rank += 5; reasons.push('frequent correspondent'); }

  let lane: Lane;
  if (rank >= 60) lane = 'today';
  else if (rank >= 25) lane = 'this_week';
  else lane = 'fyi';

  return { lane, rank: clamp(rank), reasons };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/scoring/email.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/scoring/email.ts tests/scoring/email.test.ts
git commit -m "feat: score internal email from addressing, ask, and relationship"
```

---

## Task 6: Vendor scorer

**Files:**
- Create: `src/scoring/vendor.ts`
- Test: `tests/scoring/vendor.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/scoring/vendor.test.ts
import { describe, it, expect } from 'vitest';
import { scoreVendor } from '../../src/scoring/vendor';
import type { DaybreakItem } from '../../src/model/item';

function vendor(subject: string, body = ''): DaybreakItem {
  return {
    id: 'v1', source: 'email_vendor', subject, from: 'noreply@vendor.com',
    receivedAt: '2026-05-30T10:00:00.000Z', bodyText: body,
  };
}

describe('scoreVendor', () => {
  it('security advisory -> today', () => {
    const s = scoreVendor(vendor('Critical security advisory: CVE-2026-1234'));
    expect(s.lane).toBe('today');
  });

  it('renewal/expiry -> this_week', () => {
    const s = scoreVendor(vendor('Your license expires soon', 'Renew by end of month.'));
    expect(s.lane).toBe('this_week');
  });

  it('invoice -> this_week', () => {
    const s = scoreVendor(vendor('Invoice #5567', 'Payment due in 14 days.'));
    expect(s.lane).toBe('this_week');
  });

  it('plain marketing -> fyi', () => {
    const s = scoreVendor(vendor('Check out our new features!'));
    expect(s.lane).toBe('fyi');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/scoring/vendor.test.ts`
Expected: FAIL - cannot find module `vendor`.

- [ ] **Step 3: Write the implementation**

```typescript
// src/scoring/vendor.ts
import type { DaybreakItem, Lane } from '../model/item';

export interface VendorSignal {
  lane: Lane;
  rank: number;
  reasons: string[];
}

const SECURITY = ['security advisory', 'vulnerability', 'cve-', 'breach', 'patch now', 'critical update', 'critical security'];
const EXPIRY = ['expires', 'expiring', 'renewal', 'renew by', 'contract end', 'will lapse', 'suspension', 'license expires'];
const INVOICE = ['invoice', 'payment due', 'past due', 'overdue'];

export function scoreVendor(item: DaybreakItem): VendorSignal {
  const text = `${item.subject} ${item.bodyText ?? ''}`.toLowerCase();
  if (SECURITY.some((k) => text.includes(k))) {
    return { lane: 'today', rank: 80, reasons: ['vendor security advisory'] };
  }
  if (EXPIRY.some((k) => text.includes(k)) || INVOICE.some((k) => text.includes(k))) {
    return { lane: 'this_week', rank: 55, reasons: ['vendor renewal / invoice / expiry'] };
  }
  return { lane: 'fyi', rank: 15, reasons: ['vendor / automated, no action signal'] };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/scoring/vendor.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/scoring/vendor.ts tests/scoring/vendor.test.ts
git commit -m "feat: score vendor mail by keyword patterns"
```

---

## Task 7: Resolved-while-away detector

Detects whether a thread was resolved after the user left, by scanning thread messages sent on or after `awaySince` for resolution phrases. v1 treats only explicit resolution language as definitive (to avoid false positives); a bare reply by someone else is intentionally NOT treated as resolution.

**Files:**
- Create: `src/scoring/resolved.ts`
- Test: `tests/scoring/resolved.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/scoring/resolved.test.ts
import { describe, it, expect } from 'vitest';
import { isResolvedWhileAway } from '../../src/scoring/resolved';
import type { DaybreakItem, ScoringContext } from '../../src/model/item';

const ctx: ScoringContext = {
  me: 'me@company.com',
  awaySince: '2026-05-25T00:00:00.000Z',
  now: '2026-06-08T08:00:00.000Z',
};

function withThread(messages: DaybreakItem['threadMessages']): DaybreakItem {
  return {
    id: 'e1', source: 'email_internal', subject: 's', from: 'peer@company.com',
    receivedAt: '2026-05-24T10:00:00.000Z', threadMessages: messages,
  };
}

describe('isResolvedWhileAway', () => {
  it('false when no thread messages', () => {
    expect(isResolvedWhileAway(withThread([]), ctx)).toBe(false);
    expect(isResolvedWhileAway(withThread(undefined), ctx)).toBe(false);
  });

  it('true when a later message says it is resolved', () => {
    const item = withThread([
      { from: 'peer@company.com', sentAt: '2026-05-28T09:00:00.000Z', bodyText: 'nvm, sorted it myself, thanks!' },
    ]);
    expect(isResolvedWhileAway(item, ctx)).toBe(true);
  });

  it('ignores resolution language from before the away window', () => {
    const item = withThread([
      { from: 'peer@company.com', sentAt: '2026-05-20T09:00:00.000Z', bodyText: 'all set now' },
    ]);
    expect(isResolvedWhileAway(item, ctx)).toBe(false);
  });

  it('false for an ordinary later reply with no resolution language', () => {
    const item = withThread([
      { from: 'peer@company.com', sentAt: '2026-05-28T09:00:00.000Z', bodyText: 'any update on this?' },
    ]);
    expect(isResolvedWhileAway(item, ctx)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/scoring/resolved.test.ts`
Expected: FAIL - cannot find module `resolved`.

- [ ] **Step 3: Write the implementation**

```typescript
// src/scoring/resolved.ts
import type { DaybreakItem, ScoringContext } from '../model/item';

const RESOLVED_PHRASES = [
  'resolved', 'sorted', 'nvm', 'never mind', 'no longer needed', 'all set',
  'disregard', 'please ignore', 'already handled', 'this is done', 'closing this out',
];

export function isResolvedWhileAway(item: DaybreakItem, ctx: ScoringContext): boolean {
  const msgs = item.threadMessages ?? [];
  const awaySince = new Date(ctx.awaySince).getTime();
  for (const m of msgs) {
    if (new Date(m.sentAt).getTime() < awaySince) continue;
    const body = (m.bodyText ?? '').toLowerCase();
    if (RESOLVED_PHRASES.some((p) => body.includes(p))) return true;
  }
  return false;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/scoring/resolved.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/scoring/resolved.ts tests/scoring/resolved.test.ts
git commit -m "feat: detect threads resolved while away"
```

---

## Task 8: Orchestrator (scoreItem / scoreAll)

Combines all signals. Source routing: JSM uses `scoreJsm`; vendor uses `scoreVendor`; internal email uses the sender tag when present (strong hint) else `scoreEmail`, then a body deadline can promote it upward. Finally, for any non-JSM item, resolved-while-away overrides to fyi (recipient view wins, even over a "blocked" tag). `scoreAll` sorts across lanes (today > this_week > fyi) then by rank descending.

**Files:**
- Create: `src/scoring/score.ts`
- Test: `tests/scoring/score.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/scoring/score.test.ts
import { describe, it, expect } from 'vitest';
import { scoreItem, scoreAll } from '../../src/scoring/score';
import type { DaybreakItem, ScoringContext } from '../../src/model/item';

const ctx: ScoringContext = {
  me: 'me@company.com',
  managers: ['boss@company.com'],
  awaySince: '2026-05-25T00:00:00.000Z',
  now: '2026-06-08T08:00:00.000Z', // Monday
};

describe('scoreItem', () => {
  it('a "blocked" sender tag lands today', () => {
    const item: DaybreakItem = {
      id: 'e1', source: 'email_internal', subject: 'help', from: 'peer@company.com',
      receivedAt: '2026-05-30T10:00:00.000Z', toRecipients: ['me@company.com'],
      bodyText: 'whenever', internetHeaders: { 'X-PTO-Triage': 'blocked' },
    };
    const s = scoreItem(item, ctx);
    expect(s.lane).toBe('today');
    expect(s.reasons).toContain('sender is blocked, waiting on you');
  });

  it('resolved-while-away overrides a blocked tag to fyi', () => {
    const item: DaybreakItem = {
      id: 'e2', source: 'email_internal', subject: 'help', from: 'peer@company.com',
      receivedAt: '2026-05-30T10:00:00.000Z', toRecipients: ['me@company.com'],
      internetHeaders: { 'X-PTO-Triage': 'blocked' },
      threadMessages: [{ from: 'peer@company.com', sentAt: '2026-05-31T10:00:00.000Z', bodyText: 'nvm, resolved' }],
    };
    const s = scoreItem(item, ctx);
    expect(s.lane).toBe('fyi');
    expect(s.resolved).toBe(true);
    expect(s.reasons).toContain('resolved while you were out');
  });

  it('a body deadline of today promotes an otherwise-weekly email to today', () => {
    const item: DaybreakItem = {
      id: 'e3', source: 'email_internal', subject: 'note', from: 'peer@company.com',
      receivedAt: '2026-05-30T10:00:00.000Z', toRecipients: ['me@company.com', 'x@company.com'],
      bodyText: 'sharing the meeting notes; the figures are due by EOD',
    };
    const s = scoreItem(item, ctx);
    expect(s.lane).toBe('today');
    expect(s.reasons.some((r) => r.startsWith('deadline'))).toBe(true);
  });

  it('JSM P1 assigned to me lands today', () => {
    const item: DaybreakItem = {
      id: 'J1', source: 'jsm', subject: 'down', from: 'jira@company.com',
      receivedAt: '2026-05-30T10:00:00.000Z',
      jsm: { assignee: 'me@company.com', priority: 'P1', slaStatus: 'ok', state: 'open' },
    };
    expect(scoreItem(item, ctx).lane).toBe('today');
  });
});

describe('scoreAll', () => {
  it('sorts today items before this_week before fyi', () => {
    const items: DaybreakItem[] = [
      { id: 'fyi', source: 'email_vendor', subject: 'newsletter', from: 'n@v.com', receivedAt: '2026-05-30T10:00:00.000Z', bodyText: 'news' },
      { id: 'today', source: 'jsm', subject: 'down', from: 'jira@company.com', receivedAt: '2026-05-30T10:00:00.000Z', jsm: { assignee: 'me@company.com', priority: 'P1', state: 'open' } },
    ];
    const out = scoreAll(items, ctx);
    expect(out[0].item.id).toBe('today');
    expect(out[1].item.id).toBe('fyi');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/scoring/score.test.ts`
Expected: FAIL - cannot find module `score`.

- [ ] **Step 3: Write the implementation**

```typescript
// src/scoring/score.ts
import type { DaybreakItem, ScoringContext, ScoredItem, Lane } from '../model/item';
import { scoreJsm } from './jsm';
import { scoreEmail } from './email';
import { scoreVendor } from './vendor';
import { parseSenderTag, type ParsedTag } from './sender-tag';
import { extractDeadline } from './deadline';
import { isResolvedWhileAway } from './resolved';

function laneRankOrder(l: Lane): number {
  return l === 'today' ? 3 : l === 'this_week' ? 2 : 1;
}

function laneForDeadline(deadline: Date, now: Date): Lane {
  const day = 24 * 60 * 60 * 1000;
  const ms = deadline.getTime() - now.getTime();
  if (ms <= day) return 'today';
  if (ms <= 7 * day) return 'this_week';
  return 'fyi';
}

function applyTag(tag: ParsedTag, now: Date): { lane: Lane; rank: number; reasons: string[] } {
  switch (tag.tag) {
    case 'blocked':
      return { lane: 'today', rank: 90, reasons: ['sender is blocked, waiting on you'] };
    case 'action': {
      if (tag.by) {
        const by = new Date(`${tag.by}T17:00:00`);
        if (!Number.isNaN(by.getTime())) {
          const lane = laneForDeadline(by, now);
          return { lane, rank: lane === 'today' ? 80 : 55, reasons: [`sender: action by ${tag.by}`] };
        }
      }
      return { lane: 'this_week', rank: 55, reasons: ['sender: action needed'] };
    }
    case 'whenever':
      return { lane: 'this_week', rank: 25, reasons: ['sender: whenever you get to it'] };
    case 'fyi':
      return { lane: 'fyi', rank: 10, reasons: ['sender: FYI, no reply needed'] };
  }
}

export function scoreItem(item: DaybreakItem, ctx: ScoringContext): ScoredItem {
  const now = new Date(ctx.now);
  let lane: Lane;
  let rank: number;
  let reasons: string[];
  let resolved = false;

  if (item.source === 'jsm' && item.jsm) {
    const s = scoreJsm(item.jsm, ctx.me);
    ({ lane, rank, reasons, resolved } = s);
  } else if (item.source === 'email_vendor') {
    const s = scoreVendor(item);
    ({ lane, rank, reasons } = s);
  } else {
    const tag = parseSenderTag(item.internetHeaders);
    if (tag) {
      const s = applyTag(tag, now);
      ({ lane, rank, reasons } = s);
    } else {
      const s = scoreEmail(item, ctx);
      ({ lane, rank, reasons } = s);
    }
    const dl = extractDeadline(item.bodyText ?? '', now);
    if (dl) {
      const promoted = laneForDeadline(dl, now);
      if (laneRankOrder(promoted) > laneRankOrder(lane)) {
        lane = promoted;
        rank = Math.max(rank, promoted === 'today' ? 85 : 50);
        reasons = [...reasons, `deadline ${dl.toISOString().slice(0, 10)}`];
      }
    }
  }

  // recipient view wins: a thread resolved while away drops to fyi regardless of any tag
  if (item.source !== 'jsm' && isResolvedWhileAway(item, ctx)) {
    return { item, lane: 'fyi', rank: 5, reasons: ['resolved while you were out'], resolved: true };
  }

  return { item, lane, rank, reasons, resolved };
}

export function scoreAll(items: DaybreakItem[], ctx: ScoringContext): ScoredItem[] {
  return items
    .map((i) => scoreItem(i, ctx))
    .sort((a, b) => laneRankOrder(b.lane) - laneRankOrder(a.lane) || b.rank - a.rank);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/scoring/score.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/scoring/score.ts tests/scoring/score.test.ts
git commit -m "feat: orchestrate per-source scoring into lane assignments"
```

---

## Task 9: Summary builder

**Files:**
- Create: `src/summary/summary.ts`
- Test: `tests/summary/summary.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/summary/summary.test.ts
import { describe, it, expect } from 'vitest';
import { buildSummary } from '../../src/summary/summary';
import type { ScoredItem } from '../../src/model/item';

function scored(over: Partial<ScoredItem>): ScoredItem {
  return {
    item: { id: 'x', source: 'email_internal', subject: 's', from: 'a@b.com', receivedAt: '2026-05-30T10:00:00.000Z' },
    lane: 'this_week', rank: 30, reasons: [], resolved: false, ...over,
  };
}

describe('buildSummary', () => {
  it('counts items per lane, SLA risk, and resolved-while-away', () => {
    const items: ScoredItem[] = [
      scored({ lane: 'today' }),
      scored({ lane: 'today', item: { id: 'j', source: 'jsm', subject: 's', from: 'jira', receivedAt: '2026-05-30T10:00:00.000Z', jsm: { slaStatus: 'at_risk' } } }),
      scored({ lane: 'this_week' }),
      scored({ lane: 'fyi', resolved: true }),
    ];
    const s = buildSummary(items);
    expect(s.needsTodayCount).toBe(2);
    expect(s.thisWeekCount).toBe(1);
    expect(s.fyiCount).toBe(1);
    expect(s.slaAtRiskCount).toBe(1);
    expect(s.resolvedWhileAwayCount).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/summary/summary.test.ts`
Expected: FAIL - cannot find module `summary`.

- [ ] **Step 3: Write the implementation**

```typescript
// src/summary/summary.ts
import type { ScoredItem } from '../model/item';

export interface Summary {
  needsTodayCount: number;
  thisWeekCount: number;
  fyiCount: number;
  slaAtRiskCount: number;
  resolvedWhileAwayCount: number;
}

export function buildSummary(scored: ScoredItem[]): Summary {
  return {
    needsTodayCount: scored.filter((s) => s.lane === 'today').length,
    thisWeekCount: scored.filter((s) => s.lane === 'this_week').length,
    fyiCount: scored.filter((s) => s.lane === 'fyi').length,
    slaAtRiskCount: scored.filter(
      (s) => s.item.jsm && (s.item.jsm.slaStatus === 'breached' || s.item.jsm.slaStatus === 'at_risk'),
    ).length,
    resolvedWhileAwayCount: scored.filter((s) => s.resolved).length,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/summary/summary.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add src/summary/summary.ts tests/summary/summary.test.ts
git commit -m "feat: build while-you-were-out summary"
```

---

## Task 10: CLI + fixture (end-to-end)

Reads a JSON file of `{ context, items }`, scores everything, and prints `{ summary, scored }`. This proves the whole pipeline on realistic data without any Electron/network.

**Files:**
- Create: `fixtures/sample-backlog.json`
- Create: `src/cli.ts`
- Test: `tests/cli.test.ts`

- [ ] **Step 1: Create the fixture**

```json
{
  "context": {
    "me": "me@company.com",
    "managers": ["boss@company.com"],
    "reports": ["report@company.com"],
    "frequentContacts": ["peer@company.com"],
    "awaySince": "2026-05-25T00:00:00.000Z",
    "now": "2026-06-08T08:00:00.000Z"
  },
  "items": [
    {
      "id": "JSM-101", "source": "jsm", "subject": "Prod API 500s", "from": "jira@company.com",
      "receivedAt": "2026-05-29T03:00:00.000Z",
      "jsm": { "assignee": "me@company.com", "priority": "P1", "slaStatus": "at_risk", "state": "open" }
    },
    {
      "id": "MAIL-1", "source": "email_internal", "subject": "Sign-off needed", "from": "boss@company.com",
      "receivedAt": "2026-05-30T09:00:00.000Z", "toRecipients": ["me@company.com"],
      "bodyText": "Can you approve the budget by EOD?",
      "internetHeaders": { "X-PTO-Triage": "action;by=2026-06-08" }
    },
    {
      "id": "MAIL-2", "source": "email_internal", "subject": "Re: deploy question", "from": "peer@company.com",
      "receivedAt": "2026-05-26T11:00:00.000Z", "toRecipients": ["me@company.com"],
      "bodyText": "Quick q about the pipeline",
      "threadMessages": [
        { "from": "peer@company.com", "sentAt": "2026-05-27T08:00:00.000Z", "bodyText": "nvm, sorted it, thanks!" }
      ]
    },
    {
      "id": "VEND-1", "source": "email_vendor", "subject": "Critical security advisory CVE-2026-9", "from": "security@vendor.com",
      "receivedAt": "2026-05-31T12:00:00.000Z", "bodyText": "Patch now."
    },
    {
      "id": "VEND-2", "source": "email_vendor", "subject": "Spring sale!", "from": "marketing@vendor.com",
      "receivedAt": "2026-05-31T12:00:00.000Z", "bodyText": "Big discounts inside."
    }
  ]
}
```

- [ ] **Step 2: Write the CLI**

```typescript
// src/cli.ts
import { readFileSync } from 'node:fs';
import { scoreAll } from './scoring/score';
import { buildSummary } from './summary/summary';
import type { DaybreakItem, ScoringContext } from './model/item';

interface Input {
  context: ScoringContext;
  items: DaybreakItem[];
}

function run(path: string): { summary: ReturnType<typeof buildSummary>; scored: ReturnType<typeof scoreAll> } {
  const input = JSON.parse(readFileSync(path, 'utf8')) as Input;
  const scored = scoreAll(input.items, input.context);
  const summary = buildSummary(scored);
  return { summary, scored };
}

const path = process.argv[2];
if (path) {
  const result = run(path);
  console.log(JSON.stringify(result, null, 2));
}

export { run };
```

- [ ] **Step 3: Write the failing test**

```typescript
// tests/cli.test.ts
import { describe, it, expect } from 'vitest';
import { run } from '../src/cli';

describe('cli run over fixture', () => {
  it('scores the sample backlog into the expected lanes', () => {
    const { summary, scored } = run('fixtures/sample-backlog.json');

    const lane = (id: string) => scored.find((s) => s.item.id === id)!.lane;
    expect(lane('JSM-101')).toBe('today');   // P1 + SLA at risk, assigned to me
    expect(lane('MAIL-1')).toBe('today');    // action;by=today
    expect(lane('MAIL-2')).toBe('fyi');      // resolved while away
    expect(lane('VEND-1')).toBe('today');    // security advisory
    expect(lane('VEND-2')).toBe('fyi');      // marketing

    expect(summary.needsTodayCount).toBe(3);
    expect(summary.resolvedWhileAwayCount).toBe(1);
    expect(summary.slaAtRiskCount).toBe(1);

    // sorted today-first
    expect(scored[0].lane).toBe('today');
  });
});
```

- [ ] **Step 4: Run test to verify it fails, then passes**

Run: `npx vitest run tests/cli.test.ts`
Expected: initially FAIL if any path is wrong; once files are in place, PASS (1 test).

- [ ] **Step 5: Run the CLI for real**

Run: `npm run score -- fixtures/sample-backlog.json`
Expected: prints a JSON object with `summary` (needsTodayCount 3) and a `scored` array sorted today-first.

- [ ] **Step 6: Run the full suite and typecheck**

Run: `npm test && npm run typecheck`
Expected: all test files pass, `tsc --noEmit` reports no errors.

- [ ] **Step 7: Commit**

```bash
git add src/cli.ts tests/cli.test.ts fixtures/sample-backlog.json
git commit -m "feat: add scoring CLI and end-to-end fixture test"
```

---

## Self-Review (completed by plan author)

**Spec coverage:**
- Three urgency lanes (today / this_week / fyi) - Tasks 1, 8.
- Priority varies by source (JSM parsed, email inferred, vendor pattern, sender tag hint) - Tasks 4, 5, 6, 2, 8.
- Sender vocabulary: the four locked options carried via `X-PTO-Triage`, optional and additive, hint-not-command - Tasks 2, 8 (`applyTag`, resolved override beats a blocked tag).
- No bare "Urgent": urgency earned via date/blocked - enforced in `applyTag` (no urgent case) and `scoreEmail` (no importance axis).
- Deadline extraction from body promotes upward - Tasks 3, 8.
- "Resolved while you were out" down-ranking - Tasks 7, 8.
- "While you were out" summary - Task 9.
- Within-lane ranking + cross-lane sort - Task 8 (`scoreAll`).
- Pure/local, no network or email egress - whole package; satisfies the security posture for v1.

**Deferred to later plans (correctly out of scope here):** Electron shell, M365/Graph ingestion + OAuth + keychain (Plan 2), JSM API ingestion + triage UI + re-rank/cleared persistence (Plan 3), Outlook compose add-in (Plan 4). The away-window trigger is data-only here (`awaySince` in context); the manual "I'm back" UI lives in Plan 3.

**Placeholder scan:** none - every code and test step contains complete content.

**Type consistency:** `DaybreakItem`, `ScoringContext`, `ScoredItem`, `Lane`, `JsmFields`, `ParsedTag` are defined once (Tasks 1, 2) and used consistently; signal interfaces (`JsmSignal`, `EmailSignal`, `VendorSignal`) feed the orchestrator's destructuring in Task 8.

## Known v1 limitations (intentional, documented)
- Deadline parser covers ISO dates, today/EOD/COB, tomorrow, and weekday names - not "by June 20" month-name phrasing. The sender `action;by=YYYY-MM-DD` tag covers explicit dates, so free-text parsing is a bonus.
- Resolution detection requires explicit resolution language; a bare reply by someone else is not treated as resolved (favoring false negatives over false positives).
- Relationship signals (manager/report/frequent) are supplied via context; populating them is a Plan 2/3 concern.
