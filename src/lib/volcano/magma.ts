/**
 * Modul murni (tanpa impor berawalan `@/`) untuk normalisasi data MAGMA dan
 * klasifikasi notifikasi gunung api. Dipakai server dan diuji lewat
 * `scripts/test-volcano.ts`.
 *
 * Semua field diambil apa adanya dari API publik MAGMA Indonesia
 * (`https://magma.esdm.go.id/_api`). Tidak ada status, koordinat, laporan,
 * atau erupsi yang dibuat sendiri oleh aplikasi.
 */
import type {
  EruptionEvent, GalleryPhoto, KrbMap, VolcanoCamera, VolcanoDetail, VolcanoLevel, VolcanoLevelChange,
  VolcanoNotification, VolcanoReport, VolcanoSourceRef, VolcanoStatus, VonaColor, VonaNotice,
} from '@/types/volcano';
import type { SeismogramStation } from '@/types/seismogram';

export const MAGMA_SITE = 'https://magma.esdm.go.id';

export const MAGMA_SOURCES = {
  status: 'https://magma.esdm.go.id/v1/gunung-api/tingkat-aktivitas',
  reports: 'https://magma.esdm.go.id/v1/gunung-api/laporan',
  daily: 'https://magma.esdm.go.id/v1/gunung-api/laporan-harian',
  eruptions: 'https://magma.esdm.go.id/v1/gunung-api/informasi-letusan',
  krb: 'https://magma.esdm.go.id/v1/gunung-api/peta-kawasan-rawan-bencana',
  cctv: 'https://magma.esdm.go.id/v1/gunung-api/cctv',
  gallery: 'https://magma.esdm.go.id/v1/gunung-api/gallery',
  vona: 'https://magma.esdm.go.id/vona',
  seismogram: 'https://magma.esdm.go.id/volcano/live-seismograf',
} as const;

export const MAGMA_SOURCE_REF: VolcanoSourceRef = {
  name: 'MAGMA Indonesia — PVMBG, Badan Geologi, Kementerian ESDM',
  url: MAGMA_SITE,
};

type Raw = Record<string, unknown>;

const str = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');
const nullableStr = (value: unknown): string | null => {
  const text = str(value);
  return text === '' ? null : text;
};
const finite = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};
const iso = (value: unknown): string | null => {
  const text = str(value);
  if (!text) return null;
  const at = Date.parse(text);
  return Number.isFinite(at) ? new Date(at).toISOString() : null;
};
const obj = (value: unknown): Raw => (value && typeof value === 'object' && !Array.isArray(value) ? value as Raw : {});

/** Level 1–4 dari angka status atau label resmi. */
export function parseVolcanoLevel(value: unknown, label?: unknown): VolcanoLevel | null {
  const numeric = finite(value);
  if (numeric !== null && numeric >= 1 && numeric <= 4) return Math.round(numeric) as VolcanoLevel;
  const text = str(label).toUpperCase();
  if (!text) return null;
  if (/LEVEL\s*(IV|4)/.test(text) || text.includes('AWAS')) return 4;
  if (/LEVEL\s*(III|3)/.test(text) || text.includes('SIAGA')) return 3;
  if (/LEVEL\s*(II|2)/.test(text) || text.includes('WASPADA')) return 2;
  if (/LEVEL\s*(I|1)/.test(text) || text.includes('NORMAL')) return 1;
  return null;
}

const LEVEL_LABEL: Record<VolcanoLevel, string> = {
  1: 'Level I (Normal)',
  2: 'Level II (Waspada)',
  3: 'Level III (Siaga)',
  4: 'Level IV (Awas)',
};

export const levelLabel = (level: VolcanoLevel | null): string => (level ? LEVEL_LABEL[level] : 'Tingkat tidak tercantum');

/** URL halaman laporan aktivitas resmi untuk satu gunung api (pencarian kode). */
export function reportSearchPage(code: string): string {
  return `${MAGMA_SITE}/v1/gunung-api/laporan/search/q?code=${encodeURIComponent(code)}`;
}

