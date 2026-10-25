'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { RingBuffer } from '@/lib/seismograph/buffer';
import {
  AUDIO_AMPLITUDE_WINDOW_MS, AUDIO_SILENCE_LEVEL, intervalFor, levelFor, peakGainFor, recentAmplitude,
} from '@/lib/seismograph/audio';

type AudioWindow = Window & { webkitAudioContext?: typeof AudioContext };

/**
 * Sonifikasi sederhana untuk grafik seismograf: semakin besar amplitudo,
 * semakin rapat dan keras bunyi pendek. Ini bukan alarm gempa dan bukan
 * analisis seismik.
 */
export function useSeismicAudio({ buffer, active }: { buffer: RingBuffer; active: boolean }) {
  const [supported, setSupported] = useState(false);
  const [enabled, setEnabledState] = useState(true);
  const [volume, setVolumeState] = useState(55);
  const ctxRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const runningRef = useRef(false);
  const bufferRef = useRef(buffer);
  const enabledRef = useRef(enabled);
  const volumeRef = useRef(volume);
  const lastVersionRef = useRef(-1);

  bufferRef.current = buffer;
  enabledRef.current = enabled;
  volumeRef.current = volume;

  useEffect(() => {
    const Ctor = typeof window === 'undefined'
      ? undefined
      : window.AudioContext ?? (window as AudioWindow).webkitAudioContext;
    setSupported(Boolean(Ctor));
  }, []);

  const getContext = useCallback((): AudioContext | null => {
    if (typeof window === 'undefined') return null;
    if (ctxRef.current) return ctxRef.current;
    const Ctor = window.AudioContext ?? (window as AudioWindow).webkitAudioContext;
    if (!Ctor) return null;
    try {
      ctxRef.current = new Ctor();
      return ctxRef.current;
    } catch {
      return null;
    }
  }, []);

  /** Panggil dari gesture pengguna agar browser mengizinkan audio. */
  const unlock = useCallback(() => {
    const ctx = getContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') void ctx.resume().catch(() => { /* diblokir browser */ });
  }, [getContext]);

  const playBlip = useCallback((level: number) => {
    const ctx = getContext();
    if (!ctx || ctx.state !== 'running') return;
    if (volumeRef.current <= 0) return;

    const now = ctx.currentTime;
    const peak = peakGainFor(level, volumeRef.current);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(620 + level * 520, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(peak, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.075);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.onended = () => {
      try { gain.disconnect(); } catch { /* sudah dilepas */ }
    };
    osc.start(now);
    osc.stop(now + 0.085);
  }, [getContext]);

  useEffect(() => {
    if (!active || !enabled || !supported) {
      runningRef.current = false;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    unlock();
    runningRef.current = true;
    lastVersionRef.current = -1;

    const loop = () => {
      if (!runningRef.current) return;
      const current = bufferRef.current;
      if (current.version !== lastVersionRef.current) {
        lastVersionRef.current = current.version;
        const level = levelFor(recentAmplitude(current, AUDIO_AMPLITUDE_WINDOW_MS));
        if (level > AUDIO_SILENCE_LEVEL && enabledRef.current) playBlip(level);
        timerRef.current = setTimeout(loop, intervalFor(level));
      } else {
        timerRef.current = setTimeout(loop, 120);
      }
    };

    timerRef.current = setTimeout(loop, 120);
    return () => {
      runningRef.current = false;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [active, enabled, supported, buffer, playBlip, unlock]);

  const setEnabled = useCallback((value: boolean) => {
    setEnabledState(value);
    enabledRef.current = value;
    if (value) unlock();
  }, [unlock]);

  const setVolume = useCallback((value: number) => {
    const next = Math.max(0, Math.min(100, Math.round(value)));
    setVolumeState(next);
    volumeRef.current = next;
    unlock();
  }, [unlock]);

  useEffect(() => () => {
    runningRef.current = false;
    if (timerRef.current) clearTimeout(timerRef.current);
    const ctx = ctxRef.current;
    ctxRef.current = null;
    if (ctx && ctx.state !== 'closed') void ctx.close().catch(() => { /* abaikan */ });
  }, []);

  return { supported, enabled, setEnabled, volume, setVolume, unlock };
}
