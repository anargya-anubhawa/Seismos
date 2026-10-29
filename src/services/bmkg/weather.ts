import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import { cached } from '@/lib/cache';
import { fetchJson, fetchText } from '@/services/bmkg/client';
import {
  SATELLITE_PRODUCTS, isInIndonesia, nearestArea, normalizeWeatherAlert, normalizeWeatherArea,
  parseRegionFile, parseRssItems, satelliteDetailUrl, zoneFromOffset,
} from '@/lib/weather/parse';
import type {
  SatelliteFrame, SatelliteProduct, WeatherAlert, WeatherAlertFeed, WeatherArea, WeatherForecast,
  WeatherSourceId,
} from '@/types/weather';
import { publicErrorMessage } from '@/lib/public-error';

/**
 * Klien server data cuaca BMKG.
 *
 * Tiga sumber resmi yang dipakai:
 *  1. Prakiraan cuaca desa/kelurahan: `api.bmkg.go.id/publik/prakiraan-cuaca`
 *     (sumber yang sama dengan halaman bmkg.go.id/cuaca/prakiraan-cuaca).
 *  2. Peringatan dini cuaca ekstrem: RSS nowcast CAP
 *     `bmkg.go.id/alerts/nowcast/id` (halaman peringatan dini cuaca BMKG).
 *  3. Citra satelit: berkas citra pada `inderaja.bmkg.go.id` yang dipakai
 *     halaman bmkg.go.id/cuaca/satelit, diteruskan lewat proxy internal.
 *
 * Semua permintaan dilakukan dari server dan di-cache singkat, sehingga satu
 * instance Seismos tidak membebani BMKG ketika banyak pengguna membuka halaman.
 */

const FORECAST_BASE = (process.env.BMKG_FORECAST_URL ?? 'https://api.bmkg.go.id/publik/prakiraan-cuaca').replace(/\/$/, '');
const NOWCAST_URL = process.env.BMKG_NOWCAST_URL ?? 'https://www.bmkg.go.id/alerts/nowcast/id';
const SATELLITE_HOST = 'inderaja.bmkg.go.id';
const TIMEOUT_MS = Number(process.env.BMKG_WEATHER_TIMEOUT_MS ?? 12_000);

const FORECAST_TTL_MS = Math.max(60, Number(process.env.BMKG_WEATHER_TTL_SECONDS ?? 900)) * 1_000;
const NOWCAST_TTL_MS = 5 * 60_000;
const SATELLITE_TTL_MS = 3 * 60_000;

export interface Fetched<T> {
  value: T;
  at: number;
  stale: boolean;
  error: string | null;
}

const withCache = <T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<Fetched<T>> =>
  cached(key, ttlMs, load).then((result) => ({
    value: result.value,
    at: result.at,
    stale: result.stale,
    error: result.error,
  }));

/* --------------------------------------------------------------- wilayah -- */

let regionPromise: Promise<WeatherArea[]> | null = null;

/**
 * Memuat daftar kecamatan sekali per proses. Berkasnya kecil (±217 KB gzip)
 * sehingga biaya memorinya setara beberapa gambar kecil.
 */
export function loadWeatherAreas(): Promise<WeatherArea[]> {
  if (!regionPromise) {
    regionPromise = (async () => {
      const file = path.join(process.cwd(), 'src', 'data', 'weather-regions.json.gz');
      const compressed = await readFile(file);
      return parseRegionFile(gunzipSync(compressed));
    })().catch((error) => {
      // Jangan simpan kegagalan permanen: percobaan berikutnya boleh mengulang.
      regionPromise = null;
      throw error;
    });
  }
  return regionPromise;
}

export interface AreaLookup {
  area: WeatherArea;
  distanceKm: number;
}

/** Mencari wilayah prakiraan terdekat dari koordinat pengguna. */
export async function findWeatherArea(latitude: number, longitude: number): Promise<AreaLookup | null> {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (!isInIndonesia(latitude, longitude)) return null;
  const areas = await loadWeatherAreas();
  return nearestArea(areas, latitude, longitude);
}

/** Mencari wilayah berdasarkan kode adm4 (dipakai saat tautan dibagikan). */
export async function findAreaByCode(code: string): Promise<WeatherArea | null> {
  const clean = code.trim();
  if (!/^\d{2}\.\d{2}\.\d{2}\.\d{4}$/.test(clean)) return null;
  const areas = await loadWeatherAreas();
  return areas.find((area) => area.code === clean) ?? null;
}

const areaMatches = (name: string, query: string): boolean =>
  name.toLocaleLowerCase('id').includes(query);

/**
 * Pencarian wilayah untuk kotak pencarian menu cuaca. Mencocokkan nama
 * kecamatan, kabupaten, atau provinsi; hasil diurutkan dari yang paling
 * relevan (kecamatan lebih dulu) agar mudah dipilih.
 */
