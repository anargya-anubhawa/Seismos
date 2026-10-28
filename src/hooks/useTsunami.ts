'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { TsunamiFeed } from '@/types/tsunami';

const POLL_MS = 60_000;

interface TsunamiState {
  data: TsunamiFeed | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useTsunami(): TsunamiState {
  const [data, setData] = useState<TsunamiFeed | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const sequence = useRef(0);
  const inFlight = useRef(false);

  const load = useCallback(async (silent = false) => {
    if (inFlight.current && silent) return;
    const id = ++sequence.current;
    inFlight.current = true;
    if (!silent) setLoading(true);
    try {
      const response = await fetch('/api/tsunami', { cache: 'no-store' });
      const payload = await response.json().catch(() => null) as (TsunamiFeed & { error?: string }) | null;
      if (id !== sequence.current) return;
      if (payload && Array.isArray(payload.sources) && Array.isArray(payload.alerts)) {
        setData(payload);
        setError(null);
      } else if (!response.ok) {
        setError(payload?.message ?? payload?.error ?? `Sumber tsunami membalas HTTP ${response.status}`);
      } else {
        setError('Respons status tsunami tidak dikenali.');
      }
    } catch (cause) {
      if (id !== sequence.current) return;
      setError(cause instanceof Error ? cause.message : 'Tidak dapat menghubungi server.');
    } finally {
      if (id === sequence.current) {
        inFlight.current = false;
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void load(false);
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load(true);
    }, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void load(true);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [load]);

  const refresh = useCallback(async () => { await load(false); }, [load]);

  return { data, loading, error, refresh };
}
