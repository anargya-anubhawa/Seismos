'use client';

import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
  type ReactNode,
} from 'react';
import type { EarthquakeResponse } from '@/types/earthquake';

interface State {
  data: EarthquakeResponse | null;
  loading: boolean;
  /** Pesan galat pengambilan terakhir; data lama (jika ada) tetap tersedia di `data`. */
  error: string | null;
  refresh: () => void;
}

const Ctx = createContext<State | null>(null);
const POLL_MS = 60_000;

/** Satu-satunya tempat browser mengambil data gempa; halaman lain membaca dari context ini. */
export function EarthquakeProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<EarthquakeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const ctl = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    ctl.current?.abort();
    const c = new AbortController();
    ctl.current = c;
    try {
      const res = await fetch('/api/earthquakes', { signal: c.signal, cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`);
      setData(json as EarthquakeResponse);
      setError(null);
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
      setError(e instanceof Error ? e.message : 'Tidak dapat mengambil data gempa.');
    } finally {
      if (ctl.current === c) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') load();
    }, POLL_MS);
    // Saat tab kembali dibuka atau jaringan pulih, jangan tunggu interval berikutnya.
    const onVisible = () => { if (document.visibilityState === 'visible') load(); };
    const onOnline = () => load();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onOnline);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onOnline);
      ctl.current?.abort();
    };
  }, [load]);

  const value = useMemo(() => ({ data, loading, error, refresh: load }), [data, loading, error, load]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useEarthquakes(): State {
  const v = useContext(Ctx);
  if (!v) throw new Error('useEarthquakes harus dipakai di dalam EarthquakeProvider');
  return v;
}
