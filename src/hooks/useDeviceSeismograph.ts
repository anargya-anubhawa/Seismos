'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { RingBuffer } from '@/lib/seismograph/buffer';
import { GravityFilter, isNum } from '@/lib/seismograph/processing';

export type SensorStatus =
  | 'idle' | 'requesting' | 'waiting' | 'running' | 'paused' | 'stopped'
  | 'denied' | 'unsupported' | 'insecure' | 'nodata';
export type Permission = 'belum diminta' | 'diberikan' | 'ditolak' | 'tidak diperlukan';

export interface SensorStats {
  elapsedMs: number;
  rateHz: number | null;
  valid: number;
  invalid: number;
  truncated: boolean;
  method: string;
}

const LIVE_CAPACITY = 12_000;
const REC_MAX_SAMPLES = 60_000;
const NO_DATA_AFTER_MS = 3000;
const EMPTY: SensorStats = { elapsedMs: 0, rateHz: null, valid: 0, invalid: 0, truncated: false, method: '-' };

const METHOD_LINEAR = 'event.acceleration (percepatan linier dari perangkat, tanpa gravitasi)';
const METHOD_FILTERED = 'accelerationIncludingGravity dikurangi estimasi gravitasi (low-pass eksponensial, α = 0,02 per sampel)';

type PermissionApi = { requestPermission?: () => Promise<'granted' | 'denied'> };

export function useDeviceSeismograph() {
  const live = useRef(new RingBuffer(LIVE_CAPACITY));
  const rec = useRef<number[]>([]);
  const filter = useRef(new GravityFilter());
  const listening = useRef(false);
  const statusRef = useRef<SensorStatus>('idle');
  const valid = useRef(0);
  const invalid = useRef(0);
  const truncated = useRef(false);
  const method = useRef('-');
  const acc = useRef(0);
  const segStart = useRef<number | null>(null);
  const recT0 = useRef<number | null>(null);
  const startedAt = useRef<string | null>(null);
  const ticker = useRef<ReturnType<typeof setInterval> | null>(null);

  const [status, setStatusState] = useState<SensorStatus>('idle');
  const [permission, setPermission] = useState<Permission>('belum diminta');
  const [stats, setStats] = useState<SensorStats>(EMPTY);

  const setStatus = useCallback((s: SensorStatus) => {
    statusRef.current = s;
    setStatusState(s);
  }, []);

  const handler = useRef((e: DeviceMotionEvent) => {
    const t = performance.now();
    const a = e.acceleration;
    const g = e.accelerationIncludingGravity;
    let x: number, y: number, z: number;
    if (a && isNum(a.x) && isNum(a.y) && isNum(a.z)) {
      [x, y, z] = [a.x, a.y, a.z];
      method.current = METHOD_LINEAR;
    } else if (g && isNum(g.x) && isNum(g.y) && isNum(g.z)) {
      [x, y, z] = filter.current.update(g.x, g.y, g.z);
      method.current = METHOD_FILTERED;
    } else {
      invalid.current++;
      return;
    }
    valid.current++;
    live.current.push(t, x, y, z);
    if (rec.current.length / 4 < REC_MAX_SAMPLES) {
      if (recT0.current === null) recT0.current = t;
      rec.current.push(t - recT0.current, x, y, z);
    } else {
      truncated.current = true;
    }
  });

  const tick = useCallback(() => {
    const now = performance.now();
    if (statusRef.current === 'waiting' || statusRef.current === 'nodata') {
      if (valid.current > 0) setStatus('running');
      else if (segStart.current !== null && now - segStart.current > NO_DATA_AFTER_MS) setStatus('nodata');
    }
    const buf = live.current;
    let rateHz: number | null = null;
    if (buf.size >= 2) {
      const i0 = buf.firstIndexAtOrAfter(buf.lastT - 2000);
      const n = buf.size - i0;
      const span = buf.lastT - buf.t(i0);
      if (n >= 2 && span > 0) rateHz = ((n - 1) / span) * 1000;
    }
    setStats({
      elapsedMs: acc.current + (segStart.current !== null ? now - segStart.current : 0),
      rateHz,
      valid: valid.current,
      invalid: invalid.current,
      truncated: truncated.current,
      method: method.current,
    });
  }, [setStatus]);

  const attach = useCallback(() => {
    if (listening.current) return; // mencegah listener ganda
    window.addEventListener('devicemotion', handler.current);
    listening.current = true;
    segStart.current = performance.now();
    if (ticker.current) clearInterval(ticker.current);
    ticker.current = setInterval(tick, 250);
  }, [tick]);

  const detach = useCallback(() => {
    if (listening.current) window.removeEventListener('devicemotion', handler.current);
    listening.current = false;
    if (segStart.current !== null) acc.current += performance.now() - segStart.current;
    segStart.current = null;
    if (ticker.current) clearInterval(ticker.current);
    ticker.current = null;
    tick();
  }, [tick]);

  const clearData = useCallback(() => {
    live.current.clear();
    rec.current = [];
    filter.current.reset();
    valid.current = 0;
    invalid.current = 0;
    truncated.current = false;
    method.current = '-';
    acc.current = 0;
    recT0.current = null;
    startedAt.current = null;
  }, []);

  const start = useCallback(async () => {
    if (typeof window === 'undefined' || !('DeviceMotionEvent' in window)) { setStatus('unsupported'); return; }
    if (!window.isSecureContext) { setStatus('insecure'); return; }
    detach();
    clearData();
    setStatus('requesting');
    const api = window.DeviceMotionEvent as unknown as PermissionApi;
    if (typeof api.requestPermission === 'function') {
      try {
        const res = await api.requestPermission();
        if (res !== 'granted') { setPermission('ditolak'); setStatus('denied'); return; }
        setPermission('diberikan');
      } catch {
        setPermission('ditolak');
        setStatus('denied');
        return;
      }
    } else {
      setPermission('tidak diperlukan');
    }
    startedAt.current = new Date().toISOString();
    attach();
    setStatus('waiting');
  }, [attach, clearData, detach, setStatus]);

  const pause = useCallback(() => { detach(); setStatus('paused'); }, [detach, setStatus]);

  const resume = useCallback(() => {
    filter.current.reset();
    attach();
    setStatus(valid.current > 0 ? 'running' : 'waiting');
  }, [attach, setStatus]);

  const stop = useCallback(() => { detach(); setStatus('stopped'); }, [detach, setStatus]);

  const reset = useCallback(() => {
    detach();
    clearData();
    setStats(EMPTY);
    setStatus('idle');
  }, [clearData, detach, setStatus]);

  /** Salinan rekaman (waktu relatif ms) untuk ekspor atau penyimpanan lokal. */
  const snapshot = useCallback(() => {
    const data = rec.current.slice();
    return {
      startedAt: startedAt.current ?? new Date().toISOString(),
      durationMs: acc.current + (segStart.current !== null ? performance.now() - segStart.current : 0),
      rateHz: stats.rateHz,
      method: method.current,
      data,
    };
  }, [stats.rateHz]);

  useEffect(() => {
    const h = handler.current;
    return () => {
      window.removeEventListener('devicemotion', h);
      listening.current = false;
      if (ticker.current) clearInterval(ticker.current);
    };
  }, []);

  return { live, status, permission, stats, start, pause, resume, stop, reset, snapshot, hasRecording: () => rec.current.length > 0 };
}
