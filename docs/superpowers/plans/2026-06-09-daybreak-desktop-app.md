# Daybreak Desktop App + Triage UI Implementation Plan (Plan 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn Daybreak from a headless library + CLI into a runnable macOS desktop app that ingests Outlook mail (Plan 2), scores it (Plan 1), and renders the three-lane triage surface with a "while you were out" summary and per-item Open / Re-rank / Clear actions.

**Architecture:** Three TypeScript layers in the existing repo. An Electron **main** process owns auth, ingestion, scoring, and an `electron-store` overlay; a **preload** bridge exposes a typed `window.daybreak` IPC API; a React + Vite + Tailwind **renderer** is a pure view. The scoring/ingestion core (`src/scoring`, `src/ingest`, `src/summary`, `src/model`) is untouched and imported by main. Two new PURE modules - `applyOverlay` then `buildTriageView` - turn `ScoredItem[]` + the persisted overlay into the `TriageView` the renderer draws. The app re-ingests fresh each launch and persists overlay state only (away window, cleared ids, re-rank overrides), never email content.

**Tech Stack:** TypeScript (strict, ESM), React 19, Vite 6, Tailwind v4 (`@tailwindcss/vite`), Electron 33, electron-store 8, electron-updater 6, electron-builder 25, esbuild (main/preload bundle), Vitest 2 + @testing-library/react + jsdom, tsx.

**House rules:** No em dashes anywhere in code or comments - use regular hyphens. Strict TypeScript. TDD for all pure modules and presentational components: write the failing test, see it fail, implement, see it pass, commit. Integration code (Electron shell, IPC, store, live Graph) is typecheck-gated + manually verified, with no unit test, exactly as Plan 2 treated its integration modules.

---

## File Structure

Existing core (UNCHANGED, imported by main): `src/model/item.ts`, `src/scoring/*`, `src/ingest/*`, `src/summary/*`.

New files:

- `src/app/overlay.ts` - PURE: `Overlay` type, `emptyOverlay`, reducers (`setAwayWindow`, `clearItem`, `unclearItem`, `rerankItem`), and `applyOverlay(scored, overlay) -> OverlaidItem[]`.
- `src/app/view-model.ts` - PURE: `TriageView`/`LaneView`/`SourceGroupView`/`ScoredItemView` types and `buildTriageView(overlaid, summary, meta) -> TriageView`.
- `src/app/away-window.ts` - PURE: `validateAwayWindow(sinceISO, nowISO) -> { ok: true } | { ok: false; reason: string }`.
- `src/main/store.ts` - electron-store wrapper typed to `Overlay`, delegating mutations to the pure reducers.
- `src/main/ingest-runner.ts` - orchestrates ingest -> score -> summary -> overlay -> `TriageView`; emits progress + auth events.
- `src/main/ipc.ts` - registers IPC handlers backing the bridge API.
- `src/main/updater.ts` - electron-updater wiring (dormant until a release feed exists).
- `src/main/index.ts` - app + window lifecycle; wires store, ipc, updater.
- `src/preload/index.ts` - `contextBridge` exposing `window.daybreak`.
- `src/renderer/` - React app: `index.html`, `main.tsx`, `App.tsx`, `bridge.ts` (typed window.daybreak accessor), `components/*`, `styles.css`.
- `scripts/build-main.mjs` - esbuild bundle for main + preload.
- Config: `vite.config.ts`, `vitest.config.ts`, `electron-builder.yml`.
- Tests under `tests/app/` (pure) and `tests/renderer/` (RTL).

**Phasing (for execution grouping):** A = pure logic (Tasks 1-4), B = deps + build scaffold (Tasks 5-7), C = main wiring (Tasks 8-10), D = renderer components (Tasks 11-15), E = end-to-end manual verification (Task 16).

---

## Task 1: Overlay model + pure reducers

**Files:**
- Create: `src/app/overlay.ts`
- Test: `tests/app/overlay-reducers.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/app/overlay-reducers.test.ts
import { describe, it, expect } from 'vitest';
import {
  emptyOverlay,
  setAwayWindow,
  clearItem,
  unclearItem,
  rerankItem,
  type Overlay,
} from '../../src/app/overlay';

describe('overlay reducers', () => {
  it('emptyOverlay has a null away window and no cleared/rerank entries', () => {
    expect(emptyOverlay()).toEqual({ awayWindow: null, cleared: {}, rerank: {} });
  });

  it('setAwayWindow records since + setAt without mutating the input', () => {
    const base = emptyOverlay();
    const next = setAwayWindow(base, '2026-05-25T00:00:00.000Z', '2026-06-09T08:00:00.000Z');
    expect(next.awayWindow).toEqual({
      since: '2026-05-25T00:00:00.000Z',
      setAt: '2026-06-09T08:00:00.000Z',
    });
    expect(base.awayWindow).toBeNull(); // input untouched
  });

  it('clearItem then unclearItem round-trips', () => {
    const a = clearItem(emptyOverlay(), 'm1');
    expect(a.cleared).toEqual({ m1: true });
    const b = unclearItem(a, 'm1');
    expect(b.cleared).toEqual({});
  });

  it('rerankItem records an overridden lane', () => {
    const next = rerankItem(emptyOverlay(), 'm1', 'today');
    expect(next.rerank).toEqual({ m1: 'today' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/app/overlay-reducers.test.ts`
Expected: FAIL - cannot find module `overlay`.

- [ ] **Step 3: Write the implementation**

```typescript
// src/app/overlay.ts
import type { Lane, ScoredItem } from '../model/item';

export interface Overlay {
  awayWindow: { since: string; setAt: string } | null;
  cleared: Record<string, true>;
  rerank: Record<string, Lane>;
}

export function emptyOverlay(): Overlay {
  return { awayWindow: null, cleared: {}, rerank: {} };
}

export function setAwayWindow(o: Overlay, sinceISO: string, nowISO: string): Overlay {
  return { ...o, awayWindow: { since: sinceISO, setAt: nowISO } };
}

export function clearItem(o: Overlay, id: string): Overlay {
  return { ...o, cleared: { ...o.cleared, [id]: true } };
}

export function unclearItem(o: Overlay, id: string): Overlay {
  const cleared = { ...o.cleared };
  delete cleared[id];
  return { ...o, cleared };
}

export function rerankItem(o: Overlay, id: string, lane: Lane): Overlay {
  return { ...o, rerank: { ...o.rerank, [id]: lane } };
}

// An overlaid item carries its effective lane (after a possible re-rank override)
// and whether that lane came from a manual correction.
export interface OverlaidItem {
  scored: ScoredItem;
  lane: Lane;
  reranked: boolean;
}

export function applyOverlay(scored: ScoredItem[], overlay: Overlay): OverlaidItem[] {
  const out: OverlaidItem[] = [];
  for (const s of scored) {
    const id = s.item.id;
    if (overlay.cleared[id]) continue;
    const override = overlay.rerank[id];
    out.push({
      scored: s,
      lane: override ?? s.lane,
      reranked: override !== undefined && override !== s.lane,
    });
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/app/overlay-reducers.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/app/overlay.ts tests/app/overlay-reducers.test.ts
git commit -m "feat(app): overlay model and pure reducers"
```

---

## Task 2: applyOverlay behavior

