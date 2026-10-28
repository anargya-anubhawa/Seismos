import { fetchJson } from '@/services/bmkg/client';
import { cached } from '@/lib/cache';
import {
  normalizeCamera, normalizeEruption, normalizeGalleryPhoto, normalizeKrb, normalizeLevelChange,
  normalizeReport, normalizeVona, normalizeVolcanoStatuses,
} from '@/lib/volcano/magma';
import type {
  EruptionEvent, GalleryPhoto, KrbMap, SeismogramStationRef, VolcanoCamera, VolcanoLevelChange,
  VolcanoReport, VolcanoStatus, VonaNotice,
} from '@/types/volcano';

/**
 * Klien server untuk API publik MAGMA Indonesia.
 *
 * Endpoint `_api` adalah API JSON resmi yang dipakai situs MAGMA sendiri
 * (base path internalnya `/data/api/public`). Semua permintaan dilakukan dari
 * server Seismos dan di-cache singkat agar satu instance server tidak
 * membebani MAGMA ketika banyak pengguna membuka halaman.
 */

const BASE = (process.env.MAGMA_BASE_URL ?? 'https://magma.esdm.go.id/_api').replace(/\/$/, '');
const SITE = (process.env.MAGMA_SITE_URL ?? 'https://magma.esdm.go.id').replace(/\/$/, '');
const TIMEOUT_MS = Number(process.env.MAGMA_TIMEOUT_MS ?? 12_000);

const STATUS_TTL_MS = 60_000;
const LIST_TTL_MS = Math.max(60, Number(process.env.MAGMA_CACHE_TTL_SECONDS ?? 120)) * 1_000;
const DETAIL_TTL_MS = 3 * 60_000;

export const MAGMA_USER_AGENT = 'SeismosIndonesia/0.1 (+https://magma.esdm.go.id; informasi resmi PVMBG)';

export interface Fetched<T> {
  value: T;
  /** Epoch ms data diambil dari MAGMA. */
  at: number;
  stale: boolean;
  error: string | null;
}

const qs = (params: Record<string, string | number | undefined>): string => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === '') continue;
    search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : '';
};

async function getJson(path: string): Promise<unknown> {
  return fetchJson(`${BASE}${path}`, { timeoutMs: TIMEOUT_MS, retries: 1 });
}

const rowsOf = (payload: unknown): unknown[] => {
  const data = (payload as { data?: unknown } | null)?.data;
  if (Array.isArray(data)) return data;
  const inner = (data as { data?: unknown } | null)?.data;
  return Array.isArray(inner) ? inner : [];
};

const withCache = <T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<Fetched<T>> =>
  cached(key, ttlMs, load).then((result) => ({
    value: result.value,
    at: result.at,
    stale: result.stale,
    error: result.error,
  }));

/* --------------------------------- status --------------------------------- */

async function loadStatuses(): Promise<VolcanoStatus[]> {
  const receivedAt = new Date().toISOString();
  const payload = await getJson('/home/maps');
  const volcanoes = normalizeVolcanoStatuses(payload, receivedAt);
  if (volcanoes.length === 0) {
    throw new Error('Daftar status gunung api MAGMA kosong atau bentuk respons tidak dikenali');
  }
  return volcanoes;
}

/** Status aktivitas seluruh gunung api yang dipantau PVMBG (koordinat resmi). */
export function getVolcanoStatuses(): Promise<Fetched<VolcanoStatus[]>> {
  return withCache('magma:volcano:status', STATUS_TTL_MS, loadStatuses);
}

/* ------------------------------ laporan VAR ------------------------------- */

export interface ReportQuery {
  size?: number;
  /** Offset dalam satuan halaman (offset = page × size) sesuai API MAGMA. */
  page?: number;
  date?: string;
}

/** Laporan aktivitas (VAR) terbaru; filter tanggal dijalankan di server. */
export function getActivityReports(query: ReportQuery = {}): Promise<Fetched<VolcanoReport[]>> {
  const size = Math.min(60, Math.max(1, query.size ?? 30));
  const page = Math.max(0, query.page ?? 0);
  const date = query.date && /^\d{4}-\d{2}-\d{2}$/.test(query.date) ? query.date : undefined;
  const key = `magma:volcano:var:${size}:${page}:${date ?? '-'}`;
  return withCache(key, LIST_TTL_MS, async () => {
    const payload = await getJson(`/var/list${qs({ size, page })}`);
    return rowsOf(payload)
      .map((row) => normalizeReport(row, date ? 'harian' : 'aktivitas', SITE))
      .filter((report): report is VolcanoReport => report !== null)
      .filter((report) => !date || report.date === date);
  });
}

