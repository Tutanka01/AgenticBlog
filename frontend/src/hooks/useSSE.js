import { useEffect, useMemo, useRef, useState } from 'react';

export function useSSE(url) {
  const sourceRef = useRef(null);
  const [logs, setLogs] = useState([]);
  const [nodeStates, setNodeStates] = useState(new Map());
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!url) {
      return;
    }

    const source = new EventSource(url);
    sourceRef.current = source;
    setIsRunning(true);
    setError('');

    source.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        setLogs((prev) => {
          const next = [...prev, payload];
          if (next.length > 500) {
            return next.slice(next.length - 500);
          }
          return next;
        });

        if (payload?.node) {
          setNodeStates((prev) => {
            const next = new Map(prev);
            const existing = prev.get(payload.node) || {};
            // Merge meta across events so data from earlier logs (e.g. persona names)
            // is preserved when the final score event arrives.
            next.set(payload.node, {
              status: payload.status,
              message: payload.message,
              meta: { ...(existing.meta || {}), ...(payload.meta || {}) },
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

  const resetLogs = () => {
    setLogs([]);
    setNodeStates(new Map());
  };

  return {
    nodeStates,
    logs,
    isRunning,
    error,
    latestEvent,
    resetLogs,
  };
}
