# Daybreak Outlook Compose Add-in Implementation Plan (curated-queue piece #2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship an Outlook compose add-in (under `addin/`) that lets a sender tag an outgoing message with one of the four `X-PTO-Triage` intents - and optionally bcc-route it to a non-recipient - so the message lands in the recipient's Daybreak queue.

**Architecture:** A web-hosted Office Add-in: a static, no-build task pane (vanilla HTML/CSS/JS) plus a classic XML manifest. The only dependency is Office.js, loaded from Microsoft's CDN. The header value, date format, and bcc-address validation are PURE functions in a browser-loadable ES module (`addin/src/tag.js`) unit-tested with the repo's existing Vitest. The Office.js calls and the live Outlook integration are typecheck-free vanilla JS, verified manually by sideloading (Office cannot be run headlessly). Nothing talks to a server or to the Daybreak app.

**Tech Stack:** Vanilla HTML/CSS/JS (ES modules, no bundler), Office.js (CDN), classic XML add-in manifest, Vitest (pure logic only), Node (icon generation). Hosting: GitHub Pages. Distribution: M365 admin center.

**House rules:** No em dashes anywhere in code or comments - use regular hyphens. The add-in is intentionally plain JavaScript (the rest of the repo is TypeScript); it is a self-contained static artifact. The pure logic gets TDD; the Office.js/manifest/hosting parts are typecheck-free and carry concrete manual verification, the honest treatment for live-Office code.

---

## File Structure

All new files under `addin/` (a new top-level folder; nothing in the existing app changes):

- `addin/src/tag.js` - PURE ES module: `buildTagValue`, `formatByDate`, `validateBccAddress`. Browser-loadable and Vitest-testable.
- `addin/tests/tag.test.js` - Vitest unit tests for `tag.js` (picked up by the default `**/*.test.*` glob; runs in the node environment).
- `addin/src/taskpane.html` - the task pane markup (four intent buttons, a date field, a bcc field, a status line).
- `addin/src/taskpane.css` - on-brand minimal styling.
- `addin/src/taskpane.js` - Office.js integration: imports `tag.js`, wires the UI, calls `internetHeaders.setAsync` + `bcc.addAsync`.
- `addin/scripts/make-icons.mjs` - zero-dependency Node script that writes solid PNG icons (16/32/80) used by the manifest.
- `addin/assets/icon-16.png`, `icon-32.png`, `icon-80.png` - generated icons (git-ignored output of the script is fine to commit; they are tiny).
- `addin/manifest.xml` - the XML add-in manifest (dev URLs at `https://localhost:3000`, with a documented swap to the Pages URL).
- `addin/README.md` - dev/sideload + GitHub Pages + M365 deployment instructions and the manual verification checklist.

**Phasing (for execution grouping):** A = pure logic (Task 1); B = task pane UI + Office.js (Tasks 2-3); C = manifest + icons (Task 4); D = docs + manual verification (Task 5).

---

## Task 1: Pure tag logic (TDD)

**Files:**
- Create: `addin/src/tag.js`
- Test: `addin/tests/tag.test.js`

- [ ] **Step 1: Write the failing test**

```javascript
// addin/tests/tag.test.js
import { describe, it, expect } from 'vitest';
import { buildTagValue, formatByDate, validateBccAddress } from '../src/tag.js';

describe('formatByDate', () => {
  it('passes a valid YYYY-MM-DD string through', () => {
    expect(formatByDate('2026-06-20')).toBe('2026-06-20');
  });
  it('formats a Date to YYYY-MM-DD (local date parts)', () => {
    expect(formatByDate(new Date(2026, 5, 9))).toBe('2026-06-09'); // month is 0-based: 5 = June
  });
  it('returns null for an unparseable value', () => {
    expect(formatByDate('not-a-date')).toBeNull();
    expect(formatByDate('')).toBeNull();
  });
});

describe('buildTagValue', () => {
  it('builds the three simple intents', () => {
    expect(buildTagValue('blocked')).toBe('blocked');
    expect(buildTagValue('whenever')).toBe('whenever');
    expect(buildTagValue('fyi')).toBe('fyi');
  });
  it('builds the action intent with a by-date', () => {
    expect(buildTagValue('action', '2026-06-20')).toBe('action;by=2026-06-20');
  });
  it('throws on action without a valid date', () => {
    expect(() => buildTagValue('action')).toThrow();
    expect(() => buildTagValue('action', 'nope')).toThrow();
  });
  it('throws on an unknown intent', () => {
    expect(() => buildTagValue('urgent')).toThrow();
  });
});

describe('validateBccAddress', () => {
  it('accepts a normal address', () => {
    expect(validateBccAddress('sarah@company.com')).toBe(true);
  });
  it('rejects junk and empty', () => {
    expect(validateBccAddress('sarah')).toBe(false);
    expect(validateBccAddress('')).toBe(false);
    expect(validateBccAddress('a@b')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run addin/tests/tag.test.js`