/** Detail satu laporan aktivitas resmi (teks lengkap, rekomendasi, gempa). */
export function getActivityReport(id: string): Promise<Fetched<VolcanoReport | null>> {
  return withCache(`magma:volcano:var:detail:${id}`, DETAIL_TTL_MS, async () => {
    try {
      const payload = await getJson(`/var/${encodeURIComponent(id)}/detail`);
      const data = (payload as { data?: unknown } | null)?.data;
      return normalizeReport(data, 'aktivitas', SITE);
    } catch (error) {
      // MAGMA membalas HTTP 400 untuk ID laporan yang tidak dikenal. Itu data
      // tidak ada, bukan kegagalan sumber, jadi jangan tampilkan sebagai error.
      if (isInvalidIdError(error)) return null;
      throw error;
    }
  });
}

/** MAGMA membalas 400 saat nilai ID tidak valid atau tidak ditemukan. */
function isInvalidIdError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('HTTP 400');
}

export interface DailyBundle {
  reports: VolcanoReport[];
  /** Tanggal laporan harian yang dikembalikan MAGMA. */
  date: string | null;
}

/** Laporan harian terbaru seluruh gunung api untuk satu tanggal. */
export function getDailyReports(date?: string): Promise<Fetched<DailyBundle>> {
  const clean = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : undefined;
  return withCache(`magma:volcano:daily:${clean ?? 'latest'}`, LIST_TTL_MS, async () => {
    const payload = clean
      ? await getJson(`/volcano/daily-var${qs({ date: clean })}`)
      : await getJson('/volcano/latest-daily-var');
    const rows = rowsOf(payload);
    const reports = rows
      .map((row) => normalizeReport(row, 'harian', SITE))
      .filter((report): report is VolcanoReport => report !== null);
    const derived = reports.reduce<string | null>(
      (latest, report) => (latest === null || report.date > latest ? report.date : latest),
      null,
    );
    return { reports, date: clean ?? derived };
  });
}

/* -------------------------------- letusan --------------------------------- */

/** Informasi letusan resmi (VEN) terbaru. Satu-satunya dasar notifikasi erupsi. */
export function getEruptions(size = 40, page = 0): Promise<Fetched<EruptionEvent[]>> {
  const limit = Math.min(80, Math.max(1, size));
  const offset = Math.max(0, page);
  return withCache(`magma:volcano:ven:${limit}:${offset}`, LIST_TTL_MS, async () => {
    const payload = await getJson(`/ven/list${qs({ size: limit, page: offset })}`);
    const receivedAt = new Date().toISOString();
    return rowsOf(payload)
      .map((row) => normalizeEruption(row, receivedAt))
      .filter((event): event is EruptionEvent => event !== null);
  });
}

export function getEruption(id: string): Promise<Fetched<EruptionEvent | null>> {
  return withCache(`magma:volcano:ven:detail:${id}`, DETAIL_TTL_MS, async () => {
    try {
      const payload = await getJson(`/ven/${encodeURIComponent(id)}/detail`);
      const data = (payload as { data?: unknown } | null)?.data;
      return normalizeEruption(data);
    } catch (error) {
      if (isInvalidIdError(error)) return null;
      throw error;
    }
  });
}

/* ---------------------------------- VONA ---------------------------------- */

export function getVonaNotices(size = 30, page = 0): Promise<Fetched<VonaNotice[]>> {
  const limit = Math.min(60, Math.max(1, size));
  const offset = Math.max(0, page);
  return withCache(`magma:volcano:vona:${limit}:${offset}`, LIST_TTL_MS, async () => {
    const payload = await getJson(`/vona/list${qs({ size: limit, page: offset })}`);
    return rowsOf(payload)
      .map(normalizeVona)
      .filter((notice): notice is VonaNotice => notice !== null);
  });
}

/* ---------------------------------- CCTV ---------------------------------- */

export function getCameras(): Promise<Fetched<VolcanoCamera[]>> {
  return withCache('magma:volcano:cctv', LIST_TTL_MS, async () => {
    const payload = await getJson('/cctv/list?size=200');
    return rowsOf(payload)
      .map(normalizeCamera)
      .filter((camera): camera is VolcanoCamera => camera !== null);
  });
}

/* ----------------------------------- KRB ---------------------------------- */

