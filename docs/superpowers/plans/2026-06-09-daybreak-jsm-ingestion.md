# Daybreak JSM Ingestion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Jira Service Management tickets as a second source into Daybreak's triage pipeline - fetch the user's assigned, not-Done, in-window tickets from Jira Cloud and normalize them into `DaybreakItem`s that the existing scorer/UI consume unchanged.

**Architecture:** A `src/ingest/jsm-*` module set mirroring the Graph layer: keychain-backed API-token auth, a paged JQL-search client, pure normalization (issue -> `DaybreakItem` with `JsmFields`), and an orchestrator. The desktop app's `buildView` and the `cli-ingest` dev command ingest email and JSM, concatenate the items, and score them together. JSM is independent and optional - if Jira is unconfigured or fails, it is skipped and email-only triage still works.

**Tech Stack:** TypeScript (strict, ESM), Node global `fetch`, `keytar` (already a dependency), Vitest, tsx. Jira Cloud REST API (HTTP Basic with an Atlassian API token).

**House rules:** No em dashes anywhere in code or comments - use regular hyphens. The pure logic (auth-header, JQL, priority/SLA mapping, normalization) and the mocked-fetch client get TDD; the keychain auth, live Jira fetch, orchestrator, and the buildView/CLI wiring are typecheck-gated + manually verified, exactly as the Graph ingestion (Plan 2) was.

## Prerequisites (you, once, before the live verification in Task 7)

1. In Jira, create an API token: id.atlassian.com -> Security -> API tokens -> Create.
2. Export `DAYBREAK_JIRA_BASE_URL` (e.g. `https://yourcompany.atlassian.net`) and `DAYBREAK_JIRA_EMAIL` (your Atlassian account email), then restart your shell.
3. Store the token in the keychain (Task 1 adds this command): `npm run jira:login -- <your-api-token>`.

---

## File Structure

All new files under `src/ingest/` (mirroring `graph-*`), plus a login CLI and two wiring edits.

- `src/ingest/jsm-auth.ts` - `buildBasicAuth` (PURE), `getJiraAuth`/`storeJiraToken`/`clearJiraToken` (keychain + env).
- `src/ingest/jsm-types.ts` - the Jira issue/search JSON shapes consumed.
- `src/ingest/jsm-client.ts` - `buildJql` (PURE) + `fetchAssignedTickets` (paged fetch, mocked-fetch tested).
- `src/ingest/jsm-normalize.ts` - PURE: `mapPriority`, `readSlaStatus`, `jsmIssueToItem`.
- `src/ingest/jsm-ingest.ts` - `ingestJsm` orchestrator.
- `src/cli-jira-login.ts` - stores the API token in the keychain.
- Modify: `src/main/ingest-runner.ts` (merge JSM into `buildView`), `src/cli-ingest.ts` (merge JSM into the CLI), `package.json` (the `jira:login` script).
- Tests: `tests/ingest/jsm-auth.test.ts`, `jsm-client.test.ts`, `jsm-normalize.test.ts`.

**Phasing (for execution grouping):** A = pure logic + mocked client (Tasks 1-4); B = orchestrator + wiring (Tasks 5-6); C = docs + manual verification (Task 7).

---

## Task 1: jsm-auth (pure header TDD + keychain auth + login CLI)

**Files:**
- Create: `src/ingest/jsm-auth.ts`, `src/cli-jira-login.ts`
- Modify: `package.json` (add the `jira:login` script)
- Test: `tests/ingest/jsm-auth.test.ts`

- [ ] **Step 1: Write the failing test (pure part)**

```typescript
// tests/ingest/jsm-auth.test.ts
import { describe, it, expect } from 'vitest';
import { buildBasicAuth } from '../../src/ingest/jsm-auth';

describe('buildBasicAuth', () => {
  it('builds a Basic header from email + token', () => {
    // base64 of "me@co.com:tok123"
    const expected = 'Basic ' + Buffer.from('me@co.com:tok123').toString('base64');
    expect(buildBasicAuth('me@co.com', 'tok123')).toBe(expected);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ingest/jsm-auth.test.ts`
Expected: FAIL - cannot find module `jsm-auth`.

