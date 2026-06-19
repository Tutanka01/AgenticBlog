import { useCallback, useEffect, useMemo, useState } from 'react';
import Sidebar from './components/layout/Sidebar';
import Topbar from './components/layout/Topbar';
import ComposeView from './components/compose/ComposeView';
import LiveView from './components/live/LiveView';
import ReviewView from './components/review/ReviewView';
import HistoryView from './components/history/HistoryView';
import MemoryView from './components/memory/MemoryView';
import SettingsView from './components/settings/SettingsView';
import { ToastProvider } from './components/ui/ToastProvider';
import { useConfig } from './hooks/useConfig';
import { useRun } from './hooks/useRun';
import { useRuns } from './hooks/useRuns';
import { useSSE } from './hooks/useSSE';
import { useTheme } from './hooks/useTheme';
import { useToast } from './hooks/useToast';

function AppShell() {
  const [activeView, setActiveView] = useState('compose');
  const [streamUrl, setStreamUrl] = useState('');
  const [selectedRunId, setSelectedRunId] = useState('');
  const [runStartedAt, setRunStartedAt] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [lastParams, setLastParams] = useState({ mode: 'category', category: 'infra', lang: 'en' });

  const { toast } = useToast();
  const { theme, toggleTheme } = useTheme();
  const { config } = useConfig();
  const { runs, loading: runsLoading, refetch } = useRuns();
  const { data: runData, loading: runLoading } = useRun(selectedRunId);
  const { nodeStates, logs, debateHistory, isRunning, error, latestEvent, resetLogs } = useSSE(streamUrl);

  const notify = useCallback(
    (message, type = 'info') => {
      if (type === 'success') return toast.success(message);
      if (type === 'error') return toast.error(message);
      return toast.info(message);
    },
    [toast]
  );

  useEffect(() => {
    if (!selectedRunId && runs.length) setSelectedRunId(runs[0].slug || runs[0].run_id);
  }, [runs, selectedRunId]);

  useEffect(() => {
    if (!isRunning) return undefined;
    const timer = window.setInterval(() => setElapsedSeconds((Date.now() - runStartedAt) / 1000), 250);
    return () => window.clearInterval(timer);
  }, [isRunning, runStartedAt]);

  useEffect(() => {
    if (!latestEvent) return;
    if (latestEvent.status === 'complete') {
      notify('Run finished — open Review', 'success');
      refetch();
      if (latestEvent.meta?.run_id) setSelectedRunId(latestEvent.meta.run_id);
    }
    if (latestEvent.status === 'error') {
      notify(latestEvent.message || 'Run failed', 'error');
      refetch();
    }
  }, [latestEvent, notify, refetch]);

  useEffect(() => {
    if (error) notify(error, 'error');
  }, [error, notify]);

  const launchRun = useCallback(
    async (params) => {
      resetLogs();
      setElapsedSeconds(0);
      setLastParams(params);

      const body = { category: params.category, lang: params.lang };
      if (params.mode === 'url') body.url = params.url;
      if (params.mode === 'topic') body.topic = params.topic;

      const res = await fetch('/api/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.status === 409) return notify('A run is already active', 'error');
      if (!res.ok) return notify('Could not start the run', 'error');

      const json = await res.json();
      setRunStartedAt(Date.now());
      setStreamUrl(`/api/run/stream?category=${encodeURIComponent(params.category)}&resume_id=${json.run_id}&t=${Date.now()}`);
      setActiveView('live');
      const modeLabel = params.mode === 'url' ? 'URL' : params.mode === 'topic' ? 'topic' : params.category;
      notify(`Run started · ${modeLabel} · ${params.lang}`, 'success');
      return undefined;
    },
    [notify, resetLogs]
  );

  const stopRun = useCallback(async () => {
    const res = await fetch('/api/run/stop', { method: 'POST' });
    if (res.ok) notify('Stop signal sent', 'info');
  }, [notify]);

  const resumeRun = useCallback(
    async (runId) => {
      resetLogs();
      const res = await fetch('/api/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: lastParams.category, resume_id: runId }),
      });
      if (!res.ok) return notify('Could not resume the run', 'error');
      const json = await res.json();
      setRunStartedAt(Date.now());
      setElapsedSeconds(0);
      setStreamUrl(`/api/run/stream?category=${encodeURIComponent(lastParams.category)}&resume_id=${json.run_id}&t=${Date.now()}`);
      setActiveView('live');
      notify(`Resumed ${runId.slice(0, 8)}`, 'info');
      return undefined;
    },
    [lastParams.category, notify, resetLogs]
  );

  const deleteRun = useCallback(
    async (runId) => {
      const res = await fetch(`/api/runs/${runId}`, { method: 'DELETE' });
      if (!res.ok) return notify('Delete failed', 'error');
      notify('Run deleted', 'success');
      refetch();
      return undefined;
    },
    [notify, refetch]
  );

  const openReview = useCallback((runId) => {
    setSelectedRunId(runId);
    setActiveView('review');
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') window.dispatchEvent(new CustomEvent('agenticblog:escape'));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const liveMeta = useMemo(() => {
    const tokens = Object.values(Object.fromEntries(nodeStates)).reduce(
      (acc, s) => Math.max(acc, s?.meta?.tokens || 0), 0
    );
    return { tokens };
  }, [nodeStates]);

  const topbar = useMemo(() => {
    const meta = runData?.metadata;
    const live = isRunning;
    return {
      runId: latestEvent?.meta?.run_id || meta?.run_id?.slice(0, 8) || '—',
      tokens: (live ? liveMeta.tokens : meta?.total_tokens_used) || 0,
      duration: live ? `${Math.round(elapsedSeconds)}s` : `${meta?.duration_seconds || 0}s`,
    };
  }, [runData, latestEvent, isRunning, elapsedSeconds, liveMeta]);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        activeView={activeView}
        onNavigate={setActiveView}
        isRunning={isRunning}
        hasRun={Boolean(selectedRunId)}
        runCount={runs.length}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          activeView={activeView}
          isRunning={isRunning}
          onStop={stopRun}
          topbar={topbar}
          hasError={latestEvent?.status === 'error'}
          theme={theme}
          onToggleTheme={toggleTheme}
        />

        <main className="min-h-0 flex-1" style={{ backgroundColor: 'var(--bg-base)' }}>
          {activeView === 'compose' && (
            <div key="compose" className="view-enter h-full">
              <ComposeView config={config} isRunning={isRunning} defaults={lastParams} onLaunch={launchRun} />
            </div>
          )}
          {activeView === 'live' && (
            <div key="live" className="view-enter h-full">
              <LiveView
                nodeStates={nodeStates}
                logs={logs}
                debateHistory={debateHistory}
                isRunning={isRunning}
                elapsedSeconds={elapsedSeconds}
                onClearLogs={resetLogs}
                onGoCompose={() => setActiveView('compose')}
                onOpenReview={() => selectedRunId && openReview(selectedRunId)}
              />
            </div>
          )}
          {activeView === 'review' && (
            <div key="review" className="view-enter h-full">
              <ReviewView
                runs={runs}
                selectedRunId={selectedRunId}
                onSelectRun={setSelectedRunId}
                runData={runData}
                loading={runsLoading || runLoading}
                onToast={notify}
              />
            </div>
          )}
          {activeView === 'history' && (
            <div key="history" className="view-enter h-full">
              <HistoryView runs={runs} onOpenReview={openReview} onResume={resumeRun} onDelete={deleteRun} onToast={notify} />
            </div>
          )}
          {activeView === 'memory' && (
            <div key="memory" className="view-enter h-full">
              <MemoryView />
            </div>
          )}
          {activeView === 'settings' && (
            <div key="settings" className="view-enter h-full">
              <SettingsView config={config} />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AppShell />
    </ToastProvider>
  );
}
