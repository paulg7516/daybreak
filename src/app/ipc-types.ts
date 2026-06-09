// src/app/ipc-types.ts
// Pure shared contract between the Electron main process and the renderer. No
// electron or DOM imports, so both the node and renderer tsconfig projects can
// import it without pulling in process-specific globals.
import type { Lane } from '../model/item';
import type { TriageView } from './view-model';

// The result of asking main for the current view. A discriminated union so the
// renderer can pattern-match instead of try/catch around the IPC call:
// - a TriageView to render,
// - needsAwayWindow when the user has not set an away window yet,
// - error with a user-facing message when ingest/validation failed.
export type ViewResult =
  | TriageView
  | { needsAwayWindow: true }
  | { error: string };

// A progress/auth event pushed on the daybreak:ingest channel during a refresh.
export interface IngestEventPayload {
  phase: string;
  message?: string;
}

export interface DaybreakBridge {
  getView(): Promise<ViewResult>;
  setAwayWindow(sinceISO: string): Promise<ViewResult>;
  refresh(): Promise<ViewResult>;
  clearItem(id: string): Promise<void>;
  unclearItem(id: string): Promise<void>;
  rerankItem(id: string, lane: Lane): Promise<void>;
  openItem(webLink: string): Promise<void>;
  onIngest(cb: (p: IngestEventPayload) => void): () => void;
}
