// src/renderer/components/AwayWindowModal.tsx
import { useState } from 'react';

export function AwayWindowModal({
  onSubmit,
  error,
}: {
  onSubmit: (sinceISO: string) => void;
  error: string | null;
}) {
  const [date, setDate] = useState('');
  return (
    <div className="min-h-dvh grid place-items-center bg-bg px-6">
      <div className="w-full max-w-md bg-surface rounded-xl border border-line shadow-sm p-6">
        <h1 className="text-[18px] font-semibold tracking-[-0.01em] text-ink">Welcome back</h1>
        <p className="mt-1 text-[13px] text-ink-2">
          Daybreak will sort what happened while you were out. When did you go out?
        </p>
        <label className="mt-4 block text-[13px] font-medium text-ink" htmlFor="since">
          I was out since
        </label>
        <input
          id="since"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="mt-1 w-full rounded-md border border-line-strong bg-surface text-ink px-3 py-2 text-[13px] transition-colors focus:border-brand outline-none"
        />
        {error && <p className="mt-2 text-[13px] text-today">{error}</p>}
        <button
          type="button"
          disabled={!date}
          onClick={() => onSubmit(new Date(`${date}T00:00:00`).toISOString())}
          className="mt-4 w-full rounded-md bg-brand px-4 py-2 text-[13px] font-medium text-white transition-colors hover:opacity-90 disabled:opacity-40"
        >
          Show my backlog
        </button>
      </div>
    </div>
  );
}
