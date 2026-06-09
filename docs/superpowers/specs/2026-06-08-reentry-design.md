# Reentry - Design Spec

**Date:** 2026-06-08
**Status:** Approved design, pending spec review before implementation planning
**Working name:** Reentry

## Problem

When someone returns from PTO they face hundreds of unread emails plus a backlog of
ticketing-system notifications, with no good way to know what to focus on first. Outlook's
Focused Inbox and importance flags do not solve this: importance flags are sender-asserted,
ego-driven, and distrusted, while Focused Inbox is a binary sort with no notion of "you have
been away, here is what changed and what now needs you." The specific return-from-leave
batch-triage moment is underserved, and no existing tool fuses email priority with structured
ticketing signals (JSM) in one view.

## Goal

A tool that, on the day someone returns from leave, surfaces what actually needs their
attention first - across email and tickets - so they triage by consequence instead of
scrolling chronologically through everything.

Primary user: the author and his IT ops team first; possible wider release if there is appetite.

## Non-Goals (v1)

- LLM-based inference (deferred; rules-only in v1, LLM is a later opt-in).
- Microsoft Teams as a source (later phase).
- ADP leave-feed auto-detection of away window (later phase).
- Cross-device or web access (local-first desktop only in v1).
- Any central server that stores or proxies email.

## Core Architecture: Local-First Desktop

Reentry is a local-first desktop application (Electron, following the existing Nowtify
pattern). This is both the lower-friction and the security-correct choice:

- Runs entirely on the user's machine. Email is pulled directly from Microsoft Graph to the
  local device - the same place Outlook already stores it. The app adds zero new central blast
  radius.
- Authentication is delegated OAuth directly to the user's own M365 and JSM accounts. No
  signups, no password database, no account system to breach. Tokens are stored in the OS
  keychain (same mechanism as Nowtify).
- All scoring in v1 is rules-only and runs on-device. Email content never leaves the machine.
- No server tier exists for email data. The only web-hosted artifact is the static manifest
  and task pane for the sender add-in, which carries no email content.

### Two artifacts

1. **Reentry desktop app** (recipient side): ingests Outlook + JSM, scores locally, renders the
   triage surface.
2. **Reentry Outlook compose add-in** (sender side): a compose-window button that writes a
   priority tag as a custom internet header on the outgoing message. Centrally deployable to
   the team via M365 admin.

## The Triage Surface

