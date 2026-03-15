import { useCallback, useEffect, useMemo, useState } from 'react';
import CommandBar from './components/layout/CommandBar';
import HistoryView from './components/history/HistoryView';
import OutputsView from './components/outputs/OutputsView';
import PipelineView from './components/pipeline/PipelineView';
import { ToastProvider } from './components/ui/ToastProvider';
import { useRun } from './hooks/useRun';
import { useRuns } from './hooks/useRuns';
import { useSSE } from './hooks/useSSE';
import { useTheme } from './hooks/useTheme';
import { useToast } from './hooks/useToast';

function AppShell() {
  const [activeView, setActiveView] = useState('pipeline');
  const [category, setCategory] = useState('infra');
  const [lang, setLang] = useState('en');
  const [streamUrl, setStreamUrl] = useState('');
  const [selectedRunId, setSelectedRunId] = useState('');
  const [runStartedAt, setRunStartedAt] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const { toast } = useToast();
  const { theme, toggleTheme } = useTheme();
  const { runs, loading: runsLoading, refetch } = useRuns();
  const { data: runData, loading: runLoading } = useRun(selectedRunId);
  const { nodeStates, logs, isRunning, error, latestEvent, resetLogs } = useSSE(streamUrl);

  const notify = useCallback(
    (message, type = 'info') => {
      if (type === 'success') {
        toast.success(message);
        return;
      }
      if (type === 'error') {
        toast.error(message);
        return;
      }
      toast.info(message);
    },
    [toast]
  );

  useEffect(() => {
    if (!selectedRunId && runs.length) {
      setSelectedRunId(runs[0].slug || runs[0].run_id);
    }
  }, [runs, selectedRunId]);

  useEffect(() => {
    if (!isRunning) {
      return;
    }

    const timer = window.setInterval(() => {
      setElapsedSeconds((Date.now() - runStartedAt) / 1000);
    }, 250);

    return () => window.clearInterval(timer);
  }, [isRunning, runStartedAt]);

  useEffect(() => {
    if (!latestEvent) return;

    if (latestEvent.status === 'complete') {
      notify('Run completed', 'success');
      refetch();
      if (latestEvent.meta?.run_id) {
        setSelectedRunId(latestEvent.meta.run_id);
      }
    }

    if (latestEvent.status === 'error') {
      notify(latestEvent.message || 'Run failed', 'error');
      refetch();
    }
  }, [latestEvent, notify, refetch]);

  useEffect(() => {
    if (error) {
      notify(error, 'error');
    }
  }, [error, notify]);

  const handleRunToggle = useCallback(async () => {
    if (isRunning) {
      const res = await fetch('/api/run/stop', { method: 'POST' });
      if (res.ok) {
        notify('Stop signal sent', 'info');
      }
      return;
    }

    resetLogs();
    setElapsedSeconds(0);

    const res = await fetch('/api/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category, lang }),
    });

    if (res.status === 409) {
      notify('Another run is already active', 'error');
      return;
    }

    if (!res.ok) {
      notify('Unable to start run', 'error');
      return;
    }

    const json = await res.json();
    setRunStartedAt(Date.now());
    setStreamUrl(`/api/run/stream?category=${encodeURIComponent(category)}&resume_id=${json.run_id}&t=${Date.now()}`);
    notify(`Run started · category: ${category} · lang: ${lang}`, 'success');
    setActiveView('pipeline');
  }, [category, isRunning, notify, resetLogs]);

  useEffect(() => {
    const isTypingTarget = (target) => {
      if (!target) return false;
      if (target.isContentEditable) return true;
      const tag = target.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
    };

    const onKeyDown = (event) => {
      const modKey = event.metaKey || event.ctrlKey;

      if (event.key === 'Escape') {
        window.dispatchEvent(new CustomEvent('agenticblog:escape'));
      }

      if (modKey && event.key.toLowerCase() === 'c' && activeView === 'outputs' && !isTypingTarget(event.target)) {
        event.preventDefault();
        window.dispatchEvent(new CustomEvent('agenticblog:copy-active-output'));
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [activeView, handleRunToggle, isRunning]);

  const topbarData = useMemo(() => {
    const meta = runData?.metadata;
    const runBadge = `run_id ${latestEvent?.meta?.run_id || meta?.run_id?.slice(0, 8) || '—'}`;
    const tokenBadge = `${meta?.total_tokens_used || 0} tok`;
    const duration = isRunning ? `${Math.round(elapsedSeconds)}s` : `${meta?.duration_seconds || 0}s`;
    return { runBadge, tokenBadge, duration };
  }, [runData, latestEvent, isRunning, elapsedSeconds]);

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <CommandBar
        activeView={activeView}
        onViewChange={setActiveView}
        category={category}
        onCategoryChange={setCategory}
        lang={lang}
        onLangChange={setLang}
        isRunning={isRunning}
        onRunToggle={handleRunToggle}
        topbarData={topbarData}
        hasError={latestEvent?.status === 'error'}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      <main className="min-h-0 flex-1 view-content" style={{ backgroundColor: 'var(--bg-base)' }}>
        {activeView === 'pipeline' && (
          <div key="pipeline" className="view-enter h-full">
            <PipelineView
              nodeStates={nodeStates}
              logs={logs}
              elapsedSeconds={elapsedSeconds}
              onClearLogs={resetLogs}
            />
          </div>
        )}

        {activeView === 'outputs' && (
          <div key="outputs" className="view-enter h-full">
            <OutputsView
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
            <HistoryView
              runs={runs}
              onOpenOutputs={(runId) => {
                setSelectedRunId(runId);
                setActiveView('outputs');
              }}
              onResume={async (runId) => {
                const res = await fetch('/api/run', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ category, resume_id: runId }),
                });

                if (!res.ok) {
                  notify('Unable to resume run', 'error');
                  return;
                }

                const json = await res.json();
                setRunStartedAt(Date.now());
                setElapsedSeconds(0);
                setStreamUrl(`/api/run/stream?category=${encodeURIComponent(category)}&resume_id=${json.run_id}&t=${Date.now()}`);
                setActiveView('pipeline');
                notify(`Run resumed: ${runId.slice(0, 8)}`, 'info');
              }}
              onDelete={async (runId) => {
                const res = await fetch(`/api/runs/${runId}`, { method: 'DELETE' });
                if (!res.ok) {
                  notify('Delete failed', 'error');
                  return;
                }
                notify('Run deleted', 'success');
                refetch();
              }}
              onToast={notify}
            />
          </div>
        )}
      </main>
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
