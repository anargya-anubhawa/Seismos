import { BMKG_SHAKEMAP_BASE } from '../constants';
import type {
  TsunamiAlertStatus, TsunamiLevel, TsunamiMapLinks, TsunamiObservation, TsunamiRegion,
  TsunamiSourceId,
} from '../../types/tsunami';
import { decodeNuxtData, findNuxtAlertInfos } from './nuxt';

export const DATAGEMPA_URL = 'https://cdn.bmkg.go.id/datagempa.json';
export const TSUNAMI_HISTORY_URL = 'https://www.bmkg.go.id/gempabumi/berpotensi-tsunami';

const DATAGEMPA_SOURCE_URL = (process.env.TSUNAMI_DATAGEMPA_URL ?? DATAGEMPA_URL).trim();
const HISTORY_SOURCE_URL = (process.env.TSUNAMI_HISTORY_URL ?? TSUNAMI_HISTORY_URL).trim();

export interface TsunamiCandidate {
  source: TsunamiSourceId;
  eventId: string;
  subject: string;
  phase: string | null;
  status: TsunamiAlertStatus;
  issueTime: string;
  originTime: string | null;
  magnitude: number | null;
  depthKm: number | null;
  latitude: number | null;
  longitude: number | null;
  region: string;
  headline: string;
  description: string;
  potential: string;
  instructions: string[];
  regions: TsunamiRegion[];
  observations: TsunamiObservation[];
  maps: TsunamiMapLinks;
  sourceUrl: string;
  sourceName: string;
}

const LEVELS: TsunamiLevel[] = ['AWAS', 'SIAGA', 'WASPADA'];
const MONTH_LENGTHS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

const asText = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');
const asNumber = (value: unknown): number | null => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  const match = value.replace(',', '.').match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
};

const pad = (value: number): string => String(value).padStart(2, '0');

function parseDateParts(raw: string): { year: number; month: number; day: number } | null {
  const value = raw.trim();
  let match = value.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/);
  if (match) {
    const day = Number(match[1]);
    const month = Number(match[2]);
    let year = Number(match[3]);
    if (year < 100) year += 2000;
    return validDate(year, month, day);
  }
  match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) return validDate(Number(match[1]), Number(match[2]), Number(match[3]));
  return null;
}

function validDate(year: number, month: number, day: number): { year: number; month: number; day: number } | null {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  if (month < 1 || month > 12) return null;
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const max = month === 2 && leap ? 29 : MONTH_LENGTHS[month - 1];
  if (day < 1 || day > max) return null;
  return { year, month, day };
}

function parseClock(raw: string): { hour: number; minute: number; second: number; offset: string } | null {
  const value = raw.trim().toUpperCase();
  const match = value.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(WIB|WITA|WIT)?$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const second = Number(match[3] ?? 0);
  if (hour > 23 || minute > 59 || second > 59) return null;
  const zone = match[4] ?? 'WIB';
  const offset = zone === 'WITA' ? '+08:00' : zone === 'WIT' ? '+09:00' : '+07:00';
  return { hour, minute, second, offset };
}

/** Menggabungkan tanggal dan jam BMKG ("15-08-26" + "04:58:24 WIB") menjadi ISO 8601. */
export function parseBmkgDateTime(dateRaw: unknown, timeRaw: unknown): string | null {
  const date = parseDateParts(asText(dateRaw));
  const clock = parseClock(asText(timeRaw));
  if (!date || !clock) return null;
  const iso = `${date.year}-${pad(date.month)}-${pad(date.day)}T${pad(clock.hour)}:${pad(clock.minute)}:${pad(clock.second)}${clock.offset}`;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

/**
 * Waktu terbit pembaruan BMKG. Format yang ditemui:
 * - "15/08/2026 07:31:30WIB"
 * - "2026-10-28T18:59:15WIB"
 * - ISO 8601 biasa
 */
export function parseIssueTime(raw: unknown): string | null {
  const value = asText(raw);
  if (!value) return null;
  const zoned = value
    .replace(/\s*(WIB)$/i, '+07:00')
    .replace(/\s*(WITA)$/i, '+08:00')
    .replace(/\s*(WIT)$/i, '+09:00');
  const direct = Date.parse(zoned);
  if (Number.isFinite(direct)) return new Date(direct).toISOString();

  const match = value.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(WIB|WITA|WIT)?$/i);
  if (!match) return null;
  return parseBmkgDateTime(`${match[1]}-${match[2]}-${match[3]}`, `${match[4]}:${match[5]}:${match[6] ?? '00'} ${match[7] ?? 'WIB'}`);
}