Expected: FAIL - cannot find module `../src/tag.js`.

- [ ] **Step 3: Write the implementation**

```javascript
// addin/src/tag.js
// Pure helpers for the Daybreak compose add-in. No Office.js dependency, so they
// load in the browser AND run under Vitest. The header values match exactly what
// the recipient-side parser (src/scoring/sender-tag.ts) understands.

const INTENTS = new Set(['blocked', 'whenever', 'fyi', 'action']);

// Returns 'YYYY-MM-DD' for a Date or a 'YYYY-MM-DD' string, or null if invalid.
export function formatByDate(value) {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }
  return null;
}

// Builds the X-PTO-Triage header value for an intent. 'action' requires a date.
export function buildTagValue(intent, byDate) {
  if (!INTENTS.has(intent)) {
    throw new Error(`Unknown intent: ${intent}`);
  }
  if (intent === 'action') {
    const by = formatByDate(byDate);
    if (!by) throw new Error('Action needs a valid date.');
    return `action;by=${by}`;
  }
  return intent;
}

// A pragmatic email check for the optional bcc-routing field.
export function validateBccAddress(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value).trim());
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run addin/tests/tag.test.js`
Expected: PASS (9 tests).

- [ ] **Step 5: Run the full suite (the add-in tests join the repo suite)**

Run: `npm test`
Expected: all existing tests still pass plus the new `addin/tests/tag.test.js`.

- [ ] **Step 6: Commit**

```bash
git add addin/src/tag.js addin/tests/tag.test.js
git commit -m "feat(addin): pure X-PTO-Triage tag-value + date + bcc helpers"
```

---

## Task 2: Task pane markup + styling

No automated test (static markup, verified in Task 5). The pane has four intent buttons, a date input shown only for Action, an optional bcc field, an Apply button, and a status line.

**Files:**
- Create: `addin/src/taskpane.html`, `addin/src/taskpane.css`

- [ ] **Step 1: Write the HTML**

```html
<!-- addin/src/taskpane.html -->
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Daybreak</title>
    <link rel="stylesheet" href="./taskpane.css" />
    <script src="https://appsforoffice.microsoft.com/lib/1/hosted/office.js"></script>
  </head>
  <body>
    <main class="pane">
      <header class="brand">
        <span class="mark" aria-hidden="true"></span>
        <div>
          <h1>Daybreak</h1>
          <p>Send this to their triage queue</p>
        </div>
      </header>

      <fieldset class="intents">
        <legend>How should they treat this?</legend>
        <label class="intent"><input type="radio" name="intent" value="blocked" /> <span><strong>Blocked</strong> - waiting on you</span></label>
        <label class="intent"><input type="radio" name="intent" value="action" /> <span><strong>Action needed</strong> by a date</span></label>
        <label class="intent"><input type="radio" name="intent" value="whenever" /> <span><strong>Whenever</strong> you get to it</span></label>
        <label class="intent"><input type="radio" name="intent" value="fyi" /> <span><strong>FYI</strong> - no reply needed</span></label>
      </fieldset>

      <div class="row" id="dateRow" hidden>
        <label for="byDate">By date</label>
        <input type="date" id="byDate" />
      </div>

      <div class="row">
        <label for="bcc">Also route to (optional)</label>
        <input type="email" id="bcc" placeholder="name@company.com" />
      </div>

      <button id="apply" class="apply" type="button" disabled>Apply to this message</button>
      <p id="status" class="status" role="status" aria-live="polite"></p>
    </main>
    <script type="module" src="./taskpane.js"></script>
  </body>
</html>
```

- [ ] **Step 2: Write the CSS**

