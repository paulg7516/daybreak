// src/renderer/components/AwayWindowModal.tsx
import { useState } from 'react';
import { Sunrise } from 'lucide-react';

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
      <div className="elev-pop w-full max-w-md rounded-2xl p-7">
        {/* Icon badge */}
        <div className="mb-5 grid h-12 w-12 place-items-center rounded-xl bg-accent/15 text-accent">
          <Sunrise size={24} strokeWidth={2} />
        </div>

        <h1 className="text-[20px] font-semibold tracking-[-0.02em] text-ink">Welcome back</h1>
        <p className="mt-1.5 text-[13px] text-ink-2">
          Daybreak will sort what happened while you were out. When did you go out?
        </p>

        <label className="mt-5 block text-[13px] font-medium text-ink" htmlFor="since">
          I was out since
        </label>
        <input
          id="since"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="mt-1.5 w-full rounded-lg border border-line-strong bg-panel-2 text-ink px-3 py-2 text-[13px] transition-colors focus:border-accent outline-none"
        />

        {error && <p className="mt-2.5 text-[13px] text-today">{error}</p>}

        <button
          type="button"
          disabled={!date}
          onClick={() => onSubmit(new Date(`${date}T00:00:00`).toISOString())}
          className="mt-5 w-full rounded-lg bg-accent px-4 py-2.5 text-[13px] font-medium text-accent-ink transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          Show my backlog
        </button>
      </div>
    </div>
  );
}
