// src/renderer/App.tsx
import { useCallback, useEffect, useRef, useState } from 'react';
import { LayoutList, Settings as SettingsIcon, RefreshCw, CalendarDays } from 'lucide-react';
import { daybreak } from './bridge';
import type { ViewResult } from '../app/ipc-types';
import type { Lane } from '../model/item';
import { SummaryHeader } from './components/SummaryHeader';
import { Lane as LaneComponent } from './components/Lane';
import { AwayWindowModal } from './components/AwayWindowModal';
import { AuthPanel, type AuthPrompt } from './components/AuthPanel';
import { IngestStatus } from './components/IngestStatus';
import { SetAsideBin } from './components/SetAsideBin';
import { Settings } from './components/Settings';
import type { JiraConfigView, JiraTestResult } from './components/JiraSettings';
import type { Rule } from '../app/rules';

const LANE_TITLES: Record<Lane, string> = {
  today: 'Needs you today',
  this_week: 'Time-sensitive this week',
  fyi: 'FYI / batch-clear',
};

function sinceLabel(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function App() {
  const [view, setView] = useState<ViewResult | null>(null);
  const [phase, setPhase] = useState<'idle' | 'fetching' | 'scoring' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | undefined>();
  const [auth, setAuth] = useState<AuthPrompt | null>(null);
  const [awayError, setAwayError] = useState<string | null>(null);
  const [undo, setUndo] = useState<string | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [rules, setRules] = useState<Rule[]>([]);
  const [bulkExclude, setBulkExclude] = useState(true);
  const [jiraConfig, setJiraConfig] = useState<JiraConfigView>({ baseUrl: '', email: '', hasToken: false });

  useEffect(() => {
    const off = daybreak.onIngest(({ phase: p, message }) => {
      if (p === 'auth' && message) {
        try { setAuth(JSON.parse(message)); } catch { /* ignore malformed auth payload */ }
      } else if (p === 'fetching' || p === 'scoring') {
        setPhase(p);
      } else if (p === 'done') {
        setPhase('idle');
        setAuth(null);
      } else if (p === 'error') {
        setPhase('error');
        setErrorMsg(message);
      }
    });
    void daybreak.getView().then(setView);
    return off;
  }, []);

  useEffect(() => () => { if (undoTimer.current) clearTimeout(undoTimer.current); }, []);

  const showUndo = useCallback((id: string) => {
    setUndo(id);
    if (undoTimer.current) clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => setUndo(null), 5000);
  }, []);

  const submitAwayWindow = useCallback(async (sinceISO: string) => {
    setAwayError(null);
    setPhase('fetching');
    const result = await daybreak.setAwayWindow(sinceISO);
    setPhase('idle');
    if ('error' in result) setAwayError(result.error);
    else setView(result);
  }, []);

  const refresh = useCallback(async () => {
    setPhase('fetching');
    const result = await daybreak.refresh();
    setPhase('idle');
    setView(result);
  }, []);

  const onPromote = useCallback(async (id: string, lane: Lane) => {
    setView(await daybreak.promoteSetAside(id, lane));
  }, []);
  const openSettings = useCallback(async () => {
    const [r, j] = await Promise.all([daybreak.getRules(), daybreak.getJiraConfig()]);
    setRules(r.rules);
    setBulkExclude(r.bulkExcludeEnabled);
    setJiraConfig(j);
    setShowSettings(true);
  }, []);
  const addRuleAction = useCallback(async (rule: Rule) => {
    const v = await daybreak.addRule(rule);
    setRules((rs) => (rs.some((x) => x.id === rule.id) ? rs : [...rs, rule]));
    if (!('error' in v) && !('needsAwayWindow' in v)) setView(v);
  }, []);
  const removeRuleAction = useCallback(async (id: string) => {
    const v = await daybreak.removeRule(id);
    setRules((rs) => rs.filter((x) => x.id !== id));
    if (!('error' in v) && !('needsAwayWindow' in v)) setView(v);
  }, []);
  const toggleBulk = useCallback(async (enabled: boolean) => {
    setBulkExclude(enabled);
    const v = await daybreak.setBulkExclude(enabled);
    if (!('error' in v) && !('needsAwayWindow' in v)) setView(v);
  }, []);

  const onSaveJira = useCallback(async (input: { baseUrl: string; email: string; token?: string }) => {
    await daybreak.setJiraConfig(input);
    setJiraConfig(await daybreak.getJiraConfig());
  }, []);
  const onTestJira = useCallback((input: { baseUrl: string; email: string; token?: string }): Promise<JiraTestResult> => {
    return daybreak.testJiraConnection(input);
  }, []);
  const onClearJiraToken = useCallback(async () => {
    await daybreak.clearJiraToken();
    setJiraConfig(await daybreak.getJiraConfig());
  }, []);

  const onOpen = useCallback((webLink: string) => { void daybreak.openItem(webLink); }, []);
  const onRerank = useCallback(async (id: string, lane: Lane) => {
    await daybreak.rerankItem(id, lane);
    setView(await daybreak.refresh());
  }, []);
  const onClear = useCallback(async (id: string) => {
    await daybreak.clearItem(id);
    showUndo(id);
    setView(await daybreak.refresh());
  }, [showUndo]);
  const onUndo = useCallback(async () => {
    if (!undo) return;
    if (undoTimer.current) clearTimeout(undoTimer.current);
    await daybreak.unclearItem(undo);
    setUndo(null);
    setView(await daybreak.refresh());
  }, [undo]);

  // Full-screen takeovers (no shell): auth, settings, loading, away-window, error.
  if (auth) {
    return (
      <div className="min-h-dvh grid place-items-center bg-bg px-6">
        <div className="w-full max-w-md"><AuthPanel {...auth} /></div>
      </div>
    );
  }
  if (showSettings) {
    return (
      <Settings
        rules={rules}
        bulkExcludeEnabled={bulkExclude}
        onAddRule={addRuleAction}
        onRemoveRule={removeRuleAction}
        onToggleBulk={toggleBulk}
        jiraConfig={jiraConfig}
        onSaveJira={onSaveJira}
        onTestJira={onTestJira}
        onClearJiraToken={onClearJiraToken}
        onClose={() => setShowSettings(false)}
      />
    );
  }
  if (view === null) {
    return (
      <div className="min-h-dvh grid place-items-center bg-bg px-6">
        <div className="w-full max-w-md">
          <IngestStatus phase={phase === 'error' ? 'error' : 'fetching'} message={errorMsg} onRetry={refresh} />
        </div>
      </div>
    );
  }
  if ('needsAwayWindow' in view) {
    return <AwayWindowModal onSubmit={submitAwayWindow} error={awayError} />;
  }
  if ('error' in view) {
    return (
      <div className="min-h-dvh grid place-items-center bg-bg px-6">
        <div className="w-full max-w-md">
          <IngestStatus phase="error" message={view.error} onRetry={refresh} />
        </div>
      </div>
    );
  }

  // Triage surface with the app shell.
  return (
    <div className="flex min-h-dvh bg-bg text-ink">
      {/* slim left nav rail */}
      <nav className="sticky top-0 flex h-dvh w-14 shrink-0 flex-col items-center gap-1 border-r border-line bg-panel py-3">
        <div className="mb-2 h-9 w-9 overflow-hidden rounded-xl shadow-lg shadow-orange-500/40" title="Daybreak">
          <svg viewBox="0 0 120 120" className="h-full w-full" aria-hidden="true">
            <rect width="120" height="120" fill="#ff6a3d" />
            <path d="M34.1 60 A24.7 24.7 0 0 1 83.5 60 Z" fill="#fff" />
            <path d="M41.2 67.1 A24.7 24.7 0 0 0 90.6 67.1 Z" fill="#fff" opacity="0.7" />
          </svg>
        </div>
        <button type="button" aria-label="Triage" aria-current="page"
          className="grid h-10 w-10 place-items-center rounded-xl bg-accent/15 text-accent">
          <LayoutList size={19} strokeWidth={2} />
        </button>
        <button type="button" aria-label="Settings" onClick={openSettings}
          className="grid h-10 w-10 place-items-center rounded-xl text-ink-3 transition-colors hover:bg-panel-2 hover:text-ink">
          <SettingsIcon size={19} strokeWidth={2} />
        </button>
      </nav>

      {/* main column */}
      <main className="min-w-0 flex-1">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-bg/85 px-6 py-3 backdrop-blur">
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-bold tracking-tight text-ink">Daybreak</span>
            <span className="text-xs text-ink-3">Return-from-leave triage</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1 text-xs text-ink-2">
              <CalendarDays size={13} /> Out since <span className="font-mono text-ink">{sinceLabel(view.awaySince)}</span>
            </span>
            <button type="button" onClick={refresh} aria-label="Refresh"
              className="flex items-center gap-1.5 rounded-lg border border-line-strong bg-panel px-2.5 py-1 text-xs font-medium text-ink-2 transition-colors hover:border-ink-3 hover:text-ink">
              <RefreshCw size={13} /> Refresh
            </button>
          </div>
        </header>

        <div className="px-6 pb-8">
          <SummaryHeader summary={view.summary} awaySince={view.awaySince} />

          {(phase === 'fetching' || phase === 'scoring' || phase === 'error') && (
            <div className="mb-4"><IngestStatus phase={phase} message={errorMsg} onRetry={refresh} /></div>
          )}

          <div className="grid items-start gap-4 lg:grid-cols-3">
            {(['today', 'this_week', 'fyi'] as Lane[]).map((lane) => (
              <LaneComponent
                key={lane}
                laneView={view.lanes[lane]}
                title={LANE_TITLES[lane]}
                onOpen={onOpen}
                onClear={onClear}
                onRerank={onRerank}
              />
            ))}
          </div>

          <div className="mt-4">
            <SetAsideBin view={view.setAside} onPromote={onPromote} />
          </div>
        </div>
      </main>

      {undo && (
        <div className="elev-pop fixed bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-3 rounded-xl px-4 py-2.5 text-[13px]"
          role="status" aria-live="polite">
          <span className="text-ink">Cleared</span>
          <button type="button" className="font-medium text-accent hover:underline" onClick={onUndo}>Undo</button>
        </div>
      )}
    </div>
  );
}
