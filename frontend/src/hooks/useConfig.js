import { useEffect, useState } from 'react';

// Categories, languages and pipeline thresholds — drives Compose and Settings.
export function useConfig() {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/config');
        if (!res.ok) throw new Error('config');
        const json = await res.json();
        if (!cancelled) setConfig(json);
      } catch {
        if (!cancelled) setConfig(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return { config, loading };
}
