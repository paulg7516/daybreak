// src/renderer/components/IngestStatus.tsx
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
      <div className="rounded-lg border border-today bg-today-tint p-4 shadow-sm">
        <p className="text-[13px] font-semibold text-today">Could not load your backlog</p>
        {message && <p className="mt-1 text-[13px] text-ink-2">{message}</p>}
        <button type="button" onClick={onRetry} className="mt-3 rounded-md bg-today px-3 py-1.5 text-[13px] font-medium text-white transition-colors hover:opacity-90">
          Retry
        </button>
      </div>
    );
  }
  const label = phase === 'scoring' ? 'Scoring your backlog...' : 'Fetching your mail...';
  return <p className="p-6 text-center text-[13px] text-ink-3">{label}</p>;
}
