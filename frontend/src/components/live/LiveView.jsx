import { ArrowRight, Radio } from 'lucide-react';
import { useMemo } from 'react';
import { ORDERED_NODES, subtitleFor } from '../../lib/pipeline';
import CandidatesPanel from './CandidatesPanel';
import DebatePanel from './DebatePanel';
import LogConsole from './LogConsole';
import PipelineGraph from './PipelineGraph';
import ScoreTrajectory from './ScoreTrajectory';

function EmptyState({ onGoCompose }) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-8 text-center">
      <div style={{ width: 46, height: 46, borderRadius: 13, background: 'var(--brand-gradient)', opacity: 0.9 }} />
      <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginTop: 18 }}>No run streaming yet</h2>
      <p style={{ fontSize: 13.5, color: 'var(--text-muted)', marginTop: 6, maxWidth: 380, lineHeight: 1.55 }}>
        Launch a run from Compose and the curation, debate and authoring stages will stream here in real time.
      </p>
      <button type="button" className="btn btn-primary mt-5" onClick={onGoCompose}>
        Go to Compose <ArrowRight size={14} />
      </button>
    </div>
  );
}

export default function LiveView({ nodeStates, logs, debateHistory, isRunning, onClearLogs, onGoCompose, onOpenReview }) {
  const subtitles = useMemo(
    () => ORDERED_NODES.reduce((acc, n) => ({ ...acc, [n]: subtitleFor(n, nodeStates.get(n)) }), {}),
    [nodeStates]
  );

  const filterData = nodeStates.get('filter')?.data;
  const selectorData = nodeStates.get('selector')?.data;
  const criticData = nodeStates.get('critic')?.data;
  const saverDone = nodeStates.get('saver')?.status === 'done';

  if (nodeStates.size === 0 && !isRunning) return <EmptyState onGoCompose={onGoCompose} />;

  return (
    <div className="flex h-full flex-col">
      {/* Pipeline graph */}
      <div style={{ height: '38%', minHeight: 248, borderBottom: '1px solid var(--bg-border)', position: 'relative' }}>
        <PipelineGraph nodeStates={nodeStates} subtitles={subtitles} onNodeClick={() => {}} />
        {saverDone && !isRunning && (
          <button
            type="button"
            onClick={onOpenReview}
            className="btn btn-primary"
            style={{ position: 'absolute', right: 16, bottom: 14, height: 34, zIndex: 5 }}
          >
            Open Review <ArrowRight size={14} />
          </button>
        )}
      </div>

      {/* Panels */}
      <div className="min-h-0 flex-1 overflow-y-auto custom-scrollbar p-4">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(290px,1fr)]">
          <div className="flex flex-col gap-4">
            {(criticData || isRunning) ? (
              <DebatePanel data={criticData} live={isRunning} />
            ) : (
              <CandidatesPanel data={filterData} selection={selectorData} />
            )}
          </div>
          <div className="flex flex-col gap-4">
            <ScoreTrajectory debates={debateHistory} />
            {criticData && <CandidatesPanel data={filterData} selection={selectorData} />}
          </div>
        </div>
      </div>

      <LogConsole logs={logs} onClear={onClearLogs} />
    </div>
  );
}
