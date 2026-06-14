// src/renderer/components/DataSources.tsx
// Settings "Data sources" panel: clean integration cards for the mail source
// (Microsoft 365 or Gmail) and Jira Service Management - each a logo, name, a
// status pill, and one action. The active mail provider is env/baked-selected;
// only that card is connectable, the other is informational.
import { Loader2 } from 'lucide-react';
import type { MailStatus } from '../../app/ipc-types';
import { JiraSettings, type JiraConfigView, type JiraTestResult } from './JiraSettings';

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
function GmailLogo() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path d="M3 6.5v11A1.5 1.5 0 0 0 4.5 19H6V9.2l6 4.5 6-4.5V19h1.5A1.5 1.5 0 0 0 21 17.5v-11l-9 6.75z" fill="#EA4335" opacity=".9" />
      <path d="M3 6.5 12 13.25 21 6.5A1.5 1.5 0 0 0 19.5 5h-15A1.5 1.5 0 0 0 3 6.5z" fill="#EA4335" />
    </svg>
  );
}
function JiraLogo() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path d="M12 2 22 12h-5a5 5 0 0 1-5-5z" fill="#2684FF" />
      <path d="M7 7 17 17h-5a5 5 0 0 1-5-5z" fill="#2684FF" opacity=".7" />
      <path d="M2 12 12 22H7a5 5 0 0 1-5-5z" fill="#2684FF" opacity=".5" />
    </svg>
  );
}

type Dot = 'good' | 'idle' | 'warn';
function Status({ dot, text }: { dot: Dot; text: string }) {
  const color = dot === 'good' ? 'bg-good' : dot === 'warn' ? 'bg-week' : 'bg-ink-3';
  return (
    <span className="mt-3 inline-flex items-center gap-2 text-[12px] text-ink-2">
      <span className={`h-1.5 w-1.5 rounded-full ${color}`} aria-hidden="true" />
      {text}
    </span>
  );
}

function Card({
  logo,
  name,
  sub,
  children,
}: {
  logo: React.ReactNode;
  name: string;
  sub: string;
  children: React.ReactNode;
}) {
  return (
    <div className="elev-panel rounded-xl p-5">
      <div className="flex items-start gap-3.5">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-line bg-white">{logo}</div>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}

const btnPrimary =
  'rounded-lg bg-accent px-3.5 py-1.5 text-[12px] font-medium text-accent-ink transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-default';
const btnGhost =
  'rounded-lg border border-line-strong px-3.5 py-1.5 text-[12px] font-medium text-ink-2 transition-colors hover:text-ink hover:border-ink-3';

export function DataSources({
  mail,
  busy,
  onConnectMail,
  onDisconnectMail,
  jiraConfig,
  onSaveJira,
  onTestJira,
  onClearJiraToken,
}: {
  mail: MailStatus | null;
  busy: boolean;
  onConnectMail: () => void;
  onDisconnectMail: () => void;
  jiraConfig: JiraConfigView;
  onSaveJira: (input: { baseUrl: string; email: string; token?: string }) => Promise<void>;
  onTestJira: (input: { baseUrl: string; email: string; token?: string }) => Promise<JiraTestResult>;
  onClearJiraToken: () => void;
}) {
  const provider = mail?.provider;
  const graphActive = provider === 'graph';
  const gmailActive = provider === 'gmail';
  const graphConfigured = mail?.graphConfigured ?? false;
  const graphConnected = graphActive && mail!.connected;
  const gmailConnected = gmailActive && mail!.connected;

  const Spin = busy ? <Loader2 size={13} className="animate-spin" /> : null;

  return (
    <div className="space-y-3">
      <div className="mb-1">
        <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-ink">Data sources</h2>
        <p className="mt-1 text-[12.5px] text-ink-2">
          Connect where your tagged items come from. Sign-in happens on your Mac; credentials live in your keychain, never here.
        </p>
      </div>

      {/* Microsoft 365 */}
      <Card logo={<MicrosoftLogo />} name="Microsoft 365" sub="Work mail · Outlook">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[14px] font-semibold text-ink">Microsoft 365</div>
            <div className="text-[12px] text-ink-2">Work mail · Outlook</div>
          </div>
          {graphConnected ? (
            <button type="button" className={btnGhost} disabled={busy} onClick={onDisconnectMail}>Disconnect</button>
          ) : (
            <button type="button" className={btnPrimary} disabled={!graphActive || !graphConfigured || busy} onClick={onConnectMail}>
              {graphActive && busy ? Spin : 'Connect'}
            </button>
          )}
        </div>
        <Status
          dot={graphConnected ? 'good' : graphConfigured ? 'idle' : 'warn'}
          text={graphConnected ? (mail!.account ?? 'Connected') : graphConfigured ? 'Not connected' : 'Not connected · needs Azure setup'}
        />
      </Card>

      {/* Gmail */}
      <Card logo={<GmailLogo />} name="Gmail" sub="Personal inbox · read-only">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[14px] font-semibold text-ink">Gmail</div>
            <div className="text-[12px] text-ink-2">Personal inbox · read-only</div>
          </div>
          {gmailConnected ? (
            <button type="button" className={btnGhost} disabled={busy} onClick={onDisconnectMail}>Disconnect</button>
          ) : gmailActive ? (
            <button type="button" className={btnPrimary} disabled={busy} onClick={onConnectMail}>{busy ? Spin : 'Connect'}</button>
          ) : null}
        </div>
        <Status
          dot={gmailConnected ? 'good' : 'idle'}
          text={gmailConnected ? (mail!.account ?? 'Connected') : gmailActive ? 'Not connected' : 'Not the active mail source'}
        />
      </Card>

      {/* Jira Service Management */}
      <Card logo={<JiraLogo />} name="Jira Service Management" sub="Tickets assigned to you">
        <div className="mb-1">
          <div className="text-[14px] font-semibold text-ink">Jira Service Management</div>
          <div className="text-[12px] text-ink-2">Tickets assigned to you</div>
        </div>
        <div className="mt-3 border-t border-line pt-4">
          <JiraSettings config={jiraConfig} onSave={onSaveJira} onTest={onTestJira} onClearToken={onClearJiraToken} />
        </div>
      </Card>
    </div>
  );
}
