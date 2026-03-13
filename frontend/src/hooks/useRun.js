import { useEffect, useState } from 'react';

export function useRun(runId) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!runId) {
      setData(null);
      return;
    }

    let cancelled = false;

    const fetchRun = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await fetch(`/api/runs/${runId}`);
        if (!res.ok) {
          throw new Error('Failed to load run details');
        }
        const json = await res.json();
        if (!cancelled) {
          setData(json);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unknown error');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchRun();
    return () => {
      cancelled = true;
    };
  }, [runId]);

  return { data, loading, error };
}
