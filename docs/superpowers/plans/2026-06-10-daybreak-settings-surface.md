# Daybreak In-App Settings Surface Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A tabbed in-app Settings panel (Rules + Sources) that configures the Jira connection (base URL, email, keychain token) with a live Test connection, so JSM is set up in-app instead of via env vars.

**Architecture:** Jira base URL + email persist in the `electron-store` overlay; the token stays in the keychain. `getJiraAuth` gains an optional config override resolved against env (so the CLI/env path is untouched); `buildView` passes the stored config. New IPC/bridge methods back a Settings panel whose Rules tab reuses the existing `RulesSettings` and whose Sources tab is a new `JiraSettings` form. Pure config logic is unit-tested; keychain/IPC/live-test code is typecheck-gated + manually verified.

**Tech Stack:** TypeScript (strict, ESM), React 19 + Tailwind v4 + lucide-react, Electron, electron-store, keytar, Node `fetch`, Vitest + @testing-library/react.

**House rules:** No em dashes anywhere in code or comments. Pure logic + presentational components get TDD; integration (store, IPC, keychain, live Jira) is typecheck-gated + manually verified. `npm run typecheck` runs BOTH tsconfig projects; keep both clean.

---

## File Structure

- `src/app/overlay.ts` - MODIFY: add `jira` to `Overlay`/`emptyOverlay`; `setJiraConfig` reducer.
- `src/ingest/jsm-auth.ts` - MODIFY: `resolveJiraSettings` (PURE), config-aware `getJiraAuth`, `getStoredJiraToken`.
- `src/ingest/jsm-ingest.ts` - MODIFY: forward an optional config to `getJiraAuth`.
- `src/main/store.ts` - MODIFY: `getJiraConfig`/`setJiraConfig` wrappers.
- `src/main/ingest-runner.ts` - MODIFY: pass the stored Jira config into `ingestJsm`.
- `src/main/jira-test.ts` - CREATE: `testJiraConnection`.
- `src/main/ipc.ts`, `src/app/ipc-types.ts`, `src/preload/index.ts` - MODIFY: the four Jira config/test methods.
- `src/renderer/components/RulesSettings.tsx` - MODIFY: become the Rules tab content (chrome moves to the shell).
- `src/renderer/components/JiraSettings.tsx` - CREATE: the Sources tab form.
- `src/renderer/components/Settings.tsx` - CREATE: the tabbed shell.
- `src/renderer/App.tsx` - MODIFY: render `Settings`, add Jira state/handlers, gear nav.
- Tests: `tests/app/jira-settings-logic.test.ts` (pure), `tests/renderer/JiraSettings.test.tsx`, `tests/renderer/Settings.test.tsx`; update `tests/app/overlay-reducers.test.ts` and `tests/renderer/RulesSettings.test.tsx`.

**Phasing:** A = pure (Tasks 1-2); B = backend integration (Tasks 3-5); C = renderer (Tasks 6-9); D = verification + finish (Task 10).

---

## Task 1: Overlay jira config + reducer

**Files:**
- Modify: `src/app/overlay.ts`
- Modify: `tests/app/overlay-reducers.test.ts`
- Test: `tests/app/jira-settings-logic.test.ts` (new, the reducer part)

- [ ] **Step 1: Extend the Overlay**

In `src/app/overlay.ts`, add a `jira` field to the `Overlay` interface (after `forcedInclude`) and to `emptyOverlay`:

```typescript
  forcedInclude: Record<string, Lane>;
  jira: { baseUrl: string; email: string } | null;
```

```typescript
export function emptyOverlay(): Overlay {
  return { awayWindow: null, cleared: {}, rerank: {}, rules: [], bulkExcludeEnabled: true, forcedInclude: {}, jira: null };
}
```

Add the reducer (near the other reducers):

```typescript
export function setJiraConfig(o: Overlay, baseUrl: string, email: string): Overlay {
  return { ...o, jira: { baseUrl: baseUrl.trim().replace(/\/$/, ''), email: email.trim() } };
}
```

- [ ] **Step 2: Update the existing emptyOverlay assertion**

In `tests/app/overlay-reducers.test.ts`, the test that asserts the exact `emptyOverlay()` shape must include the new field. Change that assertion's expected object to include `jira: null`:

```typescript
    expect(emptyOverlay()).toEqual({ awayWindow: null, cleared: {}, rerank: {}, rules: [], bulkExcludeEnabled: true, forcedInclude: {}, jira: null });
```

- [ ] **Step 3: Write the failing reducer test**