/**
 * `GET /_api/home/maps` → daftar status gunung api berkoordinat resmi.
 * Baris tanpa koordinat valid atau tanpa kode dilewati, bukan ditebak.
 */
export function normalizeVolcanoStatuses(payload: unknown, receivedAt: string): VolcanoStatus[] {
  const data = obj(payload).data;
  const list = Array.isArray(data) ? data
    : Array.isArray(obj(data).volcanoes) ? obj(data).volcanoes as unknown[]
      : [];
  const out: VolcanoStatus[] = [];
  for (const row of list) {
    const r = obj(row);
    const code = str(r.code);
    const name = str(r.name);
    const latitude = finite(r.latitude);
    const longitude = finite(r.longitude);
    const level = parseVolcanoLevel(r.status, r.status_label);
    if (!code || !name || latitude === null || longitude === null || level === null) continue;
    if (latitude < -12 || latitude > 7 || longitude < 94 || longitude > 142) continue;
    out.push({
      id: str(r.id) || code,
      code,
      name,
      province: str(r.province) || str(r.city) || 'Wilayah tidak tercantum',
      city: nullableStr(r.city),
      elevation: finite(r.elevation),
      latitude,
      longitude,
      level,
      levelLabel: str(r.status_label) || LEVEL_LABEL[level],
      hasVona: r.has_vona === true,
      hasVen: r.has_ven === true,
      sourceId: str(r.id) || code,
      publishedAt: iso(r.updated_at) ?? iso(r.created_at),
      receivedAt,
      sourceUrl: MAGMA_SOURCES.status,
    });
  }
  return out;
}

const VOLCANO_CODE_FROM_IMAGE = /\/img\/ga\/([A-Z0-9]{2,5})\//;

/** `GET /_api/ven/list` dan `/latest-ven` → informasi letusan resmi. */
export function normalizeEruption(row: unknown, receivedAt: string | null = null): EruptionEvent | null {
  const r = obj(row);
  const id = str(r.id);
  const name = str(r.volcano_name) || str(obj(r.volcano).name);
  const occurredAt = iso(r.datetime) ?? iso(r.iso_date_time);
  if (!id || !name || !occurredAt) return null;
  const image = obj(r.image);
  const zone = str(r.zone_area);
  return {
    id,
    volcanoCode: str(r.volcano_code) || str(obj(r.volcano).code),
    volcanoName: name,
    province: nullableStr(r.province),
    city: nullableStr(r.city),
    latitude: finite(r.latitude),
    longitude: finite(r.longitude),
    elevation: finite(r.elevation),
    occurredAt,
    publishedAt: iso(r.created_at) ?? iso(r.updated_at),
    ashHeightM: finite(r.ash_height),
    durationSeconds: finite(r.duration),
    information: nullableStr(r.information),
    recommendation: nullableStr(r.recommendation),
    author: nullableStr(r.user_name),
    zoneArea: zone || null,
    receivedAt,
    imagePath: null,
    sourceUrl: `${MAGMA_SITE}/v1/gunung-api/informasi-letusan`,
  };
}

/** `GET /_api/vona/list` → VONA resmi. */
export function normalizeVona(row: unknown): VonaNotice | null {
  const r = obj(row);
  const id = str(r.id);
  const name = str(r.volcano_name);
  const issuedAt = iso(r.issued);
  if (!id || !name || !issuedAt) return null;
  const code = (value: unknown): VonaColor | null => {
    const text = str(value).toUpperCase();
    return text === 'GREEN' || text === 'YELLOW' || text === 'ORANGE' || text === 'RED' ? text : null;
  };
  return {
    id,
    volcanoName: name,
    province: nullableStr(r.province_en) ?? nullableStr(r.province),
    issuedAt,
    noticeNumber: nullableStr(r.notice_number),
    previousCode: code(r.previous_code),
    currentCode: code(r.current_code),
    ashHeightM: finite(r.ash_height),
    durationMinutes: finite(r.duration),
    typeLabel: nullableStr(r.type_label),
    description: nullableStr(r.description),
    isSent: r.is_sent === true,
    issuedBy: nullableStr(r.user_name),
    sourceUrl: MAGMA_SOURCES.vona,
  };
}

