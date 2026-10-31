/**
 * Aturan "gempa mana yang harus dikirim ke perangkat ini".
 *
 * Sumber kebenaran perilaku adalah kode web, bukan tebakan:
 *
 *  - Cakupan (`scope`) — `src/hooks/useNotifications.tsx`:
 *      `scope === 'all'` → setiap gempa baru;
 *      selain itu        → hanya `isSignificantEarthquake(e)` (M≥5 ATAU dirasakan ATAU MMI>0).
 *  - Area (`area`) — `useNotifications.tsx` `inArea`:
 *      `area === 'indonesia'` → semua;
 *      selain itu             → `provinceForPoint(lat, lon).id === provinceId`.
 *
 * `radius` adalah tambahan (fitur baru D-021) dan memakai `distanceKm` yang sama dengan
 * `src/lib/geo.ts`, sehingga jarak yang ditampilkan app dan yang dipakai backend identik.
 */

import { isSignificantEarthquake } from '../alerts';
import { provinceById, provinceForPoint } from '../provinces';
import type { FeltReport } from '../../types/earthquake';
import { distanceKm } from './identity';

export type QuakeScope = 'important' | 'all';
export type QuakeArea = 'indonesia' | 'province' | 'radius';

export const RADIUS_MIN_KM = 10;
export const RADIUS_MAX_KM = 500;

export interface QuakeRule {
  scope: QuakeScope;
  area: QuakeArea;
  provinceId: string | null;
  radiusKm: number | null;
  centerLat: number | null;
  centerLon: number | null;
}

export const DEFAULT_QUAKE_RULE: QuakeRule = {
  scope: 'important',
  area: 'indonesia',
  provinceId: null,
  radiusKm: null,
  centerLat: null,
  centerLon: null,
};

interface QuakeLike {
  latitude: number;
  longitude: number;
  magnitude: number;
  feltReports?: FeltReport[];
  maxMmi?: number;
}

/**
 * True bila perangkat ini berlangganan gempa tersebut.
 *
 * Catatan: fungsi ini HANYA menjawab cakupan+area. Aturan "penting" dipakai di dalam
 * `scope`, bukan tambahan di sini, supaya tidak ada dua definisi penting yang bisa
 * menyimpang.
 */
export function matchesQuakeRule(rule: QuakeRule, event: QuakeLike): boolean {
  if (rule.scope !== 'all' && !isSignificantEarthquake({
    magnitude: event.magnitude,
    feltReports: event.feltReports ?? [],
    maxMmi: event.maxMmi,
  })) {
    return false;
  }

  if (rule.area === 'province') {
    // Tanpa provinsi terpilih, web tidak mengirim apa pun (bukan diam-diam mengirim semua).
    if (!rule.provinceId || !provinceById(rule.provinceId)) return false;
    return provinceForPoint(event.latitude, event.longitude).id === rule.provinceId;
  }

  if (rule.area === 'radius') {
    if (rule.radiusKm === null || rule.centerLat === null || rule.centerLon === null) return false;
    const km = distanceKm(rule.centerLat, rule.centerLon, event.latitude, event.longitude);
    return Number.isFinite(km) && km <= rule.radiusKm;
  }

  return true;
}

/** Validasi input `alertSettings.quake`; mengembalikan pesan galat atau `null`. */
export function validateQuakeRule(input: unknown): { rule: QuakeRule; error: null } | { rule: null; error: string } {
  if (!input || typeof input !== 'object') {
    return { rule: null, error: 'Pengaturan gempa tidak valid' };
  }
  const raw = input as Partial<Record<keyof QuakeRule, unknown>>;
  const rule: QuakeRule = { ...DEFAULT_QUAKE_RULE };

  if (raw.scope !== undefined) {
    if (raw.scope !== 'important' && raw.scope !== 'all') {
      return { rule: null, error: 'Cakupan gempa tidak valid' };
    }
    rule.scope = raw.scope;
  }

  if (raw.area !== undefined) {
    if (raw.area !== 'indonesia' && raw.area !== 'province' && raw.area !== 'radius') {
      return { rule: null, error: 'Area gempa tidak valid' };
    }
    rule.area = raw.area;
  }

  if (raw.provinceId !== undefined && raw.provinceId !== null) {
    if (typeof raw.provinceId !== 'string' || !provinceById(raw.provinceId)) {
      return { rule: null, error: 'Provinsi tidak dikenal' };
    }
    rule.provinceId = raw.provinceId;
  }

  if (raw.radiusKm !== undefined && raw.radiusKm !== null) {
    const km = Number(raw.radiusKm);
    if (!Number.isFinite(km) || km < RADIUS_MIN_KM || km > RADIUS_MAX_KM) {
      return { rule: null, error: `Radius harus antara ${RADIUS_MIN_KM} dan ${RADIUS_MAX_KM} km` };
    }
    rule.radiusKm = Math.round(km);
  }

  for (const key of ['centerLat', 'centerLon'] as const) {
    const value = raw[key];
    if (value === undefined || value === null) continue;
    const num = Number(value);
    const limit = key === 'centerLat' ? 90 : 180;
    if (!Number.isFinite(num) || Math.abs(num) > limit) {
      return { rule: null, error: 'Titik pusat area tidak valid' };
    }
    rule[key] = num;
  }

  // Konsistensi silang: mode yang butuh data harus lengkap, kalau tidak notifikasi akan
  // diam-diam tidak pernah terkirim dan pengguna mengira fitur rusak.
  if (rule.area === 'province' && !rule.provinceId) {
    return { rule: null, error: 'Pilih provinsi untuk area provinsi' };
  }
  if (rule.area === 'radius') {
    if (rule.radiusKm === null || rule.centerLat === null || rule.centerLon === null) {
      return { rule: null, error: 'Lengkapi radius dan titik pusat' };
    }
  }

  return { rule, error: null };
}