```typescript
// tests/app/jira-settings-logic.test.ts
import { describe, it, expect } from 'vitest';
import { setJiraConfig, emptyOverlay } from '../../src/app/overlay';

describe('setJiraConfig reducer', () => {
  it('stores trimmed base URL (no trailing slash) and email without mutating input', () => {
    const base = emptyOverlay();
    const next = setJiraConfig(base, '  https://co.atlassian.net/  ', '  me@co.com ');
    expect(next.jira).toEqual({ baseUrl: 'https://co.atlassian.net', email: 'me@co.com' });
    expect(base.jira).toBeNull();
  });
});
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/app/jira-settings-logic.test.ts tests/app/overlay-reducers.test.ts`
Expected: PASS (the new reducer test + the updated emptyOverlay assertion).

- [ ] **Step 5: Full suite + typecheck**

Run: `npm test && npm run typecheck`
Expected: all pass (the additive `jira` field does not break existing code), both projects clean.

- [ ] **Step 6: Commit**

```bash
git add src/app/overlay.ts tests/app/overlay-reducers.test.ts tests/app/jira-settings-logic.test.ts
git commit -m "feat(settings): jira config in the overlay + setJiraConfig reducer"
```

---

## Task 2: resolveJiraSettings + config-aware getJiraAuth

**Files:**
- Modify: `src/ingest/jsm-auth.ts`, `src/ingest/jsm-ingest.ts`
- Test: `tests/app/jira-settings-logic.test.ts` (add the resolver cases)

- [ ] **Step 1: Add the failing resolver tests**

Append to `tests/app/jira-settings-logic.test.ts`:

```typescript
import { resolveJiraSettings } from '../../src/ingest/jsm-auth';

describe('resolveJiraSettings', () => {
  it('prefers the explicit config over env and strips a trailing slash', () => {
    const r = resolveJiraSettings(
      { baseUrl: 'https://a.atlassian.net/', email: 'a@co.com' },
      { baseUrl: 'https://env.atlassian.net', email: 'env@co.com' },
    );
    expect(r).toEqual({ baseUrl: 'https://a.atlassian.net', email: 'a@co.com' });
  });
  it('falls back to env when config is absent', () => {
    const r = resolveJiraSettings(undefined, { baseUrl: 'https://env.atlassian.net', email: 'env@co.com' });
    expect(r).toEqual({ baseUrl: 'https://env.atlassian.net', email: 'env@co.com' });
  });
  it('returns null when neither config nor env supplies a piece', () => {
    expect(resolveJiraSettings(undefined, {})).toBeNull();
    expect(resolveJiraSettings({ baseUrl: 'https://a.net' }, {})).toBeNull(); // no email
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/app/jira-settings-logic.test.ts`
Expected: FAIL - `resolveJiraSettings` is not exported.

- [ ] **Step 3: Edit `src/ingest/jsm-auth.ts`**

Add the input type, the pure resolver, a token getter, and make `getJiraAuth` config-aware. Replace the existing `getJiraAuth` and add the new exports:

```typescript
export interface JiraConfigInput {
  baseUrl?: string;
  email?: string;
}

// Pure: merge an explicit config over env, normalizing the base URL. Null if a
// required piece (base URL or email) is missing from both.
export function resolveJiraSettings(
  config: JiraConfigInput | undefined,
  env: { baseUrl?: string; email?: string },
): { baseUrl: string; email: string } | null {
  const baseUrl = config?.baseUrl || env.baseUrl;
  const email = config?.email || env.email;
  if (!baseUrl || !email) return null;
  return { baseUrl: baseUrl.replace(/\/$/, ''), email };
}

export async function getStoredJiraToken(): Promise<string | null> {
  return keytar.getPassword(SERVICE, ACCOUNT);
}

// Resolves config-or-env, then reads the token from the keychain. Null when any
// piece is missing, so JSM ingestion is simply skipped.
export async function getJiraAuth(config?: JiraConfigInput): Promise<JiraAuth | null> {
  const resolved = resolveJiraSettings(config, {
    baseUrl: process.env.DAYBREAK_JIRA_BASE_URL,
    email: process.env.DAYBREAK_JIRA_EMAIL,
  });
  if (!resolved) return null;
  const token = await keytar.getPassword(SERVICE, ACCOUNT);
  if (!token) return null;
  return { baseUrl: resolved.baseUrl, email: resolved.email, header: buildBasicAuth(resolved.email, token) };
}
```

(Keep `buildBasicAuth`, `JiraAuth`, `storeJiraToken`, `clearJiraToken`, and the `SERVICE`/`ACCOUNT` constants as they are.)

- [ ] **Step 4: Forward config through `ingestJsm`**

