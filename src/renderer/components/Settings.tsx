// src/renderer/components/Settings.tsx
import { useState } from 'react';
import { Settings as SettingsIcon } from 'lucide-react';
import type { Rule } from '../../app/rules';
import { RulesSettings } from './RulesSettings';
import { JiraSettings, type JiraConfigView, type JiraTestResult } from './JiraSettings';

type Tab = 'rules' | 'sources';

export function Settings({
  rules,
  bulkExcludeEnabled,
  onAddRule,
  onRemoveRule,
  onToggleBulk,
  jiraConfig,
  onSaveJira,
  onTestJira,
  onClearJiraToken,
  onClose,
}: {
  rules: Rule[];
  bulkExcludeEnabled: boolean;
  onAddRule: (rule: Rule) => void;
  onRemoveRule: (id: string) => void;
  onToggleBulk: (enabled: boolean) => void;
  jiraConfig: JiraConfigView;
  onSaveJira: (input: { baseUrl: string; email: string; token?: string }) => Promise<void>;
  onTestJira: (input: { baseUrl: string; email: string; token?: string }) => Promise<JiraTestResult>;
  onClearJiraToken: () => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<Tab>('rules');

  const tabClass = (t: Tab) =>
    `rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors ${tab === t ? 'bg-accent/15 text-accent' : 'text-ink-2 hover:text-ink'}`;

  return (
    <div className="min-h-dvh bg-bg text-ink">
      <div className="mx-auto max-w-2xl px-6 py-8">
        <div className="elev-panel rounded-xl p-6">
          <div className="mb-5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <SettingsIcon size={16} strokeWidth={2} className="text-accent" />
              <h1 className="text-[18px] font-semibold tracking-[-0.01em]">Settings</h1>
            </div>
            <button type="button" onClick={onClose} className="text-[13px] font-medium text-ink-2 transition-colors hover:text-ink">Done</button>
          </div>

          <div className="mb-5 flex gap-1 border-b border-line pb-3">
            <button type="button" className={tabClass('rules')} onClick={() => setTab('rules')}>Rules</button>
            <button type="button" className={tabClass('sources')} onClick={() => setTab('sources')}>Sources</button>
          </div>

          {tab === 'rules' ? (
            <RulesSettings rules={rules} bulkExcludeEnabled={bulkExcludeEnabled} onAdd={onAddRule} onRemove={onRemoveRule} onToggleBulk={onToggleBulk} />
          ) : (
            <JiraSettings config={jiraConfig} onSave={onSaveJira} onTest={onTestJira} onClearToken={onClearJiraToken} />
          )}
        </div>
      </div>
    </div>
  );
}
