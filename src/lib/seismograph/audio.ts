import type { RingBuffer } from './buffer';

export const AUDIO_MIN_INTERVAL_MS = 70;
export const AUDIO_MAX_INTERVAL_MS = 650;
export const AUDIO_SILENCE_LEVEL = 0.015;
export const AUDIO_AMPLITUDE_WINDOW_MS = 300;

/** Amplitudo resultan terbesar pada jendela waktu terakhir. */
export function recentAmplitude(buffer: RingBuffer, windowMs = AUDIO_AMPLITUDE_WINDOW_MS): number {
  if (buffer.size === 0) return 0;
  const i0 = buffer.firstIndexAtOrAfter(buffer.lastT - windowMs);
  let max = 0;
  for (let i = i0; i < buffer.size; i++) {
    max = Math.max(max, Math.hypot(buffer.x(i), buffer.y(i), buffer.z(i)));
  }
  return max;
}

/** Petakan amplitudo (m/s²) ke tingkat 0..1 secara non-linear agar getaran kecil tetap terdengar. */
export function levelFor(amplitude: number): number {
  if (!Number.isFinite(amplitude) || amplitude <= 0) return 0;
  return Math.min(1, Math.sqrt(amplitude / 2));
}

/** Semakin besar level, semakin rapat bunyi. */
export function intervalFor(level: number): number {
  const safe = Math.max(0, Math.min(1, level));
  return Math.max(
    AUDIO_MIN_INTERVAL_MS,
    AUDIO_MAX_INTERVAL_MS - safe * (AUDIO_MAX_INTERVAL_MS - AUDIO_MIN_INTERVAL_MS),
  );
}

/** Gain puncak bunyi; volume 0..100 dari pengguna. */
export function peakGainFor(level: number, volume: number): number {
  const master = Math.max(0, Math.min(100, volume)) / 100;
  const safe = Math.max(0, Math.min(1, level));
  return Math.max(0.0002, master * (0.02 + safe * 0.15));
}