In `src/ingest/jsm-ingest.ts`, thread an optional config:

```typescript
import { getJiraAuth, type JiraConfigInput } from './jsm-auth';
// ...
export async function ingestJsm(sinceISO: string, me?: string, config?: JiraConfigInput): Promise<DaybreakItem[]> {
  const auth = await getJiraAuth(config);
  if (!auth) return [];
  const who = me ?? auth.email.toLowerCase();
  const issues = await fetchAssignedTickets(auth, sinceISO);
  return issues.map((issue) => jsmIssueToItem(issue, who, auth.baseUrl));
}
```

(Keep the other imports; merge `JiraConfigInput` into the existing `./jsm-auth` import.)

- [ ] **Step 5: Run tests + typecheck**

Run: `npx vitest run tests/app/jira-settings-logic.test.ts && npm run typecheck`
Expected: PASS (4 reducer/resolver tests total), both projects clean.

- [ ] **Step 6: Commit**

```bash
git add src/ingest/jsm-auth.ts src/ingest/jsm-ingest.ts tests/app/jira-settings-logic.test.ts
git commit -m "feat(settings): resolveJiraSettings + config-aware getJiraAuth"
```

---

## Task 3: Store wrappers + buildView threading

**Files:**
- Modify: `src/main/store.ts`, `src/main/ingest-runner.ts`

- [ ] **Step 1: Add store wrappers (src/main/store.ts)**

Add `setJiraConfig` to the overlay-reducer import alias group and add the wrappers:

```typescript
import { /* existing... */ setJiraConfig as setJiraConfigR } from '../app/overlay';
// ...
export function getJiraConfig(): { baseUrl: string; email: string } | null {
  return getOverlay().jira;
}

export function setJiraConfig(baseUrl: string, email: string): Overlay {
  return update(setJiraConfigR(getOverlay(), baseUrl, email));
}
```

(Merge `setJiraConfigR` into the existing `'../app/overlay'` import; reuse the existing private `update`.)

- [ ] **Step 2: Thread the stored config into buildView (src/main/ingest-runner.ts)**

Add to the imports:

```typescript
import { getOverlay, getJiraConfig } from './store';
```

(If `getOverlay` is already imported from `./store`, just add `getJiraConfig` to that import.)

In the NON-demo branch of `buildView`, change the `ingestJsm` call to pass the stored config:

```typescript
        const jsmItems = await ingestJsm(sinceISO, me, getJiraConfig() ?? undefined);
```

(This is the line inside the existing try block; everything else stays the same.)

- [ ] **Step 3: Typecheck + build:main**

Run: `npm run typecheck && npm run build:main`
Expected: both projects clean; main bundles to CJS.

- [ ] **Step 4: Commit**

```bash
git add src/main/store.ts src/main/ingest-runner.ts
git commit -m "feat(settings): persist jira config and thread it into buildView"
```

---

## Task 4: testJiraConnection

**Files:**
- Create: `src/main/jira-test.ts`

- [ ] **Step 1: Write the implementation**

```typescript
// src/main/jira-test.ts
import { buildBasicAuth, getStoredJiraToken } from '../ingest/jsm-auth';

export interface JiraTestInput {
  baseUrl: string;
  email: string;
  token?: string; // when omitted, the keychain token is used
}
export type JiraTestResult = { ok: true; displayName: string } | { ok: false; error: string };

// Validates a Jira connection by calling /myself. Read-only.
export async function testJiraConnection(input: JiraTestInput): Promise<JiraTestResult> {
  const token = input.token || (await getStoredJiraToken());
  if (!input.baseUrl || !input.email || !token) {
    return { ok: false, error: 'Base URL, email, and token are all required.' };
  }
  const url = `${input.baseUrl.replace(/\/$/, '')}/rest/api/3/myself`;
  try {
    const resp = await fetch(url, {
      headers: { Authorization: buildBasicAuth(input.email, token), Accept: 'application/json' },
    });
    if (!resp.ok) {
      return { ok: false, error: resp.status === 401 ? 'Authentication failed - check the email and token.' : `Jira ${resp.status}` };
    }
    const me = (await resp.json()) as { displayName?: string };
    return { ok: true, displayName: me.displayName ?? input.email };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Could not reach Jira.' };
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: both projects clean.

- [ ] **Step 3: Commit**

```bash
git add src/main/jira-test.ts
git commit -m "feat(settings): testJiraConnection against /myself"
```

---

## Task 5: IPC + bridge + preload

**Files:**
- Modify: `src/app/ipc-types.ts`, `src/main/ipc.ts`, `src/preload/index.ts`

- [ ] **Step 1: Extend the bridge contract (src/app/ipc-types.ts)**

Add to the `DaybreakBridge` interface (after the rule methods):

```typescript
  getJiraConfig(): Promise<{ baseUrl: string; email: string; hasToken: boolean }>;
  setJiraConfig(input: { baseUrl: string; email: string; token?: string }): Promise<void>;
  testJiraConnection(input: { baseUrl: string; email: string; token?: string }): Promise<{ ok: true; displayName: string } | { ok: false; error: string }>;
  clearJiraToken(): Promise<void>;
