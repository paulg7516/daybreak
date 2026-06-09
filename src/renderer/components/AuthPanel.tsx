// src/renderer/components/AuthPanel.tsx
export function AuthPanel({ verificationUri, userCode }: { verificationUri: string; userCode: string }) {
  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950 dark:border-amber-700 p-4">
      <p className="font-medium">Sign in to Microsoft</p>
      <p className="mt-1 text-sm">
        Open <span className="font-mono">{verificationUri}</span> and enter code{' '}
        <span className="font-mono font-semibold tracking-widest">{userCode}</span>.
      </p>
    </div>
  );
}