- [ ] **Step 3: Write `src/ingest/jsm-auth.ts`**

```typescript
// src/ingest/jsm-auth.ts
import keytar from 'keytar';

const SERVICE = 'Daybreak';
const ACCOUNT = 'jira-api-token';

// Pure: the HTTP Basic credential for the Jira Cloud REST API.
export function buildBasicAuth(email: string, token: string): string {
  return 'Basic ' + Buffer.from(`${email}:${token}`).toString('base64');
}

export interface JiraAuth {
  baseUrl: string;
  email: string;
  header: string;
}

// Reads base URL + email from env and the API token from the OS keychain. Returns
// null when any piece is missing, so JSM ingestion is simply skipped (optional).
export async function getJiraAuth(): Promise<JiraAuth | null> {
  const baseUrl = process.env.DAYBREAK_JIRA_BASE_URL;
  const email = process.env.DAYBREAK_JIRA_EMAIL;
  const token = await keytar.getPassword(SERVICE, ACCOUNT);
  if (!baseUrl || !email || !token) return null;
  return { baseUrl: baseUrl.replace(/\/$/, ''), email, header: buildBasicAuth(email, token) };
}

export async function storeJiraToken(token: string): Promise<void> {
  await keytar.setPassword(SERVICE, ACCOUNT, token);
}

export async function clearJiraToken(): Promise<void> {
  await keytar.deletePassword(SERVICE, ACCOUNT);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/ingest/jsm-auth.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Write the login CLI**

```typescript
// src/cli-jira-login.ts
import { storeJiraToken } from './ingest/jsm-auth';

const token = process.argv[2];
if (!token) {
  console.error('Usage: npm run jira:login -- <api-token>');
  process.exit(1);
}
storeJiraToken(token)
  .then(() => console.log('Jira API token stored in the OS keychain.'))
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
```

- [ ] **Step 6: Add the npm script**

In `package.json` `scripts`, add after the `ingest` line:

```json
    "jira:login": "tsx src/cli-jira-login.ts",
```

- [ ] **Step 7: Typecheck + commit**

Run: `npm run typecheck`
Expected: both projects clean.

```bash
git add src/ingest/jsm-auth.ts src/cli-jira-login.ts package.json tests/ingest/jsm-auth.test.ts
git commit -m "feat(jsm): API-token auth helpers + keychain login CLI"
```

---

## Task 2: Jira types + JQL builder (TDD)

**Files:**
- Create: `src/ingest/jsm-types.ts`
- Test: `tests/ingest/jsm-client.test.ts` (the `buildJql` portion; `fetchAssignedTickets` is added in Task 4)

- [ ] **Step 1: Write the failing test**

```typescript
// tests/ingest/jsm-client.test.ts
import { describe, it, expect } from 'vitest';
import { buildJql } from '../../src/ingest/jsm-client';

