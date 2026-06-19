import { useCallback, useEffect, useState } from 'react';

// Editorial memory: recent-run index, per-category topics, weighted lessons.
export function useMemory() {
  const [memory, setMemory] = useState(null);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/memory');
      if (!res.ok) throw new Error('memory');
      setMemory(await res.json());
    } catch {
      setMemory(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refetch(); }, [refetch]);

  return { memory, loading, refetch };
}
