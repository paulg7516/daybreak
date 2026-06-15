# Daybreak Outlook compose add-in

Tags an outgoing message with `X-PTO-Triage` so it lands in the recipient's Daybreak
queue. Static task pane + Office.js, no build, no server.

## LIVE (hosted on GitHub Pages)

The task pane is published to the public repo `paulg7516/daybreak-addin` and served at
`https://paulg7516.github.io/daybreak-addin/`. The deployment manifest (URLs pointed at
Pages, validated) is `https://paulg7516.github.io/daybreak-addin/manifest.xml`.

- **Deploy to the org (appears in Outlook "Built for your org"):** admin.microsoft.com
  -> Settings -> Integrated apps -> Upload custom apps -> "Provide link to manifest file"
  -> paste the manifest URL -> assign users -> Deploy.
- **Quick personal test:** Outlook web -> Get Add-ins -> My add-ins -> Add a custom add-in
  -> Add from URL -> paste the manifest URL.

To update the hosted add-in: edit `addin/` here, copy the changed files (manifest.xml /
src / assets) into the `paulg7516/daybreak-addin` repo as-is (keep the `localhost:3000`
URLs), and push. A GitHub Action (`.github/workflows/deploy.yml` in that repo) swaps
`localhost:3000` to the Pages URL, validates the manifest, and deploys to Pages
automatically - so the source manifest stays identical to this folder's dev version.

The `manifest.xml` in THIS folder keeps the `localhost:3000` URLs for local dev/sideload;
the deployed manifest at `https://paulg7516.github.io/daybreak-addin/manifest.xml` carries
the production URLs (rewritten by the Action).

## Dev: sideload against your own mailbox

1. Trust a localhost HTTPS cert (once):
   `npx -y office-addin-dev-certs install`
2. Serve the `addin/` folder over HTTPS on port 3000:
   `npx -y http-server addin -p 3000 -S -C ~/.office-addin-dev-certs/localhost.crt -K ~/.office-addin-dev-certs/localhost.key`
   (Path to the cert/key is printed by step 1.)
3. Sideload `addin/manifest.xml`:
   - Outlook on the web: Settings -> Mail -> Customize actions / Get Add-ins -> My add-ins -> Add a custom add-in -> Add from file -> pick `manifest.xml`.
   - Or: `npx -y office-addin-debugging start addin/manifest.xml`

## Verify (manual)

- Compose a new message TO yourself. Open the Daybreak button in the compose ribbon.
- Pick "Needs your decision", choose a date, leave bcc empty, click Apply -> the form is replaced by a green "Tagged for their queue" card summarizing the tag.
- Send it. In the received copy, view the message source/headers and confirm `X-PTO-Triage: action;by=YYYY-MM-DD` is present.
- Run the recipient side: `npm run ingest -- --since <a date before the send>` (or the desktop app) and confirm the message is tagged/placed by the rule.
- Repeat with a bcc address: confirm the bcc recipient receives the message and the header.

## Deploy: GitHub Pages + M365 admin center

1. Push the repo to GitHub and enable Pages serving the `addin/` path (Settings -> Pages),
   giving a base like `https://<you>.github.io/<repo>/addin`.
2. In `manifest.xml`, replace every `https://localhost:3000` with that base, then re-validate:
   `npx -y office-addin-manifest validate addin/manifest.xml`.
3. Microsoft 365 admin center -> Settings -> Integrated apps -> Upload custom apps -> upload `manifest.xml`,
   and assign it to the team. (Free.)
