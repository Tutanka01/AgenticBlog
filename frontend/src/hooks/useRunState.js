import { useEffect, useState } from 'react';

// Full pipeline state for a finished run: candidates, debate, iterations, memory.
export function useRunState(runId) {
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!runId) {
      setState(null);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await fetch(`/api/runs/${runId}/state`);
        if (!res.ok) throw new Error('state');
        const json = await res.json();
        if (!cancelled) setState(json);
      } catch {
        if (!cancelled) setState(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [runId]);

  return { state, loading };
}
