# Daybreak Desktop App + Triage UI - Design Spec (Plan 3)

**Date:** 2026-06-09
**Status:** Approved design, pending spec review before implementation planning
**Builds on:** Plan 1 (scoring core), Plan 2 (Microsoft Graph email ingestion). See `2026-06-08-daybreak-design.md` for the product vision.

## Scope

Turn Daybreak from a headless library + CLI into a runnable macOS desktop application that ingests the user's Outlook email (via the Plan 2 Graph layer), scores it (via the Plan 1 scorer), and renders the three-lane triage surface with a "while you were out" summary and per-item actions.

This is the first of two app-building plans. **Plan 3 is email-only.** JSM ingestion is a second source added into this same surface in **Plan 4** (it mirrors the Plan 2 Graph work and is gated on resolving the JSM API surface). Building the app over the already-proven email source first de-risks the UI (the real unknown) and gives the still-pending Plan 2 mailbox verification a real home.

## Non-Goals (Plan 3)

- JSM / system-notification ingestion (Plan 4).
- Generalized re-rank *learning* (turning corrections into scoring-weight changes). v1 remembers the explicit per-thread correction only.
- Windows packaging (later port, as Nowtify did).
- Interactive-popup OAuth (v1 reuses the Plan 2 device-code flow).
- Calendar OOO / ADP auto-detection of the away window (manual trigger only).
- LLM inference (rules-only, per the product vision).

## Decisions (locked)

1. **Renderer stack:** React + Vite + Tailwind, TypeScript. Chosen over vanilla HTML (the triage surface is stateful and interactive enough that hand-rolled DOM is a recurring tax) and over shadcn/ui (Daybreak's components are mostly bespoke; shadcn's dependency weight is not yet earned - it stays an easy later add if a polished dialog/date-picker is wanted).
2. **Main process:** the Nowtify pattern - Electron + `electron-store` (persistence) + `electron-updater` (auto-update) + `electron-builder` (packaging), `src/main/` + `src/preload/` structure. TypeScript throughout so the main process imports the Plan 1/2 core directly.
3. **Same repo.** The app is an additive layer; the existing `daybreak-scoring` core (`src/model`, `src/scoring`, `src/ingest`, `src/summary`) is untouched and stays independently testable.
4. **Persistence stores overlay state only,** never email content. The app re-ingests fresh from Graph each launch and scores in memory; only a thin overlay (away window, cleared ids, re-rank overrides) is written to disk via `electron-store`. This strengthens the security posture from "content never leaves the machine" to "content is never even written to disk."
5. **Re-rank v1:** moving a thread to another lane persists as a per-thread override that survives re-ingest. Generalized learning is deferred.
6. **Platform:** macOS only for Plan 3.
7. **Auth:** reuse the Plan 2 `graph-auth` device-code flow unchanged; surface the device-code prompt in an in-app panel instead of `console.log`.
8. **Not a menu-bar app.** Unlike Nowtify, Daybreak is a sit-down windowed dashboard: a real main window with a dock icon, no `LSUIElement`.

## Architecture

Three layers, all TypeScript, all in the existing repo.

### Main process (`src/main/`)

Owns all stateful work. Responsibilities:
- Window + app lifecycle, `electron-updater` wiring.
- Auth + ingestion: calls the existing `ingestBacklog(since)` (Plan 2), which runs device-code auth and pulls + normalizes mail.
- Scoring: calls `scoreAll(items, { me, awaySince, now })` then `buildSummary(scored)` (Plan 1).
- Overlay: reads the `electron-store` overlay and applies it via the new pure `applyOverlay` module.
- IPC handlers (see API below).

`webPreferences`: `contextIsolation: true`, `nodeIntegration: false`, `sandbox` where compatible with the preload bridge.

### Preload (`src/preload/`)

A single `contextBridge`-exposed, typed `window.daybreak` API. No Node primitives reach the renderer.

```ts
interface DaybreakBridge {
  getView(): Promise<TriageView | { needsAwayWindow: true }>;
  setAwayWindow(sinceISO: string): Promise<TriageView>;
  refresh(): Promise<TriageView>;            // re-ingest with the current away window
  clearItem(id: string): Promise<void>;
  unclearItem(id: string): Promise<void>;    // backs the Undo toast
  rerankItem(id: string, lane: Lane): Promise<void>;
  openItem(id: string): Promise<void>;       // opens the item's webLink in the default browser
  onAuthPrompt(cb: (info: { verificationUri: string; userCode: string }) => void): Unsubscribe;
  onIngestProgress(cb: (p: { phase: 'auth' | 'fetching' | 'scoring' | 'done' | 'error'; message?: string }) => void): Unsubscribe;
}
```

