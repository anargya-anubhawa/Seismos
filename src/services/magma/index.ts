import { cached } from '@/lib/cache';
import { fetchJson } from '@/services/bmkg/client';
import type { SeismogramResponse, SeismogramStation, VolcanoOption } from '@/types/seismogram';

const BASE = (process.env.MAGMA_BASE_URL ?? 'https://magma.esdm.go.id/_api').replace(/\/$/, '');
const IMAGE_BASE = (process.env.MAGMA_IMAGE_BASE ?? 'https://vsi.esdm.go.id/data/api/public').replace(/\/$/, '');
const SITE = (process.env.MAGMA_SITE_URL ?? 'https://magma.esdm.go.id').replace(/\/$/, '');
const TIMEOUT_MS = Number(process.env.MAGMA_TIMEOUT_MS ?? 12000);
const LIST_TTL_MS = Math.max(30, Number(process.env.MAGMA_CACHE_TTL_SECONDS ?? 60)) * 1000;
const OPTIONS_TTL_MS = 6 * 60 * 60 * 1000;

type Raw = Record<string, unknown>;
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

interface MagmaList {
  success?: boolean;
  data?: { total?: number; data?: unknown[] };
}

function normalizeStation(row: unknown): SeismogramStation | null {
  if (!row || typeof row !== 'object') return null;
  const r = row as Raw;
  const id = num(r.id);
  const scnl = str(r.scnl);
  const volcanoName = str(r.volcano_name);
  if (!id || !scnl || !volcanoName) return null;

  const preview = (r.preview && typeof r.preview === 'object' ? r.preview : {}) as Raw;
  const sourceImageUrl = str(preview.url);

  return {
    id,
    volcanoCode: str(r.volcano_code),
    volcanoName,
    scnl,
    station: str(r.station),
    channel: str(r.channel),
    network: str(r.network),
    location: str(r.location),
    hit: num(r.hit),
    imagePath: `/api/seismograms/${id}/image?size=thumb`,
    pageUrl: `${SITE}/volcano/live-seismograf/${encodeURIComponent(scnl)}`,
    sourceImageUrl,
  };
}

function normalizeVolcano(row: unknown): VolcanoOption | null {
  if (!row || typeof row !== 'object') return null;
  const r = row as Raw;
  const id = str(r.id);
  const name = str(r.name);
  if (!id || !name) return null;
  return {
    id,
    code: str(r.code),
    name,
    province: str(r.province) || undefined,
    latitude: Number.isFinite(Number(r.latitude)) ? Number(r.latitude) : undefined,
    longitude: Number.isFinite(Number(r.longitude)) ? Number(r.longitude) : undefined,
    elevation: Number.isFinite(Number(r.elevation)) ? Number(r.elevation) : undefined,
  };
}

async function loadStations(): Promise<SeismogramStation[]> {
  const json = (await fetchJson(`${BASE}/seismometer/list?page=0&size=500`, {
    timeoutMs: TIMEOUT_MS,
    retries: 2,
  })) as MagmaList;
  const rows = json?.data?.data;
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error('Daftar seismometer MAGMA kosong atau bentuk respons tidak dikenali');
  }
  return rows.map(normalizeStation).filter((s): s is SeismogramStation => s !== null);
}

async function loadVolcanoes(): Promise<VolcanoOption[]> {
  const json = (await fetchJson(`${BASE}/volcano/options`, {
    timeoutMs: TIMEOUT_MS,
    retries: 1,
  })) as { data?: unknown[] };
  if (!Array.isArray(json?.data)) throw new Error('Daftar gunung api MAGMA tidak dikenali');
  return json.data.map(normalizeVolcano).filter((v): v is VolcanoOption => v !== null);
}

function volcanoesFromStations(stations: SeismogramStation[]): VolcanoOption[] {
  const map = new Map<string, VolcanoOption>();
  for (const s of stations) {
    const key = s.volcanoCode || s.volcanoName;
    if (!map.has(key)) map.set(key, { id: key, code: s.volcanoCode, name: s.volcanoName });
  }
  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'id'));
}

/** Daftar seluruh stasiun seismograf live MAGMA (sumber tautan live seismograf). */
export async function getSeismograms(): Promise<SeismogramResponse> {
  const list = await cached('magma:seismometer:list', LIST_TTL_MS, loadStations);

  let volcanoes: VolcanoOption[] = [];
  let optionsError: string | null = null;
  try {
    const options = await cached('magma:volcano:options', OPTIONS_TTL_MS, loadVolcanoes);
    volcanoes = options.value;
    if (options.error) optionsError = options.error;
  } catch (e) {
    optionsError = e instanceof Error ? e.message : 'Daftar gunung api gagal dimuat';
    volcanoes = volcanoesFromStations(list.value);
  }
  if (volcanoes.length === 0) volcanoes = volcanoesFromStations(list.value);

  const stations = [...list.value].sort(
    (a, b) => a.volcanoName.localeCompare(b.volcanoName, 'id') || a.scnl.localeCompare(b.scnl),
  );

  return {
    stations,
    volcanoes,
    total: stations.length,
    updatedAt: new Date(list.at).toISOString(),
    stale: list.stale,
    error: list.error ?? optionsError,
    source: {
      name: 'MAGMA Indonesia — PVMBG, Badan Geologi, Kementerian ESDM',
      home: SITE,
      live: `${SITE}/volcano/live-seismograf`,
    },
  };
}

export async function fetchSeismogramImage(
  id: number,
  size: 'thumb' | 'full',
): Promise<{ body: ArrayBuffer; contentType: string }> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${IMAGE_BASE}/data-feed/${id}/image?size=${size}`, {
      signal: ctl.signal,
      cache: 'no-store',
      headers: {
        Accept: 'image/png,image/jpeg,image/*',
        Referer: `${SITE}/volcano/live-seismograf`,
        'User-Agent': 'SeismosIndonesia/0.1 (+https://data.bmkg.go.id/)',
      },
    });
    if (!res.ok) throw new Error(`Sumber gambar membalas HTTP ${res.status}`);
    const contentType = res.headers.get('content-type') ?? 'image/png';
    if (!contentType.startsWith('image/')) throw new Error('Sumber tidak mengirim berkas gambar');
    const body = await res.arrayBuffer();
    if (body.byteLength === 0) throw new Error('Gambar kosong');
    if (body.byteLength > 8_000_000) throw new Error('Gambar terlalu besar');
    return { body, contentType };
  } finally {
    clearTimeout(timer);
  }
}

export const MAGMA_ATTRIBUTION = {
  name: 'MAGMA Indonesia',
  url: `${SITE}/volcano/live-seismograf`,
};
