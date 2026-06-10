// src/renderer/components/IngestStatus.tsx
import { Loader2, AlertTriangle } from 'lucide-react';

export function IngestStatus({
  phase,
  message,
  onRetry,
}: {
  phase: 'idle' | 'fetching' | 'scoring' | 'error';
  message?: string;
  onRetry: () => void;
}) {
  if (phase === 'error') {
    return (
      <div className="elev-panel rounded-xl border border-today p-5">
        <div className="flex items-start gap-3">
          <AlertTriangle size={16} strokeWidth={2} className="mt-0.5 shrink-0 text-today" />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-today">Could not load your backlog</p>
            {message && <p className="mt-1 text-[13px] text-ink-2">{message}</p>}
          </div>
        </div>
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 rounded-lg border border-today bg-today/10 px-4 py-1.5 text-[13px] font-medium text-today transition-colors hover:bg-today hover:text-white"
        >
          Retry
        </button>
      </div>
    );
  }
  const label = phase === 'scoring' ? 'Scoring your backlog...' : 'Fetching your mail...';
  return (
    <div className="flex items-center justify-center gap-2.5 p-6 text-[13px] text-ink-3">
      <Loader2 size={14} strokeWidth={2} className="animate-spin text-accent" />
      {label}
    </div>
  );
}
