# Daybreak Curated-Queue Model - Revised Design Spec

**Date:** 2026-06-09
**Status:** Approved design direction, pending spec review before implementation planning
**Supersedes:** the *inclusion* philosophy of `2026-06-08-daybreak-design.md` (the assumption that the whole backlog flows in and is inferred). The local-first architecture, the three-lane surface, the JSM source, the away-window scope, and the scorer itself still hold - the scorer is demoted, not discarded. What changes is HOW an item gets into the queue, and how flagged/rule-matched items get their lane.

## Why this revision

The original design assumed Daybreak ingests the user's whole backlog and *infers* what matters. Testing the demo surfaced the real problem: **not every email should flow into Daybreak.** Inferring relevance over all mail makes the FYI lane a noise dump (newsletters, automated mail, vendor blasts all land somewhere).

The revised model inverts the inclusion decision. An email enters Daybreak only when it is **explicitly wanted** - either the recipient's own standing rules pull it in, or a sender flags it in. Everything else never enters the active queue. This is clean by construction and removes the dependence on guessing.

This also quietly broadens Daybreak from a PTO-only tool into an always-on **curated priority queue** (senders flag at send time regardless of whether the recipient is out). v1 keeps the PTO framing via the away-window scope; the always-on use is a natural later evolution, not built now.

## The two inclusion mechanisms

Inclusion is the union of two independent signals. An item is in the active queue if EITHER fires:

1. **Recipient standing rules (the backbone).** The user defines rules in Daybreak: "pull in mail from my manager / my team / these vendors; treat the rest as noise." This gives the recipient full control of their own queue on day one, with zero dependence on anyone else's behavior. It is the primary defense against the noise problem.

2. **Sender flags (the override).** A sender, composing in Outlook, taps a button in the Daybreak add-in to route the message into the recipient's Daybreak and pick the intent. This adds explicit "make sure you see this" signal on top of the recipient's rules. Optional, additive, and only as broad as adoption - which is fine, because the recipient rules already guarantee coverage.

Everything that matches neither is **set aside** (see below), never deleted.

## Inclusion decision (precise)

For each ingested message, in order:

1. If it carries a sender flag (`X-PTO-Triage` header) -> **included**, lane from the flag.
2. Else if it matches a recipient **include** rule -> **included**, lane from the rule (refined by inference if the rule does not pin a lane).
3. Else if it matches a recipient **exclude** rule, or is detectably bulk/automated (a `List-Unsubscribe` header, `Precedence: bulk`, `Auto-Submitted`, or a `no-reply@`/`notifications@`-style sender) -> **set aside**.
4. Else (unmatched) -> **set aside** by default.

Default-aside (step 4) is the load-bearing change: "not everything flows in" means unknown mail is parked, not queued. The recipient widens the queue by adding include rules, not by Daybreak guessing.

## Set-aside, not deleted

The spec principle "nothing is ever auto-deleted" is preserved. Items that are set aside go into a collapsed **"Set aside - N items"** affordance below the three lanes, grouped (newsletters / automated / unmatched). One click reveals them; one click promotes any of them into a lane (and optionally creates an include rule from that sender, so the correction sticks). The active queue stays focused; nothing is lost.

## Recipient rules (v1 scope)

Rules live on-device (extend the existing `electron-store` overlay). A Settings panel in the Daybreak app manages them. YAGNI applies - v1 rules match on:

- **Sender** address or domain (`from = boss@company.com`, `from-domain = company.com`).
- **Addressing**: "I am in To" vs cc-only.
- **Bulk exclusion toggle**: the built-in bulk/automated detection above, on by default.

Rule actions: **include -> lane** (today / this_week / fyi, or "let inference decide") or **exclude**. Sender flags always win over rules; an explicit recipient exclude rule wins over the bulk default. v1 does not do keyword/body matching or per-time-window rules - later enhancements.

## Sender flags and the Outlook add-in

The transport is unchanged from the original spec and already read by the ingestion layer: a custom internet header `X-PTO-Triage` on the outgoing message, read back via Microsoft Graph `internetMessageHeaders`. The existing parser already understands the four values; no reader change is needed.

