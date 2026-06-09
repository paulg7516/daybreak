// src/preload/index.ts
import { contextBridge, ipcRenderer } from 'electron';
import type { Lane } from '../model/item';
import type { TriageView } from '../app/view-model';

export interface DaybreakBridge {
  getView(): Promise<TriageView | { needsAwayWindow: true }>;
  setAwayWindow(sinceISO: string): Promise<TriageView | { needsAwayWindow: true }>;
  refresh(): Promise<TriageView | { needsAwayWindow: true }>;
  clearItem(id: string): Promise<void>;
  unclearItem(id: string): Promise<void>;
  rerankItem(id: string, lane: Lane): Promise<void>;
  openItem(webLink: string): Promise<void>;
  onIngest(cb: (p: { phase: string; message?: string }) => void): () => void;
}

const api: DaybreakBridge = {
  getView: () => ipcRenderer.invoke('daybreak:getView'),
  setAwayWindow: (s) => ipcRenderer.invoke('daybreak:setAwayWindow', s),
  refresh: () => ipcRenderer.invoke('daybreak:refresh'),
  clearItem: (id) => ipcRenderer.invoke('daybreak:clearItem', id),
  unclearItem: (id) => ipcRenderer.invoke('daybreak:unclearItem', id),
  rerankItem: (id, lane) => ipcRenderer.invoke('daybreak:rerankItem', id, lane),
  openItem: (webLink) => ipcRenderer.invoke('daybreak:openItem', webLink),
  onIngest: (cb) => {
    const handler = (_e: unknown, p: { phase: string; message?: string }) => cb(p);
    ipcRenderer.on('daybreak:ingest', handler);
    return () => ipcRenderer.removeListener('daybreak:ingest', handler);
  },
};

contextBridge.exposeInMainWorld('daybreak', api);
