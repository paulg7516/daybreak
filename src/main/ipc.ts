// src/main/ipc.ts
import { ipcMain, shell, BrowserWindow } from 'electron';
import { getOverlay, setAwayWindow, clearItem, unclearItem, rerankItem } from './store';
import { buildView, isDemoMode } from './ingest-runner';
import { validateAwayWindow } from '../app/away-window';
import type { ViewResult } from '../app/ipc-types';
import type { Lane } from '../model/item';

function emit(channel: string, payload: unknown): void {
  for (const w of BrowserWindow.getAllWindows()) w.webContents.send(channel, payload);
}

// A default 14-day away window for demo mode, so launching with DAYBREAK_DEMO drops
// straight into populated lanes without the away-window modal.
function demoSince(): string {
  return new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
}

// Resolves the current view as a value (never rejects): the renderer gets a
// TriageView, needsAwayWindow, or a typed error. buildView can throw on a Graph
// or auth failure, so it is caught here and surfaced as { error } rather than an
// untyped IPC rejection.
async function viewForCurrentWindow(): Promise<ViewResult> {
  const overlay = getOverlay();
  const since = overlay.awayWindow?.since ?? (isDemoMode() ? demoSince() : null);
  if (!since) return { needsAwayWindow: true };
  try {
    return await buildView(since, {
      onPhase: (phase, message) => emit('daybreak:ingest', { phase, message }),
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
  ipcMain.handle('daybreak:rerankItem', (_e, id: string, lane: Lane) => { rerankItem(id, lane); });

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