```css
/* addin/src/taskpane.css */
:root {
  --bg: #0f141d; --panel: #171c27; --line: #2a3344;
  --ink: #eef1f7; --ink-2: #a2abbd; --accent: #6e6bff;
  --today: #ff5f63;
  color-scheme: dark;
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--ink);
  font-family: 'Segoe UI', system-ui, sans-serif; font-size: 14px; }
.pane { padding: 16px; display: flex; flex-direction: column; gap: 14px; }
.brand { display: flex; align-items: center; gap: 10px; }
.brand h1 { margin: 0; font-size: 15px; }
.brand p { margin: 0; font-size: 12px; color: var(--ink-2); }
.mark { width: 22px; height: 22px; border-radius: 7px;
  background: linear-gradient(135deg, #fbbf24, #f43f5e, #7c3aed); }
.intents { border: 1px solid var(--line); border-radius: 10px; margin: 0; padding: 10px 12px; }
.intents legend { font-size: 12px; color: var(--ink-2); padding: 0 4px; }
.intent { display: flex; align-items: center; gap: 8px; padding: 6px 0; cursor: pointer; }
.intent span { font-weight: 400; }
.row { display: flex; flex-direction: column; gap: 5px; }
.row label { font-size: 12px; color: var(--ink-2); }
input[type="date"], input[type="email"] {
  background: var(--panel); border: 1px solid var(--line); color: var(--ink);
  border-radius: 8px; padding: 8px 10px; font: inherit; }
.apply { background: var(--accent); color: #fff; border: 0; border-radius: 8px;
  padding: 10px; font: inherit; font-weight: 600; cursor: pointer; }
.apply:disabled { opacity: .45; cursor: default; }
.status { margin: 0; font-size: 12px; min-height: 16px; }
.status.ok { color: #2dd4a7; }
.status.err { color: var(--today); }
```

- [ ] **Step 2b: Commit**

```bash
git add addin/src/taskpane.html addin/src/taskpane.css
git commit -m "feat(addin): compose task pane markup and styling"
```

---

## Task 3: Office.js integration (taskpane.js)

Wires the UI to Office.js. INTEGRATION code (live Office), no automated test; verified by sideloading in Task 5.

**Files:**
- Create: `addin/src/taskpane.js`

- [ ] **Step 1: Write the integration**

```javascript
// addin/src/taskpane.js
import { buildTagValue, validateBccAddress } from './tag.js';

const HEADER = 'X-PTO-Triage';

function el(id) { return document.getElementById(id); }
function setStatus(msg, kind) {
  const s = el('status');
  s.textContent = msg;
  s.className = `status${kind ? ' ' + kind : ''}`;
}
function selectedIntent() {
  const checked = document.querySelector('input[name="intent"]:checked');
  return checked ? checked.value : null;
}
function refreshControls() {
  const intent = selectedIntent();
  el('dateRow').hidden = intent !== 'action';
  el('apply').disabled = intent === null;
}

// Promisified Office async call.
function officeCall(fn) {
  return new Promise((resolve, reject) => {
    fn((res) => {
      if (res.status === Office.AsyncResultStatus.Succeeded) resolve(res.value);
      else reject(new Error(res.error ? res.error.message : 'Office call failed'));
    });
  });
}

async function apply() {
  const intent = selectedIntent();
  if (!intent) return;
  let value;
  try {
    value = buildTagValue(intent, el('byDate').value);
  } catch (e) {
    setStatus(e.message, 'err');
    return;
  }

  const bcc = el('bcc').value.trim();
  if (bcc && !validateBccAddress(bcc)) {
    setStatus('That does not look like an email address.', 'err');
    return;
  }

  el('apply').disabled = true;
  setStatus('Applying...');
  try {
    const item = Office.context.mailbox.item;
    await officeCall((cb) => item.internetHeaders.setAsync({ [HEADER]: value }, cb));
    if (bcc) {
      await officeCall((cb) => item.bcc.addAsync([{ emailAddress: bcc }], cb));
    }
    setStatus(bcc ? `Tagged and routing to ${bcc}. Send when ready.` : 'Tagged. Send when ready.', 'ok');
  } catch (e) {
    setStatus(`Could not apply: ${e.message}`, 'err');
  } finally {
    el('apply').disabled = false;
  }
}

Office.onReady(() => {
  document.querySelectorAll('input[name="intent"]').forEach((r) => r.addEventListener('change', refreshControls));
  el('apply').addEventListener('click', apply);
  refreshControls();
});
```

- [ ] **Step 2: Sanity-check the import graph (no Office needed)**

Run: `node --input-type=module -e "import('./addin/src/tag.js').then(m => console.log(typeof m.buildTagValue))"`
Expected: prints `function` (confirms `tag.js` is a valid ES module that `taskpane.js` can import; `taskpane.js` itself needs Office and is verified in Task 5).

- [ ] **Step 3: Commit**

```bash
git add addin/src/taskpane.js
git commit -m "feat(addin): Office.js wiring - set X-PTO-Triage header and bcc route"
```

---

## Task 4: Manifest + icons

**Files:**
- Create: `addin/scripts/make-icons.mjs`, `addin/manifest.xml`
- Generates: `addin/assets/icon-16.png`, `icon-32.png`, `icon-80.png`

- [ ] **Step 1: Write the icon generator**

