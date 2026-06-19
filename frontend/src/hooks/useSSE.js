import { useEffect, useMemo, useRef, useState } from 'react';

// Streams pipeline events. Beyond plain log lines, agents emit a structured
// `data` channel (candidates, personas, debate transcript) which we merge into
// per-node state so the Live views can render rich panels in real time.
export function useSSE(url) {
  const sourceRef = useRef(null);
  const [logs, setLogs] = useState([]);
  const [nodeStates, setNodeStates] = useState(new Map());
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!url) return undefined;

    const source = new EventSource(url);
    sourceRef.current = source;
    setIsRunning(true);
    setError('');

    source.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);

        setLogs((prev) => {
          const next = [...prev, payload];
          return next.length > 600 ? next.slice(next.length - 600) : next;
        });

        if (payload?.node) {
          setNodeStates((prev) => {
            const next = new Map(prev);
            const existing = prev.get(payload.node) || {};
            next.set(payload.node, {
              status: payload.status || existing.status || 'running',
              message: payload.message ?? existing.message ?? '',
              meta: { ...(existing.meta || {}), ...(payload.meta || {}) },
              // Shallow-merge structured payloads so e.g. the personas event and
              // the later debate event for the critic node both survive.
              data: payload.data ? { ...(existing.data || {}), ...payload.data } : existing.data,
              ts: payload.ts,
            });
            return next;
          });
        }

        if (payload?.status === 'complete' || payload?.status === 'error') {
          setIsRunning(false);
          source.close();
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'SSE parse error');
      }
    };

    source.onerror = () => {
      setIsRunning(false);
      setError('SSE connection interrupted');
      source.close();
    };

    return () => {
      source.close();
      setIsRunning(false);
    };
  }, [url]);

  const latestEvent = useMemo(() => (logs.length ? logs[logs.length - 1] : null), [logs]);

  // Every debate verdict in order — powers the live score trajectory.
  const debateHistory = useMemo(
    () => logs.filter((l) => l?.node === 'critic' && l?.data?.type === 'debate').map((l) => l.data),
    [logs]
  );

  const resetLogs = () => {
    setLogs([]);
    setNodeStates(new Map());
    setError('');
  };

  return { nodeStates, logs, debateHistory, isRunning, error, latestEvent, resetLogs };
}
