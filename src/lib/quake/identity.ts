/**
 * Identitas & dedupe gempa untuk pemantau push.
 *
 * ## Mengapa tidak memakai `Earthquake.id`
 * `id` dibentuk dari waktu (detik) + koordinat 2 desimal — lihat `eventKey` di
 * `src/lib/validation.ts` dan DECISION_LOG D-012. Nilai itu **berubah** ketika BMKG
 * mengoreksi waktu pusat atau koordinat, sehingga gempa yang sama akan tampak sebagai
 * kejadian baru dan pengguna menerima notifikasi ganda.
 *
 * Pemantau tsunami sudah memecahkan masalah ini: ia mencocokkan berdasarkan
 * (waktu pusat ± 3 menit) DAN (magnitudo ± 1,5) DAN (jarak ≤ 100 km). Berkas ini
 * memakai ambang yang sama untuk gempa, sehingga perilakunya konsisten dan sudah
 * terbukti di produksi.
 *
 * ## Mengapa hash kecil (FNV-1a)
 * Diambil apa adanya dari `src/lib/tsunami/identity.ts` agar ID notifikasi pendek dan
 * deterministik, tanpa menambah dependensi.
 */

import type { Earthquake } from '../../types/earthquake';

export const ORIGIN_MATCH_MS = 3 * 60_000;
export const MAGNITUDE_MATCH = 1.5;
export const DISTANCE_MATCH_KM = 100;

/** Hash FNV-1a 32-bit, hasil base36 — sama persis dengan `tsunami/identity.ts`. */
export function hash(input: string): string {
  let value = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    value ^= input.charCodeAt(i);
    value = Math.imul(value, 0x01000193);
  }
  return (value >>> 0).toString(36);
}

/** Haversine dengan radius 6371 km, sama dengan versi tsunami. */
export function distanceKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const rad = Math.PI / 180;
  const dLat = (bLat - aLat) * rad;
  const dLon = (bLon - aLon) * rad;
  const s = Math.sin(dLat / 2) ** 2
    + Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(Math.max(0, 1 - s)));
}

/**
 * Isi yang menentukan "apakah gempa ini berubah secara berarti".
 *
 * `updatedAt`/`fetchedAt` sengaja tidak ikut: itu hanya penanda pengambilan, bukan isi.
 * Yang ikut adalah hal yang benar-benar mengubah pesan notifikasi, sehingga koreksi
 * magnitudo atau wilayah memicu pembaruan, tetapi pengambilan ulang yang sama tidak.
 */
export function fingerprintQuake(event: Earthquake): string {
  return hash(JSON.stringify({
    originTime: event.originTime,
    // Dua desimal: perubahan di bawah ~1 km bukan koreksi yang layak menggandakan notifikasi.
    lat: event.latitude.toFixed(2),
    lon: event.longitude.toFixed(2),
    magnitude: event.magnitude.toFixed(1),
    depthKm: Math.round(event.depthKm),
    region: event.region,
    felt: event.felt ?? null,
    maxMmi: event.maxMmi ?? null,
    tsunamiNote: event.tsunamiNote ?? null,
  }));
}

/** Satu kejadian yang sudah pernah diputuskan (dikirim atau sengaja tidak dikirim). */
export interface NotifiedQuake {
  /** Kunci internal pemantau (bukan `Earthquake.id`). */
  key: string;
  originTime: string;
  latitude: number;
  longitude: number;
  magnitude: number;
  fingerprint: string;
  /** Kapan keputusan diambil (ISO). */
  decidedAt: string;
}

/**
 * Mencari catatan lama untuk gempa yang sama secara toleran.
 *
 * Urutan: sidik jari identik lebih dulu (murah dan pasti), lalu pencocokan toleran.
 * Mengembalikan `null` bila tidak ada — pemanggil lalu memperlakukannya sebagai kejadian
 * baru.
 */
export function findKnownQuake(
  known: NotifiedQuake[],
  event: Earthquake,
): NotifiedQuake | null {
  const fingerprint = fingerprintQuake(event);
  const exact = known.find((item) => item.fingerprint === fingerprint);
  if (exact) return exact;

  const origin = Date.parse(event.originTime);
  for (const item of known) {
    const knownOrigin = Date.parse(item.originTime);
    if (!Number.isFinite(origin) || !Number.isFinite(knownOrigin)) continue;
    if (Math.abs(origin - knownOrigin) > ORIGIN_MATCH_MS) continue;
    if (Math.abs(event.magnitude - item.magnitude) > MAGNITUDE_MATCH) continue;
    const distance = distanceKm(item.latitude, item.longitude, event.latitude, event.longitude);
    if (distance <= DISTANCE_MATCH_KM) return item;
  }
  return null;
}

/** `quake-<hash>`: dipakai sebagai `collapse_key` dan tag notifikasi. */
export function quakeNotificationKey(event: Earthquake): string {
  return `quake-${hash(
    `${event.originTime}|${event.latitude.toFixed(2)}|${event.longitude.toFixed(2)}`,
  )}`;
}
