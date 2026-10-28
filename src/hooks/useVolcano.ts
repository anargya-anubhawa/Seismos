'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Hook data gunung api dengan pola yang sama seperti `useTsunami`:
 * - state loading / error / data,
 * - pembaruan senyap berkala tanpa mengosongkan data lama,
 * - mendeteksi mode offline browser agar UI menampilkan status yang benar.
 */
export interface VolcanoQuery<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  offline: boolean;
  updatedAt: string | null;
  refresh: () => Promise<void>;
}

export function useVolcanoQuery<T>(
  url: string,
  options: { pollMs?: number; transform?: (payload: unknown) => T | null } = {},
): VolcanoQuery<T> {
  const { pollMs = 0, transform } = options;
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const sequence = useRef(0);
  const inFlight = useRef(false);

  const load = useCallback(async (silent = false) => {
    if (inFlight.current && silent) return;
    const id = ++sequence.current;
    inFlight.current = true;
    if (!silent) setLoading(true);
    try {
      const response = await fetch(url, { cache: 'no-store' });
      const payload = await response.json().catch(() => null) as (T & { error?: string }) | null;
      if (id !== sequence.current) return;
      const parsed = transform && payload ? transform(payload) : payload as T | null;
      if (payload && parsed !== null) {
        setData(parsed);
        setError(payload.error ?? (response.ok ? null : `Sumber membalas HTTP ${response.status}`));
        setUpdatedAt(new Date().toISOString());
        setOffline(false);
      } else {
        setError(payload?.error ?? `Data gunung api tidak tersedia (HTTP ${response.status}).`);
      }
    } catch (e) {
      if (id !== sequence.current) return;
      const message = e instanceof Error ? e.message : 'Kesalahan jaringan';
      setError(`Tidak dapat menghubungi server Seismos: ${message}`);
      if (typeof navigator !== 'undefined' && navigator.onLine === false) setOffline(true);
    } finally {
      if (id === sequence.current) {
        inFlight.current = false;
        setLoading(false);
      }
    }
  }, [url, transform]);

  useEffect(() => {
    void load();
    return () => { sequence.current += 1; };
  }, [load]);

  useEffect(() => {
    if (!pollMs) return;
    const timer = setInterval(() => { void load(true); }, pollMs);
    return () => clearInterval(timer);
  }, [load, pollMs]);

  useEffect(() => {
    const onOnline = () => { setOffline(false); void load(true); };
    const onOffline = () => setOffline(true);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    if (navigator.onLine === false) setOffline(true);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [load]);

  const refresh = useCallback(async () => { await load(); }, [load]);

  return { data, loading, error, offline, updatedAt, refresh };
}

/** Ambil nilai awal dari payload JSON yang bentuknya berbeda antar-endpoint. */
export const pick = <T>(payload: unknown, key: string, fallback: T): T => {
  if (payload && typeof payload === 'object') {
    const value = (payload as Record<string, unknown>)[key];
    if (value !== undefined && value !== null) return value as T;
  }
  return fallback;
};
