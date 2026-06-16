# Daybreak in-Outlook queue — PROTOTYPE

Proves the recipient triage board can live in the Outlook add-in panel, so the whole
product (tag + queue) runs inside Outlook with no separate desktop app.

## What's here

- `src/queue.html` / `queue.js` / `queue.css` — the recipient board, rendered in a
  pinnable read-surface taskpane at side-panel width. Stacked lanes (Needs your reply /
  decision / review / FYI), each row showing sender, source, urgency, and deadline.
- `src/graph.js` — reads tagged mail from Microsoft Graph via **nested-app auth (NAA)**,
  no backend. Falls back to mock data while `CLIENT_ID` is empty.
- `src/tag.js` — `parseTagValue()` added (recipient side of `buildTagValue`), with
  legacy-alias support.
- `manifest.xml` — adds a `MessageReadCommandSurface` button with `SupportsPinning`,
  alongside the existing compose (tagging) button.

## See it now (mock data, no setup)

Same sideload flow as the tagging add-in (see README), then open the **Daybreak queue**
button on a *received* message and pin it. With `CLIENT_ID` empty it shows preview data,
so you can judge the layout/feel immediately.

## Go live against your real mailbox (the Azure checklist)

1. **Register an app** in Entra (Azure AD) → App registrations → New registration.
   Single tenant is fine to start; multi-tenant for rollout.
2. **Add redirect URIs** of type *Single-page application* for NAA:
   - `brk-multihub://localhost:3000` (dev) — and your Pages origin for the hosted build.
   - Microsoft's NAA broker handles the rest; no client secret, no backend.
3. **API permissions** → Microsoft Graph → Delegated → **`Mail.Read`**. Grant/consent
   (user consent if the tenant allows it, else admin consent — see the Graph decision memo).
4. **Paste the Application (client) ID** into `CLIENT_ID` in `src/graph.js`.
5. Reload the add-in. The queue now pulls your tagged mail.

## Known caveats (honest)

- **NAA can't be verified headless.** The auth + fetch path is written but unproven until
  run in real Outlook against the registered app — expect a round of iteration there.
- **Graph can't `$filter` a custom header**, so we pull recent messages with their
  internet headers and filter for `X-PTO-Triage` client-side. Fine at small scale; may
  need paging/`$top` tuning for very busy mailboxes.
- **Overlay state** (done / cleared / re-rank / lane config) is **not** persisted yet —
  that's the next production decision (Office roaming settings vs localStorage).
- **Pinned panel** depends on Outlook version: supported on new Outlook + OWA; classic
  Outlook support is more limited.
