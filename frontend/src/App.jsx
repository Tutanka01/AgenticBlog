import { useEffect, useMemo, useState } from 'react';
import Sidebar from './components/layout/Sidebar';
import Topbar from './components/layout/Topbar';
import HistoryView from './components/history/HistoryView';
import OutputsView from './components/outputs/OutputsView';
import PipelineView from './components/pipeline/PipelineView';
import Toast from './components/ui/Toast';
import { useRun } from './hooks/useRun';
import { useRuns } from './hooks/useRuns';
import { useSSE } from './hooks/useSSE';
import { useTheme } from './hooks/useTheme';

export default function App() {
  const [activeView, setActiveView] = useState('pipeline');
  const [category, setCategory] = useState('infra');
  const [streamUrl, setStreamUrl] = useState('');
  const [selectedRunId, setSelectedRunId] = useState('');
  const [toasts, setToasts] = useState([]);
  const [runStartedAt, setRunStartedAt] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const { theme, toggleTheme } = useTheme();
  const { runs, loading: runsLoading, refetch } = useRuns();
  const { data: runData, loading: runLoading } = useRun(selectedRunId);
  const { nodeStates, logs, isRunning, error, latestEvent, resetLogs } = useSSE(streamUrl);

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
      addToast('Run completed', 'success');
      refetch();
      if (latestEvent.meta?.run_id) {
        setSelectedRunId(latestEvent.meta.run_id);
      }
    }

    if (latestEvent.status === 'error') {
      addToast(latestEvent.message || 'Run failed', 'error');
      refetch();
    }
  }, [latestEvent, refetch]);

  useEffect(() => {
    if (error) {
      addToast(error, 'error');
    }
  }, [error]);

  function addToast(message, type = 'info') {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setToasts((prev) => [...prev, { id, message, type }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }

  async function handleRunToggle() {
    if (isRunning) {
      const res = await fetch('/api/run/stop', { method: 'POST' });
      if (res.ok) {
        addToast('Stop signal sent', 'info');
      }
      return;
    }

    resetLogs();
    setElapsedSeconds(0);

    const res = await fetch('/api/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category }),
    });

    if (res.status === 409) {
      addToast('Another run is already active', 'error');
      return;
    }

    if (!res.ok) {
      addToast('Unable to start run', 'error');
      return;
    }

    const json = await res.json();
    setRunStartedAt(Date.now());
    setStreamUrl(`/api/run/stream?category=${encodeURIComponent(category)}&resume_id=${json.run_id}&t=${Date.now()}`);
    addToast(`Run started: ${json.run_id.slice(0, 8)}`, 'info');
    setActiveView('pipeline');
  }

  const topbarData = useMemo(() => {
    const meta = runData?.metadata;
    const runBadge = `run_id ${latestEvent?.meta?.run_id || meta?.run_id?.slice(0, 8) || '—'}`;
    const tokenBadge = `${meta?.total_tokens_used || 0} tok`;
    const duration = isRunning ? `${Math.round(elapsedSeconds)}s` : `${meta?.duration_seconds || 0}s`;
    return { runBadge, tokenBadge, duration };
  }, [runData, latestEvent, isRunning, elapsedSeconds]);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        activeView={activeView}
        onViewChange={setActiveView}
        category={category}
        onCategoryChange={setCategory}
        isRunning={isRunning}
        onRunToggle={handleRunToggle}
      />

      <main className="flex min-w-0 flex-1 flex-col" style={{ backgroundColor: 'var(--bg-base)' }}>
        <Topbar
          activeView={activeView}
          onViewChange={setActiveView}
          theme={theme}
          onToggleTheme={toggleTheme}
          runBadge={topbarData.runBadge}
          tokenBadge={topbarData.tokenBadge}
          durationBadge={topbarData.duration}
          hasError={latestEvent?.status === 'error'}
        />

        <section className="min-h-0 flex-1">
          {activeView === 'pipeline' && (
            <PipelineView
              nodeStates={nodeStates}
              logs={logs}
              elapsedSeconds={elapsedSeconds}
              onClearLogs={resetLogs}
            />
          )}

          {activeView === 'outputs' && (
            <OutputsView
              runs={runs}
              selectedRunId={selectedRunId}
              onSelectRun={setSelectedRunId}
              runData={runData}
              loading={runsLoading || runLoading}
              onToast={addToast}
            />
          )}

          {activeView === 'history' && (
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
                  addToast('Unable to resume run', 'error');
                  return;
                }

                const json = await res.json();
                setRunStartedAt(Date.now());
                setElapsedSeconds(0);
                setStreamUrl(`/api/run/stream?category=${encodeURIComponent(category)}&resume_id=${json.run_id}&t=${Date.now()}`);
                setActiveView('pipeline');
                addToast(`Run resumed: ${runId.slice(0, 8)}`, 'info');
              }}
              onDelete={async (runId) => {
                const res = await fetch(`/api/runs/${runId}`, { method: 'DELETE' });
                if (!res.ok) {
                  addToast('Delete failed', 'error');
                  return;
                }
                addToast('Run deleted', 'success');
                refetch();
              }}
              onToast={addToast}
            />
          )}
        </section>
      </main>

      <div className="fixed bottom-3 right-3 z-50">
        {toasts.map((toast) => (
          <Toast
            key={toast.id}
            toast={toast}
            onClose={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))}
          />
        ))}
      </div>
    </div>
  );
}