function recommendationText(value: unknown): string | null {
  if (typeof value === 'string') return nullableStr(value);
  const r = obj(value);
  return nullableStr(r.recommendation);
}

/** Satu laporan aktivitas (format detail VAR) atau laporan harian (format ringkas). */
export function normalizeReport(
  row: unknown,
  kind: 'aktivitas' | 'harian',
  baseUrl: string,
): VolcanoReport | null {
  const r = obj(row);
  const id = str(r.id);
  const volcano = obj(r.volcano);
  const name = str(volcano.name) || str(r.volcano_name);
  const date = str(r.date);
  if (!id || !name || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;

  const seismic: { name: string; text: string }[] = [];
  if (Array.isArray(r.seismic)) {
    for (const item of r.seismic) {
      const s = obj(item);
      const label = str(s.seismic_name);
      const text = str(s.text) || (finite(s.count) !== null ? `${finite(s.count)} kali gempa ${label}` : '');
      if (label || text) seismic.push({ name: label || 'Gempa', text });
    }
  }

  const visual = obj(r.visual);
  const climatology = obj(r.climatology);
  const image = obj(visual.image);
  const imageUrl = str(image.url);
  // Status laporan berupa nama tingkat (NORMAL/WASPADA/SIAGA/AWAS) atau angka.
  const level = parseVolcanoLevel(r.status, r.status);
  const slug = nullableStr(r.slug);

  return {
    id,
    slug,
    volcanoCode: str(volcano.code) || str(r.volcano_code),
    volcanoName: name,
    province: nullableStr(volcano.province) ?? nullableStr(r.province),
    date,
    period: nullableStr(r.period),
    timeZone: nullableStr(r.time_zone),
    level,
    levelLabel: level ? LEVEL_LABEL[level] : (str(r.status) || 'Tingkat tidak tercantum'),
    publishedAt: iso(r.created_at) ?? iso(r.updated_at),
    author: nullableStr(r.user_name),
    recommendation: recommendationText(r.recommendation),
    visualText: nullableStr(r.visual_text) ?? nullableStr(r.visual_and_climatology_text),
    climatologyText: nullableStr(r.visual_and_climatology_text) ?? nullableStr(climatology.climatology_text),
    remarks: nullableStr(obj(r.visual).other_information),
    seismic,
    visualImagePath: imageUrl
      ? `/api/volcano/image?url=${encodeURIComponent(imageUrl)}`
      : null,
    kind,
    /*
      Tautan sumber menunjuk halaman web MAGMA yang benar-benar bisa dibuka.
      `…/laporan/<slug>` adalah endpoint JSON, bukan halaman: pengunjung hanya
      mendapat 403 Forbidden. Halaman daftar laporan resmi ada di
      `…/laporan` (untuk laporan harian: `…/laporan-harian`).
    */
    sourceUrl: kind === 'harian' ? MAGMA_SOURCES.daily : MAGMA_SOURCES.reports,
  };
}

/** `GET /_api/volcano-activity/histories-by-volcano` → riwayat perubahan tingkat. */
export function normalizeLevelChange(row: unknown, volcanoCode: string, volcanoName: string): VolcanoLevelChange | null {
  const r = obj(row);
  // Histories memakai nama tingkat tanpa prefiks "Level" (mis. `WASPADA`).
  const previous = parseVolcanoLevel(r.previous_level, r.previous_level);
  const current = parseVolcanoLevel(r.current_level, r.current_level);
  const changeDate = str(r.change_date);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(changeDate)) return null;
  const direction = str(r.change_direction).toUpperCase();
  return {
    id: `${volcanoCode}:${changeDate}:${str(r.previous_level)}:${str(r.current_level)}`,
    volcanoId: str(r.volcano_id),
    volcanoCode,
    volcanoName,
    province: null,
    previousLevel: previous,
    currentLevel: current,
    previousLabel: previous ? LEVEL_LABEL[previous] : (nullableStr(r.previous_level)),
    currentLabel: current ? LEVEL_LABEL[current] : (nullableStr(r.current_level)),
    direction: direction === 'NAIK' || direction === 'TURUN' || direction === 'TETAP' ? direction : null,
    changeDate,
    endDate: /^\d{4}-\d{2}-\d{2}$/.test(str(r.end_date)) ? str(r.end_date) : null,
    durationDays: finite(r.duration_days),
    sourceName: nullableStr(r.source_name),
    author: nullableStr(r.created_by_name),
    sourceUrl: MAGMA_SOURCES.status,
  };
}