```javascript
// addin/scripts/make-icons.mjs
// Writes solid-color PNG icons with zero dependencies (Node zlib + manual CRC).
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}
function solidPng(size, [r, g, b]) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 2; // 8-bit, truecolor RGB
  const row = Buffer.concat([Buffer.from([0]), Buffer.concat(Array.from({ length: size }, () => Buffer.from([r, g, b])))]);
  const raw = Buffer.concat(Array.from({ length: size }, () => row));
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

mkdirSync('addin/assets', { recursive: true });
for (const size of [16, 32, 80]) {
  writeFileSync(`addin/assets/icon-${size}.png`, solidPng(size, [244, 63, 94])); // rose-500
}
console.log('Daybreak add-in: wrote icon-16/32/80.png');
```

- [ ] **Step 2: Generate the icons**

Run: `node addin/scripts/make-icons.mjs`
Expected: prints the confirmation; `addin/assets/icon-16.png`, `icon-32.png`, `icon-80.png` exist. Verify they are valid PNGs: `file addin/assets/icon-32.png` reports "PNG image data, 32 x 32".

- [ ] **Step 3: Write the manifest (dev URLs at localhost:3000)**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<OfficeApp xmlns="http://schemas.microsoft.com/office/appforoffice/1.1"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:bt="http://schemas.microsoft.com/office/officeappbasictypes/1.0"
  xmlns:mailappor="http://schemas.microsoft.com/office/mailappversionoverrides/1.0"
  xsi:type="MailApp">
  <Id>4d6c3b2a-1e9f-4a7b-9c2d-7e1f0a8b5c63</Id>
  <Version>1.0.0.0</Version>
  <ProviderName>Daybreak</ProviderName>
  <DefaultLocale>en-US</DefaultLocale>
  <DisplayName DefaultValue="Daybreak" />
  <Description DefaultValue="Tag an outgoing message for the recipient's Daybreak triage queue." />
  <IconUrl DefaultValue="https://localhost:3000/assets/icon-32.png" />
  <HighResolutionIconUrl DefaultValue="https://localhost:3000/assets/icon-80.png" />
  <AppDomains>
    <AppDomain>https://localhost:3000</AppDomain>
  </AppDomains>
  <Hosts>
    <Host Name="Mailbox" />
  </Hosts>
  <Requirements>
    <Sets>
      <Set Name="Mailbox" MinVersion="1.8" />
    </Sets>
  </Requirements>
  <FormSettings>
    <Form xsi:type="ItemEdit">
      <DesktopSettings>
        <SourceLocation DefaultValue="https://localhost:3000/src/taskpane.html" />
      </DesktopSettings>
    </Form>
  </FormSettings>
  <Permissions>ReadWriteItem</Permissions>
  <Rule xsi:type="RuleCollection" Mode="Or">
    <Rule xsi:type="ItemIs" ItemType="Message" FormType="Edit" />
  </Rule>
  <VersionOverrides xmlns="http://schemas.microsoft.com/office/mailappversionoverrides" xsi:type="VersionOverridesV1_0">
    <Requirements>
      <bt:Sets DefaultMinVersion="1.8">
        <bt:Set Name="Mailbox" />
      </bt:Sets>
    </Requirements>
    <Hosts>
      <Host xsi:type="MailHost">
        <DesktopFormFactor>
          <ExtensionPoint xsi:type="MessageComposeCommandSurface">
            <OfficeTab id="TabDefault">
              <Group id="daybreakGroup">
                <Label resid="groupLabel" />
                <Control xsi:type="Button" id="daybreakOpenPane">
                  <Label resid="btnLabel" />
                  <Supertip>
                    <Title resid="btnLabel" />
                    <Description resid="btnTip" />
                  </Supertip>
                  <Icon>
                    <bt:Image size="16" resid="icon16" />
                    <bt:Image size="32" resid="icon32" />
                    <bt:Image size="80" resid="icon80" />
                  </Icon>
                  <Action xsi:type="ShowTaskpane">
                    <SourceLocation resid="paneUrl" />
                  </Action>
                </Control>
              </Group>
            </OfficeTab>
          </ExtensionPoint>
        </DesktopFormFactor>
      </Host>
    </Hosts>
    <Resources>
      <bt:Images>
        <bt:Image id="icon16" DefaultValue="https://localhost:3000/assets/icon-16.png" />
        <bt:Image id="icon32" DefaultValue="https://localhost:3000/assets/icon-32.png" />
        <bt:Image id="icon80" DefaultValue="https://localhost:3000/assets/icon-80.png" />
      </bt:Images>
      <bt:Urls>
        <bt:Url id="paneUrl" DefaultValue="https://localhost:3000/src/taskpane.html" />
      </bt:Urls>
      <bt:ShortStrings>
        <bt:String id="groupLabel" DefaultValue="Daybreak" />
        <bt:String id="btnLabel" DefaultValue="Daybreak" />
      </bt:ShortStrings>
      <bt:LongStrings>
        <bt:String id="btnTip" DefaultValue="Tag this message for the recipient's Daybreak triage queue." />
      </bt:LongStrings>
    </Resources>
  </VersionOverrides>
