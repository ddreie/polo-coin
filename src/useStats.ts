import { useEffect, useState } from 'react';
import { api, type Stats } from './api';

/** Live figures from the prototype's database, refreshed every 10 s. */
export function useStats() {
  const [stats, setStats] = useState<Stats | null>(null);
  useEffect(() => {
    const load = () => api.stats().then(setStats).catch(() => undefined);
    load();
    const id = setInterval(load, 10000);
    return () => clearInterval(id);
  }, []);
  return stats;
}