export async function searchWeatherAreas(query: string, limit = 20): Promise<WeatherArea[]> {
  const q = query.trim().toLocaleLowerCase('id');
  if (q.length < 2) return [];
  const areas = await loadWeatherAreas();
  const scored: { area: WeatherArea; score: number }[] = [];
  for (const area of areas) {
    const district = area.district.toLocaleLowerCase('id');
    const regency = area.regency.toLocaleLowerCase('id');
    const province = area.province.toLocaleLowerCase('id');
    let score = 0;
    if (district === q) score = 4;
    else if (district.startsWith(q)) score = 3;
    else if (areaMatches(district, q)) score = 2;
    else if (areaMatches(regency, q)) score = 1;
    else if (areaMatches(province, q)) score = 0.5;
    if (score > 0) scored.push({ area, score });
  }
  scored.sort((a, b) => b.score - a.score || a.area.district.localeCompare(b.area.district));
  return scored.slice(0, limit).map((item) => item.area);
}

/* ------------------------------------------------------ prakiraan cuaca -- */

interface RawForecast {
  lokasi?: unknown;
  data?: { lokasi?: unknown; cuaca?: unknown }[];
  message?: string;
}

function flattenCuaca(cuaca: unknown): unknown[] {
  if (!Array.isArray(cuaca)) return [];
  const out: unknown[] = [];
  for (const entry of cuaca) {
    if (Array.isArray(entry)) out.push(...entry);
    else if (entry && typeof entry === 'object') out.push(entry);
  }
  return out;
}

async function loadForecast(code: string): Promise<WeatherForecast> {
  const fetchedAt = new Date().toISOString();
  const payload = (await fetchJson(`${FORECAST_BASE}?adm4=${encodeURIComponent(code)}`, {
    timeoutMs: TIMEOUT_MS,
    retries: 1,
  })) as RawForecast;

  const inner = Array.isArray(payload?.data) ? payload.data[0] : undefined;
  const location = inner?.lokasi ?? payload?.lokasi;
  const points = flattenCuaca(inner?.cuaca);
  if (!location || points.length === 0) {
    throw new Error(payload?.message?.trim() || 'BMKG tidak mengembalikan prakiraan untuk wilayah ini');
  }

  const normalized = normalizeWeatherArea(location, points, fetchedAt);
  if (!normalized.area) throw new Error('Kode wilayah prakiraan BMKG tidak dikenali');

  // Zona dari blok `lokasi` luar (nama zona) diutamakan; bila yang terbaca
  // hanya offset, ubah ke nama zona supaya label WIB/WITA/WIT tetap benar.
  const outerZone = (payload?.lokasi ?? {}) as Record<string, unknown>;
  const zoneName = typeof outerZone.timezone === 'string' && outerZone.timezone.includes('/')
    ? outerZone.timezone
    : zoneFromOffset(normalized.timezone) ?? normalized.timezone;

  return {
    area: normalized.area,
    timezone: zoneName,
    points: normalized.points,
    analysisAt: normalized.analysisAt,
    fetchedAt,
    updatedAt: normalized.analysisAt ? new Date(`${normalized.analysisAt}Z`).toISOString() : null,
    stale: false,
    error: null,
    sourceUrl: `https://www.bmkg.go.id/cuaca/prakiraan-cuaca/${code}`,
  };
}

const forecastWithCache = async (code: string): Promise<Fetched<WeatherForecast>> =>
  withCache(`bmkg:weather:forecast:${code}`, FORECAST_TTL_MS, () => loadForecast(code));

/** Prakiraan cuaca satu wilayah adm4 (hasil cache). */
export async function getForecastByCode(code: string): Promise<Fetched<WeatherForecast>> {
  return forecastWithCache(code);
}

export interface ForecastForPoint extends Fetched<WeatherForecast> {
  /** Jarak koordinat pengguna ke titik wilayah yang dipakai (km). */
  areaDistanceKm: number;
}

/**
 * Prakiraan cuaca untuk koordinat pengguna. Bila koordinat di luar Indonesia
 * atau wilayah tidak ditemukan, hasilnya `null` — aplikasi tidak mengarang
 * prakiraan untuk wilayah lain.
 */
export async function getForecastForPoint(latitude: number, longitude: number): Promise<ForecastForPoint | null> {
  const match = await findWeatherArea(latitude, longitude);
  if (!match) return null;
  const forecast = await forecastWithCache(match.area.code);
  return { ...forecast, areaDistanceKm: match.distanceKm };
}

/* ----------------------------------------- peringatan dini cuaca ekstrem -- */

async function loadNowcast(): Promise<WeatherAlertFeed> {
  const xml = await fetchText(NOWCAST_URL, { timeoutMs: TIMEOUT_MS, retries: 1 });
  const parsed = parseRssItems(xml);
  const alerts = parsed.items
    .map(normalizeWeatherAlert)
    .filter((alert): alert is WeatherAlert => alert !== null)
    .sort((a, b) => Date.parse(b.issuedAt) - Date.parse(a.issuedAt));
  return {
    alerts,
    updatedAt: parsed.channelDate ? new Date(parsed.channelDate).toISOString() : null,
    stale: false,
    error: null,
    sourceUrl: 'https://www.bmkg.go.id/cuaca/peringatan-dini-cuaca',
  };
}