/** Koordinat BMKG seperti "8.41 LS" / "121.39 BT", atau angka biasa. */
export function parseCoordinate(raw: unknown): number | null {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  const value = asText(raw);
  if (!value) return null;
  const match = value.match(/^(-?\d+(?:[.,]\d+)?)\s*(LS|LU|BT|BB)?$/i);
  if (!match) return null;
  const magnitude = Number(match[1].replace(',', '.'));
  if (!Number.isFinite(magnitude)) return null;
  const suffix = (match[2] ?? '').toUpperCase();
  if (suffix === 'LS' || suffix === 'BB') return -Math.abs(magnitude);
  if (suffix === 'LU' || suffix === 'BT') return Math.abs(magnitude);
  return magnitude;
}

function pointCoordinates(info: Record<string, unknown>): { latitude: number | null; longitude: number | null } {
  const latitude = parseCoordinate(info.latitude);
  const longitude = parseCoordinate(info.longitude);
  if (latitude !== null && longitude !== null) return { latitude, longitude };

  const point = info.point as { coordinates?: unknown } | undefined;
  const raw = asText(point?.coordinates);
  const parts = raw.split(',').map((part) => Number(part.trim()));
  if (parts.length === 2 && parts.every(Number.isFinite)) {
    // BMKG menulis point.coordinates sebagai "longitude,latitude".
    const [lon, lat] = parts;
    if (Math.abs(lat) <= 90 && Math.abs(lon) <= 180) return { latitude: lat, longitude: lon };
  }
  return { latitude, longitude };
}

function normalizeLevel(raw: unknown): TsunamiLevel | null {
  const value = asText(raw).toUpperCase();
  return LEVELS.find((level) => level === value) ?? null;
}

function normalizeRegions(info: Record<string, unknown>): TsunamiRegion[] {
  const raw = info.wzarea;
  const rows = Array.isArray(raw) ? raw : raw && typeof raw === 'object' ? [raw] : [];
  const unique = new Map<string, TsunamiRegion>();
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const record = row as Record<string, unknown>;
    const level = normalizeLevel(record.level);
    if (!level) continue;
    const province = asText(record.province) || 'Wilayah tidak disebutkan';
    const district = asText(record.district);
    const region: TsunamiRegion = {
      province,
      district,
      level,
      date: asText(record.date) || null,
      time: asText(record.time) || null,
    };
    unique.set(`${province}|${district}|${level}`, region);
  }
  const order: Record<TsunamiLevel, number> = { AWAS: 0, SIAGA: 1, WASPADA: 2 };
  return Array.from(unique.values()).sort(
    (a, b) => order[a.level] - order[b.level] || a.province.localeCompare(b.province) || a.district.localeCompare(b.district),
  );
}

function normalizeObservations(info: Record<string, unknown>): TsunamiObservation[] {
  const raw = info.obsarea;
  const rows = Array.isArray(raw) ? raw : raw && typeof raw === 'object' ? [raw] : [];
  const out: TsunamiObservation[] = [];
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const record = row as Record<string, unknown>;
    const location = asText(record.location);
    if (!location) continue;
    let latitude = parseCoordinate(record.loclatitude);
    let longitude = parseCoordinate(record.loclongitude);
    // Beberapa respons BMKG menukar loclatitude/loclongitude.
    if (latitude !== null && Math.abs(latitude) > 90 && longitude !== null && Math.abs(longitude) <= 90) {
      [latitude, longitude] = [longitude, latitude];
    }
    out.push({
      location,
      latitude,
      longitude,
      heightM: asNumber(record.height),
      date: asText(record.date) || null,
      time: asText(record.time) || null,
    });
  }
  return out;
}

function safeMapUrl(raw: unknown): string | null {
  const value = asText(raw);
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) {
    try {
      const url = new URL(value);
      if (url.protocol === 'https:' && (url.hostname === 'bmkg.go.id' || url.hostname.endsWith('.bmkg.go.id'))) {
        return url.toString();
      }
    } catch {
      return null;
    }
    return null;
  }
  if (!/^[A-Za-z0-9._-]+$/.test(value)) return null;
  return `${BMKG_SHAKEMAP_BASE}${value}`;
}

function normalizeMaps(info: Record<string, unknown>): TsunamiMapLinks {
  return {
    travelTime: safeMapUrl(info.ttmap),
    coastalThreat: safeMapUrl(info.wzmap),
    seaLevel: safeMapUrl(info.sshmap),
    shakemap: safeMapUrl(info.shakemap),
  };
}

function normalizeInstructions(info: Record<string, unknown>): string[] {
  const out: string[] = [];
  for (const key of ['instruction1', 'instruction2', 'instruction3', 'instruction'] as const) {
    const value = asText(info[key]);
    if (value && !out.includes(value)) out.push(value);
  }
  return out;
}