### Renderer (`src/renderer/`)

Pure view. Requests a `TriageView` from main, renders it, fires actions back. Holds no scoring logic. React + Vite + Tailwind.

### Repo layout

```
src/
  model/  scoring/  ingest/  summary/   <- existing core (unchanged)
  app/
    overlay.ts        <- NEW pure: applyOverlay(scored, overlay) -> OverlaidItem[] (cleared removed, effective lane set)
    view-model.ts     <- NEW pure: buildTriageView(overlaid, summary, meta) -> TriageView (group + sort + counts)
    away-window.ts    <- NEW pure: validate the away window (reject future / absurd dates)
  main/               <- NEW Electron main process
    index.ts  ipc.ts  store.ts  ingest-runner.ts  updater.ts
  preload/            <- NEW contextBridge bridge
    index.ts
  renderer/           <- NEW React + Vite app
    main.tsx  App.tsx  components/...  styles/...
```

### Build

- `esbuild` bundles `src/main` + `src/preload` (pulling in the imported core) to `dist/main`.
- `vite` builds `src/renderer` to `dist/renderer`.
- `electron-builder` packages a macOS universal `.dmg` (Nowtify config as the template).
- Dev: Vite dev server + Electron pointed at it. New scripts: `app:dev`, `app:build`, `app:dist`. Existing `test` / `typecheck` / `score` / `ingest` scripts stay.

## Data Model: the view contract

The new pure layer produces a `TriageView` that the renderer renders directly. Shapes (built on existing `ScoredItem`/`Lane`/`Source`/`Summary`):

```ts
type Lane = 'today' | 'this_week' | 'fyi';          // existing
type Source = 'jsm' | 'email_internal' | 'email_vendor'; // existing

interface TriageView {
  me: string;
  awaySince: string;       // ISO
  summary: Summary;        // existing buildSummary output (counts)
  lanes: Record<Lane, LaneView>;
  clearedCount: number;
}

interface LaneView {
  lane: Lane;
  total: number;
  groups: SourceGroupView[];   // ordered: System, Internal, Vendor
}

interface SourceGroupView {
  source: Source;
  items: ScoredItemView[];     // sorted by rank desc (existing rank field)
}

interface ScoredItemView {
  id: string;
  subject: string;
  from: string;
  receivedAt: string;
  reasons: string[];           // existing ScoredItem.reasons - the "why"
  resolved: boolean;           // existing - drives the down-ranked/struck treatment
  senderTag?: SenderTag;       // parsed from internetHeaders['X-PTO-Triage']
  webLink?: string;            // existing - powers Open
  lane: Lane;                  // effective lane after overlay
  reranked: boolean;           // true if a manual override moved it here
}
```

Two pure, unit-tested steps build the view: `applyOverlay(scored, overlay) -> OverlaidItem[]` filters out cleared ids and applies re-rank lane overrides (setting an effective `lane` and a `reranked` flag); `buildTriageView(overlaid, summary, meta) -> TriageView` then sorts each lane by `rank` desc, groups by `source`, and computes the per-lane and cleared counts. Splitting them keeps each step small and independently testable.

## Data Flow

```
launch
  -> main reads persisted awayWindow
       null    -> renderer shows AwayWindowModal ("I'm back - I was out since [date]")
       present -> renderer calls getView(); the triage surface carries a visible
                  "Out since [date]" control to change the window or refresh at any time

setAwayWindow(since) | refresh
  -> main: ingestBacklog(since)            [device-code auth surfaces via onAuthPrompt -> AuthPanel]
        -> scoreAll(items, { me, awaySince: since, now })
        -> buildSummary(scored)
        -> applyOverlay(scored, overlay)   [PURE]
        -> TriageView -> renderer

renderer renders SummaryHeader + 3 Lanes (source-grouped) + ItemRows

per-item action
  Open    -> openItem(id)    -> main opens webLink in default browser
  Clear   -> optimistic in renderer + Undo toast; clearItem(id) writes overlay
  Re-rank -> rerankItem(id, lane) writes overlay; view updates
```

