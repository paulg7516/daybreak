// src/renderer/components/AuthPanel.tsx
import { KeyRound } from 'lucide-react';

export function AuthPanel({ verificationUri, userCode }: { verificationUri: string; userCode: string }) {
  return (
    <div className="elev-panel rounded-xl border border-week bg-week-tint p-5">
      <div className="mb-4 grid h-10 w-10 place-items-center rounded-lg bg-week/15 text-week">
        <KeyRound size={18} strokeWidth={2} />
      </div>
      <p className="text-[14px] font-semibold text-ink">Sign in to Microsoft</p>
      <p className="mt-2 text-[13px] text-ink-2 leading-relaxed">
        Open{' '}
        <span className="font-mono text-ink">{verificationUri}</span>
        {' '}and enter code{' '}
        <span className="font-mono text-[16px] font-bold tracking-widest text-ink">{userCode}</span>.
      </p>
    </div>
  );
}
