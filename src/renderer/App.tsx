// src/renderer/App.tsx
import { useCallback, useEffect, useRef, useState } from 'react';
import { daybreak } from './bridge';
import type { ViewResult } from '../app/ipc-types';
import type { Lane } from '../model/item';
import { SummaryHeader } from './components/SummaryHeader';
import { Lane as LaneComponent } from './components/Lane';
import { AwayWindowModal } from './components/AwayWindowModal';
import { AuthPanel } from './components/AuthPanel';
import { IngestStatus } from './components/IngestStatus';
import { SetAsideBin } from './components/SetAsideBin';
import { RulesSettings } from './components/RulesSettings';
import type { Rule } from '../app/rules';

const LANE_TITLES: Record<Lane, string> = {
  today: 'Needs you today',
  this_week: 'Time-sensitive this week',
  fyi: 'FYI / batch-clear',
};

export default function App() {
  const [view, setView] = useState<ViewResult | null>(null);
  const [phase, setPhase] = useState<'idle' | 'fetching' | 'scoring' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | undefined>();
  const [auth, setAuth] = useState<{ verificationUri: string; userCode: string } | null>(null);
  const [awayError, setAwayError] = useState<string | null>(null);
  const [undo, setUndo] = useState<string | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [rules, setRules] = useState<Rule[]>([]);
  const [bulkExclude, setBulkExclude] = useState(true);

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

  // Clear the undo-toast timer on unmount so it cannot fire after teardown.
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
    if ('error' in result) {
      setAwayError(result.error);
    } else {
      setView(result);
    }
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
    const r = await daybreak.getRules();
    setRules(r.rules);
    setBulkExclude(r.bulkExcludeEnabled);
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

  // A pending device-code prompt takes priority so it is visible during the very
  // first sign-in, when the view is still the away-window modal.
  if (auth) {
    return (
      <div className="min-h-dvh grid place-items-center bg-bg px-6">
        <div className="w-full max-w-md"><AuthPanel {...auth} /></div>
      </div>
    );
  }

  if (showSettings) {
    return (
      <RulesSettings
        rules={rules}
        bulkExcludeEnabled={bulkExclude}
        onAdd={addRuleAction}
        onRemove={removeRuleAction}
        onToggleBulk={toggleBulk}
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

  // view is a TriageView
  return (
    <div className="min-h-dvh bg-bg text-ink">
      {/* top bar */}
      <header className="sticky top-0 z-10 flex items-center justify-between px-5 py-[10px] border-b border-line bg-surface">
        <div className="flex items-center gap-[10px] text-[14px] font-bold tracking-[-0.01em] text-ink">
          <span
            className="inline-block w-[18px] h-[18px] rounded-[5px]"
            style={{ background: 'linear-gradient(135deg, var(--brand), #7a4dff)' }}
            aria-hidden="true"
          />
          Daybreak
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={openSettings}
            className="rounded-md border border-line-strong bg-surface text-[12px] font-medium text-ink px-[11px] py-[5px] transition-colors hover:bg-surface-2 hover:border-ink-3"
          >
            Rules
          </button>
        </div>
      </header>

      <SummaryHeader summary={view.summary} awaySince={view.awaySince} />

      <div className="px-5 pb-5">
        {(phase === 'fetching' || phase === 'scoring' || phase === 'error') && (
          <div className="mb-[14px]"><IngestStatus phase={phase} message={errorMsg} onRetry={refresh} /></div>
        )}
        <div className="grid gap-[14px] md:grid-cols-3 items-start">
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
        <div className="mt-[14px]">
          <SetAsideBin view={view.setAside} onPromote={onPromote} />
        </div>
      </div>

      {undo && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 rounded-md bg-ink text-surface px-4 py-2 text-[13px] shadow-sm" role="status" aria-live="polite">
          Cleared <button type="button" className="ml-3 underline font-medium" onClick={onUndo}>Undo</button>
        </div>
      )}
    </div>
  );
}
