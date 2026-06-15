// src/renderer/components/Settings.tsx
import type { LaneSetting } from '../../app/lane-config';
import type { MailStatus } from '../../app/ipc-types';
import { LanesSettings } from './LanesSettings';
import { DataSources } from './DataSources';
import type { JiraConfigView, JiraTestResult } from './JiraSettings';

// Settings renders inside the app shell (the left nav rail stays visible). With only
// two short sections, a sidebar is more chrome than content - so both live on one
// scrolling page: Data sources, then Lanes.
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
  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <h1 className="text-[20px] font-semibold tracking-[-0.02em] text-ink">Settings</h1>

      <section className="mt-7">
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
      </section>

      <section className="mt-10 border-t border-line pt-8">
        <h2 className="text-[16px] font-semibold tracking-[-0.01em] text-ink">Lanes</h2>
        <p className="mb-4 mt-1.5 text-[13px] leading-relaxed text-ink-2">
          Rename, hide, or reorder the lanes on your board. Hidden lanes still receive their items, they just are not shown.
        </p>
        <LanesSettings config={laneConfig} onChange={onSaveLaneConfig} />
      </section>
    </div>
  );
}
