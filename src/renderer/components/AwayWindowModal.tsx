// src/renderer/components/AwayWindowModal.tsx
import { useState } from 'react';
import { CalendarDays } from 'lucide-react';

// Manual override for the catch-up window. By default Daybreak catches up since you
// last opened it, so this is opt-in: pick a date to see everything tagged for you
// since then. onCancel is provided when opened as a mid-session dialog.
export function AwayWindowModal({
  onSubmit,
  onCancel,
  error,
}: {
  onSubmit: (sinceISO: string) => void;
  onCancel?: () => void;
  error: string | null;
}) {
  const [date, setDate] = useState('');
  return (
    <div className="fixed inset-0 z-30 grid place-items-center bg-black/50 px-6" onClick={onCancel}>
      <div className="elev-pop w-full max-w-md rounded-2xl p-7" onClick={(e) => e.stopPropagation()}>
        <div className="mb-5 grid h-12 w-12 place-items-center rounded-xl bg-accent text-accent-ink">
          <CalendarDays size={24} strokeWidth={2.25} />
        </div>

        <h1 className="text-[20px] font-semibold tracking-[-0.02em] text-ink">Catch up since</h1>
        <p className="mt-1.5 text-[13px] text-ink-2">
          Pick a date to see everything tagged for you since then. By default Daybreak picks up where you last left off.
        </p>

        <label className="mt-5 block text-[13px] font-medium text-ink" htmlFor="since">Since</label>
        <input
          id="since"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="mt-1.5 w-full rounded-lg border border-line-strong bg-panel-2 text-ink px-3 py-2 text-[13px] transition-colors focus:border-accent outline-none"
        />

        {error && <p className="mt-2.5 text-[13px] text-today">{error}</p>}

        <div className="mt-5 flex items-center gap-2">
          <button
            type="button"
            disabled={!date}
            onClick={() => onSubmit(new Date(`${date}T00:00:00`).toISOString())}
            className="flex-1 rounded-lg bg-accent px-4 py-2.5 text-[13px] font-medium text-accent-ink transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            Apply window
          </button>
          {onCancel && (
            <button type="button" onClick={onCancel} className="rounded-lg border border-line px-4 py-2.5 text-[13px] font-medium text-ink-2 transition-colors hover:text-ink">
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