When the user launches the app and confirms they are back (manual "I'm back - I was out since
[date]" trigger in v1), Reentry shows:

### "While you were out" summary (top)

A generated overview from local data, for example:
"3 need you today, 2 SLAs at risk, 1 contract expired, 14 threads actually moved, 31 already
resolved while you were out."

### Urgency lanes (primary spine)

Three lanes, urgency-first:

1. **Needs you today**
2. **Time-sensitive this week**
3. **FYI / batch-clear**

### Source as a collapsible filter within each lane

Within each lane, items can be grouped/collapsed by source (System notifications / Internal
email / Vendor-external), each with a source icon. Urgency-first is the default view; the user
can collapse to "just show me System" or "just Internal email" on demand.

### Per-item actions

- Open in Outlook or JSM.
- Re-rank with one click; the system remembers the correction and learns from it.
- Mark cleared.
- Nothing is ever auto-deleted. Worst case an item sits one lane lower than ideal but is still
  present and one click from correction.

## Scoring Model

Priority is derived differently per source. No source depends on the sender being honest or
cooperative; the sender tag is an additive hint only.

| Source | How priority is determined | Confidence |
|---|---|---|
| **JSM / system notifications** | Parsed from structured payload: assignee, priority (P1-P4), SLA status, ticket state. | Near-deterministic |
| **Internal email** | Addressing (To vs cc, sole recipient vs blast), direct-ask detection, deadline extraction from body text, sender relationship (manager / report / frequent), and "resolved while you were out" down-ranking. | Best-effort (rules) |
| **Vendor / external** | Pattern detection for invoices, renewals, expiry dates, security advisories. | Medium |
| **Sender tag (when present)** | The four locked options below, read from the `X-PTO-Triage` header. Strong hint; the recipient-side view can still override (e.g. down-rank a "blocked" tag on a thread already resolved). | Strong hint |

### Standout feature: "resolved while you were out"

If a later message in a thread indicates resolution (someone else answered, "nvm, sorted",
etc.), the item is automatically down-ranked. A large fraction of a post-leave backlog is
already dead; surfacing that is uniquely valuable and requires only recipient-side data.

## Sender Tagging (the original idea, done right)

The sender vocabulary is an **expectation axis, not an importance axis** - people commit to a
timeline more honestly than they rank their own importance, which defeats the "everything is
urgent" inflation that killed Outlook's importance flag. There is deliberately **no bare
"Urgent" option**: urgency is earned by naming a date or admitting you are blocked, both of
which are accountable.

### The four locked options (one click each, optional)

| Sender picks | Rationale | Lands in |
|---|---|---|
| **Blocked - waiting on you** | Strongest signal; self-policing because the recipient can see whether they were truly blocked. | Top of **Needs you today** |
| **Action needed by [date]** | Forces a date instead of vague urgency; the date drives sorting. | **Today** or **This week**, by date |
| **Whenever you get to it** | A guilt-free "not urgent" option, which makes people actually use it instead of defaulting everything high. | Bottom of **This week** |
| **FYI - no reply needed** | Lets the sender pre-clear their own message from the recipient's action list. | **FYI / batch-clear** |

Design principles baked in: tagging is **optional and additive** (no tag means recipient-side
inference still places the item, so the system is never worse than no system and improves as
adoption rises), and the tag is a **hint, not a command** (recipient view always wins).

### Tag transport mechanism

- The compose add-in writes a custom internet header on send, for example
  `X-PTO-Triage: blocked` or `X-PTO-Triage: action;by=2026-06-20`.
- The desktop app reads it back via Microsoft Graph (`internetMessageHeaders`) at ingestion.
- Within a single M365 tenant these headers are preserved end-to-end, so internal email carries
  the tag reliably. External/cross-org mail may have headers stripped, which is acceptable
  because external senders are not tagging anyway and fall to inference.
- Fallback if header stripping is ever observed: the add-in also writes `{message-id -> tag}` to
  a local correlation store and the app matches by message-id. Built only if needed.
- This approach does not touch the email body or Outlook categories (categories do not travel
  to the recipient).

## Away-Window Trigger (v1)

Manual: on launch the user confirms "I'm back - I was out since [date]". The away window scopes
which messages and tickets are considered "the backlog." Auto-detection from M365 calendar OOO
is a later enhancement.

## Phasing

- **v1:** Outlook + JSM ingestion, recipient-side rules-only scoring, the three-lane +
  summary surface, the compose add-in with the four tags, manual "I'm back" trigger.
- **v2 / later:** LLM inference opt-in (minimal-metadata-to-cloud, or BYOK Azure OpenAI to keep
  content in-tenant), Teams source, vendor detection depth, ADP leave-feed auto window,
  calendar OOO auto-detect.

## Security Posture Summary

- No central email store and no server proxy for email; local-first eliminates the honeypot risk
  of a tier that transits the whole company's mail.
- Delegated OAuth to accounts the user already has; no new credential store.
- Rules-only on-device scoring in v1 means zero email-content egress.
- The sender add-in carries metadata only (a header on the sender's own message), negligible
  surface.

## Open Questions / To Resolve During Planning

- Exact JSM API surface for pulling assigned/notified items within the away window.
- Microsoft Graph scopes required (read mail, read headers) and add-in manifest permissions.
- Local storage choice for ingested items, re-rank corrections, and cleared state.
- Packaging/auto-update reuse from the Nowtify Electron setup.
