# Daybreak Rules Engine + Inclusion Gate + Set-Aside Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Daybreak a curated queue: an ingested email enters the active lanes only when a sender flag, a recipient rule, a one-off promote, or its source (JSM) wants it in; everything else goes to a collapsed "Set aside" bin (never deleted). Recipients manage include/exclude rules in a Settings panel.

**Architecture:** A pure inclusion classifier (`classifyItem`) runs over each ingested `DaybreakItem` using the persisted `Overlay` (now carrying rules + a bulk-exclude toggle + one-off promotes). `buildView` scores only the included items, applies rule-pinned lanes, and hands the set-aside items to `buildTriageView`, which adds a `setAside` group to the `TriageView`. The renderer gains a Set-aside bin and a Rules settings panel. All decision logic is pure and unit-tested; the Electron/IPC wiring is typecheck-gated and manually verified, exactly as in Plan 3.

**Tech Stack:** TypeScript (strict, ESM), React 19, Vitest + @testing-library/react (jsdom), Electron 33, electron-store. Builds on Plans 1-3 (scoring, Graph ingestion, desktop app), all shipped on `main`.

**House rules:** No em dashes anywhere in code or comments - use regular hyphens. TDD for all pure modules and presentational components (write the failing test, see it fail, implement, see it pass, commit). Integration code (store, IPC, App wiring) is typecheck-gated + manually verified. `npm run typecheck` runs BOTH the node and renderer tsconfig projects; keep both clean.

---

## File Structure

Existing (modified): `src/app/overlay.ts` (Overlay + reducers), `src/app/view-model.ts` (TriageView + buildTriageView), `src/main/ingest-runner.ts` (buildView), `src/main/store.ts`, `src/main/ipc.ts`, `src/app/ipc-types.ts`, `src/preload/index.ts`, `src/renderer/App.tsx`, `src/app/demo-data.ts`.

New:
- `src/app/rules.ts` - PURE: `Rule` type, rule reducers (`addRule`, `removeRule`, `setBulkExclude`, `forceInclude`), `isBulk`, `classifyItem`, `SetAsideReason`/`Inclusion` types.
- `src/renderer/components/SetAsideBin.tsx` - the collapsed "Set aside - N" bin with promote.
- `src/renderer/components/RulesSettings.tsx` - the rules management panel.
- Tests: `tests/app/rules.test.ts`, `tests/app/classify.test.ts`, `tests/renderer/SetAsideBin.test.tsx`, `tests/renderer/RulesSettings.test.tsx`.

**Phasing (for execution grouping):** A = pure rules + classifier (Tasks 1-3); B = view-model + pipeline (Tasks 4-5); C = store + IPC + bridge (Task 6); D = renderer (Tasks 7-9); E = demo data + manual verification (Task 10).

---

## Task 1: Rule model + rule reducers + Overlay extension

**Files:**
- Create: `src/app/rules.ts`
- Modify: `src/app/overlay.ts` (extend `Overlay`, `emptyOverlay`)
- Test: `tests/app/rules.test.ts`

- [ ] **Step 1: Extend the Overlay (do this first so reducers compile)**

In `src/app/overlay.ts`, replace the `Overlay` interface and `emptyOverlay` with:

```typescript
import type { Lane, ScoredItem } from '../model/item';
import type { Rule } from './rules';

export interface Overlay {
  awayWindow: { since: string; setAt: string } | null;
  cleared: Record<string, true>;
  rerank: Record<string, Lane>;
  rules: Rule[];
  bulkExcludeEnabled: boolean;
  forcedInclude: Record<string, Lane>; // one-off promotes out of Set-aside, keyed by item id
}

export function emptyOverlay(): Overlay {
  return { awayWindow: null, cleared: {}, rerank: {}, rules: [], bulkExcludeEnabled: true, forcedInclude: {} };
}
```

Keep the existing `setAwayWindow`, `clearItem`, `unclearItem`, `rerankItem`, `OverlaidItem`, and `applyOverlay` exactly as they are.

- [ ] **Step 2: Write the failing test**

```typescript
// tests/app/rules.test.ts
import { describe, it, expect } from 'vitest';
import { addRule, removeRule, setBulkExclude, forceInclude, type Rule } from '../../src/app/rules';
import { emptyOverlay } from '../../src/app/overlay';

const rule: Rule = { id: 'r1', field: 'from-domain', value: 'company.com', action: 'include', lane: 'today' };

describe('rule reducers', () => {
  it('addRule appends without mutating input', () => {
    const base = emptyOverlay();
    const next = addRule(base, rule);
    expect(next.rules).toEqual([rule]);
    expect(base.rules).toEqual([]);
  });

  it('removeRule drops by id', () => {
    const o = addRule(emptyOverlay(), rule);
    expect(removeRule(o, 'r1').rules).toEqual([]);
    expect(removeRule(o, 'nope').rules).toEqual([rule]); // unknown id is a no-op
  });

  it('setBulkExclude toggles the flag', () => {
    expect(setBulkExclude(emptyOverlay(), false).bulkExcludeEnabled).toBe(false);
  });

  it('forceInclude records a one-off promote lane', () => {
    expect(forceInclude(emptyOverlay(), 'm1', 'fyi').forcedInclude).toEqual({ m1: 'fyi' });
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/app/rules.test.ts`
Expected: FAIL - cannot find module `rules`.

- [ ] **Step 4: Write the rule model + reducers**

