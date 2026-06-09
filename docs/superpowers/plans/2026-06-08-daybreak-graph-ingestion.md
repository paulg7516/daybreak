# Daybreak Graph Ingestion Implementation Plan (Plan 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** From a signed-in Microsoft 365 account, fetch the user's recent mail via Microsoft Graph and normalize it into `DaybreakItem`s (the contract from Plan 1), runnable as a headless dev command that prints the real backlog and its scored lanes as JSON.

**Architecture:** Plain Node (no Electron yet - the ingestion logic is environment-agnostic and will run unchanged inside Electron's main process in Plan 3). Delegated OAuth via `@azure/msal-node` using the **device-code flow** (prints a code + URL to the console; ideal for a headless CLI and avoids running a loopback server). The MSAL token cache is persisted encrypted to the OS keychain via `keytar`, so only the first run is interactive. Graph access uses Node's global `fetch` (no SDK - we make a handful of calls; YAGNI). Pure functions map Graph message JSON to `DaybreakItem`, classify internal vs vendor by sender domain, and assemble conversations into a primary item plus `threadMessages`. The dev command wires auth, fetch, normalize, assemble, then runs the Plan 1 scorer over the result.

**Tech Stack:** TypeScript (strict), Node ESM, `@azure/msal-node`, `keytar`, Node global `fetch`, Vitest, tsx.

**House rules:** No em dashes anywhere in code or comments - use regular hyphens.

---

## Prerequisites (you must do this once, as M365 admin, before Task 7 can authenticate)

These steps register a single-tenant public client app in your tenant. No code depends on them until the auth task, but do them early.

1. Azure Portal -> Microsoft Entra ID -> App registrations -> New registration.
   - Name: `Daybreak`
   - Supported account types: **Accounts in this organizational directory only (single tenant)**
   - Leave Redirect URI blank (device-code flow does not need one). Register.
2. On the app Overview, copy the **Application (client) ID** and **Directory (tenant) ID**.
3. App -> Authentication -> Advanced settings -> **Allow public client flows = Yes** (required for device-code flow). Save.
4. App -> API permissions -> Add a permission -> Microsoft Graph -> **Delegated permissions** -> add `Mail.Read` and `User.Read`. Then click **Grant admin consent for <tenant>**. (`offline_access` is requested automatically by MSAL for refresh tokens.)
5. Export the two IDs as environment variables (e.g. add to `~/.zshenv`), then restart your shell:
   ```bash
   export DAYBREAK_CLIENT_ID="<application-client-id>"
   export DAYBREAK_TENANT_ID="<directory-tenant-id>"
   ```

---

## File Structure

All new code lives under `src/ingest/`. Plan 1 files are only touched in Task 1 (additive model fields).

- `src/model/item.ts` - MODIFY: add optional `webLink`, `threadId`, `isRead` to `DaybreakItem`
- `src/ingest/graph-types.ts` - TypeScript shapes for the Graph message JSON we consume
- `src/ingest/normalize.ts` - PURE: `classifySource`, `graphMessageToItem`
- `src/ingest/threads.ts` - PURE: `assembleThreads` (group by conversation, attach thread messages)
- `src/ingest/graph-client.ts` - `buildMessagesUrl` (pure) + `fetchMessagesSince` (paging, fetch)
- `src/ingest/keychain-cache.ts` - MSAL `ICachePlugin` backed by keytar
- `src/ingest/graph-auth.ts` - MSAL device-code + silent token acquisition, `getSignedInUser`
- `src/ingest/ingest.ts` - orchestrator: `ingestBacklog`
- `src/cli-ingest.ts` - dev command: ingest -> score -> print JSON
- Tests under `tests/ingest/`

Which modules are unit-tested vs integration-verified:
- **Unit-tested (TDD):** model fields, `classifySource`, `graphMessageToItem`, `assembleThreads`, `buildMessagesUrl`, and `fetchMessagesSince` (via a mocked `fetch`).
- **Integration (manual verification against your real mailbox, no automated test):** `keychain-cache.ts`, `graph-auth.ts`, `ingest.ts`, `cli-ingest.ts`. These touch the keychain, a browser login, and live Graph, which cannot be unit-tested meaningfully. Task 8 has explicit manual verification steps.

---

## Task 0: Add dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Add the runtime dependencies and the ingest script**

Edit `package.json` to add a `dependencies` block and an `ingest` script. The resulting file should be:

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
    "score": "tsx src/cli.ts",
    "ingest": "tsx src/cli-ingest.ts"
  },
  "dependencies": {
    "@azure/msal-node": "^2.16.0",
    "keytar": "^7.9.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "tsx": "^4.19.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: Install**

Run: `npm install`
Expected: installs `@azure/msal-node` and `keytar` (keytar builds or fetches a prebuilt native binary). No errors.

- [ ] **Step 3: Verify nothing broke**

Run: `npm test && npm run typecheck`
Expected: all existing Plan 1 tests pass, tsc clean.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add msal-node and keytar for Graph ingestion"
```

---

## Task 1: Extend the DaybreakItem model

The Plan 1 final review flagged that ingestion needs deep-link, thread-id, and read-state fields. Add them as OPTIONAL so all existing Plan 1 code and tests are unaffected.

**Files:**
- Modify: `src/model/item.ts`
- Test: `tests/model/item-ingest-fields.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/model/item-ingest-fields.test.ts
import { describe, it, expect } from 'vitest';
import type { DaybreakItem } from '../../src/model/item';

describe('DaybreakItem ingestion fields', () => {
  it('accepts webLink, threadId, and isRead', () => {
    const item: DaybreakItem = {
      id: 'm1',
      source: 'email_internal',
      subject: 'hi',
      from: 'a@company.com',
      receivedAt: '2026-05-30T10:00:00.000Z',
      webLink: 'https://outlook.office365.com/owa/?ItemID=abc',
      threadId: 'conv-123',
      isRead: false,
    };
    expect(item.webLink).toContain('outlook');
    expect(item.threadId).toBe('conv-123');
    expect(item.isRead).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/model/item-ingest-fields.test.ts`
Expected: FAIL - `webLink`/`threadId`/`isRead` do not exist on `DaybreakItem`, tsc errors during the run.

- [ ] **Step 3: Add the fields**

In `src/model/item.ts`, inside the `DaybreakItem` interface, add these three optional fields immediately after the `jsm?: JsmFields;` line (keep all existing fields unchanged):

```typescript
  // ingestion metadata (populated by the Graph ingestion layer)
  webLink?: string;   // deep link to open the item in Outlook/JSM
  threadId?: string;  // conversation/thread identifier for grouping
  isRead?: boolean;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/model/item-ingest-fields.test.ts`
Expected: PASS.

- [ ] **Step 5: Run the full suite (no regressions)**

Run: `npm test && npm run typecheck`
Expected: all tests pass, tsc clean.

- [ ] **Step 6: Commit**

```bash
git add src/model/item.ts tests/model/item-ingest-fields.test.ts
git commit -m "feat: add webLink, threadId, isRead to DaybreakItem"
```

---

## Task 2: Graph message types

**Files:**
- Create: `src/ingest/graph-types.ts`
- Test: `tests/ingest/graph-types.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/ingest/graph-types.test.ts
import { describe, it, expect } from 'vitest';
import type { GraphMessage } from '../../src/ingest/graph-types';

describe('GraphMessage type', () => {
  it('models the Graph message fields we consume', () => {
    const msg: GraphMessage = {
      id: 'AAMk-1',
      subject: 'Budget sign-off',
      from: { emailAddress: { address: 'boss@company.com', name: 'The Boss' } },
      toRecipients: [{ emailAddress: { address: 'me@company.com' } }],
      ccRecipients: [],
      bodyPreview: 'Can you approve by EOD?',
      conversationId: 'conv-1',
      webLink: 'https://outlook.office365.com/owa/?ItemID=AAMk-1',
      isRead: false,
      receivedDateTime: '2026-05-30T09:00:00Z',
      internetMessageHeaders: [{ name: 'X-PTO-Triage', value: 'action;by=2026-06-08' }],
    };
    expect(msg.from?.emailAddress.address).toBe('boss@company.com');
    expect(msg.internetMessageHeaders?.[0].name).toBe('X-PTO-Triage');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ingest/graph-types.test.ts`
Expected: FAIL - cannot find module `graph-types`.

- [ ] **Step 3: Write the types**

```typescript
// src/ingest/graph-types.ts

export interface GraphEmailAddress {
  address: string;
  name?: string;
}

export interface GraphRecipient {
  emailAddress: GraphEmailAddress;
}

export interface GraphHeader {
  name: string;
  value: string;
}

// Only the fields Daybreak requests via $select. Graph returns much more.
export interface GraphMessage {
  id: string;
  subject?: string;
  from?: { emailAddress: GraphEmailAddress };
  toRecipients?: GraphRecipient[];
  ccRecipients?: GraphRecipient[];
  bodyPreview?: string;
  conversationId?: string;
  webLink?: string;
  isRead?: boolean;
  receivedDateTime: string; // ISO timestamp
  internetMessageHeaders?: GraphHeader[];
}

// Shape of a Graph collection response page.
export interface GraphMessagePage {
  value: GraphMessage[];
  '@odata.nextLink'?: string;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/ingest/graph-types.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ingest/graph-types.ts tests/ingest/graph-types.test.ts
git commit -m "feat: add Graph message types for ingestion"
```

---

## Task 3: Normalize Graph messages to DaybreakItem

`classifySource` decides internal vs vendor by comparing the sender's domain to the user's own domain(s). `graphMessageToItem` maps the Graph shape onto the `DaybreakItem` contract, flattening the headers array into the `internetHeaders` record that the Plan 1 sender-tag parser reads.

**Files:**
- Create: `src/ingest/normalize.ts`
- Test: `tests/ingest/normalize.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/ingest/normalize.test.ts
import { describe, it, expect } from 'vitest';
import { classifySource, graphMessageToItem } from '../../src/ingest/normalize';
import type { GraphMessage } from '../../src/ingest/graph-types';

const internal = ['company.com'];

describe('classifySource', () => {
  it('classifies same-domain senders as internal', () => {
    expect(classifySource('boss@company.com', internal)).toBe('email_internal');
    expect(classifySource('BOSS@Company.com', internal)).toBe('email_internal');
  });
  it('classifies other domains as vendor', () => {
    expect(classifySource('noreply@vendor.com', internal)).toBe('email_vendor');
    expect(classifySource('', internal)).toBe('email_vendor');
  });
});

describe('graphMessageToItem', () => {
  const msg: GraphMessage = {
    id: 'AAMk-1',
    subject: 'Budget sign-off',
    from: { emailAddress: { address: 'boss@company.com' } },
    toRecipients: [{ emailAddress: { address: 'me@company.com' } }],
    ccRecipients: [{ emailAddress: { address: 'peer@company.com' } }],
    bodyPreview: 'Can you approve by EOD?',
    conversationId: 'conv-1',
    webLink: 'https://outlook.office365.com/owa/?ItemID=AAMk-1',
    isRead: false,
    receivedDateTime: '2026-05-30T09:00:00Z',
    internetMessageHeaders: [{ name: 'X-PTO-Triage', value: 'action;by=2026-06-08' }],
  };

  it('maps all consumed fields onto a DaybreakItem', () => {
    const item = graphMessageToItem(msg, internal);
    expect(item.id).toBe('AAMk-1');
    expect(item.source).toBe('email_internal');
    expect(item.subject).toBe('Budget sign-off');
    expect(item.from).toBe('boss@company.com');
    expect(item.receivedAt).toBe('2026-05-30T09:00:00Z');
    expect(item.toRecipients).toEqual(['me@company.com']);
    expect(item.ccRecipients).toEqual(['peer@company.com']);
    expect(item.bodyText).toBe('Can you approve by EOD?');
    expect(item.threadId).toBe('conv-1');
    expect(item.webLink).toContain('outlook');
    expect(item.isRead).toBe(false);
    expect(item.internetHeaders).toEqual({ 'X-PTO-Triage': 'action;by=2026-06-08' });
  });

  it('tolerates missing optional fields', () => {
    const bare: GraphMessage = { id: 'x', receivedDateTime: '2026-05-30T09:00:00Z' };
    const item = graphMessageToItem(bare, internal);
    expect(item.from).toBe('');
    expect(item.subject).toBe('');
    expect(item.toRecipients).toEqual([]);
    expect(item.bodyText).toBe('');
    expect(item.internetHeaders).toEqual({});
    expect(item.source).toBe('email_vendor'); // empty sender -> not internal
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ingest/normalize.test.ts`
Expected: FAIL - cannot find module `normalize`.

- [ ] **Step 3: Write the implementation**

```typescript
// src/ingest/normalize.ts
import type { DaybreakItem, Source } from '../model/item';
import type { GraphMessage } from './graph-types';

export function classifySource(fromAddress: string, internalDomains: string[]): Source {
  const at = fromAddress.lastIndexOf('@');
  if (at < 0) return 'email_vendor';
  const domain = fromAddress.slice(at + 1).toLowerCase();
  const internal = internalDomains.map((d) => d.toLowerCase());
  return internal.includes(domain) ? 'email_internal' : 'email_vendor';
}

export function graphMessageToItem(msg: GraphMessage, internalDomains: string[]): DaybreakItem {
  const from = msg.from?.emailAddress.address ?? '';
  const headers: Record<string, string> = {};
  for (const h of msg.internetMessageHeaders ?? []) {
    headers[h.name] = h.value;
  }
  return {
    id: msg.id,
    source: classifySource(from, internalDomains),
    subject: msg.subject ?? '',
    from,
    receivedAt: msg.receivedDateTime,
    toRecipients: (msg.toRecipients ?? []).map((r) => r.emailAddress.address),
    ccRecipients: (msg.ccRecipients ?? []).map((r) => r.emailAddress.address),
    bodyText: msg.bodyPreview ?? '',
    internetHeaders: headers,
    threadId: msg.conversationId,
    webLink: msg.webLink,
    isRead: msg.isRead,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/ingest/normalize.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/ingest/normalize.ts tests/ingest/normalize.test.ts
git commit -m "feat: normalize Graph messages into DaybreakItems"
```

---

## Task 4: Assemble conversations into threads

Group normalized items by `threadId`. Within a conversation, the earliest message (the original trigger) becomes the primary item, and every later message is attached as a `ThreadMessage` so the Plan 1 resolved-while-away detector can see replies. Items without a `threadId` pass through unchanged.

**Files:**
- Create: `src/ingest/threads.ts`
- Test: `tests/ingest/threads.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/ingest/threads.test.ts
import { describe, it, expect } from 'vitest';
import { assembleThreads } from '../../src/ingest/threads';
import type { DaybreakItem } from '../../src/model/item';

function item(over: Partial<DaybreakItem>): DaybreakItem {
  return {
    id: 'x', source: 'email_internal', subject: 's', from: 'a@company.com',
    receivedAt: '2026-05-30T10:00:00.000Z', bodyText: '', ...over,
  };
}

describe('assembleThreads', () => {
  it('uses the earliest message as primary and attaches later ones as threadMessages', () => {
    const items: DaybreakItem[] = [
      item({ id: 'b', threadId: 'c1', receivedAt: '2026-05-28T10:00:00.000Z', from: 'peer@company.com', bodyText: 'nvm, sorted' }),
      item({ id: 'a', threadId: 'c1', receivedAt: '2026-05-26T10:00:00.000Z', from: 'peer@company.com', bodyText: 'quick question?' }),
    ];
    const out = assembleThreads(items);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe('a'); // earliest is primary
    expect(out[0].threadMessages).toHaveLength(1);
    expect(out[0].threadMessages![0].bodyText).toBe('nvm, sorted');
    expect(out[0].threadMessages![0].sentAt).toBe('2026-05-28T10:00:00.000Z');
  });

  it('passes through items with no threadId, single-message threads get empty threadMessages', () => {
    const items: DaybreakItem[] = [
      item({ id: 'solo', threadId: undefined }),
      item({ id: 'only', threadId: 'c2', receivedAt: '2026-05-27T10:00:00.000Z' }),
    ];
    const out = assembleThreads(items);
    const byId = (id: string) => out.find((i) => i.id === id)!;
    expect(out).toHaveLength(2);
    expect(byId('solo').threadMessages).toBeUndefined();
    expect(byId('only').threadMessages).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ingest/threads.test.ts`
Expected: FAIL - cannot find module `threads`.

- [ ] **Step 3: Write the implementation**

```typescript
// src/ingest/threads.ts
import type { DaybreakItem, ThreadMessage } from '../model/item';

export function assembleThreads(items: DaybreakItem[]): DaybreakItem[] {
  const byConversation = new Map<string, DaybreakItem[]>();
  const result: DaybreakItem[] = [];

  for (const it of items) {
    if (!it.threadId) {
      result.push(it);
      continue;
    }
    const group = byConversation.get(it.threadId) ?? [];
    group.push(it);
    byConversation.set(it.threadId, group);
  }

  for (const group of byConversation.values()) {
    group.sort((a, b) => new Date(a.receivedAt).getTime() - new Date(b.receivedAt).getTime());
    const [primary, ...rest] = group;
    const threadMessages: ThreadMessage[] = rest.map((m) => ({
      from: m.from,
      sentAt: m.receivedAt,
      bodyText: m.bodyText ?? '',
    }));
    result.push({ ...primary, threadMessages });
  }

  return result;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/ingest/threads.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/ingest/threads.ts tests/ingest/threads.test.ts
git commit -m "feat: assemble Graph conversations into threaded items"
```

---

## Task 5: Graph client (URL builder + paged fetch)

`buildMessagesUrl` is pure and unit-tested. `fetchMessagesSince` follows `@odata.nextLink` paging up to a cap, sets the bearer token, and throws on a non-OK response. It is tested with a mocked global `fetch`.

**Files:**
- Create: `src/ingest/graph-client.ts`
- Test: `tests/ingest/graph-client.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/ingest/graph-client.test.ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { buildMessagesUrl, fetchMessagesSince } from '../../src/ingest/graph-client';
import type { GraphMessagePage } from '../../src/ingest/graph-types';

describe('buildMessagesUrl', () => {
  it('selects the needed fields and filters by receivedDateTime', () => {
    const url = buildMessagesUrl('2026-05-25T00:00:00Z');
    expect(url).toContain('https://graph.microsoft.com/v1.0/me/messages');
    expect(url).toContain('internetMessageHeaders');
    expect(url).toContain('conversationId');
    expect(decodeURIComponent(url)).toContain('receivedDateTime ge 2026-05-25T00:00:00Z');
    expect(decodeURIComponent(url)).toContain('$orderby=receivedDateTime desc');
  });
});

describe('fetchMessagesSince', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('follows nextLink paging and sends the bearer token', async () => {
    const page1: GraphMessagePage = {
      value: [{ id: 'm1', receivedDateTime: '2026-05-30T09:00:00Z' }],
      '@odata.nextLink': 'https://graph.microsoft.com/next',
    };
    const page2: GraphMessagePage = {
      value: [{ id: 'm2', receivedDateTime: '2026-05-29T09:00:00Z' }],
    };
    const seenAuth: string[] = [];
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      seenAuth.push((init?.headers as Record<string, string>).Authorization);
      const body = fetchMock.mock.calls.length === 1 ? page1 : page2;
      return { ok: true, json: async () => body } as Response;
    });
    vi.stubGlobal('fetch', fetchMock);

    const msgs = await fetchMessagesSince('TOKEN123', '2026-05-25T00:00:00Z');
    expect(msgs.map((m) => m.id)).toEqual(['m1', 'm2']);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(seenAuth.every((a) => a === 'Bearer TOKEN123')).toBe(true);
  });

  it('throws on a non-OK response', async () => {
    const fetchMock = vi.fn(async () => ({ ok: false, status: 403, text: async () => 'Forbidden' } as Response));
    vi.stubGlobal('fetch', fetchMock);
    await expect(fetchMessagesSince('T', '2026-05-25T00:00:00Z')).rejects.toThrow('Graph 403');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ingest/graph-client.test.ts`
Expected: FAIL - cannot find module `graph-client`.

- [ ] **Step 3: Write the implementation**

```typescript
// src/ingest/graph-client.ts
import type { GraphMessage, GraphMessagePage } from './graph-types';

const SELECT_FIELDS = [
  'subject',
  'from',
  'toRecipients',
  'ccRecipients',
  'bodyPreview',
  'conversationId',
  'webLink',
  'isRead',
  'receivedDateTime',
  'internetMessageHeaders',
];

export function buildMessagesUrl(sinceISO: string, top = 50): string {
  const params = new URLSearchParams({
    '$select': SELECT_FIELDS.join(','),
    '$filter': `receivedDateTime ge ${sinceISO}`,
    '$orderby': 'receivedDateTime desc',
    '$top': String(top),
  });
  return `https://graph.microsoft.com/v1.0/me/messages?${params.toString()}`;
}

// Fetch messages received on or after sinceISO, following paging up to `cap`
// messages. Caps total volume so a huge backlog cannot run unbounded; logs if hit.
export async function fetchMessagesSince(
  token: string,
  sinceISO: string,
  cap = 500,
): Promise<GraphMessage[]> {
  let url: string | undefined = buildMessagesUrl(sinceISO);
  const out: GraphMessage[] = [];

  while (url && out.length < cap) {
    const resp: Response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Prefer: 'outlook.body-content-type="text"',
      },
    });
    if (!resp.ok) {
      throw new Error(`Graph ${resp.status}: ${await resp.text()}`);
    }
    const page = (await resp.json()) as GraphMessagePage;
    out.push(...page.value);
    url = page['@odata.nextLink'];
  }

  if (url) {
    console.warn(`Daybreak: reached the ${cap}-message cap; older mail was not fetched.`);
  }
  return out.slice(0, cap);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/ingest/graph-client.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/ingest/graph-client.ts tests/ingest/graph-client.test.ts
git commit -m "feat: add paged Graph messages client"
```

---

## Task 6: Keychain-backed MSAL cache plugin

The MSAL token cache must persist between runs so only the first run is interactive. This implements the MSAL `ICachePlugin` interface, serializing the cache to/from the OS keychain via keytar. This is INTEGRATION code (touches the real keychain); there is no unit test - it is exercised by the manual verification in Task 8.

**Files:**
- Create: `src/ingest/keychain-cache.ts`

- [ ] **Step 1: Write the implementation**

```typescript
// src/ingest/keychain-cache.ts
import keytar from 'keytar';
import type { ICachePlugin, TokenCacheContext } from '@azure/msal-node';

const SERVICE = 'Daybreak';
const ACCOUNT = 'msal-token-cache';

// Persists the MSAL token cache in the OS keychain. The cache contains refresh
// tokens, so keychain (not a plaintext file) is the correct home for it.
export const keychainCachePlugin: ICachePlugin = {
  async beforeCacheAccess(context: TokenCacheContext): Promise<void> {
    const cached = await keytar.getPassword(SERVICE, ACCOUNT);
    if (cached) {
      context.tokenCache.deserialize(cached);
    }
  },
  async afterCacheAccess(context: TokenCacheContext): Promise<void> {
    if (context.cacheHasChanged) {
      await keytar.setPassword(SERVICE, ACCOUNT, context.tokenCache.serialize());
    }
  },
};

// Used by `daybreak logout` style flows and tests to clear the persisted cache.
export async function clearTokenCache(): Promise<void> {
  await keytar.deletePassword(SERVICE, ACCOUNT);
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: tsc clean (this confirms the MSAL types line up; runtime behavior is verified in Task 8).

- [ ] **Step 3: Commit**

```bash
git add src/ingest/keychain-cache.ts
git commit -m "feat: persist MSAL token cache in the OS keychain"
```

---

## Task 7: MSAL device-code auth

Acquires a Graph access token: silent from the cached account if possible, otherwise via the device-code flow (prints a URL + code to the console). Also fetches the signed-in user's address so the ingester can auto-derive the user's identity and internal domain. INTEGRATION code; verified in Task 8.

**Files:**
- Create: `src/ingest/graph-auth.ts`

- [ ] **Step 1: Write the implementation**

```typescript
// src/ingest/graph-auth.ts
import { PublicClientApplication } from '@azure/msal-node';
import { keychainCachePlugin } from './keychain-cache';

const SCOPES = ['Mail.Read', 'User.Read'];

function clientId(): string {
  const id = process.env.DAYBREAK_CLIENT_ID;
  if (!id) throw new Error('DAYBREAK_CLIENT_ID is not set. See the plan Prerequisites.');
  return id;
}

function tenantId(): string {
  const id = process.env.DAYBREAK_TENANT_ID;
  if (!id) throw new Error('DAYBREAK_TENANT_ID is not set. See the plan Prerequisites.');
  return id;
}

let pca: PublicClientApplication | undefined;
function app(): PublicClientApplication {
  if (!pca) {
    pca = new PublicClientApplication({
      auth: {
        clientId: clientId(),
        authority: `https://login.microsoftonline.com/${tenantId()}`,
      },
      cache: { cachePlugin: keychainCachePlugin },
    });
  }
  return pca;
}

export async function getAccessToken(): Promise<string> {
  const pcaApp = app();

  const accounts = await pcaApp.getTokenCache().getAllAccounts();
  if (accounts.length > 0) {
    try {
      const silent = await pcaApp.acquireTokenSilent({ account: accounts[0], scopes: SCOPES });
      if (silent?.accessToken) return silent.accessToken;
    } catch {
      // fall through to interactive device-code flow
    }
  }

  const result = await pcaApp.acquireTokenByDeviceCode({
    scopes: SCOPES,
    deviceCodeCallback: (info) => {
      // info.message instructs the user to visit a URL and enter the code.
      console.log(info.message);
    },
  });
  if (!result?.accessToken) {
    throw new Error('Device-code authentication did not return an access token.');
  }
  return result.accessToken;
}

export interface SignedInUser {
  address: string; // mail, or userPrincipalName as fallback
}

export async function getSignedInUser(token: string): Promise<SignedInUser> {
  const resp = await fetch('https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resp.ok) {
    throw new Error(`Graph /me ${resp.status}: ${await resp.text()}`);
  }
  const me = (await resp.json()) as { mail?: string; userPrincipalName?: string };
  const address = me.mail ?? me.userPrincipalName;
  if (!address) {
    throw new Error('Could not determine the signed-in user address from Graph /me.');
  }
  return { address };
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: tsc clean.

- [ ] **Step 3: Commit**

```bash
git add src/ingest/graph-auth.ts
git commit -m "feat: MSAL device-code auth and signed-in user lookup"
```

---

## Task 8: Ingest orchestrator + dev command (end-to-end)

`ingestBacklog` wires auth, identity, fetch, normalize, and thread assembly. The CLI computes a default away window (last 14 days, overridable), runs ingestion, scores the result with the Plan 1 scorer, and prints JSON. This is the runnable deliverable and is verified manually against your real mailbox.

**Files:**
- Create: `src/ingest/ingest.ts`
- Create: `src/cli-ingest.ts`

- [ ] **Step 1: Write the orchestrator**

```typescript
// src/ingest/ingest.ts
import { getAccessToken, getSignedInUser } from './graph-auth';
import { fetchMessagesSince } from './graph-client';
import { graphMessageToItem } from './normalize';
import { assembleThreads } from './threads';
import type { DaybreakItem } from '../model/item';

export interface IngestResult {
  me: string;
  internalDomains: string[];
  items: DaybreakItem[];
}

export async function ingestBacklog(sinceISO: string): Promise<IngestResult> {
  const token = await getAccessToken();
  const { address } = await getSignedInUser(token);
  const me = address.toLowerCase();
  const at = me.lastIndexOf('@');
  const internalDomains = at >= 0 ? [me.slice(at + 1)] : [];

  const raw = await fetchMessagesSince(token, sinceISO);
  const items = raw.map((m) => graphMessageToItem(m, internalDomains));
  return { me, internalDomains, items: assembleThreads(items) };
}
```

- [ ] **Step 2: Write the dev command**

```typescript
// src/cli-ingest.ts
import { ingestBacklog } from './ingest/ingest';
import { scoreAll } from './scoring/score';
import { buildSummary } from './summary/summary';

// Resolve the away window: --since <ISO> arg, then DAYBREAK_AWAY_SINCE env,
// else default to 14 days before now.
function resolveSince(now: Date): string {
  const argIndex = process.argv.indexOf('--since');
  if (argIndex >= 0 && process.argv[argIndex + 1]) {
    return process.argv[argIndex + 1];
  }
  if (process.env.DAYBREAK_AWAY_SINCE) {
    return process.env.DAYBREAK_AWAY_SINCE;
  }
  const since = new Date(now);
  since.setDate(since.getDate() - 14);
  return since.toISOString();
}

async function main(): Promise<void> {
  const now = new Date();
  const sinceISO = resolveSince(now);

  const { me, items } = await ingestBacklog(sinceISO);
  const scored = scoreAll(items, { me, awaySince: sinceISO, now: now.toISOString() });
  const summary = buildSummary(scored);

  console.log(
    JSON.stringify({ me, awaySince: sinceISO, count: items.length, summary, scored }, null, 2),
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
```

- [ ] **Step 3: Typecheck and run the full unit suite**

Run: `npm test && npm run typecheck`
Expected: all unit tests pass (Plan 1 plus the new pure ingestion tests), tsc clean.

- [ ] **Step 4: Manual verification against your real mailbox**

Ensure `DAYBREAK_CLIENT_ID` and `DAYBREAK_TENANT_ID` are exported (Prerequisites).

Run: `npm run ingest -- --since 2026-05-25T00:00:00Z`

Expected on first run:
- The console prints a device-code message: "To sign in, use a web browser to open https://microsoft.com/devicelogin and enter the code XXXXXXXXX to authenticate."
- After you complete the browser login and consent, the command prints a JSON object with: your `me` address, the `awaySince` you passed, a `count`, a `summary` (needsTodayCount / thisWeekCount / fyiCount / slaAtRiskCount / resolvedWhileAwayCount), and a `scored` array of your real messages sorted into lanes.

Verify by eye:
- Internal senders (your domain) show `source: "email_internal"`; outside senders show `email_vendor`.
- Messages where you were only cc'd, or newsletters, land in the `fyi` lane.
- If any internal mail carried an `X-PTO-Triage` header, its `reasons` mention the sender tag.

Run it a second time:
- Expected: NO device-code prompt (token came silently from the keychain). This confirms the cache plugin works.

- [ ] **Step 5: Commit**

```bash
git add src/ingest/ingest.ts src/cli-ingest.ts
git commit -m "feat: ingest real M365 backlog and score it via dev command"
```

---

## Self-Review (completed by plan author)

**Spec coverage (against the design spec, ingestion-relevant items):**
- Outlook/Exchange email via Microsoft Graph - Tasks 5, 7, 8.
- Delegated OAuth to the user's own M365, no server, token in OS keychain - Tasks 6, 7 (device-code + keychain cache).
- Normalize to the `DaybreakItem` contract; populate the fields ingestion was known to need (webLink, threadId, isRead) - Tasks 1, 3.
- Internal vs vendor classification (priority varies by source) - Task 3 (`classifySource`).
- Sender tag read from the `X-PTO-Triage` header - Task 3 (headers flattened into `internetHeaders`, consumed by the existing Plan 1 parser).
- Thread assembly so resolved-while-away detection has replies to scan - Task 4.
- Local-first, content stays on device, rules-only scoring already in Plan 1 - the dev command scores locally, nothing is sent anywhere.
- Away window via dev flag (manual "I'm back" UI deferred to Plan 3) - Task 8 `resolveSince`.

**Deferred to later plans (correctly out of scope):** Electron shell + renderer + the triage UI and the manual "I'm back since [date]" prompt (Plan 3); JSM ingestion (Plan 3); the Outlook compose add-in that writes `X-PTO-Triage` (Plan 4). Full message bodies (v1 uses `bodyPreview`), multi-domain internal classification, and a per-message header refetch fallback are documented limitations below, not built.

**Placeholder scan:** none - every code and test step has complete content. Integration tasks (6, 7, 8) intentionally have no unit test and instead carry concrete manual verification, which is the honest treatment for keychain/browser/live-Graph code.

**Type consistency:** `GraphMessage`/`GraphMessagePage` (Task 2) are consumed by `graphMessageToItem` (Task 3) and `fetchMessagesSince` (Task 5). `DaybreakItem` additive fields (Task 1) are produced in Task 3 and consumed in Task 4. `IngestResult` (Task 8) feeds the CLI which calls the existing `scoreAll`/`buildSummary` from Plan 1 with a `ScoringContext` of `{ me, awaySince, now }`. No signature drift.

## Known v1 limitations (intentional, documented)
- Uses `bodyPreview` (~255 char text snippet), not the full body. Cheaper, more private, and enough for ask/deadline detection. Full-body fetch is a later enhancement.
- `internetMessageHeaders` is requested in the list `$select`. If a tenant does not return headers on the collection endpoint, the `X-PTO-Triage` tag will be absent and the item falls to inference (degrades gracefully, exactly as designed). A per-message header refetch is the documented fallback, built only if observed.
- Internal-domain classification uses the single domain of the signed-in account. Multi-domain orgs are a later enhancement (`internalDomains` is already an array, so the change is localized).
- Fetch is capped at 500 messages with a logged warning (no silent truncation).