**Files:**
- Modify: `src/app/overlay.ts` (already contains `applyOverlay` from Task 1 - this task only adds tests)
- Test: `tests/app/apply-overlay.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/app/apply-overlay.test.ts
import { describe, it, expect } from 'vitest';
import { applyOverlay, emptyOverlay, clearItem, rerankItem } from '../../src/app/overlay';
import type { ScoredItem } from '../../src/model/item';

function scored(id: string, lane: ScoredItem['lane']): ScoredItem {
  return {
    item: { id, source: 'email_internal', subject: id, from: 'a@co.com', receivedAt: '2026-05-30T10:00:00.000Z' },
    lane,
    rank: 50,
    reasons: [],
    resolved: false,
  };
}

describe('applyOverlay', () => {
  it('passes items through unchanged with an empty overlay', () => {
    const out = applyOverlay([scored('a', 'today'), scored('b', 'fyi')], emptyOverlay());
    expect(out.map((o) => [o.scored.item.id, o.lane, o.reranked])).toEqual([
      ['a', 'today', false],
      ['b', 'fyi', false],
    ]);
  });

  it('drops cleared items', () => {
    const out = applyOverlay([scored('a', 'today'), scored('b', 'fyi')], clearItem(emptyOverlay(), 'a'));
    expect(out.map((o) => o.scored.item.id)).toEqual(['b']);
  });

  it('applies a re-rank override and flags it', () => {
    const out = applyOverlay([scored('a', 'fyi')], rerankItem(emptyOverlay(), 'a', 'today'));
    expect(out[0].lane).toBe('today');
    expect(out[0].reranked).toBe(true);
  });

  it('an override equal to the scored lane is not flagged as reranked', () => {
    const out = applyOverlay([scored('a', 'today')], rerankItem(emptyOverlay(), 'a', 'today'));
    expect(out[0].reranked).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails or passes**

Run: `npx vitest run tests/app/apply-overlay.test.ts`
Expected: PASS (4 tests) - `applyOverlay` was implemented in Task 1. If any assertion fails, fix `applyOverlay` in `src/app/overlay.ts` to satisfy it before committing.

- [ ] **Step 3: Commit**

```bash
git add tests/app/apply-overlay.test.ts
git commit -m "test(app): applyOverlay behavior coverage"
```

---

## Task 3: buildTriageView (view-model assembly)

`buildTriageView` turns the overlaid items + the Plan 1 `Summary` + run metadata into the `TriageView` the renderer draws: it groups each lane by source (ordered System -> Internal -> Vendor), sorts each group by `rank` descending, flattens each `ScoredItem` into a presentational `ScoredItemView` (mapping the `X-PTO-Triage` header to a `senderTag` via the existing `parseSenderTag`), and counts.

**Files:**
- Create: `src/app/view-model.ts`
- Test: `tests/app/view-model.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/app/view-model.test.ts
import { describe, it, expect } from 'vitest';
import { buildTriageView } from '../../src/app/view-model';
import type { OverlaidItem } from '../../src/app/overlay';
import type { ScoredItem, Source, Lane } from '../../src/model/item';
import type { Summary } from '../../src/summary/summary';

function overlaid(
  id: string,
  source: Source,
  lane: Lane,
  rank: number,
  extra: Partial<ScoredItem['item']> = {},
): OverlaidItem {
  return {
    scored: {
      item: { id, source, subject: id, from: 'a@co.com', receivedAt: '2026-05-30T10:00:00.000Z', ...extra },
      lane,
      rank,
      reasons: ['because'],
      resolved: false,
    },
    lane,
    reranked: false,
  };
}

const summary: Summary = {
  needsTodayCount: 0, thisWeekCount: 0, fyiCount: 0, slaAtRiskCount: 0, resolvedWhileAwayCount: 0,
};