```

- [ ] **Step 2: Register IPC handlers (src/main/ipc.ts)**

Add imports:

```typescript
import { getJiraConfig, setJiraConfig } from './store';
import { storeJiraToken, clearJiraToken, getStoredJiraToken } from '../ingest/jsm-auth';
import { testJiraConnection } from './jira-test';
```

Inside `registerIpc()`:

```typescript
  ipcMain.handle('daybreak:getJiraConfig', async () => {
    const j = getJiraConfig();
    const token = await getStoredJiraToken();
    return { baseUrl: j?.baseUrl ?? '', email: j?.email ?? '', hasToken: !!token };
  });
  ipcMain.handle('daybreak:setJiraConfig', async (_e, input: { baseUrl: string; email: string; token?: string }) => {
    setJiraConfig(input.baseUrl, input.email);
    if (input.token) await storeJiraToken(input.token);
  });
  ipcMain.handle('daybreak:testJiraConnection', (_e, input: { baseUrl: string; email: string; token?: string }) =>
    testJiraConnection(input),
  );
  ipcMain.handle('daybreak:clearJiraToken', () => clearJiraToken());
```

- [ ] **Step 3: Wire the bridge (src/preload/index.ts)**

Add to the `api` object:

```typescript
  getJiraConfig: () => ipcRenderer.invoke('daybreak:getJiraConfig'),
  setJiraConfig: (input) => ipcRenderer.invoke('daybreak:setJiraConfig', input),
  testJiraConnection: (input) => ipcRenderer.invoke('daybreak:testJiraConnection', input),
  clearJiraToken: () => ipcRenderer.invoke('daybreak:clearJiraToken'),
```

- [ ] **Step 4: Typecheck + build:main + full suite**

Run: `npm run typecheck && npm run build:main && npm test`
Expected: both projects clean; CJS emitted; all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/ipc-types.ts src/main/ipc.ts src/preload/index.ts
git commit -m "feat(settings): IPC + bridge for jira config and test connection"
```

---

## Task 6: Refactor RulesSettings into tab content

The Rules tab content moves out of its own full-screen chrome (the shell provides the page wrapper, header, and Done). Behavior and the rules tests are preserved.

**Files:**
- Modify: `src/renderer/components/RulesSettings.tsx`, `tests/renderer/RulesSettings.test.tsx`

- [ ] **Step 1: Strip the outer chrome from RulesSettings**

Edit `src/renderer/components/RulesSettings.tsx`: remove the `onClose` prop, the outer `<div className="min-h-dvh ...">` + `<div className="mx-auto max-w-2xl ...">` wrappers, and the header block (the `SlidersHorizontal`/`<h1>Rules</h1>`/Done row). The component returns the content directly:

```tsx
// src/renderer/components/RulesSettings.tsx
import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import type { Rule, RuleField } from '../../app/rules';
import type { Lane } from '../../model/item';

function ruleId(field: RuleField, value: string, action: string): string {
  return `${action}:${field}:${value.toLowerCase()}`;
}

export function RulesSettings({
  rules,
  bulkExcludeEnabled,
  onAdd,
  onRemove,
  onToggleBulk,
}: {
  rules: Rule[];
  bulkExcludeEnabled: boolean;
  onAdd: (rule: Rule) => void;
  onRemove: (id: string) => void;
  onToggleBulk: (enabled: boolean) => void;
}) {
  const [value, setValue] = useState('');
  const [action, setAction] = useState<'include' | 'exclude'>('include');
  const [lane, setLane] = useState<Lane>('today');

  const field: RuleField = value.includes('@') ? 'from' : 'from-domain';

  function submit() {
    const v = value.trim().toLowerCase();
    if (!v) return;
    onAdd({ id: ruleId(field, v, action), field, value: v, action, lane: action === 'include' ? lane : null });
    setValue('');
  }

  const inputClass = 'rounded-lg border border-line-strong bg-panel text-ink px-3 py-2 text-[13px] transition-colors focus:border-accent outline-none placeholder:text-ink-3';
  const selectClass = 'rounded-lg border border-line-strong bg-panel text-ink-2 px-2.5 py-2 text-[13px] transition-colors hover:border-ink-3 cursor-pointer';

  return (
    <div>
      <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-line bg-panel-2 px-4 py-3 text-[13px] text-ink transition-colors hover:border-line-strong">
        <input
          type="checkbox"
          checked={bulkExcludeEnabled}
          onChange={(e) => onToggleBulk(e.target.checked)}
          className="mt-0.5 rounded accent-accent"
        />
        <span>Set aside automated and bulk mail (newsletters, notifications)</span>
      </label>

      {rules.length > 0 && (
        <ul className="mt-5 space-y-2">
          {rules.map((r) => (
            <li key={r.id} className="flex items-center gap-3 rounded-lg border border-line bg-panel-2 px-4 py-2.5 text-[13px]">
              <span className="flex-1 text-ink">
                <strong className="font-semibold">{r.action}</strong>{' '}
                {r.field === 'from' ? 'from' : 'domain'} {r.value}
                {r.action === 'include' && r.lane ? ` (${r.lane.replace('_', ' ')})` : ''}
              </span>
              <button
                type="button"
                onClick={() => onRemove(r.id)}
                className="flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-[12px] font-medium text-today transition-colors hover:bg-today-tint"
                aria-label="Remove"
              >
                <Trash2 size={13} strokeWidth={2} />
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      <form className="mt-5 flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <label className="text-[13px] text-ink">
          <span className="mb-1 block font-medium">Sender or domain</span>
          <input value={value} onChange={(e) => setValue(e.target.value)} placeholder="boss@company.com or company.com" className={inputClass} />
        </label>
        <select aria-label="Action" value={action} onChange={(e) => setAction(e.target.value as 'include' | 'exclude')} className={selectClass}>
          <option value="include">Include</option>
          <option value="exclude">Exclude</option>
        </select>
        {action === 'include' && (
          <select aria-label="Lane" value={lane} onChange={(e) => setLane(e.target.value as Lane)} className={selectClass}>
            <option value="today">Today</option>
            <option value="this_week">This week</option>
            <option value="fyi">FYI</option>
          </select>
        )}
        <button type="submit" className="rounded-lg bg-accent px-4 py-2 text-[13px] font-medium text-accent-ink transition-opacity hover:opacity-90">Add rule</button>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Update the RulesSettings test to drop the onClose prop**

In `tests/renderer/RulesSettings.test.tsx`, remove the `onClose={() => {}}` prop from every `<RulesSettings .../>` render (the component no longer accepts it). The three existing assertions (list+remove, add, toggle) are unchanged.

- [ ] **Step 3: Run the RulesSettings test**

Run: `npx vitest run tests/renderer/RulesSettings.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 4: Commit**

```bash
git add src/renderer/components/RulesSettings.tsx tests/renderer/RulesSettings.test.tsx
git commit -m "refactor(settings): RulesSettings is now tab content (chrome moves to the shell)"
```

---

## Task 7: JiraSettings tab (TDD)

**Files:**
- Create: `src/renderer/components/JiraSettings.tsx`
- Test: `tests/renderer/JiraSettings.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// tests/renderer/JiraSettings.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { JiraSettings } from '../../src/renderer/components/JiraSettings';

const config = { baseUrl: 'https://co.atlassian.net', email: 'me@co.com', hasToken: true };

describe('JiraSettings', () => {
  it('saves the entered base URL, email, and token', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<JiraSettings config={config} onSave={onSave} onTest={async () => ({ ok: true, displayName: 'Me' })} onClearToken={() => {}} />);
    const token = screen.getByLabelText(/api token/i);
    await userEvent.type(token, 'newtoken');
    await userEvent.click(screen.getByRole('button', { name: /^save/i }));
    expect(onSave).toHaveBeenCalledWith({ baseUrl: 'https://co.atlassian.net', email: 'me@co.com', token: 'newtoken' });
  });

  it('runs a test connection and shows the result', async () => {
    const onTest = vi.fn().mockResolvedValue({ ok: true, displayName: 'Pat' });
    render(<JiraSettings config={config} onSave={async () => {}} onTest={onTest} onClearToken={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: /test connection/i }));
    expect(onTest).toHaveBeenCalledTimes(1);
    expect(await screen.findByText(/connected as pat/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/renderer/JiraSettings.test.tsx`
Expected: FAIL - cannot find module `JiraSettings`.

- [ ] **Step 3: Write the component**