/** `GET /_api/cctv/list` → gambar kamera pemantau resmi. */
export function normalizeCamera(row: unknown): VolcanoCamera | null {
  const r = obj(row);
  const id = str(r.id);
  const code = str(r.volcano_code);
  const name = str(r.volcano_name);
  const urls = Array.isArray(r.urls) ? r.urls.filter((u): u is string => typeof u === 'string' && u.startsWith('https://')) : [];
  const first = urls[0];
  if (!id || !code || !name || !first) return null;
  return {
    id,
    volcanoCode: code,
    volcanoName: name,
    station: str(r.station),
    capturedAt: iso(r.captured_at),
    imagePath: `/api/volcano/image?url=${encodeURIComponent(first)}`,
    sourceImageUrl: first,
    sourceUrl: MAGMA_SOURCES.cctv,
  };
}

/** `GET /_api/volcano/krb` → peta KRB berupa berkas gambar resmi PVMBG. */
export function normalizeKrb(row: unknown): KrbMap | null {
  const r = obj(row);
  const id = str(r.id);
  const name = str(r.volcano_name);
  const image = obj(r.image);
  const url = str(image.url);
  if (!id || !name || !url) return null;
  const fileName = str(image.original_file_name);
  return {
    id,
    volcanoId: nullableStr(r.volcano_id),
    volcanoName: name,
    year: r.year === null || r.year === undefined ? null : String(r.year),
    description: nullableStr(r.description),
    fileSize: finite(r.file_size),
    fileType: fileName.includes('.') ? fileName.split('.').pop()!.toUpperCase() : null,
    imagePath: `/api/volcano/krb/${encodeURIComponent(id)}/file?mode=preview`,
    downloadPath: `/api/volcano/krb/${encodeURIComponent(id)}/file?mode=download`,
    sourceUrl: url,
    sourcePage: MAGMA_SOURCES.krb,
  };
}

/** `GET /_api/volcano/gallery` → foto dokumentasi visual resmi. */
export function normalizeGalleryPhoto(row: unknown): GalleryPhoto | null {
  const r = obj(row);
  const image = obj(r.image);
  const url = str(image.url);
  const name = str(r.volcano_name);
  if (!url || !name) return null;
  const uploadedAt = iso(r.var_visual_created_at) ?? iso(r.var_created_at);
  const codeMatch = VOLCANO_CODE_FROM_IMAGE.exec(url);
  const fileMatch = /\/([A-Z0-9]{2,5})(\d{8})2400\.(png|jpg|jpeg)$/i.exec(url);
  const visualDate = fileMatch
    ? `${fileMatch[2].slice(0, 4)}-${fileMatch[2].slice(4, 6)}-${fileMatch[2].slice(6, 8)}`
    : null;
  const id = `${codeMatch?.[1] ?? name}|${url}`;
  return {
    id,
    volcanoName: name,
    volcanoCode: codeMatch?.[1] ?? null,
    uploadedAt,
    visualDate,
    imagePath: `/api/volcano/image?url=${encodeURIComponent(url)}`,
    sourceUrl: url,
  };
}