describe('buildTriageView', () => {
  it('groups a lane by source (System, Internal, Vendor) and sorts each group by rank desc', () => {
    const items: OverlaidItem[] = [
      overlaid('v1', 'email_vendor', 'today', 10),
      overlaid('i_low', 'email_internal', 'today', 20),
      overlaid('sys', 'jsm', 'today', 99),
      overlaid('i_high', 'email_internal', 'today', 80),
    ];
    const view = buildTriageView(items, summary, { me: 'me@co.com', awaySince: '2026-05-25T00:00:00.000Z' });
    const today = view.lanes.today;
    expect(today.total).toBe(4);
    expect(today.groups.map((g) => g.source)).toEqual(['jsm', 'email_internal', 'email_vendor']);
    const internal = today.groups.find((g) => g.source === 'email_internal')!;
    expect(internal.items.map((i) => i.id)).toEqual(['i_high', 'i_low']); // rank desc
  });

  it('maps the X-PTO-Triage header to a senderTag and carries reasons/webLink/resolved', () => {
    const items: OverlaidItem[] = [
      overlaid('a', 'email_internal', 'today', 50, {
        internetHeaders: { 'X-PTO-Triage': 'blocked' },
        webLink: 'https://outlook.example/a',
      }),
    ];
    const view = buildTriageView(items, summary, { me: 'me@co.com', awaySince: '2026-05-25T00:00:00.000Z' });
    const row = view.lanes.today.groups[0].items[0];
    expect(row.senderTag).toBe('blocked');
    expect(row.reasons).toEqual(['because']);
    expect(row.webLink).toBe('https://outlook.example/a');
    expect(row.resolved).toBe(false);
  });

  it('counts cleared items and leaves empty lanes empty', () => {
    const view = buildTriageView([], { ...summary }, {
      me: 'me@co.com', awaySince: '2026-05-25T00:00:00.000Z', clearedCount: 3,
    });
    expect(view.lanes.today.total).toBe(0);
    expect(view.lanes.this_week.groups).toEqual([]);
    expect(view.clearedCount).toBe(3);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/app/view-model.test.ts`
Expected: FAIL - cannot find module `view-model`.

- [ ] **Step 3: Write the implementation**

```typescript
// src/app/view-model.ts
import type { Lane, SenderTag, Source } from '../model/item';
import type { Summary } from '../summary/summary';
import { parseSenderTag } from '../scoring/sender-tag';
import type { OverlaidItem } from './overlay';

export interface ScoredItemView {
  id: string;
  subject: string;
  from: string;
  receivedAt: string;
  reasons: string[];
  resolved: boolean;
  senderTag?: SenderTag;
  webLink?: string;
  lane: Lane;
  reranked: boolean;
}

export interface SourceGroupView {
  source: Source;
  items: ScoredItemView[];
}

export interface LaneView {
  lane: Lane;
  total: number;
  groups: SourceGroupView[];
}

export interface TriageView {
  me: string;
  awaySince: string;
  summary: Summary;
  lanes: Record<Lane, LaneView>;
  clearedCount: number;
}

export interface ViewMeta {
  me: string;
  awaySince: string;
  clearedCount?: number;
}

const LANES: Lane[] = ['today', 'this_week', 'fyi'];
const SOURCE_ORDER: Source[] = ['jsm', 'email_internal', 'email_vendor'];

function toRow(o: OverlaidItem): ScoredItemView {
  const it = o.scored.item;
  const tag = parseSenderTag(it.internetHeaders);
  return {
    id: it.id,
    subject: it.subject,
    from: it.from,
    receivedAt: it.receivedAt,
    reasons: o.scored.reasons,
    resolved: o.scored.resolved,
    senderTag: tag?.tag,
    webLink: it.webLink,
    lane: o.lane,
    reranked: o.reranked,
  };
}

function buildLane(lane: Lane, items: OverlaidItem[]): LaneView {
  const inLane = items.filter((o) => o.lane === lane);
  const groups: SourceGroupView[] = [];
  for (const source of SOURCE_ORDER) {
    const rows = inLane
      .filter((o) => o.scored.item.source === source)
      .sort((a, b) => b.scored.rank - a.scored.rank)
      .map(toRow);
    if (rows.length > 0) groups.push({ source, items: rows });
  }
  return { lane, total: inLane.length, groups };
}

export function buildTriageView(items: OverlaidItem[], summary: Summary, meta: ViewMeta): TriageView {
  const lanes = {} as Record<Lane, LaneView>;
  for (const lane of LANES) lanes[lane] = buildLane(lane, items);
  return {
    me: meta.me,
    awaySince: meta.awaySince,
    summary,
    lanes,
    clearedCount: meta.clearedCount ?? 0,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/app/view-model.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/app/view-model.ts tests/app/view-model.test.ts
git commit -m "feat(app): buildTriageView groups and flattens scored items for the renderer"
```

---

## Task 4: away-window validation

**Files:**
- Create: `src/app/away-window.ts`
- Test: `tests/app/away-window.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/app/away-window.test.ts
import { describe, it, expect } from 'vitest';
import { validateAwayWindow } from '../../src/app/away-window';

const now = '2026-06-09T08:00:00.000Z';

describe('validateAwayWindow', () => {
  it('accepts a valid past date', () => {
    expect(validateAwayWindow('2026-05-25T00:00:00.000Z', now)).toEqual({ ok: true });
  });

  it('rejects an unparseable date', () => {
    const r = validateAwayWindow('not-a-date', now);
    expect(r.ok).toBe(false);
  });

  it('rejects a future date', () => {
    const r = validateAwayWindow('2026-06-20T00:00:00.000Z', now);
    expect(r).toEqual({ ok: false, reason: 'The date you were out since cannot be in the future.' });
  });

  it('rejects a date more than a year ago as likely a mistake', () => {
    const r = validateAwayWindow('2024-01-01T00:00:00.000Z', now);
    expect(r.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/app/away-window.test.ts`
Expected: FAIL - cannot find module `away-window`.

- [ ] **Step 3: Write the implementation**

```typescript
// src/app/away-window.ts

export type AwayWindowCheck = { ok: true } | { ok: false; reason: string };

const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

// Validates the user-supplied "I was out since" date against the current time.
// Guards the two realistic mistakes: a future date, or a date so old it is almost
// certainly a typo (more than a year back).
export function validateAwayWindow(sinceISO: string, nowISO: string): AwayWindowCheck {
  const since = Date.parse(sinceISO);
  const now = Date.parse(nowISO);
  if (Number.isNaN(since)) {
    return { ok: false, reason: 'That is not a date Daybreak can read.' };
  }
  if (since > now) {
    return { ok: false, reason: 'The date you were out since cannot be in the future.' };
  }
  if (now - since > ONE_YEAR_MS) {
    return { ok: false, reason: 'That date is more than a year ago. Please pick a more recent date.' };
  }
  return { ok: true };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/app/away-window.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Run the full suite + typecheck (no regressions)**

Run: `npm test && npm run typecheck`
Expected: all tests pass (Plan 1/2 + the new app tests), tsc clean.

- [ ] **Step 6: Commit**

```bash
git add src/app/away-window.ts tests/app/away-window.test.ts
git commit -m "feat(app): away-window validation"
```

---

## Task 5: Add app dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Add dependencies and scripts**

Edit `package.json` so the `scripts`, `dependencies`, and `devDependencies` blocks are exactly:

```json
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit",
    "score": "tsx src/cli.ts",
    "ingest": "tsx src/cli-ingest.ts",
    "build:main": "node scripts/build-main.mjs",
    "build:renderer": "vite build",
    "app:dev": "node scripts/build-main.mjs && concurrently -k \"vite\" \"electron .\"",
    "app:build": "npm run build:main && npm run build:renderer",
    "app:dist": "npm run app:build && electron-builder --mac --universal"
  },
  "dependencies": {
    "@azure/msal-node": "^2.16.0",
    "keytar": "^7.9.0",
    "electron-store": "^8.2.0",
    "electron-updater": "^6.3.9"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@testing-library/react": "^16.1.0",
    "@testing-library/jest-dom": "^6.6.0",
    "@tailwindcss/vite": "^4.0.0",
    "@vitejs/plugin-react": "^4.3.0",
    "concurrently": "^9.1.0",
    "electron": "^33.0.0",
    "electron-builder": "^25.1.8",
    "esbuild": "^0.24.0",
    "jsdom": "^25.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "tailwindcss": "^4.0.0",
    "tsx": "^4.19.0",
    "typescript": "^5.6.0",
    "vite": "^6.0.0",
    "vitest": "^2.1.0"
  }
```

Also add a top-level `"main": "dist/main/index.cjs"` key (Electron entry point) next to `"type": "module"`. The `.cjs` extension is deliberate: the package is `"type": "module"`, so a `.js` main would be parsed as ESM and the CommonJS bundle esbuild emits (Task 7) would fail to load. `.cjs` forces CommonJS and gives the main process native `__dirname`.

- [ ] **Step 2: Install**

Run: `npm install`
Expected: resolves and installs without errors. (`react`/`react-dom` are runtime but kept in devDependencies because the renderer is bundled by Vite into the packaged app; that is fine for a private app.)

- [ ] **Step 3: Verify nothing broke**

Run: `npm test && npm run typecheck`
Expected: existing tests still pass, tsc clean.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(app): add Electron, React, Vite, Tailwind, build tooling"
```

---

## Task 6: Renderer scaffold + Vitest jsdom config

**Files:**
- Create: `vite.config.ts`, `vitest.config.ts`, `src/renderer/index.html`, `src/renderer/main.tsx`, `src/renderer/App.tsx`, `src/renderer/styles.css`, `tests/renderer/smoke.test.tsx`
- Modify: `tsconfig.json` (add JSX support)

- [ ] **Step 1: Add JSX to tsconfig**

In `tsconfig.json` `compilerOptions`, add `"jsx": "react-jsx"` and add `"DOM"` and `"DOM.Iterable"` to `lib` so it reads `"lib": ["ES2022", "DOM", "DOM.Iterable"]`.

- [ ] **Step 2: Write the Vite config**

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/vite';

export default defineConfig({
  root: 'src/renderer',
  base: './', // relative paths so file:// loading works in the packaged app
  plugins: [react(), tailwind()],
  build: {
    outDir: '../../dist/renderer',
    emptyOutDir: true,
  },
});
```

- [ ] **Step 3: Write the Vitest config (jsdom for renderer tests, node elsewhere)**

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environmentMatchGlobs: [['tests/renderer/**', 'jsdom']],
    setupFiles: ['./tests/renderer/setup.ts'],
  },
});
```

- [ ] **Step 4: Write the renderer setup + entry files**

```typescript
// tests/renderer/setup.ts
import '@testing-library/jest-dom/vitest';
```

```html
<!-- src/renderer/index.html -->
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Daybreak</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="./main.tsx"></script>
  </body>
</html>
```

```css
/* src/renderer/styles.css */
@import 'tailwindcss';
```

```tsx
// src/renderer/App.tsx
export default function App() {
  return (
    <div className="min-h-dvh bg-slate-50 text-slate-900 grid place-items-center">
      <h1 className="text-2xl font-semibold">Daybreak</h1>
    </div>
  );
}
```

```tsx
// src/renderer/main.tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

- [ ] **Step 5: Write a renderer smoke test**

```tsx
// tests/renderer/smoke.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../../src/renderer/App';

describe('App', () => {
  it('renders the product name', () => {
    render(<App />);
    expect(screen.getByText('Daybreak')).toBeInTheDocument();
  });
});
```

- [ ] **Step 6: Run the smoke test + the build**

Run: `npx vitest run tests/renderer/smoke.test.tsx`
Expected: PASS (1 test).
Run: `npm run build:renderer`
Expected: Vite builds to `dist/renderer/` with no errors.

- [ ] **Step 7: Run the full suite + typecheck**

Run: `npm test && npm run typecheck`
Expected: all pass, tsc clean.

- [ ] **Step 8: Commit**

```bash
git add tsconfig.json vite.config.ts vitest.config.ts src/renderer tests/renderer
git commit -m "feat(renderer): Vite + Tailwind v4 + React scaffold with jsdom test setup"
```

---

## Task 7: Electron main + preload scaffold, esbuild build, packaging config

This produces a window that loads the renderer (dev server in dev, built files in prod) with a working preload bridge stub. INTEGRATION code: verified by launching the app, no unit test.

**Files:**
- Create: `scripts/build-main.mjs`, `src/main/index.ts`, `src/main/updater.ts`, `src/preload/index.ts`, `electron-builder.yml`

- [ ] **Step 1: Write the esbuild build script for main + preload**

```javascript
// scripts/build-main.mjs
import { build } from 'esbuild';

const common = {
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  sourcemap: true,
  // Electron and Node built-ins plus native/CJS deps must stay external.
  external: ['electron', 'keytar', 'electron-store', 'electron-updater', '@azure/msal-node'],
};

// Output .cjs so the files load as CommonJS despite the package being "type": "module".
await build({ ...common, entryPoints: ['src/main/index.ts'], outfile: 'dist/main/index.cjs' });
await build({ ...common, entryPoints: ['src/preload/index.ts'], outfile: 'dist/main/preload.cjs' });

console.log('Daybreak: built main + preload to dist/main/');
```

- [ ] **Step 2: Write the preload bridge stub**

```typescript
// src/preload/index.ts
import { contextBridge, ipcRenderer } from 'electron';

// The full typed API is filled in once IPC handlers exist (Task 10). For now the
// bridge proves contextIsolation wiring end to end.
contextBridge.exposeInMainWorld('daybreak', {
  ping: (): Promise<string> => ipcRenderer.invoke('daybreak:ping'),
});
```

- [ ] **Step 3: Write the updater wiring (dormant)**

```typescript
// src/main/updater.ts
import updaterPkg from 'electron-updater';

// electron-updater is CommonJS; destructure the default export under ESM.
const { autoUpdater } = updaterPkg;

// Wired but dormant: there is no publish feed yet. Calling this is safe and a
// no-op without an update server, so it stays here ready for the first release.
export function initUpdater(): void {
  autoUpdater.autoDownload = false;
  // Intentionally not calling checkForUpdates() until a release feed exists.
}
```

- [ ] **Step 4: Write the main entry**

```typescript
// src/main/index.ts
import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import { initUpdater } from './updater';

// Bundled to CommonJS (dist/main/index.cjs), so __dirname is available natively.
const isDev = !app.isPackaged;

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1100,
    height: 800,
    minWidth: 720,
    minHeight: 560,
    title: 'Daybreak',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    void win.loadURL('http://localhost:5173');
  } else {
    void win.loadFile(path.join(__dirname, '../renderer/index.html'));
  }
}

// Temporary handler proving the bridge; replaced by the real IPC surface in Task 10.
ipcMain.handle('daybreak:ping', () => 'pong');

void app.whenReady().then(() => {
  initUpdater();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
```

Note: the CommonJS bundle provides `__dirname` natively, so no `import.meta.url` shim is needed. In dev, Electron loads the Vite dev server; in production it loads the built `dist/renderer/index.html` resolved relative to `dist/main/`.

- [ ] **Step 5: Write the electron-builder config**

```yaml
# electron-builder.yml
appId: com.paulgerios.daybreak
productName: Daybreak
directories:
  output: release
files:
  - dist/**/*
  - package.json
mac:
  category: public.app-category.productivity
  target:
    - target: dmg
      arch: [universal]
  hardenedRuntime: true
  gatekeeperAssess: false
  notarize: false
```

- [ ] **Step 6: Build main**

Run: `npm run build:main`
Expected: prints "built main + preload to dist/main/", creates `dist/main/index.cjs` and `dist/main/preload.cjs`.

- [ ] **Step 7: Manual verification - the app launches**

Run: `npm run app:dev`
Expected: a Daybreak window opens showing the "Daybreak" placeholder heading from the renderer (served by Vite at localhost:5173). Open DevTools console and run `await window.daybreak.ping()`; expect `"pong"`. Close the app.

- [ ] **Step 8: Typecheck + commit**

Run: `npm run typecheck`
Expected: tsc clean.

```bash
git add scripts/build-main.mjs src/main src/preload electron-builder.yml package.json
git commit -m "feat(app): Electron main + preload scaffold, esbuild build, packaging config"
```

---

## Task 8: electron-store overlay wrapper

Wraps `electron-store` in a typed accessor for the `Overlay`, delegating all mutations to the pure reducers from Task 1. INTEGRATION (touches disk via electron-store); typecheck-gated, exercised manually in Task 16.

**Files:**
- Create: `src/main/store.ts`

- [ ] **Step 1: Write the implementation**

```typescript
// src/main/store.ts
import ElectronStore from 'electron-store';
import {
  emptyOverlay,
  setAwayWindow as setAwayWindowR,
  clearItem as clearItemR,
  unclearItem as unclearItemR,
  rerankItem as rerankItemR,
  type Overlay,
} from '../app/overlay';
import type { Lane } from '../model/item';

// electron-store persists a single "overlay" key. Email content is never stored;
// only the away window, cleared ids, and re-rank overrides live here.
const store = new ElectronStore<{ overlay: Overlay }>({
  name: 'daybreak-overlay',
  defaults: { overlay: emptyOverlay() },
});

export function getOverlay(): Overlay {
  return store.get('overlay');
}

function update(next: Overlay): Overlay {
  store.set('overlay', next);
  return next;
}

export function setAwayWindow(sinceISO: string, nowISO: string): Overlay {
  return update(setAwayWindowR(getOverlay(), sinceISO, nowISO));
}

export function clearItem(id: string): Overlay {
  return update(clearItemR(getOverlay(), id));
}

export function unclearItem(id: string): Overlay {
  return update(unclearItemR(getOverlay(), id));
}

export function rerankItem(id: string, lane: Lane): Overlay {
  return update(rerankItemR(getOverlay(), id, lane));
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: tsc clean (confirms the electron-store generic and reducer types line up).

- [ ] **Step 3: Commit**

```bash
git add src/main/store.ts
git commit -m "feat(main): typed electron-store overlay wrapper over pure reducers"
```

---

## Task 9: ingest-runner (orchestration in main)

Produces a `TriageView` from the current away window: runs the Plan 2 ingest, the Plan 1 scorer + summary, applies the overlay, and builds the view. Emits progress and device-code auth events through a callback so the renderer can show the AuthPanel and IngestStatus. INTEGRATION; typecheck-gated, run live in Task 16.

**Files:**
- Create: `src/main/ingest-runner.ts`

- [ ] **Step 1: Write the implementation**

```typescript
// src/main/ingest-runner.ts
import { ingestBacklog } from '../ingest/ingest';
import { scoreAll } from '../scoring/score';
import { buildSummary } from '../summary/summary';
import { applyOverlay } from '../app/overlay';
import { buildTriageView, type TriageView } from '../app/view-model';
import { getOverlay } from './store';

export type IngestPhase = 'auth' | 'fetching' | 'scoring' | 'done' | 'error';
export interface IngestEvents {
  onPhase: (phase: IngestPhase, message?: string) => void;
}

// Runs a full refresh for the given away window and returns the renderable view.
// The overlay (cleared / re-rank / away window) is read fresh so corrections made
// in a previous session survive re-ingest.
export async function buildView(sinceISO: string, events: IngestEvents): Promise<TriageView> {
  try {
    events.onPhase('fetching');
    const now = new Date().toISOString();
    const { me, items } = await ingestBacklog(sinceISO);

    events.onPhase('scoring');
    const scored = scoreAll(items, { me, awaySince: sinceISO, now });
    const summary = buildSummary(scored);

    const overlay = getOverlay();
    const overlaid = applyOverlay(scored, overlay);
    const clearedCount = Object.keys(overlay.cleared).length;

    events.onPhase('done');
    return buildTriageView(overlaid, summary, { me, awaySince: sinceISO, clearedCount });
  } catch (err) {
    events.onPhase('error', err instanceof Error ? err.message : String(err));
    throw err;
  }
}
```

Note: the device-code prompt is emitted by the Plan 2 `graph-auth` layer via `console.log` today. Surfacing the code in the UI (the `auth` phase + the AuthPanel payload) requires threading a callback into `getAccessToken`. For this task, leave the `auth` phase reserved and the AuthPanel will display the code by reading the main-process stdout bridge wired in Task 10; if Task 10 finds threading a callback through `getAccessToken` is cleaner, update `graph-auth` to accept an optional `onDeviceCode` callback then. Either way, no email content is logged.

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: tsc clean.

- [ ] **Step 3: Commit**

```bash
git add src/main/ingest-runner.ts
git commit -m "feat(main): ingest-runner orchestrates ingest, score, overlay into a TriageView"
```

---

## Task 10: IPC handlers + full preload bridge

Wires the bridge API end to end. INTEGRATION; typecheck-gated, run live in Task 16.

**Files:**
- Create: `src/main/ipc.ts`
- Modify: `src/main/index.ts` (register ipc, drop the temporary ping handler), `src/preload/index.ts` (full API), `src/ingest/graph-auth.ts` (optional device-code callback)

- [ ] **Step 1: Add an optional device-code callback to graph-auth**

In `src/ingest/graph-auth.ts`, change `getAccessToken` to accept an optional callback and use it in `deviceCodeCallback` instead of only `console.log`:

```typescript
export async function getAccessToken(
  onDeviceCode?: (info: { verificationUri: string; userCode: string; message: string }) => void,
): Promise<string> {
```

and inside the `acquireTokenByDeviceCode` call replace the existing `deviceCodeCallback` body with:

```typescript
    deviceCodeCallback: (info) => {
      console.log(info.message);
      onDeviceCode?.({
        verificationUri: info.verificationUri,
        userCode: info.userCode,
        message: info.message,
      });
    },
```

Then thread it through: `ingestBacklog` in `src/ingest/ingest.ts` gains an optional `onDeviceCode` parameter forwarded to `getAccessToken`, and `buildView` in `src/main/ingest-runner.ts` passes one that calls `events.onPhase('auth', JSON.stringify({ verificationUri, userCode }))`.

- [ ] **Step 2: Write the IPC registration**

```typescript
// src/main/ipc.ts
import { ipcMain, shell, BrowserWindow } from 'electron';
import { getOverlay, setAwayWindow, clearItem, unclearItem, rerankItem } from './store';
import { buildView } from './ingest-runner';
import type { Lane } from '../model/item';

function emit(channel: string, payload: unknown): void {
  for (const w of BrowserWindow.getAllWindows()) w.webContents.send(channel, payload);
}

async function viewForCurrentWindow() {
  const overlay = getOverlay();
  if (!overlay.awayWindow) return { needsAwayWindow: true as const };
  return buildView(overlay.awayWindow.since, {
    onPhase: (phase, message) => emit('daybreak:ingest', { phase, message }),
  });
}

export function registerIpc(): void {
  ipcMain.handle('daybreak:getView', () => viewForCurrentWindow());

  ipcMain.handle('daybreak:setAwayWindow', (_e, sinceISO: string) => {
    setAwayWindow(sinceISO, new Date().toISOString());
    return viewForCurrentWindow();
  });

  ipcMain.handle('daybreak:refresh', () => viewForCurrentWindow());

  ipcMain.handle('daybreak:clearItem', (_e, id: string) => { clearItem(id); });
  ipcMain.handle('daybreak:unclearItem', (_e, id: string) => { unclearItem(id); });
  ipcMain.handle('daybreak:rerankItem', (_e, id: string, lane: Lane) => { rerankItem(id, lane); });

  ipcMain.handle('daybreak:openItem', async (_e, webLink: string) => {
    if (webLink) await shell.openExternal(webLink);
  });
}
```

- [ ] **Step 3: Register IPC in main, remove the temporary ping**

In `src/main/index.ts`: remove the `ipcMain.handle('daybreak:ping', ...)` line and the now-unused `ipcMain` import if unused elsewhere, import `registerIpc` from `./ipc`, and call `registerIpc()` inside `app.whenReady().then(...)` before `createWindow()`.

- [ ] **Step 4: Write the full preload bridge**

```typescript
// src/preload/index.ts
import { contextBridge, ipcRenderer } from 'electron';
import type { Lane } from '../model/item';
import type { TriageView } from '../app/view-model';

export interface DaybreakBridge {
  getView(): Promise<TriageView | { needsAwayWindow: true }>;
  setAwayWindow(sinceISO: string): Promise<TriageView | { needsAwayWindow: true }>;
  refresh(): Promise<TriageView | { needsAwayWindow: true }>;
  clearItem(id: string): Promise<void>;
  unclearItem(id: string): Promise<void>;
  rerankItem(id: string, lane: Lane): Promise<void>;
  openItem(webLink: string): Promise<void>;
  onIngest(cb: (p: { phase: string; message?: string }) => void): () => void;
}

const api: DaybreakBridge = {
  getView: () => ipcRenderer.invoke('daybreak:getView'),
  setAwayWindow: (s) => ipcRenderer.invoke('daybreak:setAwayWindow', s),
  refresh: () => ipcRenderer.invoke('daybreak:refresh'),
  clearItem: (id) => ipcRenderer.invoke('daybreak:clearItem', id),
  unclearItem: (id) => ipcRenderer.invoke('daybreak:unclearItem', id),
  rerankItem: (id, lane) => ipcRenderer.invoke('daybreak:rerankItem', id, lane),
  openItem: (webLink) => ipcRenderer.invoke('daybreak:openItem', webLink),
  onIngest: (cb) => {
    const handler = (_e: unknown, p: { phase: string; message?: string }) => cb(p);
    ipcRenderer.on('daybreak:ingest', handler);
    return () => ipcRenderer.removeListener('daybreak:ingest', handler);
  },
};

contextBridge.exposeInMainWorld('daybreak', api);
```

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: tsc clean.

- [ ] **Step 6: Commit**

```bash
git add src/main/ipc.ts src/main/index.ts src/preload/index.ts src/ingest/graph-auth.ts src/ingest/ingest.ts src/main/ingest-runner.ts
git commit -m "feat(app): full IPC surface and typed preload bridge with device-code event"
```

---

## Task 11: SummaryHeader component

The renderer components use a shared `bridge.ts` accessor and the `TriageView` types from the preload module. From here the renderer imports view types from `../../src/app/view-model`.

**Files:**
- Create: `src/renderer/bridge.ts`, `src/renderer/components/SummaryHeader.tsx`
- Test: `tests/renderer/SummaryHeader.test.tsx`

- [ ] **Step 1: Write the typed bridge accessor**

```typescript
// src/renderer/bridge.ts
import type { DaybreakBridge } from '../preload';

// The preload script exposes window.daybreak. Read it lazily on each property
// access (via a Proxy) rather than capturing it once at import time, so the handle
// is always live - this also lets tests install a mock window.daybreak in beforeEach.
export const daybreak: DaybreakBridge = new Proxy({} as DaybreakBridge, {
  get(_target, prop) {
    const real = (window as unknown as { daybreak: DaybreakBridge }).daybreak;
    return real[prop as keyof DaybreakBridge];
  },
});
```

- [ ] **Step 2: Write the failing test**

```tsx
// tests/renderer/SummaryHeader.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SummaryHeader } from '../../src/renderer/components/SummaryHeader';
import type { Summary } from '../../src/summary/summary';

const summary: Summary = {
  needsTodayCount: 3, thisWeekCount: 5, fyiCount: 31, slaAtRiskCount: 2, resolvedWhileAwayCount: 14,
};

describe('SummaryHeader', () => {
  it('shows the headline counts', () => {
    render(<SummaryHeader summary={summary} awaySince="2026-05-25T00:00:00.000Z" />);
    expect(screen.getByText(/3 need you today/i)).toBeInTheDocument();
    expect(screen.getByText(/2 SLAs at risk/i)).toBeInTheDocument();
    expect(screen.getByText(/14 resolved while you were out/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/renderer/SummaryHeader.test.tsx`
Expected: FAIL - cannot find module `SummaryHeader`.

- [ ] **Step 4: Write the component**

```tsx
// src/renderer/components/SummaryHeader.tsx
import type { Summary } from '../../summary/summary';

function sinceLabel(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'long', day: 'numeric' });
}

export function SummaryHeader({ summary, awaySince }: { summary: Summary; awaySince: string }) {
  const parts = [
    `${summary.needsTodayCount} need you today`,
    `${summary.slaAtRiskCount} SLAs at risk`,
    `${summary.thisWeekCount} this week`,
    `${summary.resolvedWhileAwayCount} resolved while you were out`,
  ];
  return (
    <header className="px-6 py-5 border-b border-slate-200 dark:border-slate-700">
      <p className="text-sm text-slate-500 dark:text-slate-400">
        While you were out since {sinceLabel(awaySince)}
      </p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{parts.join(' · ')}</p>
    </header>
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/renderer/SummaryHeader.test.tsx`
Expected: PASS (1 test).

- [ ] **Step 6: Commit**

```bash
git add src/renderer/bridge.ts src/renderer/components/SummaryHeader.tsx tests/renderer/SummaryHeader.test.tsx
git commit -m "feat(renderer): SummaryHeader"
```

---

## Task 12: ItemRow component

**Files:**
- Create: `src/renderer/components/ItemRow.tsx`
- Test: `tests/renderer/ItemRow.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// tests/renderer/ItemRow.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ItemRow } from '../../src/renderer/components/ItemRow';
import type { ScoredItemView } from '../../src/app/view-model';

const row: ScoredItemView = {
  id: 'm1', subject: 'Budget sign-off', from: 'boss@co.com', receivedAt: '2026-05-30T09:00:00.000Z',
  reasons: ['Direct ask', 'Blocked tag'], resolved: false, senderTag: 'blocked',
  webLink: 'https://outlook.example/m1', lane: 'today', reranked: false,
};

describe('ItemRow', () => {
  it('renders subject, sender, reasons, and the sender-tag badge', () => {
    render(<ItemRow row={row} onOpen={() => {}} onClear={() => {}} onRerank={() => {}} />);
    expect(screen.getByText('Budget sign-off')).toBeInTheDocument();
    expect(screen.getByText('boss@co.com')).toBeInTheDocument();
    expect(screen.getByText(/Direct ask/)).toBeInTheDocument();
    expect(screen.getByText(/blocked/i)).toBeInTheDocument();
  });

  it('invokes onOpen with the webLink when Open is clicked', async () => {
    const onOpen = vi.fn();
    render(<ItemRow row={row} onOpen={onOpen} onClear={() => {}} onRerank={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: /open/i }));
    expect(onOpen).toHaveBeenCalledWith('https://outlook.example/m1');
  });

  it('invokes onClear with the id when Clear is clicked', async () => {
    const onClear = vi.fn();
    render(<ItemRow row={row} onOpen={() => {}} onClear={onClear} onRerank={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: /clear/i }));
    expect(onClear).toHaveBeenCalledWith('m1');
  });
});
```

- [ ] **Step 2: Add @testing-library/user-event**

Run: `npm install -D @testing-library/user-event@^14.5.0`
Then commit nothing yet; continue.

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/renderer/ItemRow.test.tsx`
Expected: FAIL - cannot find module `ItemRow`.

- [ ] **Step 4: Write the component**

```tsx
// src/renderer/components/ItemRow.tsx
import type { ScoredItemView } from '../../app/view-model';

function relTime(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

const TAG_LABEL: Record<string, string> = {
  blocked: 'Blocked', action: 'Action needed', whenever: 'Whenever', fyi: 'FYI',
};

export function ItemRow({
  row,
  onOpen,
  onClear,
  onRerank,
}: {
  row: ScoredItemView;
  onOpen: (webLink: string) => void;
  onClear: (id: string) => void;
  onRerank: (id: string, lane: ScoredItemView['lane']) => void;
}) {
  return (
    <div className={`flex items-start gap-3 px-4 py-3 border-b border-slate-100 dark:border-slate-800 ${row.resolved ? 'opacity-60' : ''}`}>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium">{row.subject}</span>
          {row.senderTag && (
            <span className="shrink-0 rounded px-1.5 py-0.5 text-xs bg-slate-200 dark:bg-slate-700">
              {TAG_LABEL[row.senderTag]}
            </span>
          )}
        </div>
        <div className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
          <span>{row.from}</span> <span className="tabular-nums">{relTime(row.receivedAt)}</span>
        </div>
        {row.reasons.length > 0 && (
          <div className="mt-1 text-xs text-slate-400">{row.reasons.join(' · ')}</div>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          className="rounded px-2 py-1 text-sm hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40"
          disabled={!row.webLink}
          onClick={() => row.webLink && onOpen(row.webLink)}
        >
          Open
        </button>
        <select
          aria-label="Re-rank"
          className="rounded border border-slate-200 dark:border-slate-700 bg-transparent px-1 py-1 text-sm"
          value={row.lane}
          onChange={(e) => onRerank(row.id, e.target.value as ScoredItemView['lane'])}
        >
          <option value="today">Today</option>
          <option value="this_week">This week</option>
          <option value="fyi">FYI</option>
        </select>
        <button
          type="button"
          className="rounded px-2 py-1 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
          onClick={() => onClear(row.id)}
        >
          Clear
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/renderer/ItemRow.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add src/renderer/components/ItemRow.tsx tests/renderer/ItemRow.test.tsx package.json package-lock.json
git commit -m "feat(renderer): ItemRow with Open / Re-rank / Clear actions"
```

---

## Task 13: SourceGroup + Lane components

**Files:**
- Create: `src/renderer/components/SourceGroup.tsx`, `src/renderer/components/Lane.tsx`
- Test: `tests/renderer/Lane.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// tests/renderer/Lane.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Lane } from '../../src/renderer/components/Lane';
import type { LaneView } from '../../src/app/view-model';

const laneView: LaneView = {
  lane: 'today',
  total: 2,
  groups: [
    {
      source: 'jsm',
      items: [{
        id: 's1', subject: 'INC-1 P1 breach', from: 'jsm@co.com', receivedAt: '2026-05-30T09:00:00.000Z',
        reasons: ['P1', 'SLA breached'], resolved: false, lane: 'today', reranked: false,
      }],
    },
    {
      source: 'email_internal',
      items: [{
        id: 'e1', subject: 'Approve PR', from: 'peer@co.com', receivedAt: '2026-05-29T09:00:00.000Z',
        reasons: ['Direct ask'], resolved: false, lane: 'today', reranked: false,
      }],
    },
  ],
};

const noop = () => {};

describe('Lane', () => {
  it('renders the lane title, count, and grouped items', () => {
    render(<Lane laneView={laneView} title="Needs you today" onOpen={noop} onClear={noop} onRerank={noop} />);
    expect(screen.getByText('Needs you today')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('INC-1 P1 breach')).toBeInTheDocument();
    expect(screen.getByText('Approve PR')).toBeInTheDocument();
    expect(screen.getByText(/System/i)).toBeInTheDocument();
    expect(screen.getByText(/Internal/i)).toBeInTheDocument();
  });

  it('renders an empty-lane message when there are no groups', () => {
    render(
      <Lane laneView={{ lane: 'today', total: 0, groups: [] }} title="Needs you today"
        onOpen={noop} onClear={noop} onRerank={noop} />,
    );
    expect(screen.getByText(/nothing here/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/renderer/Lane.test.tsx`
Expected: FAIL - cannot find module `Lane`.

- [ ] **Step 3: Write the SourceGroup component**

```tsx
// src/renderer/components/SourceGroup.tsx
import { useState } from 'react';
import type { SourceGroupView, ScoredItemView } from '../../app/view-model';
import type { Source } from '../../model/item';
import { ItemRow } from './ItemRow';

const SOURCE_LABEL: Record<Source, string> = {
  jsm: 'System',
  email_internal: 'Internal',
  email_vendor: 'Vendor',
};

export function SourceGroup({
  group,
  onOpen,
  onClear,
  onRerank,
}: {
  group: SourceGroupView;
  onOpen: (webLink: string) => void;
  onClear: (id: string) => void;
  onRerank: (id: string, lane: ScoredItemView['lane']) => void;
}) {
  const [open, setOpen] = useState(true);
  return (
    <section>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500"
      >
        <span>{SOURCE_LABEL[group.source]}</span>
        <span className="tabular-nums">{group.items.length}</span>
      </button>
      {open && group.items.map((row) => (
        <ItemRow key={row.id} row={row} onOpen={onOpen} onClear={onClear} onRerank={onRerank} />
      ))}
    </section>
  );
}
```

- [ ] **Step 4: Write the Lane component**

```tsx
// src/renderer/components/Lane.tsx
import type { LaneView, ScoredItemView } from '../../app/view-model';
import { SourceGroup } from './SourceGroup';

export function Lane({
  laneView,
  title,
  onOpen,
  onClear,
  onRerank,
}: {
  laneView: LaneView;
  title: string;
  onOpen: (webLink: string) => void;
  onClear: (id: string) => void;
  onRerank: (id: string, lane: ScoredItemView['lane']) => void;
}) {
  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
      <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800 px-4 py-2">
        <h2 className="font-semibold">{title}</h2>
        <span className="tabular-nums text-slate-500">{laneView.total}</span>
      </div>
      {laneView.groups.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-slate-400">Nothing here.</p>
      ) : (
        laneView.groups.map((g) => (
          <SourceGroup key={g.source} group={g} onOpen={onOpen} onClear={onClear} onRerank={onRerank} />
        ))
      )}
    </div>
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/renderer/Lane.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add src/renderer/components/SourceGroup.tsx src/renderer/components/Lane.tsx tests/renderer/Lane.test.tsx
git commit -m "feat(renderer): collapsible SourceGroup and Lane"
```

---

## Task 14: AwayWindowModal, AuthPanel, IngestStatus

**Files:**
- Create: `src/renderer/components/AwayWindowModal.tsx`, `src/renderer/components/AuthPanel.tsx`, `src/renderer/components/IngestStatus.tsx`
- Test: `tests/renderer/AwayWindowModal.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// tests/renderer/AwayWindowModal.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AwayWindowModal } from '../../src/renderer/components/AwayWindowModal';

describe('AwayWindowModal', () => {
  it('submits the chosen date as an ISO string', async () => {
    const onSubmit = vi.fn();
    render(<AwayWindowModal onSubmit={onSubmit} error={null} />);
    await userEvent.type(screen.getByLabelText(/out since/i), '2026-05-25');
    await userEvent.click(screen.getByRole('button', { name: /show my backlog/i }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0][0]).toMatch(/^2026-05-25/);
  });

  it('shows a validation error when provided', () => {
    render(<AwayWindowModal onSubmit={() => {}} error="The date you were out since cannot be in the future." />);
    expect(screen.getByText(/cannot be in the future/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/renderer/AwayWindowModal.test.tsx`
Expected: FAIL - cannot find module `AwayWindowModal`.

- [ ] **Step 3: Write the components**

```tsx
// src/renderer/components/AwayWindowModal.tsx
import { useState } from 'react';

export function AwayWindowModal({
  onSubmit,
  error,
}: {
  onSubmit: (sinceISO: string) => void;
  error: string | null;
}) {
  const [date, setDate] = useState('');
  return (
    <div className="min-h-dvh grid place-items-center bg-slate-50 dark:bg-slate-900 px-6">
      <div className="w-full max-w-md rounded-xl border border-slate-200 dark:border-slate-700 p-6">
        <h1 className="text-xl font-semibold">Welcome back</h1>
        <p className="mt-1 text-sm text-slate-500">
          Daybreak will sort what happened while you were out. When did you go out?
        </p>
        <label className="mt-4 block text-sm font-medium" htmlFor="since">
          I was out since
        </label>
        <input
          id="since"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="mt-1 w-full rounded border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2"
        />
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        <button
          type="button"
          disabled={!date}
          onClick={() => onSubmit(new Date(`${date}T00:00:00.000Z`).toISOString())}
          className="mt-4 w-full rounded bg-blue-600 px-4 py-2 font-medium text-white disabled:opacity-40"
        >
          Show my backlog
        </button>
      </div>
    </div>
  );
}
```

```tsx
// src/renderer/components/AuthPanel.tsx
export function AuthPanel({ verificationUri, userCode }: { verificationUri: string; userCode: string }) {
  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950 dark:border-amber-700 p-4">
      <p className="font-medium">Sign in to Microsoft</p>
      <p className="mt-1 text-sm">
        Open <span className="font-mono">{verificationUri}</span> and enter code{' '}
        <span className="font-mono font-semibold tracking-widest">{userCode}</span>.
      </p>
    </div>
  );
}
```

```tsx
// src/renderer/components/IngestStatus.tsx
export function IngestStatus({
  phase,
  message,
  onRetry,
}: {
  phase: 'idle' | 'fetching' | 'scoring' | 'error';
  message?: string;
  onRetry: () => void;
}) {
  if (phase === 'error') {
    return (
      <div className="rounded-lg border border-red-300 bg-red-50 dark:bg-red-950 dark:border-red-700 p-4">
        <p className="font-medium text-red-700 dark:text-red-300">Could not load your backlog</p>
        {message && <p className="mt-1 text-sm">{message}</p>}
        <button type="button" onClick={onRetry} className="mt-3 rounded bg-red-600 px-3 py-1.5 text-sm text-white">
          Retry
        </button>
      </div>
    );
  }
  const label = phase === 'scoring' ? 'Scoring your backlog...' : 'Fetching your mail...';
  return <p className="p-6 text-center text-sm text-slate-500">{label}</p>;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/renderer/AwayWindowModal.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/renderer/components/AwayWindowModal.tsx src/renderer/components/AuthPanel.tsx src/renderer/components/IngestStatus.tsx tests/renderer/AwayWindowModal.test.tsx
git commit -m "feat(renderer): AwayWindowModal, AuthPanel, IngestStatus"
```

---

## Task 15: App root wiring (routing, actions, undo toast)

Wires the bridge to the components: routes between the AwayWindowModal and the triage surface, runs ingest, handles auth/progress events, and implements optimistic Clear with an Undo toast. INTEGRATION (depends on the live bridge); verified manually in Task 16. A light render test covers the away-window route with a mocked bridge.

**Files:**
- Modify: `src/renderer/App.tsx`
- Test: `tests/renderer/App.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// tests/renderer/App.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../../src/renderer/App';

beforeEach(() => {
  (window as unknown as { daybreak: unknown }).daybreak = {
    getView: vi.fn().mockResolvedValue({ needsAwayWindow: true }),
    setAwayWindow: vi.fn(),
    refresh: vi.fn(),
    clearItem: vi.fn(),
    unclearItem: vi.fn(),
    rerankItem: vi.fn(),
    openItem: vi.fn(),
    onIngest: vi.fn().mockReturnValue(() => {}),
  };
});

describe('App', () => {
  it('shows the away-window modal when no window is set', async () => {
    render(<App />);
    expect(await screen.findByText(/welcome back/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/renderer/App.test.tsx`
Expected: FAIL - the current placeholder App renders only "Daybreak".

- [ ] **Step 3: Write the App**

```tsx
// src/renderer/App.tsx
import { useCallback, useEffect, useState } from 'react';
import { daybreak } from './bridge';
import type { TriageView, ScoredItemView } from '../app/view-model';
import type { Lane } from '../model/item';
import { SummaryHeader } from './components/SummaryHeader';
import { Lane as LaneComponent } from './components/Lane';
import { AwayWindowModal } from './components/AwayWindowModal';
import { AuthPanel } from './components/AuthPanel';
import { IngestStatus } from './components/IngestStatus';

type View = TriageView | { needsAwayWindow: true };
const LANE_TITLES: Record<Lane, string> = {
  today: 'Needs you today',
  this_week: 'Time-sensitive this week',
  fyi: 'FYI / batch-clear',
};

export default function App() {
  const [view, setView] = useState<View | null>(null);
  const [phase, setPhase] = useState<'idle' | 'fetching' | 'scoring' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | undefined>();
  const [auth, setAuth] = useState<{ verificationUri: string; userCode: string } | null>(null);
  const [awayError, setAwayError] = useState<string | null>(null);
  const [undo, setUndo] = useState<string | null>(null);

  useEffect(() => {
    const off = daybreak.onIngest(({ phase: p, message }) => {
      if (p === 'auth' && message) {
        try { setAuth(JSON.parse(message)); } catch { /* ignore */ }
      } else if (p === 'fetching' || p === 'scoring') {
        setPhase(p);
      } else if (p === 'done') {
        setPhase('idle');
        setAuth(null);
      } else if (p === 'error') {
        setPhase('error');
        setErrorMsg(message);
      }
    });
    void daybreak.getView().then(setView);
    return off;
  }, []);

  const setAwayWindow = useCallback(async (sinceISO: string) => {
    setAwayError(null);
    setPhase('fetching');
    try {
      const next = await daybreak.setAwayWindow(sinceISO);
      setView(next);
    } catch (e) {
      setAwayError(e instanceof Error ? e.message : 'Could not load your backlog.');
    }
  }, []);

  const refresh = useCallback(async () => {
    setPhase('fetching');
    setView(await daybreak.refresh());
  }, []);

  const onOpen = useCallback((webLink: string) => { void daybreak.openItem(webLink); }, []);
  const onRerank = useCallback(async (id: string, lane: Lane) => {
    await daybreak.rerankItem(id, lane);
    setView(await daybreak.refresh());
  }, []);
  const onClear = useCallback(async (id: string) => {
    await daybreak.clearItem(id);
    setUndo(id);
    setView(await daybreak.refresh());
  }, []);
  const onUndo = useCallback(async () => {
    if (!undo) return;
    await daybreak.unclearItem(undo);
    setUndo(null);
    setView(await daybreak.refresh());
  }, [undo]);

  if (view === null) return <IngestStatus phase={phase === 'error' ? 'error' : 'fetching'} message={errorMsg} onRetry={refresh} />;

  if ('needsAwayWindow' in view) {
    return <AwayWindowModal onSubmit={setAwayWindow} error={awayError} />;
  }

  return (
    <div className="min-h-dvh bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100">
      <SummaryHeader summary={view.summary} awaySince={view.awaySince} />
      <div className="p-4">
        {auth && <div className="mb-4"><AuthPanel {...auth} /></div>}
        {(phase === 'fetching' || phase === 'scoring' || phase === 'error') && (
          <div className="mb-4"><IngestStatus phase={phase} message={errorMsg} onRetry={refresh} /></div>
        )}
        <div className="grid gap-4 md:grid-cols-3">
          {(['today', 'this_week', 'fyi'] as Lane[]).map((lane) => (
            <LaneComponent
              key={lane}
              laneView={view.lanes[lane]}
              title={LANE_TITLES[lane]}
              onOpen={onOpen}
              onClear={onClear}
              onRerank={onRerank as (id: string, lane: ScoredItemView['lane']) => void}
            />
          ))}
        </div>
      </div>
      {undo && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 rounded bg-slate-900 text-white px-4 py-2 text-sm" role="status" aria-live="polite">
          Cleared <button type="button" className="ml-3 underline" onClick={onUndo}>Undo</button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/renderer/App.test.tsx`
Expected: PASS (1 test).

- [ ] **Step 5: Run the full suite + typecheck + renderer build**

Run: `npm test && npm run typecheck && npm run build:renderer`
Expected: all tests pass, tsc clean, Vite builds.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/App.tsx tests/renderer/App.test.tsx
git commit -m "feat(renderer): App root - routing, actions, optimistic clear with undo"
```

---

## Task 16: End-to-end manual verification

No new code. Verifies the assembled app against a real mailbox. Requires the Plan 2 prerequisites: `DAYBREAK_CLIENT_ID` and `DAYBREAK_TENANT_ID` exported and the Azure app registration in place.

- [ ] **Step 1: Build main and launch in dev**

Run: `npm run app:dev`
Expected: the Daybreak window opens showing the "Welcome back" away-window modal (no away window persisted yet).

- [ ] **Step 2: Set the away window and authenticate**

Pick a date a couple of weeks back and click "Show my backlog".
Expected on first run: the AuthPanel appears with a `microsoft.com/devicelogin` URL and a code. Complete the browser login. The window then renders the SummaryHeader and the three lanes populated with your real, scored mail, grouped by source within each lane.

- [ ] **Step 3: Verify the triage surface**

Verify by eye:
- Internal senders appear under "Internal", outside senders under "Vendor".
- Counts in the SummaryHeader match the visible lanes.
- An item with an `X-PTO-Triage` header shows its sender-tag badge.

- [ ] **Step 4: Verify the actions**

- Click Open on an item: it opens in your default browser (Outlook web).
- Re-rank an item to another lane: it moves and stays there.
- Clear an item: it disappears and the Undo toast appears; click Undo and it returns.

- [ ] **Step 5: Verify persistence across restart**

Quit and relaunch with `npm run app:dev`.
Expected: NO away-window modal (the window persisted) and NO device-code prompt (token came from the keychain). Previously cleared/re-ranked items retain their state.

- [ ] **Step 6: Verify the packaged build (optional but recommended)**

Run: `npm run app:dist`
Expected: electron-builder produces a `.dmg` under `release/`. Install and launch it; repeat Steps 2-4 against the packaged app to confirm production file loading works.

- [ ] **Step 7: Final full suite + typecheck**

Run: `npm test && npm run typecheck`
Expected: all unit + component tests pass, tsc clean.

---

## Self-Review (completed by plan author)

**Spec coverage:**
- Three-layer architecture (main / preload / renderer) - Tasks 7, 10, 6.
- Pure `applyOverlay` -> `buildTriageView` -> `TriageView` - Tasks 1, 2, 3.
- Overlay-only persistence (away window, cleared, rerank), never content - Tasks 1, 8; content stays in memory in Task 9.
- "I'm back since [date]" trigger + validation - Tasks 4, 14, 15.
- Three lanes + source grouping + summary - Tasks 11, 13, 15.
- Per-item Open / Re-rank / Clear with Undo - Tasks 12, 15.
- Reuse Plan 2 device-code auth, surfaced in UI - Tasks 9, 10 (graph-auth callback), 14 (AuthPanel).
- Error / empty / auth states - Tasks 13 (empty lane), 14 (Auth/Ingest), 15.
- macOS packaging via electron-builder (Nowtify template) - Task 7.
- Pure-vs-integration test split - pure/RTL in Tasks 1-4, 11-14; integration manual in Task 16.

**Deferred (correctly out of scope, per spec):** JSM ingestion (Plan 4), generalized re-rank learning, Windows packaging, interactive-popup OAuth, calendar/ADP auto-window, LLM. List virtualization is described in the spec as a refinement once a lane exceeds ~50 rows; it is intentionally NOT a task here (YAGNI for a first run; add when a real backlog proves it needed) and is noted so it is not mistaken for a gap.

**Placeholder scan:** none - every code/test step has complete content. Integration tasks (7, 8, 9, 10, 15) carry concrete manual or typecheck verification, the honest treatment for Electron/IPC/keychain/live-Graph code, mirroring Plan 2.

**Type consistency:** `Overlay`/`OverlaidItem` (Task 1) are consumed by `applyOverlay` (Tasks 1-2) and `buildTriageView` (Task 3). `TriageView`/`LaneView`/`SourceGroupView`/`ScoredItemView` (Task 3) are consumed by the renderer (Tasks 11-15) and the preload/bridge types (Tasks 10-11). `DaybreakBridge` (Task 10) is the type the renderer `bridge.ts` (Task 11) imports. `buildView` (Task 9) returns the `TriageView` the IPC layer (Task 10) sends and the renderer (Task 15) renders. The device-code callback signature added to `getAccessToken` (Task 10) matches the `onDeviceCode` forwarded from `ingestBacklog` and `buildView`.

## Known v1 limitations (intentional, documented)
- Re-rank and Clear trigger a full `refresh()` (re-ingest) for simplicity. For a few-hundred-item backlog this is acceptable; an in-memory view update without re-fetching is a later optimization.
- The away window is a date (midnight UTC). Sub-day precision is unnecessary for return-from-leave triage.
- List virtualization is not implemented; lanes render all rows. Add when a real backlog shows a performance need.
- `now` is taken at ingest time per refresh, so a long-open session re-evaluates "today" on each manual refresh, which is the intended behavior.
