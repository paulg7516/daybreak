# Daybreak Outlook Compose Add-in - Design Spec (curated-queue piece #2)

**Date:** 2026-06-09
**Status:** Approved design, pending spec review before implementation planning
**Builds on:** the sender-flag half of `2026-06-09-daybreak-curated-queue-design.md`. The recipient side (rules engine + Set-aside) shipped as piece #1. This is the **sender** side.

## Purpose

Let a sender, while composing in Outlook, route a message into a recipient's Daybreak and declare its intent - by writing the `X-PTO-Triage` header that the Daybreak ingestion layer (Plan 2 `parseSenderTag`) already reads. Optionally route the message to someone who was not already on the thread via bcc. The add-in is fully decoupled: it touches only the outgoing message, talks to no server and to no Daybreak instance, and carries no email content off the device beyond the message the user is already sending.

## The contract (already consumed by the recipient)

The add-in writes one custom internet header, `X-PTO-Triage`, with exactly one of the four values the existing parser understands (`src/scoring/sender-tag.ts`):

| Sender intent | Header value written | Lands in (recipient side) |
|---|---|---|
| Blocked - waiting on you | `blocked` | top of Needs you today |
| Action needed by [date] | `action;by=YYYY-MM-DD` | Today or This week, by date |
| Whenever you get to it | `whenever` | bottom of This week |
| FYI - no reply needed | `fyi` | FYI / batch-clear |

These are an expectation axis, not an importance axis (the anti-inflation design). No value change is needed on the recipient side.

## Architecture

A web-hosted Office Add-in - a static task pane plus an XML manifest. No framework, no bundler, no server.

- **Task pane** (`addin/src/taskpane.html` + `taskpane.css` + `taskpane.js`): four intent buttons, a date field that appears for "Action needed by", and an optional "also route to [email]" bcc field. `taskpane.js` loads Office.js from Microsoft's CDN and, on a button tap, writes the header (and adds the bcc if provided).
- **Pure logic** (`addin/src/tag.js` - plain ES module, browser-loadable AND unit-testable): `buildTagValue(intent, byDateISO?)`, `formatByDate(date) -> YYYY-MM-DD`, `validateBccAddress(s)`. No Office.js dependency, so it is tested in isolation.
- **Manifest** (`addin/manifest.xml`): a classic MailApp manifest with a MessageCompose extension point, requirement set `Mailbox 1.8`, permission `ReadWriteItem`, pointing at the GitHub Pages URL of the task pane. Button icons in `addin/assets/`.

**Why plain JS, no build:** the task pane is a handful of controls and Office.js is the only dependency (CDN script). Plain ES modules load directly in the browser and are tested directly by Vitest - no toolchain, matching the spec's "tiny static artifact" intent. (The rest of the Daybreak repo is TypeScript; the add-in is an intentionally self-contained vanilla artifact under `addin/`.)

## The send-time flow

```
sender composes a message
  -> opens the Daybreak task pane (ribbon button in the compose window)
  -> taps an intent (e.g. "Action needed by" + picks a date)
  -> optionally types an address in "also route to"
  -> taps Apply
taskpane.js:
  value = buildTagValue(intent, byDate)            [PURE]
  Office ... item.internetHeaders.setAsync({ 'X-PTO-Triage': value })
  if bcc provided and validateBccAddress(bcc):      [PURE check]
     Office ... item.bcc.addAsync([{ emailAddress: bcc }])
  show a confirmation in the pane
sender sends normally -> header rides the message -> recipient's Daybreak reads it
```

Office.js APIs (Mailbox 1.8+, compose mode): `Office.context.mailbox.item.internetHeaders.setAsync(...)` for the header, `Office.context.mailbox.item.bcc.addAsync(...)` for routing. Both are async with status callbacks; the pane reports success or a readable error.

## Routing to non-recipients (the bcc path)

"Also route to [name]" adds that person as **bcc** with the same header. The message lands in their mailbox, where their Daybreak reads the flag like any other - keeping the whole system local-first and server-less, exactly as decided. Accepted trade-off (documented in the curated-queue spec): the routed person receives a bcc copy of the email in addition to the flagged Daybreak entry. A true queue-only route would need a backend and is out of scope.

## Hosting + distribution (deploy steps, flagged not built)

- The static task pane is served over **GitHub Pages** from the Daybreak repo (e.g. an `addin/` path published via Pages, or a `gh-pages` branch). This requires the repo to have a GitHub remote and Pages enabled - the Daybreak repo is currently local-only, so pushing it (or a dedicated Pages branch) is part of go-live.
- The `manifest.xml` SourceLocation/icon URLs point at that Pages origin (HTTPS, which Office requires).
- Distribution to the team is **Centralized Deployment via the Microsoft 365 admin center** (free; the user is the M365 admin). Public AppSource listing is not needed and is out of scope.

## Dev / test approach

- **Unit-tested (Vitest, pure):** `buildTagValue` (the four values incl. the `action;by=` date form), `formatByDate`, `validateBccAddress`. These run in the existing test suite.
- **Manual / integration (no automated test):** the Office.js calls, the task pane in a live Outlook compose window, and the manifest. Verified by **sideloading** the manifest into Outlook (web or desktop) against the user's own mailbox - the honest treatment for live-Office code, mirroring how the Electron/keychain/Graph integration was handled. Dev uses a local HTTPS server (Office requires HTTPS even for localhost) to serve the task pane while iterating, then the Pages URL for the real manifest.

## Security posture

Consistent with the product's local-first stance: the add-in carries metadata only (a header on the sender's own outgoing message), runs entirely client-side in Outlook, has no backend, stores nothing, and reads no mailbox content. The only hosted artifact is the static task pane, which contains no email data.

## Scope (v1) and deferrals

**In v1:** the four intent buttons + the date field for Action + the optional bcc routing field; the header write; the bcc add; the manifest; the Pages-hosted task pane; sideload verification.

**Deferred (per the curated-queue spec / YAGNI):** per-recipient differentiation (one header per message applies to all recipients in v1); the unified JSON manifest (classic XML in v1); a settings/options surface; any reading-back or correlation store (header transport is sufficient; the message-id fallback is built only if header stripping is ever observed); auto-detecting whether the recipient is actually on PTO (the sender just declares intent).

## Open questions / to resolve during planning

- Exact manifest requirement-set floor (`Mailbox 1.8` for `internetHeaders.setAsync` - confirm `bcc.addAsync` availability at the same floor; raise if needed).
- The task pane's visual treatment (a small on-brand panel vs. plain Office Fabric styling) - lean minimal/on-brand but not a heavy design pass.
- Whether the GitHub Pages source is the Daybreak repo's `addin/` path or a dedicated `gh-pages` branch (a deploy-mechanics choice, not a code choice).
- Whether "Apply" should also prompt-send or just set-and-close (lean set-and-close; the user sends normally).
