'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useVolcanoQuery, type VolcanoQuery } from '@/hooks/useVolcano';
import type { WeatherAlert, WeatherArea, WeatherForecast } from '@/types/weather';

/**
 * Hook data cuaca BMKG.
 *
 * Pola sama seperti menu lain: loading/error/offline, pembaruan senyap berkala,
 * dan data lama dipertahankan saat pembaruan gagal agar cuaca terakhir tidak
 * hilang begitu saja. Lokasi pengguna disimpan di localStorage supaya cuaca di
 * bagian atas halaman tetap tersedia pada kunjungan berikutnya tanpa meminta
 * izin lokasi berulang kali.
 */

const STORAGE_KEY = 'seismos-weather-area';

/** Wilayah yang dipilih/disetujui pengguna (disimpan di perangkat). */
export interface SavedArea extends WeatherArea {
  /** "geo" = dipilih otomatis dari lokasi browser, "manual" = dipilih sendiri. */
  mode: 'geo' | 'manual';
  /** Jarak lokasi pengguna ke titik wilayah (km), bila berasal dari lokasi browser. */
  distanceKm?: number;
}

export function loadSavedArea(): SavedArea | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedArea;
    if (!parsed?.code || !parsed?.district) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveArea(area: SavedArea | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (area) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(area));
    else window.localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new Event('seismos-weather-area'));
  } catch {
    /* penyimpanan penuh atau diblokir: cuaca tetap tampil untuk sesi ini */
  }
}

/** Hook wilayah aktif cuaca (tersinkron antar komponen lewat event). */
export function useSavedArea(): [SavedArea | null, (area: SavedArea | null) => void] {
  const [area, setArea] = useState<SavedArea | null>(null);
  useEffect(() => {
    setArea(loadSavedArea());
    const sync = () => setArea(loadSavedArea());
    window.addEventListener('seismos-weather-area', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('seismos-weather-area', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);
  const update = useCallback((next: SavedArea | null) => {
    saveArea(next);
    setArea(next);
  }, []);
  return [area, update];
}

interface ForecastPayload {
  forecast: WeatherForecast | null;
  areaDistanceKm?: number;
  outsideCoverage?: boolean;
  error?: string;
}

export type WeatherQuery = VolcanoQuery<WeatherForecast> & { outsideCoverage: boolean };

/** Prakiraan cuaca menurut kode wilayah adm4. */
export function useWeatherForecast(adm4: string | null, pollMs = 15 * 60_000): WeatherQuery {
  const query = useVolcanoQuery<WeatherForecast>(adm4 ? `/api/weather/prakiraan?adm4=${encodeURIComponent(adm4)}` : '', {
    pollMs: adm4 ? pollMs : 0,
    transform: (payload) => (payload as ForecastPayload).forecast,
  });
  return { ...query, outsideCoverage: false };
}

interface AlertsPayload {
  alerts: WeatherAlert[];
  error?: string;
}

/** Peringatan dini cuaca ekstrem (seluruh Indonesia atau satu wilayah). */
export function useWeatherAlerts(region?: string | null, pollMs = 5 * 60_000): VolcanoQuery<WeatherAlert[]> {
  const url = `/api/weather/peringatan${region ? `?wilayah=${encodeURIComponent(region)}` : ''}`;
  return useVolcanoQuery<WeatherAlert[]>(url, {
    pollMs,
    transform: (payload) => (payload as AlertsPayload).alerts ?? [],
  });
}

/* ------------------------------------------------------- lokasi pengguna -- */

export interface GeoState {
  status: 'idle' | 'asking' | 'granted' | 'denied' | 'unavailable' | 'outside';
  latitude: number | null;
  longitude: number | null;
  accuracyM: number | null;
  message: string | null;
}

/**
 * Meminta lokasi browser hanya ketika pengguna menekan tombol. Izin lokasi
 * tidak diminta otomatis saat halaman dibuka: itu mengagetkan pengguna dan
 * sering langsung ditolak sehingga cuaca tidak pernah akurat.
 */
export function useGeolocationRequest() {
  const [state, setState] = useState<GeoState>({
    status: 'idle', latitude: null, longitude: null, accuracyM: null, message: null,
  });
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  const request = useCallback((): Promise<GeoState> => new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      const next: GeoState = {
        status: 'unavailable', latitude: null, longitude: null, accuracyM: null,
        message: 'Peramban ini tidak menyediakan layanan lokasi.',
      };
      setState(next);
      resolve(next);
      return;
    }
    setState((prev) => ({ ...prev, status: 'asking', message: null }));
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (!mounted.current) { resolve({ status: 'granted', latitude: position.coords.latitude, longitude: position.coords.longitude, accuracyM: position.coords.accuracy, message: null }); return; }
        const next: GeoState = {
          status: 'granted',
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracyM: position.coords.accuracy,
          message: null,
        };
        setState(next);
        resolve(next);
      },
      (error) => {
        const denied = error.code === error.PERMISSION_DENIED;
        const next: GeoState = {
          status: denied ? 'denied' : 'unavailable',
          latitude: null,
          longitude: null,
          accuracyM: null,
          message: denied
            ? 'Izin lokasi ditolak. Pilih wilayah secara manual agar cuaca tetap tampil.'
            : 'Lokasi tidak dapat diketahui saat ini. Pilih wilayah secara manual.',
        };
        if (mounted.current) setState(next);
        resolve(next);
      },
      { enableHighAccuracy: false, timeout: 12_000, maximumAge: 10 * 60_000 },
    );
  }), []);

  return { geo: state, request };
}

/** Mencari wilayah cuaca dari koordinat (dipakai setelah izin lokasi diberikan). */
export async function resolveAreaFromPoint(latitude: number, longitude: number): Promise<{
  area: WeatherArea | null;
  distanceKm: number | null;
  outsideCoverage: boolean;
  error: string | null;
}> {
  try {
    const res = await fetch(`/api/weather/prakiraan?lat=${latitude}&lon=${longitude}`, { cache: 'no-store' });
    const payload = await res.json() as ForecastPayload;
    if (payload.forecast) {
      return {
        area: payload.forecast.area,
        distanceKm: payload.areaDistanceKm ?? null,
        outsideCoverage: false,
        error: null,
      };
    }
    return {
      area: null,
      distanceKm: null,
      outsideCoverage: Boolean(payload.outsideCoverage),
      error: payload.error ?? 'Wilayah cuaca tidak ditemukan untuk lokasi ini.',
    };
  } catch (error) {
    return {
      area: null,
      distanceKm: null,
      outsideCoverage: false,
      error: error instanceof Error ? error.message : 'Kesalahan jaringan',
    };
  }
}
