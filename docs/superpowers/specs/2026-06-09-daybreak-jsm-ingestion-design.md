# Daybreak JSM Ingestion - Design Spec

**Date:** 2026-06-09
**Status:** Approved design, pending spec review before implementation planning
**Builds on:** Plan 2 (Graph email ingestion) as the structural template, and the JSM handling that already exists recipient-side (the `JsmFields` model, `scoreJsm`, the always-include rule for `source: 'jsm'`, and the "System" source group in the UI).

## Purpose

Add Jira Service Management tickets as a **second source** into Daybreak's existing triage pipeline, so a returning user sees the tickets that need them alongside their email. The recipient side is done; this spec covers only the **ingestion**: authenticating to Jira Cloud, fetching the relevant tickets within the away window, and normalizing them into `DaybreakItem`s with `JsmFields` populated. The scorer, inclusion gate, and UI consume them unchanged.

## What already exists (not rebuilt)

- `src/model/item.ts`: `source: 'jsm'`, `JsmFields = { assignee?; priority?: 'P1'|'P2'|'P3'|'P4'; slaStatus?: 'breached'|'at_risk'|'ok'|'none'; state? }`.
- `src/scoring/jsm.ts` `scoreJsm`: closed/resolved -> FYI; assigned + (P1 or SLA breached/at_risk) -> Today; assigned + P2/P3 -> This week; not-assignee -> FYI.
- The rules engine always includes `source: 'jsm'`; the UI groups it as "System".

So ingestion only has to produce `DaybreakItem`s of `source: 'jsm'` with those fields filled in.

## Architecture

A parallel ingestion module set under `src/ingest/`, mirroring the Graph layer:

- `jsm-auth.ts` - builds the HTTP Basic credential from `DAYBREAK_JIRA_EMAIL` + a Jira API token persisted in the OS keychain (reusing the same keychain pattern as the MSAL token cache). Exposes the base URL + auth header.
- `jsm-types.ts` - the Jira issue JSON shapes consumed (key, fields.summary, fields.status, fields.priority, fields.assignee, fields.reporter, fields.created, fields.updated, the SLA field).
- `jsm-client.ts` - `buildJql(sinceISO)` (pure) + `fetchAssignedTickets(auth, sinceISO)` (paged fetch against the current Jira Cloud REST JQL-search endpoint, capped, throws on non-OK).
- `jsm-normalize.ts` - PURE: `mapPriority(name)`, `readSlaStatus(slaField)`, `jsmIssueToItem(issue, me, baseUrl)`.
- `jsm-ingest.ts` - orchestrator: auth -> fetch -> normalize -> `DaybreakItem[]`.

**Merge into the pipeline:** `buildView` (desktop app) and the CLI ingest run the email ingest and the JSM ingest, **concatenate the items**, and pass the combined list to `scoreAll`. JSM is **independent and optional**: if Jira is not configured, it is skipped and email-only triage still works (and vice versa).

## Auth

HTTP Basic with an Atlassian **API token**: `Authorization: Basic base64(<email>:<token>)`. Configuration:
- `DAYBREAK_JIRA_BASE_URL` (e.g. `https://yourcompany.atlassian.net`) and `DAYBREAK_JIRA_EMAIL` via env (later, app settings).
- The API token is stored in the OS keychain, never in env or on disk in plaintext - same posture as the Graph/MSAL token.

Chosen over OAuth 3LO: no app registration, no callback server, stays local-first, and the user is the Jira admin/account holder. Jira Cloud only (the Cloud REST API; Server/Data Center differ and are out of scope).

## What is fetched ("the backlog")

Tickets **assigned to the user, not Done, updated within the away window**:

```
JQL: assignee = currentUser() AND statusCategory != Done AND updated >= "<awaySince>" ORDER BY updated DESC
```

Because the query is already scoped to the current user, every result is assigned-to-me by construction - so normalization sets `jsm.assignee = me` directly. This sidesteps Jira Cloud's default email privacy (assignee emails are hidden), and the scorer's assigned-to-me branch fires correctly without depending on email visibility. Paging follows the search endpoint's token-based paging up to a cap (mirroring the 500-message email cap), with a logged warning if the cap is hit.

