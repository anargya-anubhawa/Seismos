'use client';

import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
  type ReactNode,
} from 'react';
import { useEarthquakes } from '@/hooks/useEarthquakes';
import { isSignificantEarthquake } from '@/lib/alerts';
import {
  DEFAULT_ALARM_SOUND, DEFAULT_ALARM_VOLUME, isAlarmSoundId, type AlarmSoundId,
} from '@/lib/alarms';
import { provinceById, provinceForPoint } from '@/lib/provinces';
import type { Earthquake } from '@/types/earthquake';
import { fmtTime } from '@/lib/formatting';

const ENABLED_KEY = 'seismos-notify-enabled';
const SEEN_KEY = 'seismos-notify-last-seen';
const SEEN_IMPORTANT_KEY = 'seismos-notify-seen-important';
const ALARM_KEY = 'seismos-notify-alarm';
const ALARM_SOUND_KEY = 'seismos-notify-alarm-sound';
const ALARM_VOLUME_KEY = 'seismos-notify-alarm-volume';
const SCOPE_KEY = 'seismos-notify-scope';
const AREA_KEY = 'seismos-notify-area';
const PROVINCE_KEY = 'seismos-notify-province';
const LOOKBACK_MS = 6 * 3_600_000;
const ALARM_MAX_AGE_MS = 15 * 60_000;
const MAX_SEEN_IDS = 400;

export type AlertScope = 'important' | 'all';
export type AlertArea = 'indonesia' | 'province';

interface NotificationState {
  ready: boolean;
  supported: boolean;
  permission: NotificationPermission;
  enabled: boolean;
  alarmSupported: boolean;
  alarmEnabled: boolean;
  alarmSound: AlarmSoundId;
  alarmVolume: number;
  scope: AlertScope;
  area: AlertArea;
  provinceId: string | null;
  enable: () => Promise<boolean>;
  disable: () => void;
  setAlarmEnabled: (value: boolean) => void;
  setAlarmSound: (value: AlarmSoundId) => void;
  setAlarmVolume: (value: number) => void;
  previewAlarm: () => void;
  setScope: (scope: AlertScope) => void;
  setArea: (area: AlertArea) => void;
  setProvinceId: (id: string | null) => void;
  test: () => void;
}

const Ctx = createContext<NotificationState | null>(null);

const readNumber = (key: string): number => {
  try {
    const n = Number(localStorage.getItem(key));
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
};

const writeNumber = (key: string, value: number): void => {
  try { localStorage.setItem(key, String(value)); } catch { /* penyimpanan diblokir */ }
};

const readVolume = (): number => {
  try {
    const raw = localStorage.getItem(ALARM_VOLUME_KEY);
    if (raw === null) return DEFAULT_ALARM_VOLUME;
    const value = Number(raw);
    return Number.isFinite(value) ? Math.min(100, Math.max(0, Math.round(value))) : DEFAULT_ALARM_VOLUME;
  } catch {
    return DEFAULT_ALARM_VOLUME;
  }
};

const readSeenIds = (): Set<string> => {
  try {
    const raw = localStorage.getItem(SEEN_IMPORTANT_KEY);
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((value): value is string => typeof value === 'string').slice(-MAX_SEEN_IDS));
  } catch {
    return new Set();
  }
};

type AudioWindow = Window & { webkitAudioContext?: typeof AudioContext };

/**
 * Notifikasi web dan alarm audio saat halaman terbuka. Ini bukan push notification
 * latar belakang: browser hanya dapat menampilkan notifikasi dan memutar suara
 * selama aplikasi masih dimuat. Alarm mengikuti kebijakan autoplay browser, jadi
 * audio baru aktif setelah ada interaksi pengguna.
 */