```typescript
// src/app/rules.ts
import type { DaybreakItem, Lane } from '../model/item';
import { parseSenderTag } from '../scoring/sender-tag';
import type { Overlay } from './overlay';

export type RuleField = 'from' | 'from-domain';

export interface Rule {
  id: string;
  field: RuleField;
  value: string;                  // address or domain, compared case-insensitively
  action: 'include' | 'exclude';
  lane: Lane | null;              // include only: pin a lane, or null to let the scorer decide
}

export function addRule(o: Overlay, rule: Rule): Overlay {
  return { ...o, rules: [...o.rules, rule] };
}

export function removeRule(o: Overlay, id: string): Overlay {
  return { ...o, rules: o.rules.filter((r) => r.id !== id) };
}

export function setBulkExclude(o: Overlay, enabled: boolean): Overlay {
  return { ...o, bulkExcludeEnabled: enabled };
}

export function forceInclude(o: Overlay, id: string, lane: Lane): Overlay {
  return { ...o, forcedInclude: { ...o.forcedInclude, [id]: lane } };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/app/rules.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Run the full suite + typecheck (Overlay change must not break Plan 3)**

Run: `npm test && npm run typecheck`
Expected: all existing tests still pass (the new Overlay fields are additive; `applyOverlay`, store, etc. are unaffected at the type level). tsc clean for both projects.

- [ ] **Step 7: Commit**

```bash
git add src/app/rules.ts src/app/overlay.ts tests/app/rules.test.ts
git commit -m "feat(rules): Rule model, rule reducers, Overlay extension"
```

---

## Task 2: Bulk / automated detection

**Files:**
- Modify: `src/app/rules.ts` (add `isBulk`)
- Test: `tests/app/rules-isbulk.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/app/rules-isbulk.test.ts
import { describe, it, expect } from 'vitest';
import { isBulk } from '../../src/app/rules';
import type { DaybreakItem } from '../../src/model/item';

function item(over: Partial<DaybreakItem>): DaybreakItem {
  return { id: 'x', source: 'email_vendor', subject: 's', from: 'a@vendor.com', receivedAt: '2026-05-30T10:00:00.000Z', ...over };
}

