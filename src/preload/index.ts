// src/preload/index.ts
import { contextBridge, ipcRenderer } from 'electron';

// The full typed API is filled in once IPC handlers exist (Task 10). For now the
// bridge proves contextIsolation wiring end to end.
contextBridge.exposeInMainWorld('daybreak', {
  ping: (): Promise<string> => ipcRenderer.invoke('daybreak:ping'),
});
