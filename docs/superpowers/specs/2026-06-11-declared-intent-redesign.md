# Daybreak: declared-intent redesign

## Context

Daybreak is pivoting from inference-based triage (guess each email's urgency from
recipient position, sender relationship, keywords) to **declared intent**: an email
enters the app *only* if the sender tagged it via the Outlook add-in, and the tag
*is* the lane. JSM tickets enter via their own structured fields. No recipient-side
inference anywhere. Daybreak is a companion channel for deliberately-routed requests,
not a full inbox.

This supersedes the curated-queue/rules pivot: the rules engine, bulk detection, and
Set-Aside bin all go away, because nothing low-signal can enter (untagged mail simply
isn't ingested into the board).

## Core model change

`Lane` and the old `SenderTag` merge. The sender declares an action-type, which is the
lane directly. Urgency is a separate, derived axis shown as a badge and used for sort.

```ts
// model/item.ts
export type Lane = 'respond' | 'approve' | 'review' | 'fyi';   // = declared intent
export type Source = 'jsm' | 'email_internal' | 'email_vendor';
export type Urgency = 'overdue' | 'today' | 'this_week' | 'none';

export interface TriagedItem {        // replaces ScoredItem (no rank, no resolved)
  item: DaybreakItem;
  lane: Lane;
  urgency: Urgency;
  deadline?: string;                  // ISO date, if the sender declared one
  reasons: string[];                  // e.g. ["sender: approve", "due Jun 15"]
}
```

`DaybreakItem` is unchanged (still carries `internetHeaders` with `X-PTO-Triage`, and
`jsm` fields). `ScoringContext` shrinks to `{ me, since, now }` (drop managers/
reports/frequentContacts).

## Lane vocabulary = the add-in dropdown

| Tag value (`X-PTO-Triage`) | Lane | Meaning |
|---|---|---|
| `respond` | Respond | sender needs an answer/reply |
| `approve` | Approve / Decide | sender needs a sign-off or decision |
| `review` | Review | please look, light touch |
| `fyi` | FYI | no action |

Optional deadline on any: `approve;by=2026-06-15`. Legacy values are aliased so
in-flight mail still classifies: `blocked→respond`, `action→approve`, `whenever→review`.

Urgency derives from the deadline (for email) or SLA (for JSM): past → `overdue`, due
today → `today`, within 7 days → `this_week`, else `none`.

## What gets deleted

- `src/scoring/email.ts`, `src/scoring/vendor.ts`, `src/scoring/resolved.ts` + tests
  (all recipient inference).
- The rules engine: `Rule`, `classifyItem` rule branches, `addRule`/`removeRule`/
  `setBulkExclude`/`forceInclude`, `isBulk`, `bulkExcludeEnabled`, `forcedInclude`,
  `promoteSetAside`. + their tests + `RulesSettings.tsx`.
- Set-Aside everywhere: `SetAsideBin.tsx`, `SetAsideView`/`SetAsideEntry`, the bin in
  `App.tsx`, the promote IPC path.
- The 4 stat tiles in `SummaryHeader` (replaced by one headline).
- `resolved` field on items; "resolved while you were out".

## What replaces it

- `src/scoring/sender-tag.ts` → `parseDeclaredIntent(headers): { lane, deadline? } | null`
  (promoted to the router; supports new values + legacy aliases).
- `src/scoring/urgency.ts` (new): `urgencyFor(deadlineISO, now): Urgency`.
- `src/scoring/triage.ts` (replaces `score.ts`): `triageItem` / `triageAll`. Email:
  lane = declared intent, urgency from deadline. JSM: open+assigned → `respond` (else
  `review`), urgency from SLA/priority.
- `classifyItem(item)` (simplified, no overlay rules): include if `jsm` or email has a
  declared intent; otherwise drop (not shown). No Set-Aside.
- Overlay shrinks to `{ awayWindow, lastOpenedAt?, cleared, rerank, laneConfig?, jira }`.

## UI

- **Board:** stacked, full-width, collapsible lanes (Respond / Approve / Review / FYI),
  not a 3-column grid. Each item shows subject — sender · **urgency badge**
  (`Overdue`/`Today`/`This week`). FYI/Review collapsed by default. Reuse the existing
  dark "sunrise" tokens (no restyle). Real empty states ("You're all caught up").
- **Headline** replaces the 4 stat tiles: e.g. "8 need you · 2 overdue".
- **Group/filter bar:** Group by {Lane (default) / Sender / Source}; filter by sender.
- **Settings in shell:** the left nav rail persists; Settings renders in the content
  area, not as a full-screen takeover. Tabs: **Lanes** (rename / toggle / reorder) +
  **Sources** (Jira). Rules tab removed.
- **"Catch up since"** replaces "Out since": defaults to `lastOpenedAt`, manual date
  override retained. Rename in the header + AwayWindowModal.
- Bulk actions (multi-select clear) + keyboard triage (`j/k`, `e`) where they fit.

## Add-in (addin/)

- `addin/src/tag.js`: `INTENTS` → `['respond','approve','review','fyi']`; `buildTagValue`
  supports `;by=` on any. Update `addin/src/taskpane.html` radios and labels,
  `taskpane.js` deadline-row logic, and `addin/tests/tag.test.js`.

## Phases (each ends green + committed)

1. **Data layer** — model types, `parseDeclaredIntent`, `urgency`, `triage` (replaces
   scoring), simplified `classifyItem`, slimmed overlay/store/ipc, view-model without
   Set-Aside, headline summary, demo-data. Rewrite/delete affected tests.
2. **Board UI** — stacked lanes, urgency badge, headline, lane titles, remove SetAsideBin.
3. **Settings in shell** — persistent rail, Lanes tab (rename/toggle/reorder), drop Rules.
4. **Group/filter + bulk + keyboard.**
5. **Add-in** dropdown → new vocabulary.

## Verification

`npm test` green at each phase; `npm run typecheck` + `npm run build:main` +
`build:renderer` clean; run `npm run app:demo` to see the board; demo data exercises
all four lanes + urgency badges.