/** Cari stasiun seismograf live yang terkait satu gunung api (reuse `/api/seismograms`). */
export function seismogramsForVolcano(stations: SeismogramStation[], code: string, name: string): VolcanoDetail['seismograms'] {
  const targetCode = code.trim().toUpperCase();
  const targetName = name.trim().toLowerCase();
  return stations
    .filter((station) => (targetCode && station.volcanoCode.toUpperCase() === targetCode)
      || (!station.volcanoCode && station.volcanoName.trim().toLowerCase() === targetName))
    .sort((a, b) => a.scnl.localeCompare(b.scnl))
    .map((station) => ({
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

/* -------------------------------------------------------------------------- */
/* Klasifikasi notifikasi                                                      */
/* -------------------------------------------------------------------------- */

export interface LevelObservation {
  code: string;
  name: string;
  level: VolcanoLevel | null;
  label: string;
}

export interface VolcanoNotificationCandidate {
  key: string;
  kind: VolcanoNotification['kind'];
  volcanoCode: string;
  volcanoName: string;
  title: string;
  body: string;
  url: string;
  sourceId: string;
  occurredAt: string;
}

const truncate = (text: string, max: number): string => {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 1)}…`;
};

/**
 * Deteksi perubahan tingkat aktivitas resmi dengan membandingkan status
 * terbaru terhadap status yang sudah diproses. Bukan notifikasi erupsi:
 * perubahan level tidak pernah menjadi bukti erupsi.
 */
export function detectLevelChanges(
  previous: Map<string, LevelObservation>,
  current: LevelObservation[],
  detectedAt: string,
): VolcanoNotificationCandidate[] {
  const out: VolcanoNotificationCandidate[] = [];
  for (const volcano of current) {
    if (!volcano.level) continue;
    const before = previous.get(volcano.code);
    if (!before) continue; // pemeriksaan pertama: hanya mencatat dasar, tidak mengirim.
    if (!before.level || before.level === volcano.level) continue;
    out.push({
      key: `level:${volcano.code}:${volcano.level}:${volcano.label}`,
      kind: 'level-change',
      volcanoCode: volcano.code,
      volcanoName: volcano.name,
      title: `Perubahan tingkat aktivitas: ${volcano.name}`,
      body: `${levelLabel(before.level)} → ${levelLabel(volcano.level)} menurut MAGMA/PVMBG.`,
      url: `/gunung-berapi/${volcano.code.toLowerCase()}`,
      sourceId: `level:${volcano.code}:${volcano.level}`,
      occurredAt: detectedAt,
    });
  }
  return out;
}

/** Satu notifikasi untuk setiap informasi letusan (VEN) resmi yang belum pernah dikirim. */
export function eruptionCandidate(event: EruptionEvent, seen: Set<string>): VolcanoNotificationCandidate | null {
  if (seen.has(event.id)) return null;
  const ash = event.ashHeightM !== null ? `${event.ashHeightM} m` : 'tidak teramati';
  return {
    key: `ven:${event.id}`,
    kind: 'eruption',
    volcanoCode: event.volcanoCode,
    volcanoName: event.volcanoName,
    title: `Laporan erupsi resmi: ${event.volcanoName}`,
    body: truncate(
      event.information
      ?? `MAGMA/PVMBG menerbitkan informasi letusan untuk ${event.volcanoName}. Tinggi kolom abu ${ash}.`,
      180,
    ),
    url: `/gunung-berapi/${event.volcanoCode.toLowerCase()}/erupsi`,
    sourceId: event.id,
    occurredAt: event.occurredAt,
  };
}

/** Satu notifikasi untuk setiap VONA resmi baru. */
export function vonaCandidate(notice: VonaNotice, seen: Set<string>): VolcanoNotificationCandidate | null {
  if (seen.has(notice.id)) return null;
  return {
    key: `vona:${notice.id}`,
    kind: 'vona',
    volcanoCode: '',
    volcanoName: notice.volcanoName,
    title: `VONA baru: ${notice.volcanoName}`,
    body: truncate(
      `${notice.noticeNumber ?? 'VONA'} · kode ${notice.previousCode ?? '—'} → ${notice.currentCode ?? '—'}. ${notice.description ?? ''}`,
      180,
    ),
    url: '/gunung-berapi/vona',
    sourceId: notice.id,
    occurredAt: notice.issuedAt,
  };
}

/** Slug sederhana untuk URL internal (dipakai hanya untuk path, bukan data resmi). */
export function volcanoSlug(code: string, name: string): string {
  const cleanCode = code.trim().toLowerCase();
  if (cleanCode) return cleanCode;
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