describe('isBulk', () => {
  it('flags messages with a List-Unsubscribe header', () => {
    expect(isBulk(item({ internetHeaders: { 'List-Unsubscribe': '<mailto:u@vendor.com>' } }))).toBe(true);
  });
  it('flags Precedence: bulk and Auto-Submitted', () => {
    expect(isBulk(item({ internetHeaders: { Precedence: 'bulk' } }))).toBe(true);
    expect(isBulk(item({ internetHeaders: { 'Auto-Submitted': 'auto-generated' } }))).toBe(true);
  });
  it('flags no-reply style senders', () => {
    expect(isBulk(item({ from: 'no-reply@service.com' }))).toBe(true);
    expect(isBulk(item({ from: 'noreply@service.com' }))).toBe(true);
    expect(isBulk(item({ from: 'notifications@service.com' }))).toBe(true);
  });
  it('does not flag a normal person', () => {
    expect(isBulk(item({ from: 'jane@company.com', internetHeaders: {} }))).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/app/rules-isbulk.test.ts`
Expected: FAIL - `isBulk` is not exported.

- [ ] **Step 3: Add `isBulk` to `src/app/rules.ts`**

```typescript
// append to src/app/rules.ts

function headerValue(item: DaybreakItem, name: string): string | undefined {
  const headers = item.internetHeaders ?? {};
  const key = Object.keys(headers).find((k) => k.toLowerCase() === name);
  return key ? headers[key] : undefined;
}

const BULK_SENDER = /^(no-?reply|do-?not-?reply|donotreply|notifications?|mailer-daemon|bounce)/i;

// Detects mail that is machine-generated or sent to a list: newsletters, system
// notifications, automated digests. These are the default Set-aside candidates.
export function isBulk(item: DaybreakItem): boolean {
  if (headerValue(item, 'list-unsubscribe') !== undefined) return true;
  if (headerValue(item, 'auto-submitted') !== undefined) return true;
  const prec = headerValue(item, 'precedence')?.toLowerCase();
  if (prec === 'bulk' || prec === 'list' || prec === 'junk') return true;
  const localPart = item.from.split('@')[0] ?? '';
  return BULK_SENDER.test(localPart);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/app/rules-isbulk.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/app/rules.ts tests/app/rules-isbulk.test.ts
git commit -m "feat(rules): bulk/automated mail detection"
```

---

## Task 3: Inclusion classifier

`classifyItem` decides whether an item enters the active queue and, if so, whether a rule pins its lane. Precedence (highest first): one-off promote, JSM source (tickets always flow), sender flag, include rule, exclude rule, bulk default, unmatched.

**Files:**
- Modify: `src/app/rules.ts` (add `classifyItem`, `Inclusion`, `SetAsideReason`)
- Test: `tests/app/classify.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/app/classify.test.ts
import { describe, it, expect } from 'vitest';
import { classifyItem, addRule, setBulkExclude, forceInclude, type Rule } from '../../src/app/rules';
import { emptyOverlay } from '../../src/app/overlay';
import type { DaybreakItem } from '../../src/model/item';

function item(over: Partial<DaybreakItem>): DaybreakItem {
  return { id: 'x', source: 'email_internal', subject: 's', from: 'jane@company.com', receivedAt: '2026-05-30T10:00:00.000Z', ...over };
}

describe('classifyItem', () => {
  it('sets aside unmatched mail by default', () => {
    expect(classifyItem(item({}), emptyOverlay())).toEqual({ kind: 'aside', reason: 'unmatched' });
  });

  it('includes JSM/system items regardless of rules', () => {
    expect(classifyItem(item({ source: 'jsm' }), emptyOverlay())).toEqual({ kind: 'include', lane: null });
  });

  it('includes flagged mail (lane left to the scorer)', () => {
    const flagged = item({ internetHeaders: { 'X-PTO-Triage': 'blocked' } });
    expect(classifyItem(flagged, emptyOverlay())).toEqual({ kind: 'include', lane: null });
  });

  it('includes via an include rule and pins the rule lane', () => {
    const rule: Rule = { id: 'r1', field: 'from-domain', value: 'company.com', action: 'include', lane: 'today' };
    expect(classifyItem(item({}), addRule(emptyOverlay(), rule))).toEqual({ kind: 'include', lane: 'today' });
  });

  it('sets aside via an exclude rule', () => {
    const rule: Rule = { id: 'r2', field: 'from', value: 'jane@company.com', action: 'exclude', lane: null };
    expect(classifyItem(item({}), addRule(emptyOverlay(), rule))).toEqual({ kind: 'aside', reason: 'rule' });
  });

  it('sets aside bulk mail as automated, unless bulk-exclude is off', () => {
    const news = item({ from: 'news@vendor.com', source: 'email_vendor', internetHeaders: { 'List-Unsubscribe': '<x>' } });
    expect(classifyItem(news, emptyOverlay())).toEqual({ kind: 'aside', reason: 'automated' });
    expect(classifyItem(news, setBulkExclude(emptyOverlay(), false))).toEqual({ kind: 'aside', reason: 'unmatched' });
  });

  it('a one-off promote wins over everything', () => {
    const news = item({ id: 'm1', from: 'news@vendor.com', internetHeaders: { 'List-Unsubscribe': '<x>' } });
    expect(classifyItem(news, forceInclude(emptyOverlay(), 'm1', 'fyi'))).toEqual({ kind: 'include', lane: 'fyi' });
  });

  it('an include rule beats an exclude rule on the same item', () => {
    let o = addRule(emptyOverlay(), { id: 'i', field: 'from-domain', value: 'company.com', action: 'include', lane: 'this_week' });
    o = addRule(o, { id: 'e', field: 'from', value: 'jane@company.com', action: 'exclude', lane: null });
    expect(classifyItem(item({}), o)).toEqual({ kind: 'include', lane: 'this_week' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/app/classify.test.ts`
Expected: FAIL - `classifyItem` is not exported.

- [ ] **Step 3: Add the classifier to `src/app/rules.ts`**

```typescript
// append to src/app/rules.ts

export type SetAsideReason = 'rule' | 'automated' | 'unmatched';
export type Inclusion =
  | { kind: 'include'; lane: Lane | null }
  | { kind: 'aside'; reason: SetAsideReason };

function senderDomain(from: string): string {
  const at = from.lastIndexOf('@');
  return at >= 0 ? from.slice(at + 1).toLowerCase() : '';
}

function ruleMatches(item: DaybreakItem, rule: Rule): boolean {
  const from = item.from.toLowerCase();
  if (rule.field === 'from') return from === rule.value.toLowerCase();
  return senderDomain(item.from) === rule.value.toLowerCase();
}

export function classifyItem(item: DaybreakItem, overlay: Overlay): Inclusion {
  const forced = overlay.forcedInclude[item.id];
  if (forced) return { kind: 'include', lane: forced };

  // Tickets/system notifications always flow in; they carry their own priority.
  if (item.source === 'jsm') return { kind: 'include', lane: null };

  // A sender flag is an explicit "put this in your queue"; the scorer reads the
  // X-PTO-Triage header to assign the lane, so leave lane null here.
  if (parseSenderTag(item.internetHeaders)) return { kind: 'include', lane: null };

  const include = overlay.rules.find((r) => r.action === 'include' && ruleMatches(item, r));
  if (include) return { kind: 'include', lane: include.lane };

  const exclude = overlay.rules.find((r) => r.action === 'exclude' && ruleMatches(item, r));
  if (exclude) return { kind: 'aside', reason: 'rule' };

  if (overlay.bulkExcludeEnabled && isBulk(item)) return { kind: 'aside', reason: 'automated' };

  return { kind: 'aside', reason: 'unmatched' };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/app/classify.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Run the full suite + typecheck**

Run: `npm test && npm run typecheck`
Expected: all pass, both tsconfig projects clean.

- [ ] **Step 6: Commit**

```bash
git add src/app/rules.ts tests/app/classify.test.ts
git commit -m "feat(rules): inclusion classifier with rule/flag/bulk precedence"
```

---

## Task 4: Set-aside view types + buildTriageView extension

`TriageView` gains a `setAside` group so the renderer can show the bin. `buildTriageView` takes the set-aside entries as a new argument and maps them to a display shape (newest first).

**Files:**
- Modify: `src/app/view-model.ts`
- Test: `tests/app/view-model-setaside.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/app/view-model-setaside.test.ts
import { describe, it, expect } from 'vitest';
import { buildTriageView, type SetAsideEntry } from '../../src/app/view-model';
import type { Summary } from '../../src/summary/summary';

const summary: Summary = { needsTodayCount: 0, thisWeekCount: 0, fyiCount: 0, slaAtRiskCount: 0, resolvedWhileAwayCount: 0 };

describe('buildTriageView set-aside', () => {
  it('maps set-aside entries newest-first with their reason and counts them', () => {
    const setAside: SetAsideEntry[] = [
      { item: { id: 'a', source: 'email_vendor', subject: 'Newsletter', from: 'news@v.com', receivedAt: '2026-05-28T10:00:00.000Z' }, reason: 'automated' },
      { item: { id: 'b', source: 'email_internal', subject: 'Random', from: 'x@y.com', receivedAt: '2026-05-30T10:00:00.000Z' }, reason: 'unmatched' },
    ];
    const view = buildTriageView([], summary, { me: 'me@co.com', awaySince: '2026-05-25T00:00:00.000Z' }, setAside);
    expect(view.setAside.total).toBe(2);
    expect(view.setAside.items.map((i) => i.id)).toEqual(['b', 'a']); // newest first
    expect(view.setAside.items[0].reason).toBe('unmatched');
  });

  it('defaults set-aside to empty when the argument is omitted', () => {
    const view = buildTriageView([], summary, { me: 'me@co.com', awaySince: '2026-05-25T00:00:00.000Z' });
    expect(view.setAside).toEqual({ total: 0, items: [] });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/app/view-model-setaside.test.ts`
Expected: FAIL - `SetAsideEntry` not exported / `setAside` missing on `TriageView`.

- [ ] **Step 3: Extend `src/app/view-model.ts`**

Add these imports and types near the top (after the existing imports), keeping everything else intact:

```typescript
import type { DaybreakItem } from '../model/item';
import type { SetAsideReason } from './rules';

export interface SetAsideItemView {
  id: string;
  subject: string;
  from: string;
  receivedAt: string;
  reason: SetAsideReason;
}

export interface SetAsideView {
  total: number;
  items: SetAsideItemView[];
}

export interface SetAsideEntry {
  item: DaybreakItem;
  reason: SetAsideReason;
}
```

Add `setAside: SetAsideView;` to the `TriageView` interface (after `clearedCount`).

Change the `buildTriageView` signature and body to accept and map the set-aside entries:

```typescript
export function buildTriageView(
  items: OverlaidItem[],
  summary: Summary,
  meta: ViewMeta,
  setAside: SetAsideEntry[] = [],
): TriageView {
  const lanes = {} as Record<Lane, LaneView>;
  for (const lane of LANES) lanes[lane] = buildLane(lane, items);

  const setAsideItems: SetAsideItemView[] = setAside
    .map((e) => ({ id: e.item.id, subject: e.item.subject, from: e.item.from, receivedAt: e.item.receivedAt, reason: e.reason }))
    .sort((a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime());

  return {
    me: meta.me,
    awaySince: meta.awaySince,
    summary,
    lanes,
    clearedCount: meta.clearedCount ?? 0,
    setAside: { total: setAsideItems.length, items: setAsideItems },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/app/view-model-setaside.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Run the full suite + typecheck**

Run: `npm test && npm run typecheck`
Expected: existing view-model tests still pass (the new arg is optional and defaults to `[]`), both projects clean.

- [ ] **Step 6: Commit**

```bash
git add src/app/view-model.ts tests/app/view-model-setaside.test.ts
git commit -m "feat(view): set-aside group in TriageView"
```

---

## Task 5: Wire the inclusion gate into buildView

Split ingested items into included (scored, with rule-pinned lanes applied) and set-aside, and pass both to `buildTriageView`. INTEGRATION; typecheck-gated, run live in Task 10.

**Files:**
- Modify: `src/main/ingest-runner.ts`

- [ ] **Step 1: Rewrite the scoring section of `buildView`**

In `src/main/ingest-runner.ts`, add imports:

```typescript
import { classifyItem } from '../app/rules';
import type { SetAsideEntry } from '../app/view-model';
import type { Lane } from '../model/item';
```

Replace the block from `events.onPhase('scoring');` through the `return buildTriageView(...)` line with:

```typescript
    events.onPhase('scoring');
    const overlay = getOverlay();

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
```

This replacement subsumes the original `const overlay = getOverlay();` line (it was inside the replaced span), so afterwards there must be exactly ONE `const overlay = getOverlay();` in `buildView` - the one in this new block. Keep the `buildView` try/catch and the demo-mode branch above `events.onPhase('scoring')` unchanged. (Task 10 later edits this single `const overlay` line to seed demo rules.)

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: both projects clean.

- [ ] **Step 3: Run the full suite (no regressions to pure tests)**

Run: `npm test`
Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add src/main/ingest-runner.ts
git commit -m "feat(main): apply the inclusion gate in buildView"
```

---

## Task 6: Store + IPC + bridge for rules and promote

Persist the new overlay fields, backfill them for overlays saved before this change, and expose rule + promote operations to the renderer. INTEGRATION; typecheck-gated, run live in Task 10.

**Files:**
- Modify: `src/main/store.ts`, `src/main/ipc.ts`, `src/app/ipc-types.ts`, `src/preload/index.ts`

- [ ] **Step 1: Backfill defaults + add rule wrappers in `src/main/store.ts`**

Change `getOverlay` to merge stored data over the defaults (so overlays persisted by Plan 3, which lack the new keys, gain them), and add wrappers. Add these imports:

```typescript
import { addRule as addRuleR, removeRule as removeRuleR, setBulkExclude as setBulkExcludeR, forceInclude as forceIncludeR, type Rule } from '../app/rules';
```

Replace `getOverlay` and add the wrappers:

```typescript
export function getOverlay(): Overlay {
  return { ...emptyOverlay(), ...store.get('overlay') };
}

export function addRule(rule: Rule): Overlay {
  return update(addRuleR(getOverlay(), rule));
}

export function removeRule(id: string): Overlay {
  return update(removeRuleR(getOverlay(), id));
}

export function setBulkExclude(enabled: boolean): Overlay {
  return update(setBulkExcludeR(getOverlay(), enabled));
}

export function promoteSetAside(id: string, lane: Lane): Overlay {
  return update(forceIncludeR(getOverlay(), id, lane));
}
```

- [ ] **Step 2: Extend the bridge contract in `src/app/ipc-types.ts`**

Add a `RuleInput` type and four methods to `DaybreakBridge`. Add near the top:

```typescript
import type { Rule } from './rules';
```

Add to the `DaybreakBridge` interface (after `openItem`):

```typescript
  getRules(): Promise<{ rules: Rule[]; bulkExcludeEnabled: boolean }>;
  addRule(rule: Rule): Promise<ViewResult>;
  removeRule(id: string): Promise<ViewResult>;
  setBulkExclude(enabled: boolean): Promise<ViewResult>;
  promoteSetAside(id: string, lane: Lane): Promise<ViewResult>;
```

(`Lane` is already imported in this file.)

- [ ] **Step 3: Register the IPC handlers in `src/main/ipc.ts`**

Add imports:

```typescript
import { getOverlay as readOverlay, addRule, removeRule, setBulkExclude, promoteSetAside } from './store';
import type { Rule } from '../app/rules';
```

(Note: `getOverlay` may already be imported; if so, import the rule wrappers only and reuse the existing `getOverlay`.)

Inside `registerIpc()`, add:

```typescript
  ipcMain.handle('daybreak:getRules', () => {
    const o = readOverlay();
    return { rules: o.rules, bulkExcludeEnabled: o.bulkExcludeEnabled };
  });
  ipcMain.handle('daybreak:addRule', (_e, rule: Rule) => { addRule(rule); return viewForCurrentWindow(); });
  ipcMain.handle('daybreak:removeRule', (_e, id: string) => { removeRule(id); return viewForCurrentWindow(); });
  ipcMain.handle('daybreak:setBulkExclude', (_e, enabled: boolean) => { setBulkExclude(enabled); return viewForCurrentWindow(); });
  ipcMain.handle('daybreak:promoteSetAside', (_e, id: string, lane: Lane) => { promoteSetAside(id, lane); return viewForCurrentWindow(); });
```

- [ ] **Step 4: Wire the bridge in `src/preload/index.ts`**

Add to the `api` object:

```typescript
  getRules: () => ipcRenderer.invoke('daybreak:getRules'),
  addRule: (rule) => ipcRenderer.invoke('daybreak:addRule', rule),
  removeRule: (id) => ipcRenderer.invoke('daybreak:removeRule', id),
  setBulkExclude: (enabled) => ipcRenderer.invoke('daybreak:setBulkExclude', enabled),
  promoteSetAside: (id, lane) => ipcRenderer.invoke('daybreak:promoteSetAside', id, lane),
```

- [ ] **Step 5: Typecheck + build:main**

Run: `npm run typecheck && npm run build:main`
Expected: both projects clean; main bundles to CJS.

- [ ] **Step 6: Commit**

```bash
git add src/main/store.ts src/main/ipc.ts src/app/ipc-types.ts src/preload/index.ts
git commit -m "feat(app): persist rules, backfill overlay, IPC for rules and promote"
```

---

## Task 7: SetAsideBin component

**Files:**
- Create: `src/renderer/components/SetAsideBin.tsx`
- Test: `tests/renderer/SetAsideBin.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// tests/renderer/SetAsideBin.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SetAsideBin } from '../../src/renderer/components/SetAsideBin';
import type { SetAsideView } from '../../src/app/view-model';

const view: SetAsideView = {
  total: 2,
  items: [
    { id: 'a', subject: 'Weekly newsletter', from: 'news@v.com', receivedAt: '2026-05-30T09:00:00.000Z', reason: 'automated' },
    { id: 'b', subject: 'Random thing', from: 'x@y.com', receivedAt: '2026-05-29T09:00:00.000Z', reason: 'unmatched' },
  ],
};

describe('SetAsideBin', () => {
  it('shows the count and stays collapsed until opened', async () => {
    render(<SetAsideBin view={view} onPromote={() => {}} />);
    expect(screen.getByRole('button', { name: /set aside.*2/i })).toBeInTheDocument();
    expect(screen.queryByText('Weekly newsletter')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /set aside.*2/i }));
    expect(screen.getByText('Weekly newsletter')).toBeInTheDocument();
  });

  it('promotes an item to a chosen lane', async () => {
    const onPromote = vi.fn();
    render(<SetAsideBin view={view} onPromote={onPromote} />);
    await userEvent.click(screen.getByRole('button', { name: /set aside.*2/i }));
    const rowSelect = screen.getAllByLabelText(/move to/i)[0];
    await userEvent.selectOptions(rowSelect, 'today');
    expect(onPromote).toHaveBeenCalledWith('a', 'today');
  });

  it('renders nothing when empty', () => {
    const { container } = render(<SetAsideBin view={{ total: 0, items: [] }} onPromote={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/renderer/SetAsideBin.test.tsx`
Expected: FAIL - cannot find module `SetAsideBin`.

- [ ] **Step 3: Write the component**

```tsx
// src/renderer/components/SetAsideBin.tsx
import { useState } from 'react';
import type { SetAsideView, SetAsideItemView } from '../../app/view-model';
import type { Lane } from '../../model/item';

const REASON_LABEL: Record<string, string> = {
  automated: 'Automated', rule: 'Rule', unmatched: 'Unmatched',
};

export function SetAsideBin({ view, onPromote }: { view: SetAsideView; onPromote: (id: string, lane: Lane) => void }) {
  const [open, setOpen] = useState(false);
  if (view.total === 0) return null;
  return (
    <section className="mt-4 rounded-lg border border-slate-200 dark:border-slate-700">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-2 text-sm text-slate-500"
      >
        <span>Set aside</span>
        <span className="tabular-nums">{view.total}</span>
      </button>
      {open && view.items.map((row: SetAsideItemView) => (
        <div key={row.id} className="flex items-center gap-3 px-4 py-2 border-t border-slate-100 dark:border-slate-800 text-sm">
          <span className="min-w-0 flex-1 truncate">{row.subject} <span className="text-slate-400">{row.from}</span></span>
          <span className="shrink-0 rounded px-1.5 py-0.5 text-xs bg-slate-100 dark:bg-slate-800">{REASON_LABEL[row.reason]}</span>
          <select
            aria-label={`Move to lane`}
            defaultValue=""
            className="shrink-0 rounded border border-slate-200 dark:border-slate-700 bg-transparent px-1 py-1 text-xs"
            onChange={(e) => { if (e.target.value) onPromote(row.id, e.target.value as Lane); }}
          >
            <option value="" disabled>Move to...</option>
            <option value="today">Today</option>
            <option value="this_week">This week</option>
            <option value="fyi">FYI</option>
          </select>
        </div>
      ))}
    </section>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/renderer/SetAsideBin.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/renderer/components/SetAsideBin.tsx tests/renderer/SetAsideBin.test.tsx
git commit -m "feat(renderer): Set-aside bin with promote"
```

---

## Task 8: RulesSettings panel

**Files:**
- Create: `src/renderer/components/RulesSettings.tsx`
- Test: `tests/renderer/RulesSettings.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// tests/renderer/RulesSettings.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RulesSettings } from '../../src/renderer/components/RulesSettings';
import type { Rule } from '../../src/app/rules';

const rules: Rule[] = [
  { id: 'r1', field: 'from-domain', value: 'company.com', action: 'include', lane: 'today' },
];

describe('RulesSettings', () => {
  it('lists existing rules and removes one', async () => {
    const onRemove = vi.fn();
    render(<RulesSettings rules={rules} bulkExcludeEnabled onAdd={() => {}} onRemove={onRemove} onToggleBulk={() => {}} onClose={() => {}} />);
    expect(screen.getByText(/company\.com/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /remove/i }));
    expect(onRemove).toHaveBeenCalledWith('r1');
  });

  it('adds an include rule from the form', async () => {
    const onAdd = vi.fn();
    render(<RulesSettings rules={[]} bulkExcludeEnabled onAdd={onAdd} onRemove={() => {}} onToggleBulk={() => {}} onClose={() => {}} />);
    await userEvent.type(screen.getByLabelText(/sender or domain/i), 'boss@company.com');
    await userEvent.click(screen.getByRole('button', { name: /add rule/i }));
    expect(onAdd).toHaveBeenCalledTimes(1);
    const added = onAdd.mock.calls[0][0] as Rule;
    expect(added.value).toBe('boss@company.com');
    expect(added.action).toBe('include');
  });

  it('toggles the bulk-exclude switch', async () => {
    const onToggleBulk = vi.fn();
    render(<RulesSettings rules={[]} bulkExcludeEnabled onAdd={() => {}} onRemove={() => {}} onToggleBulk={onToggleBulk} onClose={() => {}} />);
    await userEvent.click(screen.getByLabelText(/set aside automated/i));
    expect(onToggleBulk).toHaveBeenCalledWith(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/renderer/RulesSettings.test.tsx`
Expected: FAIL - cannot find module `RulesSettings`.

- [ ] **Step 3: Write the component**

```tsx
// src/renderer/components/RulesSettings.tsx
import { useState } from 'react';
import type { Rule, RuleField } from '../../app/rules';
import type { Lane } from '../../model/item';

// A new rule's id is derived from its content so the same rule is not added twice;
// Math.random is unavailable in this codebase, so content + field + action is the key.
function ruleId(field: RuleField, value: string, action: string): string {
  return `${action}:${field}:${value.toLowerCase()}`;
}

export function RulesSettings({
  rules,
  bulkExcludeEnabled,
  onAdd,
  onRemove,
  onToggleBulk,
  onClose,
}: {
  rules: Rule[];
  bulkExcludeEnabled: boolean;
  onAdd: (rule: Rule) => void;
  onRemove: (id: string) => void;
  onToggleBulk: (enabled: boolean) => void;
  onClose: () => void;
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

  return (
    <div className="min-h-dvh bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Rules</h1>
        <button type="button" onClick={onClose} className="text-sm underline">Done</button>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={bulkExcludeEnabled} onChange={(e) => onToggleBulk(e.target.checked)} />
        Set aside automated and bulk mail (newsletters, notifications)
      </label>

      <ul className="mt-4 space-y-1">
        {rules.map((r) => (
          <li key={r.id} className="flex items-center gap-3 text-sm">
            <span className="flex-1">
              <strong>{r.action}</strong> {r.field === 'from' ? 'from' : 'domain'} {r.value}
              {r.action === 'include' && r.lane ? ` -> ${r.lane}` : ''}
            </span>
            <button type="button" onClick={() => onRemove(r.id)} className="text-red-600 underline">Remove</button>
          </li>
        ))}
      </ul>

      <div className="mt-4 flex flex-wrap items-end gap-2">
        <label className="text-sm">
          <span className="block">Sender or domain</span>
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="boss@company.com or company.com"
            className="mt-1 rounded border border-slate-300 dark:border-slate-600 bg-transparent px-2 py-1"
          />
        </label>
        <select aria-label="Action" value={action} onChange={(e) => setAction(e.target.value as 'include' | 'exclude')} className="rounded border border-slate-300 dark:border-slate-600 bg-transparent px-2 py-1 text-sm">
          <option value="include">Include</option>
          <option value="exclude">Exclude</option>
        </select>
        {action === 'include' && (
          <select aria-label="Lane" value={lane} onChange={(e) => setLane(e.target.value as Lane)} className="rounded border border-slate-300 dark:border-slate-600 bg-transparent px-2 py-1 text-sm">
            <option value="today">Today</option>
            <option value="this_week">This week</option>
            <option value="fyi">FYI</option>
          </select>
        )}
        <button type="button" onClick={submit} className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white">Add rule</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/renderer/RulesSettings.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/renderer/components/RulesSettings.tsx tests/renderer/RulesSettings.test.tsx
git commit -m "feat(renderer): rules settings panel"
```

---

## Task 9: Wire SetAsideBin + RulesSettings into App

Render the Set-aside bin under the lanes, add a Settings button that opens the rules panel, and wire the new bridge calls. INTEGRATION; the existing App test still covers the away-window route, and a new test covers the bin showing on the triage surface.

**Files:**
- Modify: `src/renderer/App.tsx`
- Test: `tests/renderer/App-setaside.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// tests/renderer/App-setaside.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../../src/renderer/App';
import type { TriageView } from '../../src/app/view-model';

const emptyLane = (lane: 'today' | 'this_week' | 'fyi') => ({ lane, total: 0, groups: [] });
const triage: TriageView = {
  me: 'me@co.com',
  awaySince: '2026-05-25T00:00:00.000Z',
  summary: { needsTodayCount: 0, thisWeekCount: 0, fyiCount: 0, slaAtRiskCount: 0, resolvedWhileAwayCount: 0 },
  lanes: { today: emptyLane('today'), this_week: emptyLane('this_week'), fyi: emptyLane('fyi') },
  clearedCount: 0,
  setAside: { total: 1, items: [{ id: 'a', subject: 'Newsletter', from: 'news@v.com', receivedAt: '2026-05-30T09:00:00.000Z', reason: 'automated' }] },
};

beforeEach(() => {
  (window as unknown as { daybreak: unknown }).daybreak = {
    getView: vi.fn().mockResolvedValue(triage),
    setAwayWindow: vi.fn(), refresh: vi.fn().mockResolvedValue(triage),
    clearItem: vi.fn(), unclearItem: vi.fn(), rerankItem: vi.fn(), openItem: vi.fn(),
    getRules: vi.fn().mockResolvedValue({ rules: [], bulkExcludeEnabled: true }),
    addRule: vi.fn(), removeRule: vi.fn(), setBulkExclude: vi.fn(), promoteSetAside: vi.fn().mockResolvedValue(triage),
    onIngest: vi.fn().mockReturnValue(() => {}),
  };
});

describe('App set-aside', () => {
  it('shows the Set-aside bin on the triage surface', async () => {
    render(<App />);
    expect(await screen.findByRole('button', { name: /set aside.*1/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/renderer/App-setaside.test.tsx`
Expected: FAIL - App does not render the bin yet.

- [ ] **Step 3: Edit `src/renderer/App.tsx`**

Add imports:

```typescript
import { SetAsideBin } from './components/SetAsideBin';
import { RulesSettings } from './components/RulesSettings';
import type { Rule } from '../app/rules';
```

Add state for the settings panel + rules, after the existing `useState` hooks:

```typescript
  const [showSettings, setShowSettings] = useState(false);
  const [rules, setRules] = useState<Rule[]>([]);
  const [bulkExclude, setBulkExclude] = useState(true);
```

Add action callbacks (near the other `useCallback`s):

```typescript
  const onPromote = useCallback(async (id: string, lane: Lane) => {
    setView(await daybreak.promoteSetAside(id, lane));
  }, []);
  const openSettings = useCallback(async () => {
    const r = await daybreak.getRules();
    setRules(r.rules);
    setBulkExclude(r.bulkExcludeEnabled);
    setShowSettings(true);
  }, []);
  const addRuleAction = useCallback(async (rule: Rule) => {
    const v = await daybreak.addRule(rule);
    setRules((rs) => (rs.some((x) => x.id === rule.id) ? rs : [...rs, rule]));
    if (!('error' in v) && !('needsAwayWindow' in v)) setView(v);
  }, []);
  const removeRuleAction = useCallback(async (id: string) => {
    const v = await daybreak.removeRule(id);
    setRules((rs) => rs.filter((x) => x.id !== id));
    if (!('error' in v) && !('needsAwayWindow' in v)) setView(v);
  }, []);
  const toggleBulk = useCallback(async (enabled: boolean) => {
    setBulkExclude(enabled);
    const v = await daybreak.setBulkExclude(enabled);
    if (!('error' in v) && !('needsAwayWindow' in v)) setView(v);
  }, []);
```

Add the settings-panel early return, placed AFTER the `auth` branch and BEFORE `if (view === null)`:

```typescript
  if (showSettings) {
    return (
      <RulesSettings
        rules={rules}
        bulkExcludeEnabled={bulkExclude}
        onAdd={addRuleAction}
        onRemove={removeRuleAction}
        onToggleBulk={toggleBulk}
        onClose={() => setShowSettings(false)}
      />
    );
  }
```

In the TriageView return block, add a Settings button in the header area and the bin under the lane grid. Replace the `<SummaryHeader .../>` line with a header row:

```tsx
      <div className="flex items-start justify-between">
        <SummaryHeader summary={view.summary} awaySince={view.awaySince} />
        <button type="button" onClick={openSettings} className="m-4 shrink-0 rounded border border-slate-200 dark:border-slate-700 px-3 py-1 text-sm">
          Rules
        </button>
      </div>
```

And immediately after the closing `</div>` of the lane grid (the `grid gap-4 md:grid-cols-3` block), add:

```tsx
        <SetAsideBin view={view.setAside} onPromote={onPromote} />
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/renderer/App-setaside.test.tsx`
Expected: PASS.

- [ ] **Step 5: Run the full suite + typecheck + renderer build**

Run: `npm test && npm run typecheck && npm run build:renderer`
Expected: all tests pass (including the existing App test), both projects clean, Vite builds.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/App.tsx tests/renderer/App-setaside.test.tsx
git commit -m "feat(renderer): wire Set-aside bin and Rules settings into App"
```

---

## Task 10: Demo data update + manual verification

Make the curated-queue behavior visible in demo mode, then verify end to end.

**Files:**
- Modify: `src/app/demo-data.ts`

- [ ] **Step 1: Seed demo include rules so demo lanes stay populated**

Under the new gate, demo items without a flag or rule would be set aside. Add an exported helper that returns demo rules, and have demo mode seed them. In `src/app/demo-data.ts` add:

```typescript
import type { Rule } from './rules';

// Demo include rules so the un-flagged demo items (design-lead, legal) still land
// in lanes, while the vendor newsletter falls to Set-aside - showing both halves.
export function demoRules(): Rule[] {
  return [
    { id: 'demo-include-company', field: 'from-domain', value: 'company.com', action: 'include', lane: null },
  ];
}
```

- [ ] **Step 2: Apply demo rules in the runner**

In `src/main/ingest-runner.ts`, in the demo branch where `me` and `items` are set, also seed the overlay rules for the classification step. Since `buildView` reads the overlay via `getOverlay()`, the simplest approach is: in demo mode, merge the demo rules into the overlay used for classification. Change the line `const overlay = getOverlay();` to:

```typescript
    const overlay = isDemoMode()
      ? { ...getOverlay(), rules: [...getOverlay().rules, ...demoRules()] }
      : getOverlay();
```

and add the import:

```typescript
import { DEMO_ME, demoItems, demoRules } from '../app/demo-data';
```

- [ ] **Step 3: Typecheck + full suite**

Run: `npm test && npm run typecheck`
Expected: all pass, both projects clean.

- [ ] **Step 4: Manual verification in demo mode (no Azure needed)**

Run: `npm run app:demo`
Expected:
- The three lanes are populated by the `company.com` items (CFO, legal, design-lead, peer) plus the flagged ones.
- A **"Set aside - N"** bin appears under the lanes; opening it shows the **vendor newsletter** and the **Datadog invoice** (vendor domain, no rule), tagged Automated/Unmatched.
- Clicking **Move to... -> Today** on a set-aside item moves it into the Today lane (it leaves the bin).
- The **Rules** button opens the settings panel; adding an include rule for `datadoghq.com` and returning shows the Datadog invoice now in a lane instead of Set-aside; toggling off "Set aside automated" brings bulk mail back into the lanes.

- [ ] **Step 5: Commit**

```bash
git add src/app/demo-data.ts src/main/ingest-runner.ts
git commit -m "demo: seed include rule so demo shows populated lanes plus a Set-aside bin"
```

---

## Self-Review (completed by plan author)

**Spec coverage (against the curated-queue spec):**
- Inclusion = recipient rules OR sender flag, else set aside - Task 3 (`classifyItem`), Task 5 (wired into buildView).
- Default-aside for unmatched - Task 3 (final branch).
- Set aside, not deleted; collapsed bin; promote into a lane - Tasks 4 (view), 7 (bin), 9 (App), with promote persisting via `forcedInclude` (Tasks 1, 6).
- Recipient rules v1: sender/domain include/exclude, To-vs-cc is deferred (see note), bulk-exclude toggle on by default - Tasks 1, 2, 3, 8.
- Sender flags unchanged, four tags read by the existing parser - Task 3 reuses `parseSenderTag`; no reader change.
- JSM always included - Task 3 (`source === 'jsm'`).
- Inference demoted to lane-refiner for rule-included no-flag items - Task 5 scores included items; rule-pinned lanes override, otherwise the Plan 1 scorer/inference assigns the lane.
- Local-first, on-device rules in the overlay - Tasks 1, 6.

**Intentionally deferred (per spec "v1 scope" + YAGNI):** the "To vs cc-only" rule field (the model supports adding a `RuleField`, but v1 ships `from`/`from-domain` only); keyword/body rules; per-recipient flag routing; the Outlook add-in (separate plan); JSM ingestion (separate plan); one-click "always include this sender" on promote (promote is a one-off `forcedInclude` in v1; turning it into a rule is a small follow-up). These are noted so they are not mistaken for gaps.

**Placeholder scan:** none - every code/test step has complete content. Integration tasks (5, 6, 9, 10) carry typecheck + manual verification, the honest treatment for Electron/IPC/renderer-wiring code, consistent with Plans 2 and 3.

**Type consistency:** `Rule`/`RuleField` (Task 1) are used by `classifyItem` (Task 3), the store/IPC (Task 6), and `RulesSettings` (Task 8). `Inclusion`/`SetAsideReason` (Task 3) feed `SetAsideEntry`/`SetAsideView` (Task 4), consumed by `buildView` (Task 5), `SetAsideBin` (Task 7), and the App (Task 9). The extended `Overlay` (Task 1) is read with backfilled defaults in `getOverlay` (Task 6) so Plan 3 overlays keep working. The new bridge methods (Task 6 `ipc-types.ts`) are implemented in preload (Task 6) and called in the App (Task 9). `buildTriageView`'s new optional `setAside` arg (Task 4) is supplied by `buildView` (Task 5).

## Known v1 limitations (intentional, documented)
- Promote from Set-aside is a one-off `forcedInclude` keyed by message id; it survives re-ingest but does not create a sender rule. "Always include this sender" is a one-line follow-up (call `addRule` alongside `promoteSetAside`).
- Rules match sender/domain and run in array order; include beats exclude beats bulk. No rule reordering UI in v1.
- Set-aside items are shown as a flat newest-first list with a reason tag, not sub-grouped by reason. Grouping is a later refinement if the bin gets large.
- The bulk detector hard-sets-aside; a borderline vendor that sometimes sends real escalations is handled by adding an include rule for that sender (or promoting), not by a fuzzy score.
