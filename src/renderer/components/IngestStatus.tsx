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
      <div className="rounded-lg border border-red-300 bg-red-50 dark:bg-red-950 dark:border-red-700 p-4">
        <p className="font-medium text-red-700 dark:text-red-300">Could not load your backlog</p>
        {message && <p className="mt-1 text-sm">{message}</p>}
        <button type="button" onClick={onRetry} className="mt-3 rounded bg-red-600 px-3 py-1.5 text-sm text-white">
          Retry
        </button>
      </div>
    );
  }
  const label = phase === 'scoring' ? 'Scoring your backlog...' : 'Fetching your mail...';
  return <p className="p-6 text-center text-sm text-slate-500">{label}</p>;
}