The four flag values (an **expectation axis, not an importance axis** - the anti-inflation design is retained) and where they land:

| Sender taps | Header written | Lands in |
|---|---|---|
| Blocked - waiting on you | `X-PTO-Triage: blocked` | top of Needs you today |
| Action needed by [date] | `X-PTO-Triage: action;by=YYYY-MM-DD` | Today or This week, by date |
| Whenever you get to it | `X-PTO-Triage: whenever` | bottom of This week |
| FYI - no reply needed | `X-PTO-Triage: fyi` | FYI / batch-clear |

**v1 routing rule:** one flag per message, applied uniformly to every recipient's Daybreak. Per-recipient differentiation (Sarah=today, Bob=fyi on the same message) is deferred.

### Routing to people who were not on the thread (bcc path)

When a sender wants an item in someone's Daybreak who is not already a recipient, the add-in **adds that person as bcc** (Office.js `item.bcc.addAsync`) and writes the flag header. The message then lands in that person's mailbox, where their Daybreak reads the flag like any other. This keeps the system **local-first and server-less** - no backend, no central store, consistent with the security posture. The accepted trade-off: the routed person receives an actual (bcc) copy of the email, which they would batch-clear anyway, in addition to the flagged Daybreak entry. A true "queue-only, no email copy" route would require a backend and is explicitly out of scope (it would forfeit the no-honeypot security advantage).

### Add-in distribution

The add-in is a small web-hosted task pane (static HTML/JS that writes the header and optionally adds bcc) plus a manifest. Distribution for the target org is **Centralized Deployment via the Microsoft 365 admin center** - free, pushed to all users by the admin. The only cost is trivial static hosting for the task pane, which carries no email content. Public AppSource listing is not needed and is out of scope. Technical basis: custom header write requires Outlook Mailbox requirement set 1.8+ (compose `internetHeaders` + `bcc.addAsync`).

## What this demotes

Recipient-side **inference** (direct-ask detection, deadline extraction, To-vs-cc weighting from the Plan 1 scorer) is no longer the headline mechanism. It is retained as a **lane-refiner for rule-included items that carry no flag** (step 2 above) and as the scorer for JSM tickets. It is not deleted - it is demoted from "decides inclusion" to "helps place already-included items."

## Unchanged from prior plans

- Local-first Electron desktop app, overlay-only persistence, re-rank/clear, Undo (Plan 3, shipped).
- Microsoft Graph email ingestion (Plan 2, shipped) - still how the recipient's mailbox and the flag headers are read.
- JSM ticket ingestion (a separate source, always included, scored by its near-deterministic rules) - still a later plan, unaffected by this revision.
- The three urgency lanes, the "while you were out" summary, and the away-window scope.

## Implementation decomposition (sequenced plans, not built here)

1. **Rules engine + inclusion gate + Set-aside bin** (recipient-side). Highest leverage: delivers the curated queue and solves the noise problem **day one, with no external dependency** (no add-in, no hosting, no admin deployment). Build first. Touches the scoring/ingestion pipeline (`buildView`), the overlay (rules storage), and the renderer (Set-aside UI + a rules Settings panel).
2. **Outlook compose add-in** (sender-side): the task pane that writes `X-PTO-Triage` + bcc routing, its manifest, hosting, and admin-center deployment. Layers sender intent on top of the rules engine.
3. **JSM ingestion** and any later enhancements (per-recipient routing, keyword rules, always-on mode) follow.

## Open questions / to resolve during planning

- Exact rules data shape in the overlay and the Settings-panel UX (add/edit/remove, ordering, precedence display).
- Whether "promote from Set-aside" should offer one-click "always include this sender" (recommended) and how that rule is phrased.
- The add-in's hosting target (a static host) and manifest specifics (requirement set, permissions, icon).
- Whether the bulk/automated detector should also down-rank rather than hard-aside borderline cases (e.g., a vendor that sometimes sends real escalations).
