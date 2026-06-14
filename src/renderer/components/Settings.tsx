// src/renderer/components/Settings.tsx
import { useState } from 'react';
import { Settings as SettingsIcon, Database, Rows3 } from 'lucide-react';
import type { LaneSetting } from '../../app/lane-config';
import type { MailStatus } from '../../app/ipc-types';
import { LanesSettings } from './LanesSettings';
import { DataSources } from './DataSources';
import type { JiraConfigView, JiraTestResult } from './JiraSettings';

type Section = 'sources' | 'lanes';

// Settings renders inside the app shell (the left nav rail stays visible). A small
// SaaS-style sidebar splits Data sources (integration cards) from Lanes.
export function Settings({
  laneConfig,
  onSaveLaneConfig,
  jiraConfig,
  onSaveJira,
  onTestJira,
  onClearJiraToken,
  mailStatus,
  mailBusy,
  onConnectMail,
  onDisconnectMail,
}: {
  laneConfig: LaneSetting[];
  onSaveLaneConfig: (config: LaneSetting[]) => void;
  jiraConfig: JiraConfigView;
  onSaveJira: (input: { baseUrl: string; email: string; token?: string }) => Promise<void>;
  onTestJira: (input: { baseUrl: string; email: string; token?: string }) => Promise<JiraTestResult>;
  onClearJiraToken: () => void;
  mailStatus: MailStatus | null;
  mailBusy: boolean;
  onConnectMail: () => void;
  onDisconnectMail: () => void;
}) {
  const [section, setSection] = useState<Section>('sources');

  const navItem = (s: Section, label: string, Icon: typeof Database) => (
    <button
      type="button"
      onClick={() => setSection(s)}
      aria-current={section === s ? 'page' : undefined}
      className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors ${
        section === s ? 'bg-accent/15 text-accent' : 'text-ink-2 hover:bg-panel-2 hover:text-ink'
      }`}
    >
      <Icon size={15} strokeWidth={2} />
      {label}
    </button>
  );

  return (
    <div className="mx-auto flex max-w-3xl gap-7 px-6 py-7">
      <nav className="w-44 shrink-0" aria-label="Settings sections">
        <div className="mb-4 flex items-center gap-2 px-1">
          <SettingsIcon size={15} strokeWidth={2} className="text-ink-3" />
          <h1 className="text-[15px] font-semibold tracking-[-0.01em]">Settings</h1>
        </div>
        <div className="space-y-0.5">
          {navItem('sources', 'Data sources', Database)}
          {navItem('lanes', 'Lanes', Rows3)}
        </div>
      </nav>

      <div className="min-w-0 flex-1">
        {section === 'sources' ? (
          <DataSources
            mail={mailStatus}
            busy={mailBusy}
            onConnectMail={onConnectMail}
            onDisconnectMail={onDisconnectMail}
            jiraConfig={jiraConfig}
            onSaveJira={onSaveJira}
            onTestJira={onTestJira}
            onClearJiraToken={onClearJiraToken}
          />
        ) : (
          <LanesSettings config={laneConfig} onChange={onSaveLaneConfig} />
        )}
      </div>
    </div>
  );
}
