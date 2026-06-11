// src/renderer/components/Settings.tsx
import { Settings as SettingsIcon } from 'lucide-react';
import { JiraSettings, type JiraConfigView, type JiraTestResult } from './JiraSettings';

// Settings renders inside the app shell (the left nav rail stays visible), not as a
// full-screen takeover. Declared-intent has no rules to configure, so the only
// surface today is Sources (the Jira connection). Lane rename/toggle/reorder is a
// planned tab here.
export function Settings({
  jiraConfig,
  onSaveJira,
  onTestJira,
  onClearJiraToken,
}: {
  jiraConfig: JiraConfigView;
  onSaveJira: (input: { baseUrl: string; email: string; token?: string }) => Promise<void>;
  onTestJira: (input: { baseUrl: string; email: string; token?: string }) => Promise<JiraTestResult>;
  onClearJiraToken: () => void;
}) {
  return (
    <div className="mx-auto max-w-2xl px-6 py-6">
      <div className="mb-5 flex items-center gap-2">
        <SettingsIcon size={16} strokeWidth={2} className="text-accent" />
        <h1 className="text-[18px] font-semibold tracking-[-0.01em]">Settings</h1>
      </div>
      <div className="mb-3 text-[11px] font-semibold uppercase tracking-[.04em] text-ink-3">Sources</div>
      <div className="elev-panel rounded-xl p-6">
        <JiraSettings config={jiraConfig} onSave={onSaveJira} onTest={onTestJira} onClearToken={onClearJiraToken} />
      </div>
    </div>
  );
}