```tsx
// src/renderer/components/JiraSettings.tsx
import { useState } from 'react';
import { Ticket, CheckCircle2, XCircle } from 'lucide-react';

export interface JiraConfigView { baseUrl: string; email: string; hasToken: boolean }
export type JiraTestResult = { ok: true; displayName: string } | { ok: false; error: string };

export function JiraSettings({
  config,
  onSave,
  onTest,
  onClearToken,
}: {
  config: JiraConfigView;
  onSave: (input: { baseUrl: string; email: string; token?: string }) => Promise<void>;
  onTest: (input: { baseUrl: string; email: string; token?: string }) => Promise<JiraTestResult>;
  onClearToken: () => void;
}) {
  const [baseUrl, setBaseUrl] = useState(config.baseUrl);
  const [email, setEmail] = useState(config.email);
  const [token, setToken] = useState('');
  const [status, setStatus] = useState<{ kind: 'ok' | 'err' | 'info'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const inputClass = 'w-full rounded-lg border border-line-strong bg-panel text-ink px-3 py-2 text-[13px] transition-colors focus:border-accent outline-none placeholder:text-ink-3';

  function payload() {
    return { baseUrl: baseUrl.trim(), email: email.trim(), token: token.trim() || undefined };
  }

  async function save() {
    setBusy(true);
    try {
      await onSave(payload());
      setToken('');
      setStatus({ kind: 'info', text: 'Saved.' });
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setBusy(true);
    setStatus({ kind: 'info', text: 'Testing...' });
    const r = await onTest(payload());
    setStatus(r.ok ? { kind: 'ok', text: `Connected as ${r.displayName}` } : { kind: 'err', text: r.error });
    setBusy(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-[12px] text-ink-2">
        <Ticket size={14} className="text-accent" />
        Connect Jira Service Management to pull your assigned tickets.
      </div>

      <label className="block text-[13px]">
        <span className="mb-1 block font-medium">Base URL</span>
        <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://yourcompany.atlassian.net" className={inputClass} />
      </label>
      <label className="block text-[13px]">
        <span className="mb-1 block font-medium">Account email</span>
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" className={inputClass} />
      </label>
      <label className="block text-[13px]">
        <span className="mb-1 block font-medium">API token</span>
        <input aria-label="API token" type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder={config.hasToken ? 'token set - type to replace' : 'paste your Atlassian API token'} className={inputClass} />
      </label>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" disabled={busy} onClick={save} className="rounded-lg bg-accent px-4 py-2 text-[13px] font-medium text-accent-ink transition-opacity hover:opacity-90 disabled:opacity-50">Save</button>
        <button type="button" disabled={busy} onClick={test} className="rounded-lg border border-line-strong bg-panel px-4 py-2 text-[13px] font-medium text-ink-2 transition-colors hover:text-ink hover:border-ink-3 disabled:opacity-50">Test connection</button>
        {config.hasToken && (
          <button type="button" onClick={onClearToken} className="ml-auto text-[12px] text-ink-3 transition-colors hover:text-today">Clear token</button>
        )}
      </div>

      {status && (
        <p className={`flex items-center gap-1.5 text-[12px] ${status.kind === 'ok' ? 'text-good' : status.kind === 'err' ? 'text-today' : 'text-ink-3'}`}>
          {status.kind === 'ok' && <CheckCircle2 size={13} />}
          {status.kind === 'err' && <XCircle size={13} />}
          {status.text}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/renderer/JiraSettings.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/renderer/components/JiraSettings.tsx tests/renderer/JiraSettings.test.tsx
git commit -m "feat(settings): JiraSettings tab - config form + test connection"
```

---

## Task 8: Settings shell (tabbed)

**Files:**
- Create: `src/renderer/components/Settings.tsx`
- Test: `tests/renderer/Settings.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// tests/renderer/Settings.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Settings } from '../../src/renderer/components/Settings';

const noop = () => {};
const jira = { baseUrl: '', email: '', hasToken: false };

function renderSettings() {
  render(
    <Settings
      rules={[]}
      bulkExcludeEnabled
      onAddRule={noop}
      onRemoveRule={noop}
      onToggleBulk={noop}
      jiraConfig={jira}
      onSaveJira={async () => {}}
      onTestJira={async () => ({ ok: true, displayName: 'X' })}
      onClearJiraToken={noop}
      onClose={noop}
    />,
  );
}

describe('Settings', () => {
  it('shows the Rules tab by default and switches to Sources', async () => {
    renderSettings();
    expect(screen.getByText(/automated and bulk mail/i)).toBeInTheDocument(); // rules content
    await userEvent.click(screen.getByRole('button', { name: /sources/i }));
    expect(screen.getByLabelText(/base url/i)).toBeInTheDocument(); // jira content
  });

  it('has a Done button', () => {
    renderSettings();
    expect(screen.getByRole('button', { name: /done/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/renderer/Settings.test.tsx`