</OfficeApp>
```

Note: the `https://localhost:3000` URLs are for dev sideloading. At deploy time you replace all five occurrences with your GitHub Pages base (see `addin/README.md`, Task 5). This is a deploy parameter, not a placeholder.

- [ ] **Step 4: Validate the manifest**

Run: `npx -y office-addin-manifest validate addin/manifest.xml`
Expected: "The manifest is valid." (If the validator flags the `Mailbox 1.8` floor for `bcc.addAsync`, raise the MinVersion to the value it reports and re-run; record the change.)

- [ ] **Step 5: Commit**

```bash
git add addin/scripts/make-icons.mjs addin/assets addin/manifest.xml
git commit -m "feat(addin): XML manifest and generated icons"
```

---

## Task 5: README + manual verification

**Files:**
- Create: `addin/README.md`

- [ ] **Step 1: Write the README**

````markdown
# Daybreak Outlook compose add-in

Tags an outgoing message with `X-PTO-Triage` so it lands in the recipient's Daybreak
queue. Static task pane + Office.js, no build, no server.

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
- Pick "Action needed", choose a date, leave bcc empty, click Apply -> status shows "Tagged. Send when ready."
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
````

- [ ] **Step 2: Final full suite**

Run: `npm test`
Expected: all tests pass (the add-in adds only `addin/tests/tag.test.js`; the rest of the add-in is static/integration).

- [ ] **Step 3: Commit**

```bash
git add addin/README.md
git commit -m "docs(addin): dev sideload, verification, and deploy instructions"
```

- [ ] **Step 4: Manual verification (user-gated, requires Outlook + M365)**

Follow `addin/README.md` "Verify (manual)". This is the user's step; it needs a live Outlook compose window and the user's mailbox, which cannot be automated here.

---

## Self-Review (completed by plan author)

**Spec coverage:**
- Four `X-PTO-Triage` intents, exact values matching `parseSenderTag` - Task 1 (`buildTagValue`), confirmed against `src/scoring/sender-tag.ts` (`blocked`/`whenever`/`fyi`/`action;by=<date>`).
- Vanilla static task pane, no build - Tasks 2, 3 (HTML/CSS + ES-module JS, Office.js from CDN).
- bcc routing to non-recipients - Task 3 (`bcc.addAsync`, gated by `validateBccAddress`).
- Classic XML manifest, Mailbox 1.8, ReadWriteItem, compose extension point - Task 4.
- Pure logic unit-tested, Office/manifest manual - Task 1 (Vitest) vs Tasks 3-5 (sideload).
- GitHub Pages hosting + M365 admin-center deployment - Task 5 README (deploy steps, flagged).
- Security posture (metadata only, no server, no Daybreak coupling) - the add-in imports nothing from the app and calls no network beyond Office.js CDN.

**Deferred (per spec / YAGNI):** per-recipient differentiation (one header per message), the unified JSON manifest, an options surface, a message-id correlation fallback, OOO auto-detection. Not built; noted so they are not mistaken for gaps.

**Placeholder scan:** none. The `localhost:3000` manifest URLs are a real dev/deploy parameter (swapped to the Pages base at deploy, documented in Task 5), analogous to the env vars in the Plan 2 prerequisites - not an incomplete-plan placeholder.

**Type consistency:** `buildTagValue`/`formatByDate`/`validateBccAddress` (Task 1) are imported and called in `taskpane.js` (Task 3) with matching signatures. The header name constant `X-PTO-Triage` in `taskpane.js` matches the value the recipient parser reads. The manifest `resid` ids (icon16/32/80, paneUrl, groupLabel, btnLabel, btnTip) are each defined in `<Resources>` and referenced in the control - no dangling resid.

## Known v1 limitations (intentional, documented)
- One `X-PTO-Triage` per message, applied to all recipients (per-recipient differentiation deferred).
- bcc routing means the routed person gets an email copy (the local-first, server-less trade-off).
- Icons are solid-color placeholders from the generator; a designed icon can replace them later.
- The add-in is plain JS and not part of the TypeScript typecheck; only its pure logic is unit-tested, by design.
