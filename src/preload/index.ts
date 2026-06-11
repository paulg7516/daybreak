// src/preload/index.ts
import { contextBridge, ipcRenderer } from 'electron';
import type { DaybreakBridge } from '../app/ipc-types';

// DaybreakBridge is defined in the pure src/app/ipc-types module so the renderer
// can import the same type without pulling electron into its build.
const api: DaybreakBridge = {
  getView: () => ipcRenderer.invoke('daybreak:getView'),
  setAwayWindow: (s) => ipcRenderer.invoke('daybreak:setAwayWindow', s),
  refresh: () => ipcRenderer.invoke('daybreak:refresh'),
  clearItem: (id) => ipcRenderer.invoke('daybreak:clearItem', id),
  unclearItem: (id) => ipcRenderer.invoke('daybreak:unclearItem', id),
  rerankItem: (id, lane) => ipcRenderer.invoke('daybreak:rerankItem', id, lane),
  openItem: (webLink) => ipcRenderer.invoke('daybreak:openItem', webLink),
  getJiraConfig: () => ipcRenderer.invoke('daybreak:getJiraConfig'),
  setJiraConfig: (input) => ipcRenderer.invoke('daybreak:setJiraConfig', input),
  testJiraConnection: (input) => ipcRenderer.invoke('daybreak:testJiraConnection', input),
  clearJiraToken: () => ipcRenderer.invoke('daybreak:clearJiraToken'),
  onIngest: (cb) => {
    const handler = (_e: unknown, p: { phase: string; message?: string }) => cb(p);
    ipcRenderer.on('daybreak:ingest', handler);
    return () => ipcRenderer.removeListener('daybreak:ingest', handler);
  },
};

contextBridge.exposeInMainWorld('daybreak', api);