export function NotificationProvider({ children }: { children: ReactNode }) {
  const { data } = useEarthquakes();
  const [ready, setReady] = useState(false);
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [enabled, setEnabled] = useState(false);
  const [alarmSupported, setAlarmSupported] = useState(false);
  const [alarmEnabled, setAlarmEnabledState] = useState(true);
  const [alarmSound, setAlarmSoundState] = useState<AlarmSoundId>(DEFAULT_ALARM_SOUND);
  const [alarmVolume, setAlarmVolumeState] = useState(DEFAULT_ALARM_VOLUME);
  const [scope, setScopeState] = useState<AlertScope>('important');
  const [area, setAreaState] = useState<AlertArea>('indonesia');
  const [provinceId, setProvinceIdState] = useState<string | null>(null);
  const lastSeen = useRef(0);
  const seenImportant = useRef<Set<string>>(new Set());
  const seenReady = useRef(false);
  const dataRef = useRef(data);
  dataRef.current = data;
  const audioCtx = useRef<AudioContext | null>(null);

  useEffect(() => {
    const ok = typeof window !== 'undefined' && 'Notification' in window;
    setSupported(ok);
    const hasAudio = typeof window !== 'undefined'
      && Boolean(window.AudioContext ?? (window as AudioWindow).webkitAudioContext);
    setAlarmSupported(hasAudio);
    if (!ok) {
      setReady(true);
      return;
    }
    setPermission(Notification.permission);
    lastSeen.current = readNumber(SEEN_KEY);
    seenImportant.current = readSeenIds();
    // Versi lama hanya menyimpan lastSeen. Jangan kirim notifikasi backlog saat migrasi.
    seenReady.current = seenImportant.current.size > 0 || lastSeen.current === 0;
    let saved = false;
    try {
      saved = localStorage.getItem(ENABLED_KEY) === '1';
      setAlarmEnabledState(localStorage.getItem(ALARM_KEY) !== '0');
      const savedSound = localStorage.getItem(ALARM_SOUND_KEY);
      if (isAlarmSoundId(savedSound)) setAlarmSoundState(savedSound);
      setAlarmVolumeState(readVolume());
      const savedScope = localStorage.getItem(SCOPE_KEY);
      if (savedScope === 'important' || savedScope === 'all') setScopeState(savedScope);
      const savedArea = localStorage.getItem(AREA_KEY);
      if (savedArea === 'indonesia' || savedArea === 'province') setAreaState(savedArea);
      const savedProvince = localStorage.getItem(PROVINCE_KEY);
      if (savedProvince && provinceById(savedProvince)) setProvinceIdState(savedProvince);
    } catch { /* penyimpanan diblokir */ }
    setEnabled(saved && Notification.permission === 'granted');
    setReady(true);
  }, []);

  const getAudioContext = useCallback((): AudioContext | null => {
    if (typeof window === 'undefined') return null;
    if (!audioCtx.current) {
      const Ctor = window.AudioContext ?? (window as AudioWindow).webkitAudioContext;
      if (!Ctor) return null;
      try { audioCtx.current = new Ctor(); } catch { return null; }
    }
    return audioCtx.current;
  }, []);

  /** Dipanggil dari gesture pengguna agar browser mengizinkan audio. */
  const unlockAudio = useCallback(() => {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') void ctx.resume().catch(() => { /* diblokir browser */ });
  }, [getAudioContext]);

  /** Alarm pendek sesuai pilihan pengguna; bukan sirine evakuasi resmi. */
  const playAlarm = useCallback(async () => {
    const ctx = getAudioContext();
    if (!ctx) return;
    try {
      if (ctx.state === 'suspended') await ctx.resume();
    } catch {
      return; // browser memblokir audio sebelum ada interaksi
    }
    if (ctx.state !== 'running') return;

    try {
      const start = ctx.currentTime + 0.02;
      const level = Math.max(0, Math.min(100, alarmVolume)) / 100;
      const master = ctx.createGain();
      master.gain.setValueAtTime(level, start);
      master.connect(ctx.destination);

      const envelope = (gain: GainNode, t: number, duration: number, peak: number) => {
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(peak, t + Math.min(0.02, duration / 3));
        gain.gain.setValueAtTime(peak, t + Math.max(0.03, duration - 0.06));
        gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
      };

      const tone = (frequency: number, offset: number, duration: number, type: OscillatorType, peak = 0.6) => {
        const t = start + offset;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(frequency, t);
        envelope(gain, t, duration, peak);
        osc.connect(gain);
        gain.connect(master);
        osc.start(t);
        osc.stop(t + duration + 0.02);
      };

      const sweep = (from: number, to: number, offset: number, duration: number, type: OscillatorType, peak = 0.45) => {
        const t = start + offset;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(from, t);
        osc.frequency.exponentialRampToValueAtTime(to, t + duration);
        envelope(gain, t, duration, peak);
        osc.connect(gain);
        gain.connect(master);
        osc.start(t);
        osc.stop(t + duration + 0.02);
      };

      if (alarmSound === 'chime') {
        [784, 988, 1175].forEach((frequency, index) => tone(frequency, index * 0.28, 0.9, 'sine', 0.35));
      } else if (alarmSound === 'siren') {
        sweep(500, 1000, 0, 0.45, 'sawtooth', 0.35);
        sweep(1000, 500, 0.45, 0.45, 'sawtooth', 0.35);
        sweep(500, 1000, 0.9, 0.45, 'sawtooth', 0.35);
        sweep(1000, 500, 1.35, 0.45, 'sawtooth', 0.35);
      } else if (alarmSound === 'pulse') {
        [0, 0.18, 0.36, 0.54].forEach((offset) => tone(1046, offset, 0.11, 'square', 0.45));
      } else {
        [0, 0.45, 0.9].forEach((offset) => {
          const t = start + offset;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(880, t);
          osc.frequency.setValueAtTime(660, t + 0.13);
          osc.frequency.setValueAtTime(880, t + 0.26);
          envelope(gain, t, 0.38, 0.6);
          osc.connect(gain);
          gain.connect(master);
          osc.start(t);
          osc.stop(t + 0.4);
        });
      }

      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try { navigator.vibrate([200, 100, 200, 100, 400]); } catch { /* tidak didukung */ }
      }
      window.setTimeout(() => {
        try { master.disconnect(); } catch { /* sudah dilepas */ }
      }, 2600);
    } catch {
      /* AudioContext dapat ditutup browser kapan saja. */
    }
  }, [alarmSound, alarmVolume, getAudioContext]);

  const previewAlarm = useCallback(() => {
    if (!alarmSupported) return;
    unlockAudio();
    void playAlarm();
  }, [alarmSupported, playAlarm, unlockAudio]);

  useEffect(() => () => {
    const ctx = audioCtx.current;
    if (ctx && ctx.state !== 'closed') void ctx.close().catch(() => { /* abaikan */ });
  }, []);

  const markSignificantSeen = useCallback((events: Earthquake[]) => {
    for (const event of events) {
      if (isSignificantEarthquake(event)) seenImportant.current.add(event.id);
    }
    const ids = Array.from(seenImportant.current).slice(-MAX_SEEN_IDS);
    seenImportant.current = new Set(ids);
    try { localStorage.setItem(SEEN_IMPORTANT_KEY, JSON.stringify(ids)); } catch { /* abaikan */ }
  }, []);

  const show = useCallback((event: Earthquake) => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;
    try {
      const notification = new Notification(`Gempa M ${event.magnitude.toFixed(1)} — ${event.region}`, {
        body: `${fmtTime(event.originTime)} · kedalaman ${event.depthKm} km${event.maxMmi ? ` · MMI ${event.maxMmi}` : ''}`,
        tag: `seismos-${event.id}`,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        requireInteraction: isSignificantEarthquake(event),
      });
      notification.onclick = () => {
        window.focus();
        window.location.assign(`/event/${event.id}`);
        notification.close();
      };
    } catch {
      /* Browser dapat menolak notifikasi meski izin diberikan. */
    }
  }, []);

  const enable = useCallback(async (): Promise<boolean> => {
    if (typeof window === 'undefined' || !('Notification' in window)) return false;
    // Buka audio selagi masih di dalam gesture klik; prompt izin bisa memutus activation.
    if (alarmEnabled) unlockAudio();
    let result = Notification.permission;
    if (result === 'default') {
      try { result = await Notification.requestPermission(); }
      catch { result = 'denied'; }
    }
    setPermission(result);
    if (result !== 'granted') {
      setEnabled(false);
      try { localStorage.removeItem(ENABLED_KEY); } catch { /* abaikan */ }
      return false;
    }

    setEnabled(true);
    try { localStorage.setItem(ENABLED_KEY, '1'); } catch { /* abaikan */ }
    if (alarmEnabled) unlockAudio();

    // Jangan membanjiri pengguna dengan kejadian lama saat pertama kali diaktifkan.
    const events = dataRef.current?.events ?? [];
    markSignificantSeen(events);
    seenReady.current = true;
    const newest = events.reduce((max, e) => Math.max(max, Date.parse(e.originTime)), 0);
    if (newest > 0) {
      lastSeen.current = newest;
      writeNumber(SEEN_KEY, newest);
    }
    return true;
  }, [alarmEnabled, markSignificantSeen, unlockAudio]);

  const disable = useCallback(() => {
    setEnabled(false);
    try { localStorage.removeItem(ENABLED_KEY); } catch { /* abaikan */ }
    const ctx = audioCtx.current;
    if (ctx && ctx.state === 'running') void ctx.suspend().catch(() => { /* abaikan */ });
  }, []);

  const setAlarmEnabled = useCallback((value: boolean) => {
    setAlarmEnabledState(value);
    try { localStorage.setItem(ALARM_KEY, value ? '1' : '0'); } catch { /* abaikan */ }
    if (value) unlockAudio();
  }, [unlockAudio]);

  const setAlarmSound = useCallback((value: AlarmSoundId) => {
    setAlarmSoundState(value);
    try { localStorage.setItem(ALARM_SOUND_KEY, value); } catch { /* abaikan */ }
    unlockAudio();
  }, [unlockAudio]);

  const setAlarmVolume = useCallback((value: number) => {
    const next = Math.max(0, Math.min(100, Math.round(value)));
    setAlarmVolumeState(next);
    try { localStorage.setItem(ALARM_VOLUME_KEY, String(next)); } catch { /* abaikan */ }
    unlockAudio();
  }, [unlockAudio]);

  const setScope = useCallback((value: AlertScope) => {
    setScopeState(value);
    try { localStorage.setItem(SCOPE_KEY, value); } catch { /* abaikan */ }
  }, []);

  const setArea = useCallback((value: AlertArea) => {
    setAreaState(value);
    try { localStorage.setItem(AREA_KEY, value); } catch { /* abaikan */ }
  }, []);

  const setProvinceId = useCallback((value: string | null) => {
    const valid = value && provinceById(value) ? value : null;
    setProvinceIdState(valid);
    try {
      if (valid) localStorage.setItem(PROVINCE_KEY, valid);
      else localStorage.removeItem(PROVINCE_KEY);
    } catch { /* abaikan */ }
  }, []);

  const test = useCallback(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;
    const provinceName = provinceById(provinceId)?.name;
    const areaText = area === 'province'
      ? provinceName
        ? `hanya gempa di sekitar ${provinceName}`
        : 'provinsi sekitar lokasi Anda (provinsi belum dipilih)'
      : 'seluruh Indonesia';
    try {
      new Notification('Notifikasi Seismos Indonesia aktif', {
        body: alarmEnabled && alarmSupported
          ? `Anda akan diberi notifikasi dan alarm untuk ${areaText} saat data BMKG memuat gempa penting baru.`
          : `Anda akan diberi notifikasi untuk ${areaText} saat data BMKG memuat gempa baru selama halaman ini terbuka.`,
        tag: 'seismos-test',
        icon: '/icon-192.png',
      });
    } catch {
      /* abaikan */
    }
    if (alarmEnabled) previewAlarm();
  }, [alarmEnabled, alarmSupported, area, previewAlarm, provinceId]);

  useEffect(() => {
    if (!enabled || !alarmEnabled) return;
    const unlock = () => unlockAudio();
    window.addEventListener('pointerdown', unlock, { once: true, passive: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, [enabled, alarmEnabled, unlockAudio]);

  useEffect(() => {
    if (!enabled || permission !== 'granted' || !data) return;
    const events = data.events;
    if (events.length === 0) return;

    const newest = events.reduce((max, e) => Math.max(max, Date.parse(e.originTime)), 0);
    if (!newest) return;
    const significant = events.filter(isSignificantEarthquake);

    // first run atau migrasi dari versi yang hanya menyimpan timestamp:
    // tandai data yang sudah ada sebagai sudah dilihat, jangan kirim backlog.
    if (!lastSeen.current || !seenReady.current) {
      markSignificantSeen(events);
      seenReady.current = true;
      lastSeen.current = newest;
      writeNumber(SEEN_KEY, newest);
      return;
    }

    const cutoff = Date.now() - LOOKBACK_MS;
    const inArea = (event: Earthquake) => area === 'indonesia'
      || (provinceId !== null && provinceForPoint(event.latitude, event.longitude).id === provinceId);
    const fresh = (scope === 'all'
      ? events.filter((e) => {
        const t = Date.parse(e.originTime);
        return t > lastSeen.current && t >= cutoff;
      })
      : significant.filter((e) => {
        const t = Date.parse(e.originTime);
        return !seenImportant.current.has(e.id) && t >= cutoff;
      })
    ).filter(inArea).sort((a, b) => b.originTime.localeCompare(a.originTime));

    if (fresh.length === 0) {
      markSignificantSeen(events);
      if (newest > lastSeen.current) {
        lastSeen.current = newest;
        writeNumber(SEEN_KEY, newest);
      }
      return;
    }

    for (const event of fresh.slice(0, 3)) show(event);

    const alarmCutoff = Date.now() - ALARM_MAX_AGE_MS;
    const hasFreshAlarm = fresh.some((e) => {
      const t = Date.parse(e.originTime);
      return t >= alarmCutoff && isSignificantEarthquake(e);
    });
    if (alarmEnabled && hasFreshAlarm) void playAlarm();

    markSignificantSeen(events);
    lastSeen.current = newest;
    writeNumber(SEEN_KEY, newest);
  }, [data, enabled, permission, show, alarmEnabled, scope, area, provinceId, playAlarm, markSignificantSeen]);

  const value = useMemo(
    () => ({
      ready, supported, permission, enabled, alarmSupported, alarmEnabled, alarmSound, alarmVolume, scope,
      area, provinceId,
      enable, disable, setAlarmEnabled, setAlarmSound, setAlarmVolume, previewAlarm, setScope, setArea,
      setProvinceId, test,
    }),
    [
      ready, supported, permission, enabled, alarmSupported, alarmEnabled, alarmSound, alarmVolume, scope,
      area, provinceId,
      enable, disable, setAlarmEnabled, setAlarmSound, setAlarmVolume, previewAlarm, setScope, setArea,
      setProvinceId, test,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useNotifications(): NotificationState {
  const value = useContext(Ctx);
  if (!value) throw new Error('useNotifications harus dipakai di dalam NotificationProvider');
  return value;
}
