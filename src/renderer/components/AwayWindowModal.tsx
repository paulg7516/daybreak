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
    <div className="min-h-dvh grid place-items-center bg-slate-50 dark:bg-slate-900 px-6">
      <div className="w-full max-w-md rounded-xl border border-slate-200 dark:border-slate-700 p-6">
        <h1 className="text-xl font-semibold">Welcome back</h1>
        <p className="mt-1 text-sm text-slate-500">
          Daybreak will sort what happened while you were out. When did you go out?
        </p>
        <label className="mt-4 block text-sm font-medium" htmlFor="since">
          I was out since
        </label>
        <input
          id="since"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="mt-1 w-full rounded border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2"
        />
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        <button
          type="button"
          disabled={!date}
          onClick={() => onSubmit(new Date(`${date}T00:00:00.000Z`).toISOString())}
          className="mt-4 w-full rounded bg-blue-600 px-4 py-2 font-medium text-white disabled:opacity-40"
        >
          Show my backlog
        </button>
      </div>
    </div>
  );
}