describe('buildJql', () => {
  it('scopes to the current user, not-Done, updated since the date (day precision)', () => {
    const jql = buildJql('2026-05-26T00:00:00.000Z');
    expect(jql).toContain('assignee = currentUser()');
    expect(jql).toContain('statusCategory != Done');
    expect(jql).toContain('updated >= "2026-05-26"');
    expect(jql).toContain('ORDER BY updated DESC');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ingest/jsm-client.test.ts`
Expected: FAIL - cannot find module `jsm-client`.

- [ ] **Step 3: Write the Jira types**

```typescript
// src/ingest/jsm-types.ts

export interface JiraUser {
  displayName?: string;
  emailAddress?: string;
}

// Only the fields Daybreak reads. Jira returns much more. The SLA field is a custom
// field whose key varies per instance, so it is not named here; it is discovered
// generically in normalization (an object carrying an ongoingCycle).
export interface JiraIssueFields {
  summary?: string;
  status?: { name?: string };
  priority?: { name?: string };
  assignee?: JiraUser | null;
  reporter?: JiraUser | null;
  created?: string;
  updated?: string;
  [key: string]: unknown; // for the SLA custom field discovery
}

export interface JiraIssue {
  key: string;
  fields: JiraIssueFields;
}

// Shape of the enhanced JQL-search response (token-based paging).
export interface JiraSearchResponse {
  issues: JiraIssue[];
  nextPageToken?: string;
  isLast?: boolean;
}
```

- [ ] **Step 4: Write `buildJql` in `src/ingest/jsm-client.ts`**

```typescript
// src/ingest/jsm-client.ts
import type { JiraIssue, JiraSearchResponse } from './jsm-types';
import type { JiraAuth } from './jsm-auth';

// JQL: assigned to me, not in a Done status category, updated on/after the away
// date. Jira JQL takes a day-precision date string, so trim the ISO timestamp.
export function buildJql(sinceISO: string): string {
  const day = sinceISO.slice(0, 10);
  return `assignee = currentUser() AND statusCategory != Done AND updated >= "${day}" ORDER BY updated DESC`;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/ingest/jsm-client.test.ts`
Expected: PASS (1 test).

- [ ] **Step 6: Commit**

```bash
git add src/ingest/jsm-types.ts src/ingest/jsm-client.ts tests/ingest/jsm-client.test.ts
git commit -m "feat(jsm): Jira issue types and JQL builder"
```

---

## Task 3: Normalization (TDD)

`mapPriority` maps Jira's per-instance priority names to P1-P4. `readSlaStatus` discovers the JSM SLA object generically and interprets it best-effort. `jsmIssueToItem` produces the `DaybreakItem` the scorer reads.

**Files:**
- Create: `src/ingest/jsm-normalize.ts`
- Test: `tests/ingest/jsm-normalize.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/ingest/jsm-normalize.test.ts
import { describe, it, expect } from 'vitest';
import { mapPriority, readSlaStatus, jsmIssueToItem } from '../../src/ingest/jsm-normalize';
import type { JiraIssue } from '../../src/ingest/jsm-types';

describe('mapPriority', () => {
  it('maps common scheme names to P1-P4', () => {
    expect(mapPriority('Highest')).toBe('P1');
    expect(mapPriority('Critical')).toBe('P1');
    expect(mapPriority('High')).toBe('P2');
    expect(mapPriority('Medium')).toBe('P3');
    expect(mapPriority('Low')).toBe('P4');
    expect(mapPriority('P1')).toBe('P1');
  });
  it('returns undefined for unknown or missing', () => {
    expect(mapPriority('Spicy')).toBeUndefined();
    expect(mapPriority(undefined)).toBeUndefined();
  });
});

describe('readSlaStatus', () => {
  it('reads breached from an ongoing cycle', () => {
    const fields = { customfield_1: { ongoingCycle: { breached: true, remainingTime: { millis: -1000 } } } };
    expect(readSlaStatus(fields)).toBe('breached');
  });
  it('reads at_risk when remaining time is at or below the threshold', () => {
    const fields = { customfield_1: { ongoingCycle: { breached: false, remainingTime: { millis: 60 * 60 * 1000 } } } };
    expect(readSlaStatus(fields)).toBe('at_risk');
  });
  it('reads ok with ample remaining time', () => {
    const fields = { customfield_1: { ongoingCycle: { breached: false, remainingTime: { millis: 48 * 60 * 60 * 1000 } } } };
    expect(readSlaStatus(fields)).toBe('ok');
  });
  it('returns none when no SLA object is present', () => {
    expect(readSlaStatus({ summary: 'x', status: { name: 'Open' } })).toBe('none');
  });
});

describe('jsmIssueToItem', () => {
  const issue: JiraIssue = {
    key: 'INC-4821',
    fields: {
      summary: 'Payments API returning 500s',
      status: { name: 'In Progress' },
      priority: { name: 'Highest' },
      reporter: { displayName: 'Pat Reporter' },
      created: '2026-05-05T09:00:00.000Z',
      updated: '2026-05-07T09:00:00.000Z',
      customfield_1: { ongoingCycle: { breached: true, remainingTime: { millis: -1 } } },
    },
  };

  it('maps an issue to a jsm DaybreakItem', () => {
    const item = jsmIssueToItem(issue, 'me@company.com', 'https://co.atlassian.net');
    expect(item.id).toBe('INC-4821');
    expect(item.source).toBe('jsm');
    expect(item.subject).toBe('Payments API returning 500s');
    expect(item.from).toBe('Pat Reporter');
    expect(item.receivedAt).toBe('2026-05-07T09:00:00.000Z');
    expect(item.webLink).toBe('https://co.atlassian.net/browse/INC-4821');
    expect(item.jsm).toEqual({ assignee: 'me@company.com', priority: 'P1', slaStatus: 'breached', state: 'In Progress' });
  });

  it('falls back gracefully on missing optional fields', () => {
    const bare: JiraIssue = { key: 'REQ-1', fields: { updated: '2026-05-07T09:00:00.000Z' } };
    const item = jsmIssueToItem(bare, 'me@company.com', 'https://co.atlassian.net');
    expect(item.subject).toBe('');
    expect(item.from).toBe('JSM');
    expect(item.jsm?.assignee).toBe('me@company.com');
    expect(item.jsm?.priority).toBeUndefined();
    expect(item.jsm?.slaStatus).toBe('none');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ingest/jsm-normalize.test.ts`
Expected: FAIL - cannot find module `jsm-normalize`.

- [ ] **Step 3: Write the implementation**

```typescript
// src/ingest/jsm-normalize.ts
import type { DaybreakItem, JsmFields } from '../model/item';
import type { JiraIssue, JiraIssueFields } from './jsm-types';

const PRIORITY = new Map<string, JsmFields['priority']>([
  ['highest', 'P1'], ['critical', 'P1'], ['p1', 'P1'],
  ['high', 'P2'], ['major', 'P2'], ['p2', 'P2'],
  ['medium', 'P3'], ['p3', 'P3'],
  ['low', 'P4'], ['minor', 'P4'], ['lowest', 'P4'], ['p4', 'P4'],
]);

export function mapPriority(name?: string): JsmFields['priority'] {
  if (!name) return undefined;
  return PRIORITY.get(name.trim().toLowerCase());
}

// at_risk if the SLA will breach within this window.
const AT_RISK_MS = 4 * 60 * 60 * 1000;

// JSM SLA fields are custom fields whose key varies per instance, so find the value
// generically: an object carrying an `ongoingCycle`. Best-effort by design.
export function readSlaStatus(fields: JiraIssueFields): JsmFields['slaStatus'] {
  for (const value of Object.values(fields)) {
    if (value && typeof value === 'object' && 'ongoingCycle' in value) {
      const cycle = (value as { ongoingCycle?: { breached?: boolean; remainingTime?: { millis?: number } } }).ongoingCycle;
      if (!cycle) continue;
      if (cycle.breached) return 'breached';
      const millis = cycle.remainingTime?.millis;
      if (typeof millis === 'number' && millis <= AT_RISK_MS) return 'at_risk';
      return 'ok';
    }
  }
  return 'none';
}

export function jsmIssueToItem(issue: JiraIssue, me: string, baseUrl: string): DaybreakItem {
  const f = issue.fields;
  return {
    id: issue.key,
    source: 'jsm',
    subject: f.summary ?? '',
    from: f.reporter?.displayName ?? 'JSM',
    receivedAt: f.updated ?? f.created ?? '',
    webLink: `${baseUrl}/browse/${issue.key}`,
    jsm: {
      assignee: me, // every fetched ticket is assigned to the current user
      priority: mapPriority(f.priority?.name),
      slaStatus: readSlaStatus(f),
      state: f.status?.name,
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/ingest/jsm-normalize.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/ingest/jsm-normalize.ts tests/ingest/jsm-normalize.test.ts
git commit -m "feat(jsm): priority mapping, best-effort SLA, issue normalization"
```

---

## Task 4: Paged Jira fetch (mocked-fetch test)

`fetchAssignedTickets` POSTs to the enhanced JQL-search endpoint, follows `nextPageToken` paging up to a cap, sends the Basic auth header, and throws on a non-OK response. Tested with a mocked global `fetch`, mirroring the Graph client.

**Files:**
- Modify: `src/ingest/jsm-client.ts` (add `fetchAssignedTickets`)
- Test: `tests/ingest/jsm-client.test.ts` (add the fetch cases)

- [ ] **Step 1: Add the failing tests**

Append to `tests/ingest/jsm-client.test.ts`:

```typescript
import { vi, afterEach } from 'vitest';
import { fetchAssignedTickets } from '../../src/ingest/jsm-client';
import type { JiraSearchResponse } from '../../src/ingest/jsm-types';

const auth = { baseUrl: 'https://co.atlassian.net', email: 'me@co.com', header: 'Basic abc' };

describe('fetchAssignedTickets', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('follows nextPageToken paging and sends the auth header', async () => {
    const page1: JiraSearchResponse = { issues: [{ key: 'A-1', fields: {} }], nextPageToken: 'tok2', isLast: false };
    const page2: JiraSearchResponse = { issues: [{ key: 'A-2', fields: {} }], isLast: true };
    const seenAuth: string[] = [];
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      seenAuth.push((init?.headers as Record<string, string>).Authorization);
      const body = fetchMock.mock.calls.length === 1 ? page1 : page2;
      return { ok: true, json: async () => body } as Response;
    });
    vi.stubGlobal('fetch', fetchMock);

    const issues = await fetchAssignedTickets(auth, '2026-05-26T00:00:00.000Z');
    expect(issues.map((i) => i.key)).toEqual(['A-1', 'A-2']);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(seenAuth.every((a) => a === 'Basic abc')).toBe(true);
  });

  it('throws on a non-OK response', async () => {
    const fetchMock = vi.fn(async () => ({ ok: false, status: 401, text: async () => 'Unauthorized' } as Response));
    vi.stubGlobal('fetch', fetchMock);
    await expect(fetchAssignedTickets(auth, '2026-05-26T00:00:00.000Z')).rejects.toThrow('Jira 401');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/ingest/jsm-client.test.ts`
Expected: FAIL - `fetchAssignedTickets` is not exported.

- [ ] **Step 3: Add `fetchAssignedTickets` to `src/ingest/jsm-client.ts`**

```typescript
// append to src/ingest/jsm-client.ts

const SEARCH_PATH = '/rest/api/3/search/jql';

// Fetch assigned, not-Done, in-window tickets, following token paging up to `cap`
// issues. Requests all fields so the per-instance SLA custom field is discoverable
// during normalization. Logs if the cap is hit; never runs unbounded.
export async function fetchAssignedTickets(
  auth: JiraAuth,
  sinceISO: string,
  cap = 200,
): Promise<JiraIssue[]> {
  const jql = buildJql(sinceISO);
  const out: JiraIssue[] = [];
  let nextPageToken: string | undefined;

  do {
    const resp: Response = await fetch(`${auth.baseUrl}${SEARCH_PATH}`, {
      method: 'POST',
      headers: {
        Authorization: auth.header,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ jql, fields: ['*all'], maxResults: 100, nextPageToken }),
    });
    if (!resp.ok) {
      throw new Error(`Jira ${resp.status}: ${await resp.text()}`);
    }
    const page = (await resp.json()) as JiraSearchResponse;
    out.push(...page.issues);
    nextPageToken = page.isLast ? undefined : page.nextPageToken;
  } while (nextPageToken && out.length < cap);

  if (nextPageToken) {
    console.warn(`Daybreak: reached the ${cap}-ticket cap; older tickets were not fetched.`);
  }
  return out.slice(0, cap);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/ingest/jsm-client.test.ts`
Expected: PASS (3 tests: buildJql + the two fetch cases).

- [ ] **Step 5: Commit**

```bash
git add src/ingest/jsm-client.ts tests/ingest/jsm-client.test.ts
git commit -m "feat(jsm): paged Jira JQL-search client"
```

---

## Task 5: ingestJsm orchestrator

Wires auth -> fetch -> normalize. Returns `[]` when Jira is unconfigured. INTEGRATION; typecheck-gated, run live in Task 7.

**Files:**
- Create: `src/ingest/jsm-ingest.ts`

- [ ] **Step 1: Write the implementation**

```typescript
// src/ingest/jsm-ingest.ts
import { getJiraAuth } from './jsm-auth';
import { fetchAssignedTickets } from './jsm-client';
import { jsmIssueToItem } from './jsm-normalize';
import type { DaybreakItem } from '../model/item';

// Ingest the user's assigned, in-window JSM tickets as DaybreakItems. Returns an
// empty array when Jira is not configured, so callers can merge unconditionally.
// `me` is the cross-source identity; if absent it falls back to the Jira email.
export async function ingestJsm(sinceISO: string, me?: string): Promise<DaybreakItem[]> {
  const auth = await getJiraAuth();
  if (!auth) return [];
  const who = me ?? auth.email.toLowerCase();
  const issues = await fetchAssignedTickets(auth, sinceISO);
  return issues.map((issue) => jsmIssueToItem(issue, who, auth.baseUrl));
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: both projects clean.

- [ ] **Step 3: Commit**

```bash
git add src/ingest/jsm-ingest.ts
git commit -m "feat(jsm): ingestJsm orchestrator (skips when unconfigured)"
```

---

## Task 6: Merge JSM into buildView and the CLI

JSM items are concatenated with email items before scoring. A JSM failure degrades gracefully (logged, email triage continues). INTEGRATION; typecheck-gated, run live in Task 7.

**Files:**
- Modify: `src/main/ingest-runner.ts`, `src/cli-ingest.ts`

- [ ] **Step 1: Merge into `buildView` (src/main/ingest-runner.ts)**

Add the import near the other ingest imports (ingest-runner.ts is in `src/main/`, so the path to `src/ingest/jsm-ingest.ts` is `'../ingest/jsm-ingest'`):

```typescript
import { ingestJsm } from '../ingest/jsm-ingest';
```

In the NON-demo branch of `buildView`, right after `me`/`items` are set from `ingestBacklog`, append JSM items:

```typescript
      me = ingested.me;
      items = ingested.items;
      try {
        const jsmItems = await ingestJsm(sinceISO, me);
        if (jsmItems.length) items = [...items, ...jsmItems];
      } catch (err) {
        // JSM is optional; a Jira failure must not break email triage.
        console.warn('Daybreak: JSM ingest failed -', err instanceof Error ? err.message : err);
      }
```

(Locate the existing `me = ingested.me; items = ingested.items;` lines in the else branch and insert the try/catch immediately after them. Leave the demo branch unchanged.)

- [ ] **Step 2: Merge into the CLI (src/cli-ingest.ts)**

Add the import:

```typescript
import { ingestJsm } from './ingest/jsm-ingest';
```

Change the `main()` body so JSM items join the email items before scoring:

```typescript
  const { me, items: emailItems } = await ingestBacklog(sinceISO);
  let items = emailItems;
  try {
    const jsmItems = await ingestJsm(sinceISO, me);
    if (jsmItems.length) items = [...emailItems, ...jsmItems];
  } catch (err) {
    console.warn('Daybreak: JSM ingest failed -', err instanceof Error ? err.message : err);
  }
  const scored = scoreAll(items, { me, awaySince: sinceISO, now: now.toISOString() });
```

(Replace the existing `const { me, items } = await ingestBacklog(sinceISO);` and the `scoreAll(items, ...)` line accordingly; keep the rest of `main` - the summary + console.log - the same, using `items`.)

- [ ] **Step 3: Typecheck + full suite + build:main**

Run: `npm run typecheck && npm test && npm run build:main`
Expected: both projects clean; all tests pass (the new pure/mocked JSM tests included); main bundles to CJS.

- [ ] **Step 4: Commit**

```bash
git add src/main/ingest-runner.ts src/cli-ingest.ts
git commit -m "feat(jsm): merge JSM tickets into buildView and the ingest CLI"
```

---

## Task 7: Config doc + manual verification

No new code. Documents the Jira setup and verifies end to end against a real instance.

- [ ] **Step 1: Run the full suite + typecheck (regression gate)**

Run: `npm test && npm run typecheck`
Expected: all pass, both projects clean.

- [ ] **Step 2: Configure Jira (you, once)**

Export and restart your shell:
```bash
export DAYBREAK_JIRA_BASE_URL="https://yourcompany.atlassian.net"
export DAYBREAK_JIRA_EMAIL="you@yourcompany.com"
```
Store the API token in the keychain:
```bash
npm run jira:login -- <your-api-token>
```

- [ ] **Step 3: Verify via the CLI**

Run: `npm run ingest -- --since 2026-05-26T00:00:00Z`
Expected: the printed JSON `scored` array now includes `source: "jsm"` items (your assigned, not-Done, recently-updated tickets) alongside email. Verify by eye:
- A P1 or SLA-breached assigned ticket lands in the `today` lane with reasons mentioning priority/SLA.
- Closed/resolved tickets do not appear (filtered by `statusCategory != Done`).
- If SLA shows `none` on tickets that do have SLAs, note it - the SLA field discovery may need adjusting for your instance (the documented best-effort caveat); priority/state scoring still works.

- [ ] **Step 4: Verify in the app**

Run: `npm run app:dev` (with the Jira env set and an away window). Expected: JSM tickets appear under the "System" source group in the lanes. (Demo mode is unaffected; it uses its own sample data.)

- [ ] **Step 5: (optional) Note for go-live**

JSM config currently lives in env + keychain (like the Graph creds). A Settings surface for the Jira connection, alongside the rules panel, is a later enhancement.

---

## Self-Review (completed by plan author)

**Spec coverage:**
- `jsm-*` module set mirroring Graph - Tasks 1-5.
- API-token auth, token in keychain, base URL + email in env, skip when unconfigured - Task 1 (`getJiraAuth` returns null) + Task 5 (`ingestJsm` returns []).
- Assigned-to-me, not-Done, in-window JQL - Task 2 (`buildJql`).
- `assignee = me` to sidestep email privacy - Task 3 (`jsmIssueToItem` sets `assignee: me`).
- Priority heuristic + best-effort SLA + state - Task 3 (`mapPriority`, `readSlaStatus`).
- Paged fetch, cap, throw-on-non-OK - Task 4.
- Merge into buildView + CLI, JSM optional/independent, graceful failure - Task 6 (try/catch).
- Testing split (pure + mocked unit; auth/live/wiring manual) - pure/mocked in Tasks 1-4; manual in Task 7.
- Security posture (token in keychain, read-only, on-device, no server) - Task 1 + the read-only client.

**Deferred (per spec / YAGNI):** participant/approver/watcher tickets (the scorer's not-assignee path is ready but unused in v1), OAuth, Jira Server/DC, Rovo, comment/history analysis, multi-instance, a config UI, configurable priority/SLA mapping. Noted so they are not mistaken for gaps.

**Placeholder scan:** none. The Jira base URL / email / token are real deploy parameters (env + keychain, set in Task 7), analogous to the Plan 2 Graph prerequisites - not incomplete-plan placeholders. The exact search endpoint (`/rest/api/3/search/jql`, `*all` fields, token paging) is pinned in Task 4 and confirmed against the live API in Task 7's manual verification, where it is adjusted if the instance differs (the honest treatment for the spec's flagged open question).

**Type consistency:** `JiraAuth` (Task 1) is consumed by `fetchAssignedTickets` (Task 4) and `ingestJsm` (Task 5). `JiraIssue`/`JiraIssueFields`/`JiraSearchResponse` (Task 2) are consumed by the client (Task 4) and normalizer (Task 3). `jsmIssueToItem` (Task 3) returns a `DaybreakItem` with `source: 'jsm'` and a `JsmFields` shape matching `src/model/item.ts` exactly (`assignee`/`priority`/`slaStatus`/`state`). `ingestJsm` (Task 5) is imported and merged by `buildView` and the CLI (Task 6) with the `(sinceISO, me)` signature.

## Known v1 limitations (intentional, documented)
- SLA is best-effort via generic field discovery; instances with an unusual SLA shape report `none` and the ticket still scores by priority/state.
- Priority mapping is a name heuristic; an instance with non-standard priority names maps unknowns to undefined (low).
- Only assigned-to-me tickets in v1; participant/approver tickets are deferred.
- Fetch is capped at 200 tickets with a logged warning.
- Jira config is env + keychain in v1; no in-app Settings surface yet.