/**
 * Apakah info BMKG benar-benar peringatan/potensi tsunami?
 * Teks "tidak berpotensi tsunami" pada gempa biasa harus tidak dianggap alert.
 */
export function isTsunamiInfo(info: Record<string, unknown>): boolean {
  const subject = asText(info.subject);
  const potential = asText(info.potential);
  const headline = asText(info.headline);
  const combined = `${subject} ${potential} ${headline}`;
  if (/tidak\s+(?:ber)?potensi\s+tsunami|tidak\s+ada\s+(?:potensi\s+)?tsunami|no\s+tsunami/i.test(combined)) {
    return false;
  }
  if (/warning\s+tsunami|peringatan\s+dini\s+tsunami|potensi\s+tsunami|tsunami\s+warning/i.test(combined)) return true;
  return /tsunami/i.test(subject) || /tsunami/i.test(potential);
}

function parsePhase(subject: string): string | null {
  const match = subject.match(/\bPD[-\s]?(\d+(?:\.\d+)?)\b/i);
  return match ? `PD-${match[1]}` : null;
}

/** Menormalkan satu objek info BMKG menjadi kandidat peringatan tsunami. */
export function normalizeTsunamiInfo(
  info: Record<string, unknown>,
  source: TsunamiSourceId,
  fallbackIssueTime?: unknown,
): TsunamiCandidate | null {
  if (!isTsunamiInfo(info)) return null;

  const subject = asText(info.subject) || 'Peringatan Tsunami BMKG';
  const headline = asText(info.headline);
  const description = asText(info.description);
  const issueTime = parseIssueTime(info.timesent) ?? parseIssueTime(fallbackIssueTime);
  if (!issueTime) return null;

  const phase = parsePhase(subject);
  const endedText = /telah\s+berakhir|dinyatakan\s+berakhir|berakhir|cabut|dicabut|ended/i.test(`${subject} ${headline}`);
  const endedPhase = phase === 'PD-4' || Boolean(phase?.startsWith('PD-4.'));
  const status: TsunamiAlertStatus = endedPhase || endedText ? 'ended' : 'active';
  const { latitude, longitude } = pointCoordinates(info);

  return {
    source,
    eventId: info.eventid === undefined || info.eventid === null
      ? `${source}-${issueTime}`
      : String(info.eventid).trim() || `${source}-${issueTime}`,
    subject,
    phase,
    status,
    issueTime,
    originTime: parseBmkgDateTime(info.date, info.time),
    magnitude: asNumber(info.magnitude),
    depthKm: asNumber(info.depth),
    latitude,
    longitude,
    region: asText(info.area) || 'Lokasi tidak disebutkan',
    headline: headline || subject,
    description: description || headline,
    potential: asText(info.potential),
    instructions: normalizeInstructions(info),
    regions: normalizeRegions(info),
    observations: normalizeObservations(info),
    maps: normalizeMaps(info),
    sourceUrl: source === 'datagempa' ? DATAGEMPA_SOURCE_URL : HISTORY_SOURCE_URL,
    sourceName: source === 'datagempa' ? 'BMKG · feed WRS' : 'BMKG · halaman peringatan tsunami',
  };
}

interface DatagempaRoot {
  sent?: unknown;
  info?: unknown;
}

/** Parse `cdn.bmkg.go.id/datagempa.json`; null berarti feed sehat tetapi bukan tsunami. */
export function parseDatagempaPayload(json: unknown): TsunamiCandidate | null {
  if (!json || typeof json !== 'object') throw new Error('Respons datagempa bukan objek JSON');
  const root = json as DatagempaRoot;
  const rawInfo = root.info;
  const info = Array.isArray(rawInfo) ? rawInfo[0] : rawInfo;
  if (!info || typeof info !== 'object') throw new Error('Field info datagempa tidak dikenali');
  return normalizeTsunamiInfo(info as Record<string, unknown>, 'datagempa', root.sent);
}

/** Parse halaman riwayat BMKG dan kembalikan semua pembaruan tsunami. */
export function parseTsunamiHistoryHtml(html: string): TsunamiCandidate[] {
  const decoded = decodeNuxtData(html);
  const infos = findNuxtAlertInfos(decoded);
  if (infos.length === 0) throw new Error('Daftar peringatan tsunami tidak ditemukan di halaman BMKG');
  const candidates: TsunamiCandidate[] = [];
  for (const info of infos) {
    const candidate = normalizeTsunamiInfo(info, 'history');
    if (candidate) candidates.push(candidate);
  }
  return candidates;
}