## Normalization (issue -> DaybreakItem)

| DaybreakItem field | Source |
|---|---|
| `id` | the issue key (e.g. `INC-4821`) |
| `source` | `'jsm'` |
| `subject` | `fields.summary` |
| `from` | `fields.reporter` display name, or `'JSM'` if absent |
| `receivedAt` | `fields.updated` (ISO) |
| `webLink` | `${baseUrl}/browse/${key}` |
| `jsm.assignee` | `me` (every result is assigned to me; see above) |
| `jsm.priority` | `mapPriority(fields.priority.name)` |
| `jsm.slaStatus` | `readSlaStatus(...)` best-effort, else `'none'` |
| `jsm.state` | `fields.status.name` |

**Priority mapping** (`mapPriority`, pure, heuristic since schemes vary per instance): Highest/Critical/P1 -> `P1`; High/Major/P2 -> `P2`; Medium/P3 -> `P3`; Low/Minor/Lowest/P4 -> `P4`; unknown -> undefined (the scorer treats missing priority as low).

## SLA (best-effort - the one uncertain part)

JSM SLA data lives in a service-desk SLA field (e.g. "Time to resolution"), returned on the issue as an object with an `ongoingCycle` (carrying a `breached` boolean and a `remainingTime`) and `completedCycles`. `readSlaStatus` interprets it: `ongoingCycle.breached === true` -> `'breached'`; an ongoing cycle whose remaining time is at or below a small threshold -> `'at_risk'`; an ongoing cycle with ample time -> `'ok'`; no readable SLA field -> `'none'`. The SLA field id and exact shape vary by instance, so this is explicitly best-effort: when it cannot be read the ticket still scores by **priority + state**, and SLA accuracy is the most likely thing to need a tweak against the real instance (the JSM analogue of Plan 2's header-reading caveat).

## Identity (`me`)

The scoring context `me` is the user's identity used across sources. When email is ingested it is the signed-in M365 address; when only JSM is configured it is `DAYBREAK_JIRA_EMAIL`. JSM tickets set `jsm.assignee = me` regardless, so they score correctly even if the Jira account email differs from the M365 address.

## Testing

Following the Plan 1/2 split:
- **Unit-tested (Vitest, pure):** `buildJql`, `mapPriority`, `readSlaStatus`, `jsmIssueToItem`.
- **Integration / manual (no automated test):** `jsm-auth` (keychain), `jsm-client.fetchAssignedTickets` (live Jira), and the `buildView`/CLI merge against a real instance. Verified by running the ingest CLI / app against the user's Jira with a real API token - the honest treatment for live-API + keychain code, mirroring Plan 2.

## Security posture

Local-first, consistent with the rest of Daybreak: delegated access via the user's own Jira API token (no new credential store), token in the OS keychain, all fetching and scoring on-device, no server, no ticket content egress. Read-only against Jira (no writes).

## Scope (v1) and deferrals

**In v1:** API-token auth + keychain; fetch assigned-to-me, not-Done, in-window tickets; normalize with priority mapping + best-effort SLA + state; merge into the email pipeline; skip gracefully when unconfigured.

**Deferred:** tickets where the user is only a participant/approver/watcher/reporter (the scorer already has a "notified, not assignee -> FYI" path for when this expands); OAuth 3LO; Jira Server/Data Center; Rovo; comment/activity or change-history analysis; multi-instance; real-time updates; configurable priority/SLA field mapping UI (v1 uses the heuristic).

## Open questions / to resolve during planning

- The exact current Jira Cloud JQL-search endpoint + paging shape (the enhanced `/rest/api/3/search/jql` token-paging vs the older `/rest/api/3/search`); confirm and pin during planning.
- The SLA field discovery: whether to request all fields and find the SLA object generically, or require a configured SLA field id. Lean: request the needed fields plus the SLA field generically and degrade to `'none'` when absent.
- Where Jira config lives long-term (env in v1; an app Settings surface later, alongside the rules panel).
- Rate-limit/error handling specifics for the Jira API (429 backoff) - basic throw-on-non-OK in v1, refine if observed.
