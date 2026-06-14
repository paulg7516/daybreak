// src/main/ipc.ts
import { ipcMain, shell, BrowserWindow } from 'electron';
import { getOverlay, setAwayWindow, setLastOpenedAt, clearItem, unclearItem, rerankItem, getLaneConfig, setLaneConfig, getJiraConfig, setJiraConfig, getMailAccount, setMailAccount, clearMailAccount } from './store';
import { getMailStatus, connectMail, disconnectMail } from '../ingest/mail-account';
import type { LaneSetting } from '../app/lane-config';
import { storeJiraToken, clearJiraToken, getStoredJiraToken } from '../ingest/jsm-auth';
import { testJiraConnection } from './jira-test';
import { resolveCatchUpSince } from '../app/since';
import { buildView, isDemoMode } from './ingest-runner';
import { validateAwayWindow } from '../app/away-window';
import type { ViewResult } from '../app/ipc-types';
import type { Lane } from '../model/item';

function emit(channel: string, payload: unknown): void {
  for (const w of BrowserWindow.getAllWindows()) w.webContents.send(channel, payload);
}

// Guard the lane coming over IPC: a bogus value would persist into the re-rank
// overlay and make the item vanish from every lane (lanes are keyed by the Lane union).
const VALID_LANES = new Set<string>(['respond', 'approve', 'review', 'fyi']);

// A default 14-day away window for demo mode, so launching with DAYBREAK_DEMO drops
// straight into populated lanes without the away-window modal.
function demoSince(): string {
  return new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
}

// The "catch up since" boundary for this run. An explicit away window wins;
// otherwise it is "since you last opened Daybreak", computed once per process so
// refreshes within a session do not keep sliding the window forward to now.
let sessionSince: string | null = null;
function resolveSince(): string {
  if (isDemoMode()) return demoSince();
  const overlay = getOverlay();
  if (overlay.awayWindow?.since) return overlay.awayWindow.since;
  if (sessionSince === null) {
    const now = new Date().toISOString();
    sessionSince = resolveCatchUpSince(overlay, now);
    setLastOpenedAt(now); // so the next launch catches up since this moment
  }
  return sessionSince;
}

// Resolves the current view as a value (never rejects): the renderer gets a
// TriageView or a typed error. buildView can throw on an ingest/auth failure, so
// it is caught here and surfaced as { error } rather than an untyped IPC rejection.
async function viewForCurrentWindow(): Promise<ViewResult> {
  try {
    return await buildView(resolveSince(), {
      onPhase: (phase, message) => {
        // For Google's loopback sign-in, open the consent URL automatically so the
        // user does not have to copy a long URL. Microsoft's device-code prompt is
        // shown in-app instead (it needs a short code typed in).
        if (phase === 'auth' && message) {
          try {
            const prompt = JSON.parse(message) as { provider?: string; url?: string };
            if (prompt.provider === 'google' && prompt.url) void shell.openExternal(prompt.url);
          } catch {
            /* ignore a malformed auth payload */
          }
        }
        emit('daybreak:ingest', { phase, message });
      },
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export function registerIpc(): void {
  ipcMain.handle('daybreak:getView', (): Promise<ViewResult> => viewForCurrentWindow());

  ipcMain.handle('daybreak:setAwayWindow', (_e, sinceISO: string): Promise<ViewResult> | ViewResult => {
    // Validate before persisting so a future/garbage date returns a clean message
    // instead of being written to the store and surfacing as a Graph error.
    const check = validateAwayWindow(sinceISO, new Date().toISOString());
    if (!check.ok) return { error: check.reason };
    setAwayWindow(sinceISO, new Date().toISOString());
    return viewForCurrentWindow();
  });

  ipcMain.handle('daybreak:refresh', (): Promise<ViewResult> => viewForCurrentWindow());

  ipcMain.handle('daybreak:clearItem', (_e, id: string) => { clearItem(id); });
  ipcMain.handle('daybreak:unclearItem', (_e, id: string) => { unclearItem(id); });
  ipcMain.handle('daybreak:rerankItem', (_e, id: string, lane: Lane) => {
    if (id && VALID_LANES.has(lane)) rerankItem(id, lane);
  });

  ipcMain.handle('daybreak:getLaneConfig', () => getLaneConfig());
  ipcMain.handle('daybreak:setLaneConfig', (_e, config: LaneSetting[]) => { setLaneConfig(config); });

  ipcMain.handle('daybreak:getJiraConfig', async () => {
    const j = getJiraConfig();
    const token = await getStoredJiraToken();
    return { baseUrl: j?.baseUrl ?? '', email: j?.email ?? '', hasToken: !!token };
  });
  ipcMain.handle('daybreak:setJiraConfig', async (_e, input: { baseUrl: string; email: string; token?: string }) => {
    setJiraConfig(input.baseUrl, input.email);
    if (input.token) await storeJiraToken(input.token);
  });
  ipcMain.handle('daybreak:testJiraConnection', (_e, input: { baseUrl: string; email: string; token?: string }) =>
    testJiraConnection(input),
  );
  ipcMain.handle('daybreak:clearJiraToken', () => clearJiraToken());

  ipcMain.handle('daybreak:getMailStatus', () => getMailStatus(getMailAccount()));
  ipcMain.handle('daybreak:connectMail', async () => {
    try {
      const { address } = await connectMail((prompt) => {
        // Gmail uses a loopback redirect we can open directly; Microsoft shows a code.
        if (prompt.provider === 'google') void shell.openExternal(prompt.url);
        emit('daybreak:ingest', { phase: 'auth', message: JSON.stringify(prompt) });
      });
      setMailAccount(address);
      emit('daybreak:ingest', { phase: 'done' });
      return { ok: true as const, account: address };
    } catch (err) {
      emit('daybreak:ingest', { phase: 'done' });
      return { ok: false as const, error: err instanceof Error ? err.message : String(err) };
    }
  });
  ipcMain.handle('daybreak:disconnectMail', async () => { await disconnectMail(); clearMailAccount(); });

  ipcMain.handle('daybreak:openItem', async (_e, webLink: string) => {
    if (!webLink) return;
    // Defence in depth: webLinks come from our own ingest, but only ever hand
    // http(s) URLs to the OS, never file:// or other schemes.
    let parsed: URL;
    try {
      parsed = new URL(webLink);
    } catch {
      return;
    }
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      await shell.openExternal(webLink);
    }
  });
}
