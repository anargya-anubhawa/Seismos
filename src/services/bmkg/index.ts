import { cached } from '@/lib/cache';
import { normalizeBmkgEvent } from '@/lib/validation';
import { fetchJson, fetchText } from './client';
import { parseFeltEventsXml, parseLiveEventsXml } from './xml';
import type { Earthquake, EarthquakeResponse, SourceStatus, SourceTag } from '@/types/earthquake';

const BASE = (process.env.BMKG_BASE_URL ?? 'https://data.bmkg.go.id/DataMKG/TEWS').replace(/\/$/, '');
const CDN = (process.env.BMKG_CDN_URL ?? 'https://cdn.bmkg.go.id').replace(/\/$/, '');
const TTL_MS = Math.max(30, Number(process.env.BMKG_CACHE_TTL_SECONDS ?? 60)) * 1000;
const TIMEOUT_MS = Number(process.env.BMKG_TIMEOUT_MS ?? 8000);

interface SourceDef {
  id: SourceTag;
  label: string;
  url: string;
  format: 'json' | 'live-xml' | 'felt-xml';
  /** Feed live memuat kejadian dunia; aplikasi hanya menampilkan wilayah Indonesia. */
  indonesiaOnly?: boolean;
}

const SOURCES: SourceDef[] = [
  { id: 'terbaru', label: 'Gempa terbaru', url: `${BASE}/autogempa.json`, format: 'json' },
  { id: 'm5', label: '15 gempa M 5,0+', url: `${BASE}/gempaterkini.json`, format: 'json' },
  { id: 'dirasakan', label: '15 gempa dirasakan', url: `${BASE}/gempadirasakan.json`, format: 'json' },
  {
    id: 'felt30',
    label: 'Gempa dirasakan InaTEWS (30 terbaru)',
    url: `${CDN}/last30feltevent.xml`,
    format: 'felt-xml',
    indonesiaOnly: true,
  },
  {
    id: 'live',
    label: 'Gempa terkini InaTEWS',
    url: `${CDN}/live30event.xml`,
    format: 'live-xml',
    indonesiaOnly: true,
  },
];

/** Bentuk respons JSON: { Infogempa: { gempa: object | object[] } } */
function extractRows(json: unknown): unknown[] {
  const gempa = (json as { Infogempa?: { gempa?: unknown } } | null)?.Infogempa?.gempa;
  if (Array.isArray(gempa)) return gempa;
  return gempa && typeof gempa === 'object' ? [gempa] : [];
}

/** Batas kasar wilayah Indonesia; feed InaTEWS juga memuat gempa dunia. */
function isInIndonesia(event: Earthquake): boolean {
  return (
    event.latitude >= -12 &&
    event.latitude <= 7.5 &&
    event.longitude >= 92.5 &&
    event.longitude <= 143
  );
}

async function loadSource(src: SourceDef) {
  try {
    const r = await cached(`bmkg:${src.id}`, TTL_MS, async () => {
      const rows = src.format === 'json'
        ? extractRows(await fetchJson(src.url, { timeoutMs: TIMEOUT_MS, retries: 2 }))
        : src.format === 'live-xml'
          ? parseLiveEventsXml(await fetchText(src.url, { timeoutMs: TIMEOUT_MS, retries: 2 }))
          : parseFeltEventsXml(await fetchText(src.url, { timeoutMs: TIMEOUT_MS, retries: 2 }));
      if (rows.length === 0) throw new Error('Struktur respons tidak dikenali atau kosong');

      let events = rows
        .map((row) => normalizeBmkgEvent(row, src.id))
        .filter((e): e is Earthquake => e !== null);
      if (src.indonesiaOnly) events = events.filter(isInIndonesia);
      if (events.length === 0) throw new Error('Tidak ada kejadian yang dapat dipakai dari sumber');
      return events;
    });
    const status: SourceStatus = {
      id: src.id, label: src.label, url: src.url,
      fetchedAt: new Date(r.at).toISOString(),
      stale: r.stale, error: r.error, count: r.value.length,
    };
    return { events: r.value, status };
  } catch (e) {
    const status: SourceStatus = {
      id: src.id, label: src.label, url: src.url, fetchedAt: null, stale: false,
      error: e instanceof Error ? e.message : 'Gagal', count: 0,
    };
    return { events: [] as Earthquake[], status };
  }
}

/** Menggabungkan semua daftar BMKG; kejadian yang sama (waktu + koordinat) hanya muncul sekali. */
export async function getBmkgEarthquakes(): Promise<EarthquakeResponse> {
  const results = await Promise.all(SOURCES.map(loadSource));
  const merged = new Map<string, Earthquake>();
  for (const { events } of results) {
    for (const ev of events) {
      const prev = merged.get(ev.id);
      if (!prev) {
        merged.set(ev.id, { ...ev });
      } else {
        const prevReports = prev.feltReports ?? [];
        const evReports = ev.feltReports ?? [];
        const bestReports = evReports.length > prevReports.length ? evReports : prevReports;
        const maxMmi = Math.max(prev.maxMmi ?? 0, ev.maxMmi ?? 0) || undefined;
        merged.set(ev.id, {
          ...prev,
          tsunamiNote: prev.tsunamiNote ?? ev.tsunamiNote,
          felt: prev.felt ?? ev.felt,
          feltReports: bestReports,
          maxMmi,
          shakemapFile: prev.shakemapFile ?? ev.shakemapFile,
          sources: Array.from(new Set([...prev.sources, ...ev.sources])),
        });
      }
    }
  }
  const events = Array.from(merged.values()).sort((a, b) => b.originTime.localeCompare(a.originTime));
  const times = results.map((r) => r.status.fetchedAt).filter((t): t is string => t !== null);
  return {
    events,
    sources: results.map((r) => r.status),
    updatedAt: times.length ? times.sort().reverse()[0] : null,
  };
}

export const BMKG_ATTRIBUTION = {
  name: 'BMKG — Badan Meteorologi, Klimatologi, dan Geofisika',
  url: 'https://data.bmkg.go.id/gempabumi/',
  shakemapBase: 'https://static.bmkg.go.id/',
};
