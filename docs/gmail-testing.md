# Gmail testing (pre-Azure)

Daybreak can ingest a real Gmail inbox as a read-only second mail source, so you and
other testers can exercise the full triage pipeline before Microsoft 365 (Graph) is
wired up. This is a testing bridge, not the production work-mail path.

- **Read-only**: Daybreak requests the `gmail.readonly` scope only. It never marks
  read, archives, labels, or sends. Your inbox is never modified.
- **Provider switch**: `DAYBREAK_MAIL_PROVIDER=gmail` selects Gmail. Unset (or any
  other value) keeps the default Microsoft Graph path. See `src/ingest/mail.ts`.

## One-time setup (developer, already done)

A single Google Cloud project owns one OAuth client that every tester shares. This
was set up once; you do not repeat it per tester.

1. Create a Google Cloud project under a **personal** Gmail (not a Workspace/org
   account, which often blocks OAuth client creation and external test users).
2. **APIs & Services -> Library -> Gmail API -> Enable.**
3. **Google Auth Platform** (formerly OAuth consent screen): configure as
   **External**, app name "Daybreak".
4. **Data Access -> add scope** `.../auth/gmail.readonly`.
5. **Clients -> Create client -> Application type: Desktop app.** A Desktop client
   allows the loopback redirect (`http://127.0.0.1:<port>`) with no registered
   redirect URLs.
6. Copy the **Client ID** and **Client secret**.

## Running it yourself (from source)

Put the credentials in `~/.zshenv` next to the other Daybreak vars, then open a new
shell:

```sh
export DAYBREAK_GOOGLE_CLIENT_ID="...apps.googleusercontent.com"
export DAYBREAK_GOOGLE_CLIENT_SECRET="..."
export DAYBREAK_MAIL_PROVIDER="gmail"
```

```sh
npm run app:dev
```

Set an away window, trigger ingest, approve the Google tab that opens (you will see
an "unverified app" warning - Advanced -> proceed; normal for a test app). Real mail
flows into Today / This Week / FYI; vendor/bulk mail drops to Set-aside. The refresh
token is cached in the OS keychain (`Daybreak / gmail-refresh-token`), so you are not
re-prompted on subsequent ingests.

To reset the connection (e.g. after rotating the OAuth client):

```sh
security delete-generic-password -s Daybreak -a gmail-refresh-token
```

## Onboarding another tester

Testers do **not** touch the Google Cloud Console. Per tester (~10 seconds):

1. **Add their Gmail to Test users**: Google Auth Platform -> Audience -> Test users
   -> Add users. While the app is in "Testing" status only allow-listed accounts can
   sign in (limit: 100 test users).
2. **Give them a build with credentials baked in** (see below).
3. They open the app and approve the consent screen for their own mailbox. Same
   read-only access, same one-time "unverified app" warning.

## Building a tester-ready app (zero-config)

```sh
npm run app:dist:gmail
```

This produces a packaged `.app` a tester can launch from Finder with **no env vars at
all**. A macOS app started from Finder inherits no shell environment, so the build
bakes two things into the bundle:

- **The Google OAuth credentials** present in your build environment
  (`DAYBREAK_GOOGLE_CLIENT_ID` / `_SECRET`).
- **The mail provider** (`gmail`), so the app does not fall back to the Microsoft
  Graph default.

The build prints `(Gmail credentials baked in) (provider baked: gmail)` on success,
and warns if the credentials are missing.

Guarantees:

- The runtime reads the **env var first** and only falls back to the baked value, so
  a dev or tester can still override either the credentials or the provider.
- Provider baking is keyed on an explicit build flag (`DAYBREAK_BAKE_PROVIDER`), not
  on your ambient `DAYBREAK_MAIL_PROVIDER`, so plain `npm run app:dist` stays on
  Graph and is never accidentally Gmail-locked.
- A Desktop OAuth client secret is not confidential by design, so bundling it is the
  accepted approach for installed apps.
- `dist/` is gitignored, so the baked secret never enters source control.

## When this goes away

Once Microsoft 365 / Graph is connected, work users authenticate through Graph and
this Gmail path is only for testers without M365. Removing it later is just deleting
the `gmail-*` ingest files and the `mail.ts` switch.
