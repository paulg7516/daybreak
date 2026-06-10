# Daybreak In-App Settings Surface (Jira + Rules) - Design Spec

**Date:** 2026-06-10
**Status:** Approved design, pending spec review before implementation planning
**Builds on:** the shipped rules engine (`RulesSettings` panel + the overlay) and JSM ingestion (`getJiraAuth`, `ingestJsm`, currently env-configured).

## Purpose

Move Daybreak's configuration into the app. Today rules are editable in-app but the Jira connection is env-vars-plus-keychain-CLI only. This adds a **tabbed Settings panel** with a **Rules** tab (the existing rules config, polished) and a **Sources** tab that configures the Jira connection (base URL, email, API token) with a **Test connection** button - so a user sets up JSM without touching env vars, and finds out immediately whether their credentials work.

## Scope

- A single Settings panel with two tabs: **Rules** and **Sources** (Jira). Opened from a nav **Settings (gear)** entry (replacing the current "Rules" icon).
- Jira config persisted in-app: base URL + email in the overlay store, API token in the OS keychain.
- `getJiraAuth` reads the stored config in the app, falling back to env vars (so the CLI/env path is unchanged).
- A live **Test connection** against Jira's `/rest/api/3/myself`.
- Polish both tabs to the dark mission-control aesthetic.

## Storage and the config-resolution seam

- **Overlay** gains `jira: { baseUrl: string; email: string } | null` (added to `Overlay`/`emptyOverlay`, with a `setJiraConfig` reducer). The **API token never goes in the overlay** - it stays in the keychain via the existing `storeJiraToken`.
- `getJiraAuth(config?)` gains an optional `{ baseUrl?; email? }` override. Resolution: `baseUrl = config?.baseUrl ?? env.DAYBREAK_JIRA_BASE_URL`, `email = config?.email ?? env.DAYBREAK_JIRA_EMAIL`, token always from the keychain; returns null if any piece is missing. A pure `resolveJiraSettings(config, env)` helper does the merge and is unit-tested.
- The **desktop app** (`buildView`) reads the stored config from the overlay and passes it to `ingestJsm` -> `getJiraAuth`. The **CLI** passes nothing, so it keeps using env vars. electron-store is only available in the Electron main process, so this split is deliberate - it never imports the store into the CLI/ingest path.

## Test connection

`testJiraConnection({ baseUrl, email, token? })` calls `GET ${baseUrl}/rest/api/3/myself` with HTTP Basic (`email` + the supplied token, or the keychain token if none supplied). On 2xx it returns `{ ok: true, displayName }`; on failure `{ ok: false, error }` with a readable message (401 -> bad credentials, network -> unreachable). This is the payoff of the in-app form over env vars: immediate, specific feedback.

## Components and data flow

- **`Settings.tsx`** (new) - the panel shell: a header with a Settings title + Done, a tab strip (Rules | Sources), and the active tab's content. Replaces the App's direct render of `RulesSettings`.
- **Rules tab** - the existing `RulesSettings` content, reused (its rules CRUD + bulk toggle behavior and tests are preserved; only its outer chrome moves into the tab).
- **`JiraSettings.tsx`** (new) - the Sources form: base URL, email, API-token inputs (token write-only, shown as "token set" when one exists, never read back); Save; Test connection; a status line. Save persists base URL + email and, if a token was entered, stores it in the keychain.
- **IPC + bridge** additions: `getJiraConfig(): { baseUrl: string; email: string; hasToken: boolean }`, `setJiraConfig({ baseUrl, email, token? }): void`, `testJiraConnection({ baseUrl, email, token? }): { ok; displayName?; error? }`.
- **Nav** - the rail's "Rules" button becomes "Settings" (gear icon) and opens the Settings panel on the Rules tab by default.

Flow: open Settings -> bridge `getRules` + `getJiraConfig` load both tabs -> edit rules (existing path) or the Jira form -> Save writes config (+ keychain) -> next ingest/refresh picks up the new Jira config via the overlay.

## Testing

Following the established split:
- **Unit-tested (pure):** the `setJiraConfig` overlay reducer; `resolveJiraSettings(config, env)`.
- **Component-tested (RTL):** `JiraSettings` (renders, Save calls the bridge with the entered values, Test connection invokes the bridge and shows the result), `Settings` (tab switching renders the right content), and the preserved `RulesSettings` tests.
- **Integration / manual:** the store wrappers, the IPC handlers, `testJiraConnection` against live Jira, and the `buildView` config threading - verified by configuring Jira in the app and running a refresh, mirroring how the keychain/live-API code was handled before.

## Security posture

Unchanged stance: the API token lives only in the OS keychain (never the overlay, never echoed back to the UI - the form shows "token set", not the value), config is on-device, the Jira calls are read-only (`/myself`, search), no server.

## Scope (v1) and deferrals

**In v1:** the tabbed Settings panel; Jira base URL/email/token config + keychain; Test connection; `getJiraAuth` store-or-env resolution; polish.

**Deferred:** a Microsoft/email connection tab (email setup stays via the Plan 2 device-code flow for now); SSO/WorkOS-style settings; multi-account; an "import env into the store" migration (the env path simply keeps working as a fallback); a general preferences tab (theme is locked dark, away-window already has its own control).

## Open questions / to resolve during planning

- Whether Save should also auto-run a Test connection, or keep them as separate explicit actions (lean: separate - Save persists, Test validates on demand).
- Exact placement of the "token set" indicator and whether to offer a "clear token" action (lean: include a small "clear" since `clearJiraToken` already exists).
- Whether the Sources tab should show a live "JSM connected / not configured" status derived from `getJiraConfig().hasToken` + the last test result (lean: yes, a small status badge).
