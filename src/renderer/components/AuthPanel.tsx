// src/renderer/components/AuthPanel.tsx
export function AuthPanel({ verificationUri, userCode }: { verificationUri: string; userCode: string }) {
  return (
    <div className="rounded-lg border border-week bg-week-tint p-4 shadow-sm">
      <p className="text-[13px] font-semibold text-ink">Sign in to Microsoft</p>
      <p className="mt-1 text-[13px] text-ink-2">
        Open <span className="font-mono text-ink">{verificationUri}</span> and enter code{' '}
        <span className="font-mono font-semibold tracking-widest text-ink">{userCode}</span>.
      </p>
    </div>
  );
}
