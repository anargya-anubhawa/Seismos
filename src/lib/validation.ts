import type { Earthquake, SourceTag } from '@/types/earthquake';
import { maxMmiOf, parseFeltReports } from '@/lib/felt';

type Raw = Record<string, unknown>;

const firstNumber = (v: unknown): number => {
  const m = String(v ?? '').match(/-?\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : NaN;
};

const text = (v: unknown): string | undefined => {
  const s = typeof v === 'string' ? v.trim() : '';
  return s ? s : undefined;
};

/** Mengurai "Coordinates" ("lat,lon") atau pasangan Lintang/Bujur ("3.44 LS"). */
function parseCoords(r: Raw): { lat: number; lon: number } {
  if (typeof r.Coordinates === 'string') {
    const [a, b] = r.Coordinates.split(',');
    const lat = firstNumber(a);
    const lon = firstNumber(b);
    if (Number.isFinite(lat) && Number.isFinite(lon)) return { lat, lon };
  }
  const lat = firstNumber(r.Lintang);
  const lon = firstNumber(r.Bujur);
  const latSouth = /LS/i.test(String(r.Lintang ?? ''));
  const lonWest = /BB/i.test(String(r.Bujur ?? ''));
  return {
    lat: latSouth ? -Math.abs(lat) : lat,
    lon: lonWest ? -Math.abs(lon) : lon,
  };
}

export function eventKey(ms: number, lat: number, lon: number): string {
  return `${Math.floor(ms / 1000)}_${Math.round(lat * 100)}_${Math.round(lon * 100)}`;
}

/** Mengembalikan null bila data tidak valid (kejadian dibuang, tidak ditebak). */
export function normalizeBmkgEvent(raw: unknown, tag: SourceTag): Earthquake | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Raw;

  const ms = Date.parse(String(r.DateTime ?? ''));
  const { lat, lon } = parseCoords(r);
  const magnitude = firstNumber(r.Magnitude);
  const depthKm = firstNumber(r.Kedalaman);
  const region = text(r.Wilayah);

  if (!Number.isFinite(ms)) return null;
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) return null;
  if (!Number.isFinite(lon) || lon < -180 || lon > 180) return null;
  if (!Number.isFinite(magnitude) || magnitude < 0 || magnitude > 10) return null;
  if (!Number.isFinite(depthKm) || depthKm < 0 || depthKm > 800) return null;
  if (!region) return null;

  const felt = text(r.Dirasakan);
  const feltReports = parseFeltReports(felt);

  return {
    id: eventKey(ms, lat, lon),
    originTime: new Date(ms).toISOString(),
    latitude: lat,
    longitude: lon,
    magnitude,
    depthKm,
    region,
    tsunamiNote: text(r.Potensi),
    felt,
    feltReports,
    maxMmi: maxMmiOf(feltReports),
    shakemapFile: text(r.Shakemap),
    sources: [tag],
  };
}