Expected: FAIL - cannot find module `Settings`.

- [ ] **Step 3: Write the shell**

```tsx
// src/renderer/components/Settings.tsx
import { useState } from 'react';
import { Settings as SettingsIcon } from 'lucide-react';
import type { Rule } from '../../app/rules';
import { RulesSettings } from './RulesSettings';
import { JiraSettings, type JiraConfigView, type JiraTestResult } from './JiraSettings';

type Tab = 'rules' | 'sources';

export function Settings({
  rules,
  bulkExcludeEnabled,
  onAddRule,
  onRemoveRule,
  onToggleBulk,
  jiraConfig,
  onSaveJira,
  onTestJira,
  onClearJiraToken,
  onClose,
}: {
  rules: Rule[];
  bulkExcludeEnabled: boolean;
  onAddRule: (rule: Rule) => void;
  onRemoveRule: (id: string) => void;
  onToggleBulk: (enabled: boolean) => void;
  jiraConfig: JiraConfigView;
  onSaveJira: (input: { baseUrl: string; email: string; token?: string }) => Promise<void>;
  onTestJira: (input: { baseUrl: string; email: string; token?: string }) => Promise<JiraTestResult>;
  onClearJiraToken: () => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<Tab>('rules');

  const tabClass = (t: Tab) =>
    `rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors ${tab === t ? 'bg-accent/15 text-accent' : 'text-ink-2 hover:text-ink'}`;

  return (
    <div className="min-h-dvh bg-bg text-ink">
      <div className="mx-auto max-w-2xl px-6 py-8">
        <div className="elev-panel rounded-xl p-6">
          <div className="mb-5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <SettingsIcon size={16} strokeWidth={2} className="text-accent" />
              <h1 className="text-[18px] font-semibold tracking-[-0.01em]">Settings</h1>
            </div>
            <button type="button" onClick={onClose} className="text-[13px] font-medium text-ink-2 transition-colors hover:text-ink">Done</button>
          </div>

          <div className="mb-5 flex gap-1 border-b border-line pb-3">
            <button type="button" className={tabClass('rules')} onClick={() => setTab('rules')}>Rules</button>
            <button type="button" className={tabClass('sources')} onClick={() => setTab('sources')}>Sources</button>
          </div>

          {tab === 'rules' ? (
            <RulesSettings rules={rules} bulkExcludeEnabled={bulkExcludeEnabled} onAdd={onAddRule} onRemove={onRemoveRule} onToggleBulk={onToggleBulk} />
          ) : (
            <JiraSettings config={jiraConfig} onSave={onSaveJira} onTest={onTestJira} onClearToken={onClearJiraToken} />
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/renderer/Settings.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/renderer/components/Settings.tsx tests/renderer/Settings.test.tsx
git commit -m "feat(settings): tabbed Settings shell (Rules | Sources)"
```

---

## Task 9: Wire Settings into App

**Files:**
- Modify: `src/renderer/App.tsx`

- [ ] **Step 1: Swap imports and the nav icon**

In `src/renderer/App.tsx`: replace the `RulesSettings` import with `Settings` and the `SlidersHorizontal` icon with `Settings as SettingsIcon`:

```typescript
import { Sunrise, LayoutList, Settings as SettingsIcon, RefreshCw, CalendarDays } from 'lucide-react';
// remove: import { RulesSettings } from './components/RulesSettings';
import { Settings } from './components/Settings';
import type { JiraConfigView, JiraTestResult } from './components/JiraSettings';
```

Change the nav "Rules" button to a "Settings" button (gear): set `aria-label="Settings"` and render `<SettingsIcon size={19} strokeWidth={2} />` (keep `onClick={openSettings}`).

- [ ] **Step 2: Add Jira state + handlers**

Add state near the rules state:

```typescript
  const [jiraConfig, setJiraConfig] = useState<JiraConfigView>({ baseUrl: '', email: '', hasToken: false });
```

Change `openSettings` to also load the Jira config:

```typescript
  const openSettings = useCallback(async () => {
    const [r, j] = await Promise.all([daybreak.getRules(), daybreak.getJiraConfig()]);
    setRules(r.rules);
    setBulkExclude(r.bulkExcludeEnabled);
    setJiraConfig(j);
    setShowSettings(true);
  }, []);
```

Add the Jira handlers near the rule handlers:

