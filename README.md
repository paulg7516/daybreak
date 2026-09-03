# Daybreak

An **Outlook add-in** for declared-intent email triage.

Senders tag what they need from you - **Decision**, **Input**, or **FYI** (with an
optional deadline) - right in the Outlook compose pane. On the receiving end, a pinned
side panel shows **your queue**: only the messages people deliberately tagged for you,
grouped by lane and surfaced by urgency. No inbox re-creation, no inference, no noise.

## Scope

Daybreak is **Outlook-only**. Everything lives in `addin/`:

- **Compose surface** (`src/taskpane.*`) - the "Tag this email" picker.
- **Read surface** (`src/queue.*`) - the pinned recipient queue.
- **Graph via nested-app auth** (`src/graph.js`) - reads your tagged mail (set `CLIENT_ID`).
- **Tag vocabulary** (`src/tag.js`) - `decision | input | fyi` + `;by=YYYY-MM-DD`, with legacy aliases.

The recipient queue is served live from GitHub Pages (repo `paulg7516/daybreak-addin`);
the `manifest.xml` here is the source of truth, deployed to the M365 admin center.

> The former Electron desktop app (Microsoft Graph + Gmail + JSM) was retired in favour
> of the add-in. It is preserved on the git tag **`desktop-app-final`** / branch
> **`archive/desktop-app`** if it ever needs to come back.

## Develop

```sh
npm test                 # run the add-in unit tests (Vitest)
npm run validate:manifest # validate the Office manifest
```

The add-in is plain HTML/CSS/JS with no build step. To preview the queue locally,
serve `addin/src/` and open `queue.html` (it renders mock data when `CLIENT_ID` is empty).

## Deploy

Copy `addin/` (manifest + `src/` + `assets/`) into the `paulg7516/daybreak-addin` repo and
push - a GitHub Action rewrites the `localhost:3000` URLs to the Pages origin, validates,
and publishes. Page content (`queue.*`, `taskpane.*`) goes live immediately; manifest
changes (labels, icons, surfaces) need an admin-center re-upload.
