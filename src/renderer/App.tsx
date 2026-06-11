// src/renderer/App.tsx
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Sunrise, LayoutList, Settings as SettingsIcon, RefreshCw, CalendarDays, Users, Search } from 'lucide-react';
import { daybreak } from './bridge';
import type { ViewResult } from '../app/ipc-types';
import { LANE_ORDER, type Lane } from '../model/item';
import { Headline } from './components/Headline';
import { LaneSection } from './components/LaneSection';
import { AwayWindowModal } from './components/AwayWindowModal';
import { AuthPanel, type AuthPrompt } from './components/AuthPanel';
import { IngestStatus } from './components/IngestStatus';
import { Settings } from './components/Settings';
import type { JiraConfigView, JiraTestResult } from './components/JiraSettings';

// FYI and Review collapse by default - they are skim/batch-clear lanes.
const COLLAPSED_BY_DEFAULT: Record<Lane, boolean> = { respond: false, approve: false, review: true, fyi: true };

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
  const [page, setPage] = useState<'board' | 'settings'>('board');
  const [jiraConfig, setJiraConfig] = useState<JiraConfigView>({ baseUrl: '', email: '', hasToken: false });
  const [bySender, setBySender] = useState(false);
  const [senderFilter, setSenderFilter] = useState('');

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

  const openSettings = useCallback(async () => {
    setJiraConfig(await daybreak.getJiraConfig());
    setPage('settings');
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

  const board = view && !('needsAwayWindow' in view) && !('error' in view) ? view : null;

  // Apply the sender filter to each lane's rows.
  const filteredLanes = useMemo(() => {
    if (!board) return [];
    const q = senderFilter.trim().toLowerCase();
    return board.lanes.map((l) => ({
      ...l,
      items: q ? l.items.filter((r) => r.from.toLowerCase().includes(q)) : l.items,
    }));
  }, [board, senderFilter]);

  // Full-screen takeovers (no shell yet): auth, away-window, first load, fatal error.
  if (auth) {
    return (
      <div className="min-h-dvh grid place-items-center bg-bg px-6">
        <div className="w-full max-w-md"><AuthPanel {...auth} /></div>
      </div>
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

  const railBtn = (active: boolean) =>
    `grid h-10 w-10 place-items-center rounded-xl transition-colors ${active ? 'bg-accent/15 text-accent' : 'text-ink-3 hover:bg-panel-2 hover:text-ink'}`;

  return (
    <div className="flex min-h-dvh bg-bg text-ink">
      {/* persistent left nav rail - stays visible in Settings too */}
      <nav className="sticky top-0 flex h-dvh w-14 shrink-0 flex-col items-center gap-1 border-r border-line bg-panel py-3">
        <div className="mb-2 grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-amber-400 via-rose-500 to-violet-600 text-white shadow-lg shadow-rose-500/40" title="Daybreak">
          <Sunrise size={19} strokeWidth={2.25} />
        </div>
        <button type="button" aria-label="Board" aria-current={page === 'board' ? 'page' : undefined}
          onClick={() => setPage('board')} className={railBtn(page === 'board')}>
          <LayoutList size={19} strokeWidth={2} />
        </button>
        <button type="button" aria-label="Settings" aria-current={page === 'settings' ? 'page' : undefined}
          onClick={openSettings} className={railBtn(page === 'settings')}>
          <SettingsIcon size={19} strokeWidth={2} />
        </button>
      </nav>

      <main className="min-w-0 flex-1">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-bg/85 px-6 py-3 backdrop-blur">
          <div className="flex items-baseline gap-2">
            <span className="bg-gradient-to-r from-amber-300 via-rose-400 to-violet-400 bg-clip-text text-sm font-bold tracking-tight text-transparent">Daybreak</span>
            <span className="text-xs text-ink-3">Declared-intent triage</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1 text-xs text-ink-2">
              <CalendarDays size={13} /> Catch up since <span className="font-mono text-ink">{sinceLabel(view.since)}</span>
            </span>
            <button type="button" onClick={refresh} aria-label="Refresh"
              className="flex items-center gap-1.5 rounded-lg border border-line-strong bg-panel px-2.5 py-1 text-xs font-medium text-ink-2 transition-colors hover:border-ink-3 hover:text-ink">
              <RefreshCw size={13} /> Refresh
            </button>
          </div>
        </header>

        {page === 'settings' ? (
          <Settings jiraConfig={jiraConfig} onSaveJira={onSaveJira} onTestJira={onTestJira} onClearJiraToken={onClearJiraToken} />
        ) : (
          <div className="mx-auto max-w-3xl px-6 pb-10">
            <Headline summary={view.summary} since={view.since} />

            {(phase === 'fetching' || phase === 'scoring' || phase === 'error') && (
              <div className="mb-4"><IngestStatus phase={phase} message={errorMsg} onRetry={refresh} /></div>
            )}

            {/* group / filter bar */}
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 rounded-lg border border-line bg-panel px-2 py-1">
                <Search size={13} className="text-ink-3" />
                <input
                  value={senderFilter}
                  onChange={(e) => setSenderFilter(e.target.value)}
                  placeholder="Filter by sender"
                  aria-label="Filter by sender"
                  className="w-40 bg-transparent text-[12px] text-ink placeholder:text-ink-3 focus:outline-none"
                />
              </div>
              <button
                type="button"
                onClick={() => setBySender((v) => !v)}
                aria-pressed={bySender}
                className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[12px] font-medium transition-colors ${bySender ? 'border-accent/40 bg-accent/10 text-accent' : 'border-line text-ink-2 hover:text-ink'}`}
              >
                <Users size={13} /> Group by sender
              </button>
            </div>

            <div className="flex flex-col gap-3">
              {LANE_ORDER.map((lane) => {
                const lv = filteredLanes.find((l) => l.lane === lane);
                return (
                  <LaneSection
                    key={lane}
                    lane={lane}
                    items={lv?.items ?? []}
                    defaultCollapsed={COLLAPSED_BY_DEFAULT[lane]}
                    bySender={bySender}
                    onOpen={onOpen}
                    onClear={onClear}
                    onRerank={onRerank}
                  />
                );
              })}
            </div>
          </div>
        )}
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