/** Seluruh peringatan dini cuaca ekstrem yang sedang berlaku menurut BMKG. */
export async function getWeatherAlerts(): Promise<Fetched<WeatherAlertFeed>> {
  return withCache('bmkg:weather:nowcast', NOWCAST_TTL_MS, loadNowcast);
}

/* --------------------------------------------------------------- satelit -- */

/** Daftar produk satelit dengan path proxy internal. */
export function satelliteProducts(): SatelliteProduct[] {
  return SATELLITE_PRODUCTS.map((product) => ({
    ...product,
    imagePath: `/api/weather/satelit/${product.id}/image`,
    detailUrl: satelliteDetailUrl(product.id),
  }));
}

export function findSatelliteProduct(id: string): SatelliteProduct | null {
  return satelliteProducts().find((product) => product.id === id) ?? null;
}

/** Hanya citra dari host INDERAJA BMKG yang boleh diteruskan proxy. */
export function isAllowedSatelliteUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return null;
    if (parsed.hostname !== SATELLITE_HOST) return null;
    if (!/^\/IMAGE\/|^\/Trajektori\//.test(parsed.pathname)) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

export interface SatelliteImage {
  body: ArrayBuffer;
  contentType: string;
  capturedAt: string | null;
}

/**
 * Mengambil citra satelit asli. Ukurannya bisa beberapa MB, jadi cache disimpan
 * terpisah dalam memori dengan masa berlaku pendek di atas TTL `cached`.
 */
const imageStore = new Map<string, { data: SatelliteImage; at: number }>();

export async function fetchSatelliteImage(product: SatelliteProduct): Promise<SatelliteImage> {
  const key = product.sourceUrl;
  const hit = imageStore.get(key);
  if (hit && Date.now() - hit.at < SATELLITE_TTL_MS) return hit.data;

  const url = isAllowedSatelliteUrl(product.sourceUrl);
  if (!url) throw new Error('Alamat citra satelit tidak diizinkan');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS * 2);
  try {
    const res = await fetch(url, { signal: controller.signal, cache: 'no-store' });
    if (!res.ok) throw new Error(`Sumber citra satelit membalas HTTP ${res.status}`);
    const contentType = res.headers.get('content-type') ?? 'image/png';
    if (!contentType.startsWith('image/')) throw new Error('Sumber tidak mengirim berkas gambar');
    const body = await res.arrayBuffer();
    const data: SatelliteImage = {
      body,
      contentType,
      capturedAt: res.headers.get('last-modified')
        ? new Date(res.headers.get('last-modified') as string).toISOString()
        : null,
    };
    imageStore.set(key, { data, at: Date.now() });
    return data;
  } finally {
    clearTimeout(timer);
  }
}

/** Informasi satu produk satelit: kapan citra diperbarui terakhir. */
export async function getSatelliteFrame(id: string): Promise<SatelliteFrame | null> {
  const product = findSatelliteProduct(id);
  if (!product) return null;
  const checkedAt = new Date().toISOString();
  try {
    const result = await cached(`bmkg:satelit:head:${id}`, SATELLITE_TTL_MS, async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      try {
        const res = await fetch(product.sourceUrl, { method: 'HEAD', signal: controller.signal, cache: 'no-store' });
        if (!res.ok) throw new Error(`Sumber citra membalas HTTP ${res.status}`);
        return res.headers.get('last-modified')
          ? new Date(res.headers.get('last-modified') as string).toISOString()
          : null;
      } finally {
        clearTimeout(timer);
      }
    });
    return { product, capturedAt: result.value, checkedAt, stale: result.stale, error: result.error };
  } catch (error) {
    return {
      product,
      capturedAt: null,
      checkedAt,
      stale: false,
      error: publicErrorMessage(error, 'Citra satelit tidak dapat diperiksa'),
    };
  }
}

/** Sidik jari singkat untuk cache-busting URL citra (ETag sederhana). */
export function frameTag(frame: SatelliteFrame | null): string {
  if (!frame?.capturedAt) return '0';
  return createHash('sha1').update(frame.capturedAt).digest('hex').slice(0, 10);
}

/** Label sumber data resmi per jenis, dipakai teks kredit laporan. */
export const WEATHER_SOURCE_LABEL: Record<WeatherSourceId, string> = {
  prakiraan: 'BMKG (bmkg.go.id/cuaca/prakiraan-cuaca)',
  nowcast: 'BMKG — Peringatan Dini Cuaca Ekstrem (bmkg.go.id/cuaca)',
  satelit: 'BMKG — Citra Satelit (bmkg.go.id/cuaca/satelit)',
};