```typescript
  const onSaveJira = useCallback(async (input: { baseUrl: string; email: string; token?: string }) => {
    await daybreak.setJiraConfig(input);
    setJiraConfig(await daybreak.getJiraConfig());
  }, []);
  const onTestJira = useCallback((input: { baseUrl: string; email: string; token?: string }): Promise<JiraTestResult> => {
    return daybreak.testJiraConnection(input);
  }, []);
  const onClearJiraToken = useCallback(async () => {
    await daybreak.clearJiraToken();
    setJiraConfig(await daybreak.getJiraConfig());
  }, []);
```

- [ ] **Step 3: Replace the settings render**

Replace the `if (showSettings) { return <RulesSettings ... /> }` block with:

```tsx
  if (showSettings) {
    return (
      <Settings
        rules={rules}
        bulkExcludeEnabled={bulkExclude}
        onAddRule={addRuleAction}
        onRemoveRule={removeRuleAction}
        onToggleBulk={toggleBulk}
        jiraConfig={jiraConfig}
        onSaveJira={onSaveJira}
        onTestJira={onTestJira}
        onClearJiraToken={onClearJiraToken}
        onClose={() => setShowSettings(false)}
      />
    );
  }
```

- [ ] **Step 4: Run the full suite + typecheck + renderer build**

Run: `npm test && npm run typecheck && npm run build:renderer`
Expected: all tests pass (including the existing App tests - the away-window/needsAwayWindow path is unchanged), both projects clean, Vite builds.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/App.tsx
git commit -m "feat(settings): open the tabbed Settings panel from the nav gear"
```

---

## Task 10: Full verification + manual check

- [ ] **Step 1: Full suite + typecheck + app build**

Run: `npm test && npm run typecheck && npm run app:build`
Expected: all tests pass, both projects clean, main + renderer build.

- [ ] **Step 2: Manual verification (user-gated where it needs live Jira)**

Run: `npm run app:demo` (UI works without Jira) and confirm:
- The nav gear opens Settings on the Rules tab; rules add/remove/toggle still work.
- The Sources tab shows the Jira form.

With real Jira (env not required now):
- In Sources, enter your base URL + email + API token, click Test connection -> "Connected as <name>"; a bad token -> "Authentication failed".
- Click Save, close Settings, refresh -> your assigned JSM tickets appear under "System" (the app now reads the stored config, no env vars needed).
- Clear token -> the token field shows "paste your..." again and JSM is skipped.

- [ ] **Step 3: Commit (if any manual-fix tweaks were needed)**

Only if Step 2 surfaced a fix; otherwise nothing to commit.

---

## Self-Review (completed by plan author)

**Spec coverage:**
- Tabbed Settings (Rules | Sources) from a nav gear - Tasks 8, 9.
- Jira config in overlay + token in keychain - Tasks 1 (reducer), 3 (store), 5 (IPC stores token via `storeJiraToken`).
- `getJiraAuth` store-or-env resolution; CLI unchanged - Task 2 (`resolveJiraSettings`, config-aware `getJiraAuth`); the CLI passes no config so env still applies; `buildView` passes the stored config (Task 3).
- Test connection against /myself - Task 4, surfaced in Task 7's form.
- Rules tab reuse + polish - Task 6 (refactor) + Task 8 (shell chrome).
- Token never echoed back (form shows "token set") - Task 7 (password input, placeholder), Task 5 (`getJiraConfig` returns only `hasToken`).
- Clear-token + status badge (the spec's leaned-yes open items) - Task 7.

**Placeholder scan:** none. The Jira base URL/email/token are user-entered config (in-app now), not plan placeholders. `testJiraConnection`/live Jira are manually verified in Task 10, the honest treatment for live-API code.

**Type consistency:** `JiraConfigInput` (Task 2) flows into `ingestJsm` (Task 2) and `buildView` (Task 3, via `getJiraConfig() ?? undefined`). `JiraConfigView`/`JiraTestResult` (Task 7) are consumed by `Settings` (Task 8) and `App` (Task 9). The bridge methods (Task 5 `ipc-types`) match the preload wiring (Task 5) and the App calls (Task 9). `RulesSettings`'s reduced props (Task 6, no `onClose`) match how `Settings` renders it (Task 8) and the updated test (Task 6).

## Known v1 limitations (intentional, documented)
- Only the Jira source is configurable in-app; email setup stays on the Plan 2 device-code flow.
- The stored Jira config lives in the overlay (per-user, on-device); no export/sync.
- Save and Test are separate explicit actions (Save does not auto-test).
- `testJiraConnection`/`getJiraAuth`/store wiring are integration code with no unit test (only the pure resolver + reducer are unit-tested); verified manually.
