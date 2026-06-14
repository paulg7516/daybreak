// src/renderer/components/DataSources.tsx
// Settings "Data sources" panel. For now this surfaces the primary integration -
// Microsoft 365 (Outlook) - as a single clean card. Gmail and Jira remain wired in
// the backend but are hidden here until they are part of the product story.
import { Loader2 } from 'lucide-react';
import type { MailStatus } from '../../app/ipc-types';
import type { JiraConfigView, JiraTestResult } from './JiraSettings';

function MicrosoftLogo() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <rect x="2" y="2" width="9" height="9" fill="#F25022" />
      <rect x="13" y="2" width="9" height="9" fill="#7FBA00" />
      <rect x="2" y="13" width="9" height="9" fill="#00A4EF" />
      <rect x="13" y="13" width="9" height="9" fill="#FFB900" />
    </svg>
  );
}

type Dot = 'good' | 'idle' | 'warn';
function Status({ dot, text }: { dot: Dot; text: string }) {
  const color = dot === 'good' ? 'bg-good' : dot === 'warn' ? 'bg-week' : 'bg-ink-3';
  return (
    <span className="mt-3 inline-flex items-center gap-2 text-[13px] text-ink-2">
      <span className={`h-1.5 w-1.5 rounded-full ${color}`} aria-hidden="true" />
      {text}
    </span>
  );
}

const btnPrimary =
  'rounded-lg bg-accent px-4 py-2 text-[13px] font-medium text-accent-ink transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-default';
const btnGhost =
  'rounded-lg border border-line-strong px-4 py-2 text-[13px] font-medium text-ink-2 transition-colors hover:text-ink hover:border-ink-3';

export function DataSources({
  mail,
  busy,
  onConnectMail,
  onDisconnectMail,
}: {
  mail: MailStatus | null;
  busy: boolean;
  onConnectMail: () => void;
  onDisconnectMail: () => void;
  // Kept for compatibility; Jira/Gmail are hidden for now.
  jiraConfig: JiraConfigView;
  onSaveJira: (input: { baseUrl: string; email: string; token?: string }) => Promise<void>;
  onTestJira: (input: { baseUrl: string; email: string; token?: string }) => Promise<JiraTestResult>;
  onClearJiraToken: () => void;
}) {
  const graphActive = mail?.provider === 'graph';
  const graphConfigured = mail?.graphConfigured ?? false;
  const connected = graphActive && !!mail?.connected;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-[16px] font-semibold tracking-[-0.01em] text-ink">Data sources</h2>
        <p className="mt-1.5 max-w-md text-[13px] leading-relaxed text-ink-2">
          Where Daybreak reads what needs you. Sign-in happens on your Mac; credentials stay in your keychain, never here.
        </p>
      </div>

      <div className="elev-panel rounded-2xl p-6">
        <div className="flex items-start gap-4">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-line bg-white">
            <MicrosoftLogo />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[15px] font-semibold text-ink">Microsoft 365</div>
                <div className="mt-0.5 text-[13px] text-ink-2">Work mail and calendar from Outlook</div>
              </div>
              {connected ? (
                <button type="button" className={btnGhost} disabled={busy} onClick={onDisconnectMail}>Disconnect</button>
              ) : (
                <button
                  type="button"
                  className={btnPrimary}
                  disabled={!graphActive || !graphConfigured || busy}
                  onClick={onConnectMail}
                >
                  {busy ? <Loader2 size={14} className="animate-spin" /> : 'Connect'}
                </button>
              )}
            </div>
            <Status
              dot={connected ? 'good' : graphConfigured ? 'idle' : 'warn'}
              text={
                connected
                  ? mail?.account ?? 'Connected'
                  : graphConfigured
                    ? 'Not connected'
                    : 'Not connected · needs Azure setup'
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
}
