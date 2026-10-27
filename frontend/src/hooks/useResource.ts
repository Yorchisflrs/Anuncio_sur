import { useEffect, useState } from 'react';
import { api, errorMessage } from '../services/api';

export function useResource<T>(endpoint: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    api<T>(endpoint, { signal: controller.signal }).then(result => { if (!controller.signal.aborted) setData(result); }).catch(error => { if (!controller.signal.aborted) setError(errorMessage(error)); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [endpoint, revision]);
  return { data, error, loading, reload: () => setRevision(value => value + 1) };
}