export function getKrbMaps(): Promise<Fetched<KrbMap[]>> {
  return withCache('magma:volcano:krb', 6 * 60 * 60_000, async () => {
    const payload = await getJson('/volcano/krb?size=100');
    const maps = rowsOf(payload)
      .map(normalizeKrb)
      .filter((map): map is KrbMap => map !== null);
    if (maps.length === 0) return maps;

    // Cocokkan peta dengan daftar status resmi lewat `volcano_id` supaya
    // tautan detail memakai kode gunung api yang benar. Nama pada peta KRB
    // tidak dapat dipakai sebagai slug (mis. "Hobal" berkode "HOB"). Bila
    // daftar status gagal dimuat, peta tetap ditampilkan tanpa kode.
    try {
      const statuses = await getVolcanoStatuses();
      const codeById = new Map(statuses.value.map((volcano) => [volcano.id, volcano.code]));
      const codeByName = new Map(
        statuses.value.map((volcano) => [volcano.name.trim().toLowerCase(), volcano.code]),
      );
      for (const map of maps) {
        const byId = map.volcanoId ? codeById.get(map.volcanoId) : undefined;
        map.volcanoCode = byId ?? codeByName.get(map.volcanoName.trim().toLowerCase()) ?? null;
      }
    } catch {
      for (const map of maps) map.volcanoCode = null;
    }
    return maps;
  });
}

/** Berkas KRB asli (gambar) untuk diteruskan ke browser lewat proxy. */
export async function fetchKrbFile(id: string): Promise<{ url: string } | null> {
  const maps = await getKrbMaps();
  const found = maps.value.find((map) => map.id === id);
  return found ? { url: found.sourceUrl } : null;
}

/* --------------------------------- gallery -------------------------------- */

export function getGallery(search?: string, size = 24, page = 0): Promise<Fetched<GalleryPhoto[]>> {
  const limit = Math.min(48, Math.max(1, size));
  const offset = Math.max(0, page);
  const clean = search?.trim().slice(0, 60);
  return withCache(`magma:volcano:gallery:${clean ?? '-'}:${limit}:${offset}`, LIST_TTL_MS, async () => {
    const payload = await getJson(`/volcano/gallery${qs({ size: limit, page: offset, search: clean })}`);
    return rowsOf(payload)
      .map(normalizeGalleryPhoto)
      .filter((photo): photo is GalleryPhoto => photo !== null);
  });
}

/* ------------------------------ riwayat level ------------------------------ */

export interface VolcanoIdentity {
  id: string;
  code: string;
  name: string;
}

/** Riwayat perubahan tingkat aktivitas resmi satu gunung api. */
export function getLevelHistory(volcano: VolcanoIdentity): Promise<Fetched<VolcanoLevelChange[]>> {
  return withCache(`magma:volcano:histories:${volcano.id}`, 6 * 60 * 60_000, async () => {
    const payload = await getJson(
      `/volcano-activity/histories-by-volcano${qs({ volcano_id: volcano.id, size: 50 })}`,
    );
    return rowsOf(payload)
      .map((row) => normalizeLevelChange(row, volcano.code, volcano.name))
      .filter((change): change is VolcanoLevelChange => change !== null);
  });
}

/* -------------------------------- detail --------------------------------- */

/** Detail gunung api (intro resmi, morfologi, koordinat) dari MAGMA. */
export function getVolcanoProfile(id: string): Promise<Fetched<Record<string, unknown> | null>> {
  return withCache(`magma:volcano:detail:${id}`, 6 * 60 * 60_000, async () => {
    const payload = await getJson(`/volcano/${encodeURIComponent(id)}/detail`);
    const data = (payload as { data?: unknown } | null)?.data;
    return data && typeof data === 'object' ? data as Record<string, unknown> : null;
  });
}

/** Laporan aktivitas terakhir untuk satu gunung api. */
export function getLatestReportFor(volcanoId: string): Promise<Fetched<VolcanoReport | null>> {
  return withCache(`magma:volcano:latest-var:${volcanoId}`, LIST_TTL_MS, async () => {
    const payload = await getJson(`/volcano/${encodeURIComponent(volcanoId)}/latest-var`);
    const data = (payload as { data?: unknown } | null)?.data;
    return normalizeReport(data, 'aktivitas', SITE);
  });
}

/* ------------------------------- seismogram ------------------------------- */

export function seismogramRefs(stations: {
  id: number; volcanoCode: string; volcanoName: string; scnl: string; station: string; channel: string; pageUrl: string;
}[]): SeismogramStationRef[] {
  return stations.map((station) => ({
    id: station.id,
    volcanoCode: station.volcanoCode,
    volcanoName: station.volcanoName,
    scnl: station.scnl,
    station: station.station,
    channel: station.channel,
    imagePath: `/api/seismograms/${station.id}/image?size=thumb`,
    pageUrl: station.pageUrl,
  }));
}

export const MAGMA_SITE_URL = SITE;
