// src/main/ipc.ts
import { ipcMain, shell, BrowserWindow } from 'electron';
import { getOverlay, setAwayWindow, clearItem, unclearItem, rerankItem } from './store';
import { buildView } from './ingest-runner';
import type { Lane } from '../model/item';

function emit(channel: string, payload: unknown): void {
  for (const w of BrowserWindow.getAllWindows()) w.webContents.send(channel, payload);
}

async function viewForCurrentWindow() {
  const overlay = getOverlay();
  if (!overlay.awayWindow) return { needsAwayWindow: true as const };
  return buildView(overlay.awayWindow.since, {
    onPhase: (phase, message) => emit('daybreak:ingest', { phase, message }),
  });
}

export function registerIpc(): void {
  ipcMain.handle('daybreak:getView', () => viewForCurrentWindow());

  ipcMain.handle('daybreak:setAwayWindow', (_e, sinceISO: string) => {
    setAwayWindow(sinceISO, new Date().toISOString());
    return viewForCurrentWindow();
  });

  ipcMain.handle('daybreak:refresh', () => viewForCurrentWindow());

  ipcMain.handle('daybreak:clearItem', (_e, id: string) => { clearItem(id); });
  ipcMain.handle('daybreak:unclearItem', (_e, id: string) => { unclearItem(id); });
  ipcMain.handle('daybreak:rerankItem', (_e, id: string, lane: Lane) => { rerankItem(id, lane); });

  ipcMain.handle('daybreak:openItem', async (_e, webLink: string) => {
    if (webLink) await shell.openExternal(webLink);
  });
}
