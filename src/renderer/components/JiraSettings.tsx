// src/renderer/components/JiraSettings.tsx
import { useState } from 'react';
import { Ticket, CheckCircle2, XCircle } from 'lucide-react';

export interface JiraConfigView { baseUrl: string; email: string; hasToken: boolean }
export type JiraTestResult = { ok: true; displayName: string } | { ok: false; error: string };

export function JiraSettings({
  config,
  onSave,
  onTest,
  onClearToken,
}: {
  config: JiraConfigView;
  onSave: (input: { baseUrl: string; email: string; token?: string }) => Promise<void>;
  onTest: (input: { baseUrl: string; email: string; token?: string }) => Promise<JiraTestResult>;
  onClearToken: () => void;
}) {
  const [baseUrl, setBaseUrl] = useState(config.baseUrl);
  const [email, setEmail] = useState(config.email);
  const [token, setToken] = useState('');
  const [status, setStatus] = useState<{ kind: 'ok' | 'err' | 'info'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const inputClass = 'w-full rounded-lg border border-line-strong bg-panel text-ink px-3 py-2 text-[13px] transition-colors focus:border-accent outline-none placeholder:text-ink-3';

  function payload() {
    return { baseUrl: baseUrl.trim(), email: email.trim(), token: token.trim() || undefined };
  }

  async function save() {
    setBusy(true);
    try {
      await onSave(payload());
      setToken('');
      setStatus({ kind: 'info', text: 'Saved.' });
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setBusy(true);
    setStatus({ kind: 'info', text: 'Testing...' });
    const r = await onTest(payload());
    setStatus(r.ok ? { kind: 'ok', text: `Connected as ${r.displayName}` } : { kind: 'err', text: r.error });
    setBusy(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-[12px] text-ink-2">
        <Ticket size={14} className="text-accent" />
        Connect Jira Service Management to pull your assigned tickets.
      </div>

      <label className="block text-[13px]">
        <span className="mb-1 block font-medium">Base URL</span>
        <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://yourcompany.atlassian.net" className={inputClass} />
      </label>
      <label className="block text-[13px]">
        <span className="mb-1 block font-medium">Account email</span>
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" className={inputClass} />
      </label>
      <label className="block text-[13px]">
        <span className="mb-1 block font-medium">API token</span>
        <input aria-label="API token" type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder={config.hasToken ? 'token set - type to replace' : 'paste your Atlassian API token'} className={inputClass} />
      </label>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" disabled={busy} onClick={save} className="rounded-lg bg-accent px-4 py-2 text-[13px] font-medium text-accent-ink transition-opacity hover:opacity-90 disabled:opacity-50">Save</button>
        <button type="button" disabled={busy} onClick={test} className="rounded-lg border border-line-strong bg-panel px-4 py-2 text-[13px] font-medium text-ink-2 transition-colors hover:text-ink hover:border-ink-3 disabled:opacity-50">Test connection</button>
        {config.hasToken && (
          <button type="button" onClick={onClearToken} className="ml-auto text-[12px] text-ink-3 transition-colors hover:text-today">Clear token</button>
        )}
      </div>

      {status && (
        <p className={`flex items-center gap-1.5 text-[12px] ${status.kind === 'ok' ? 'text-good' : status.kind === 'err' ? 'text-today' : 'text-ink-3'}`}>
          {status.kind === 'ok' && <CheckCircle2 size={13} />}
          {status.kind === 'err' && <XCircle size={13} />}
          {status.text}
        </p>
      )}
    </div>
  );
}
