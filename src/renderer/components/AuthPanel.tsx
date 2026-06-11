// src/renderer/components/AuthPanel.tsx
import { KeyRound } from 'lucide-react';

// Mirrors the AuthPrompt union emitted by the ingest layer. Microsoft uses a
// device code (visit a URL, type a code); Google uses a loopback redirect that the
// main process opens automatically, so the panel just confirms a tab has opened.
export type AuthPrompt =
  | { provider: 'microsoft'; verificationUri: string; userCode: string; message?: string }
  | { provider: 'google'; url: string };

export function AuthPanel(prompt: AuthPrompt) {
  return (
    <div className="elev-panel rounded-xl border border-week bg-week-tint p-5">
      <div className="mb-4 grid h-10 w-10 place-items-center rounded-lg bg-week/15 text-week">
        <KeyRound size={18} strokeWidth={2} />
      </div>
      {prompt.provider === 'google' ? (
        <>
          <p className="text-[14px] font-semibold text-ink">Sign in to Google</p>
          <p className="mt-2 text-[13px] text-ink-2 leading-relaxed">
            A browser tab has opened for you to approve access. If it did not,{' '}
            <a href={prompt.url} target="_blank" rel="noreferrer" className="font-medium text-accent underline">
              open it here
            </a>
            . Daybreak only requests read-only access to your mail.
          </p>
        </>
      ) : (
        <>
          <p className="text-[14px] font-semibold text-ink">Sign in to Microsoft</p>
          <p className="mt-2 text-[13px] text-ink-2 leading-relaxed">
            Open{' '}
            <span className="font-mono text-ink">{prompt.verificationUri}</span>
            {' '}and enter code{' '}
            <span className="font-mono text-[16px] font-bold tracking-widest text-ink">{prompt.userCode}</span>.
          </p>
        </>
      )}
    </div>
  );
}
