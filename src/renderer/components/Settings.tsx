// src/renderer/components/Settings.tsx
import { useState } from 'react';
import { Settings as SettingsIcon } from 'lucide-react';
import type { LaneSetting } from '../../app/lane-config';
import { LanesSettings } from './LanesSettings';
import { JiraSettings, type JiraConfigView, type JiraTestResult } from './JiraSettings';

type Tab = 'lanes' | 'sources';

// Settings renders inside the app shell (the left nav rail stays visible), not as a
// full-screen takeover. Tabs: Lanes (rename / hide / reorder) and Sources (Jira).
export function Settings({
  laneConfig,
  onSaveLaneConfig,
  jiraConfig,
  onSaveJira,
  onTestJira,
  onClearJiraToken,
}: {
  laneConfig: LaneSetting[];
  onSaveLaneConfig: (config: LaneSetting[]) => void;
  jiraConfig: JiraConfigView;
  onSaveJira: (input: { baseUrl: string; email: string; token?: string }) => Promise<void>;
  onTestJira: (input: { baseUrl: string; email: string; token?: string }) => Promise<JiraTestResult>;
  onClearJiraToken: () => void;
}) {
  const [tab, setTab] = useState<Tab>('lanes');
  const tabClass = (t: Tab) =>
    `rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors ${tab === t ? 'bg-accent/15 text-accent' : 'text-ink-2 hover:text-ink'}`;

  return (
    <div className="mx-auto max-w-2xl px-6 py-6">
      <div className="mb-5 flex items-center gap-2">
        <SettingsIcon size={16} strokeWidth={2} className="text-accent" />
        <h1 className="text-[18px] font-semibold tracking-[-0.01em]">Settings</h1>
      </div>

      <div className="mb-5 flex gap-1 border-b border-line pb-3">
        <button type="button" className={tabClass('lanes')} onClick={() => setTab('lanes')}>Lanes</button>
        <button type="button" className={tabClass('sources')} onClick={() => setTab('sources')}>Sources</button>
      </div>

      {tab === 'lanes' ? (
        <LanesSettings config={laneConfig} onChange={onSaveLaneConfig} />
      ) : (
        <div className="elev-panel rounded-xl p-6">
          <JiraSettings config={jiraConfig} onSave={onSaveJira} onTest={onTestJira} onClearToken={onClearJiraToken} />
        </div>
      )}
    </div>
  );
}