## Persistence (`electron-store`)

```ts
interface Overlay {
  awayWindow: { since: string; setAt: string } | null;
  cleared: Record<string, true>;            // itemId -> cleared
  rerank: Record<string, Lane>;             // itemId -> overridden lane
}
```

Keyed by the stable Graph message id, so the overlay survives re-ingest. No subjects, bodies, or senders are persisted. A corrupt store falls back to defaults (empty overlay, no away window) rather than crashing.

## Components (renderer)

```
App                  routes between AwayWindowModal and the Triage surface from view state
  AwayWindowModal    date picker; "I was out since [date]"; validates not-future, not-absurd
  AuthPanel          shows device-code verificationUri + userCode during ingest; setup hint if unconfigured
  IngestStatus       skeleton/progress during fetch+score; error state with Retry; empty state
  SummaryHeader      "3 need you today - 2 SLAs at risk - 1 expired - 14 moved - 31 resolved while away"
  LaneList
    Lane (x3)        header: title + count + collapse; status-colored; virtualizes >~50 rows
      SourceGroup    collapsible: System / Internal / Vendor (icon + count); urgency-first default
        ItemRow      subject, sender, relative time, reasons[], sender-tag badge, resolved treatment,
                     actions: Open - Re-rank - Clear
  UndoToast          "Cleared - Undo" (aria-live polite, auto-dismiss 5s)
```

## Visual / UX Direction

Grounded in a ui-ux-pro-max design pass: a data-dense-but-scannable operations-dashboard aesthetic, not a marketing surface.

- **Status-color lane mapping:** red/amber emphasis for *Needs you today*, amber for *This week*, neutral/slate for *FYI*. SLA-at-risk and `blocked` sender-tag carry the strongest red. Inbox-blue primary, priority-red accent.
- **Full light + dark mode,** designed as a pair with semantic Tailwind tokens (no inverted-color dark mode); contrast verified independently per theme (body text >= 4.5:1).
- **SVG icons only** (Lucide), one icon family. No emoji as icons.
- **4/8px spacing rhythm;** tabular figures for the summary counts and timestamps.
- **Motion:** expand/collapse and lane transitions 150-300ms, ease-out enter; `prefers-reduced-motion` respected; never block input.
- **List virtualization** once a lane exceeds ~50 rows.
- **One primary action emphasis per row;** Clear is destructive-styled and always Undo-able.

The detailed surface design (exact tokens, item-row layout, empty/loading art) gets its own ui-ux-pro-max pass during implementation.

## Error / Empty / Auth States

- **Unconfigured** (no `DAYBREAK_CLIENT_ID` / `DAYBREAK_TENANT_ID`): AuthPanel shows a plain setup message pointing at the Plan 2 prerequisites, not a stack trace.
- **Graph / network error:** IngestStatus error state with Retry.
- **Empty backlog:** "Nothing needs you - you're all caught up."
- **Device-code:** AuthPanel shows the URL + code on first run; silent on later runs (keychain cache from Plan 2).

## Testing

Following the Plan 1/2 split between pure (unit-tested) and integration (manually verified):

- **Unit-tested (Vitest, TDD):** `applyOverlay` (filter / rerank / sort / group / counts), `view-model` assembly, `away-window` resolution + validation, overlay read/write logic (store wrapper around a pure reducer), and sender-tag-to-badge mapping.
- **Component tests (React Testing Library):** `Lane`, `SourceGroup`, `ItemRow`, `SummaryHeader` render the expected content from a fixture `TriageView`, and action buttons invoke the bridge.
- **Integration / manual (explicit checklist, no unit test):** Electron lifecycle, IPC wiring, preload bridge, device-code auth, live Graph ingest end-to-end, packaging. This is the honest treatment for shell/keychain/browser/live-Graph code, mirroring Plan 2.

## Open Questions / To Resolve During Planning

- Exact `electron-builder` config delta from the Nowtify template (appId, product name, icons, universal target, auto-update feed). Auto-update can be wired-but-dormant like Nowtify until there is a release channel.
- Where the renderer date-picker comes from (native input vs a small headless lib) for AwayWindowModal.
- Whether `now` injection for scoring should be the launch time or recomputed per refresh (lean: per ingest run).
- Confirm `esbuild` cleanly bundles the ESM core for the Electron main target, or whether a `tsc` pre-step is simpler.
