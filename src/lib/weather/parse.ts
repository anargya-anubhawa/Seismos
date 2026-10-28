import type { WeatherAlert, WeatherArea, WeatherPoint } from '../../types/weather';

/**
 * Pengurai data cuaca BMKG yang murni (tanpa jaringan) agar dapat diuji.
 *
 * Semua angka diambil apa adanya dari sumber. Bila BMKG tidak menerbitkan
 * sebuah nilai (mis. jarak pandang `null`), nilai itu tetap `null` dan UI wajib
 * menampilkannya sebagai "tidak tercantum", bukan menebak.
 */

const str = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');
const num = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};
const obj = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {};

/* --------------------------------------------------------- wilayah adm4 -- */

interface RegionRow { c: string; d: string; k: string; p: string; lat: number; lon: number }

/** Membaca daftar kecamatan dari berkas gzip yang dibangun skrip build. */
export function parseRegionFile(buffer: Buffer): WeatherArea[] {
  const payload = JSON.parse(buffer.toString('utf8')) as { regions?: RegionRow[] };
  const rows = payload.regions ?? [];
  return rows.map((row) => ({
    code: row.c,
    village: row.d,
    district: row.d,
    regency: row.k,
    province: row.p,
    latitude: row.lat,
    longitude: row.lon,
  }));
}

/** Jarak dua titik (km) memakai rumus haversine — cukup akurat untuk memilih kecamatan terdekat. */
export function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Batas wilayah Indonesia; di luar ini prakiraan desa BMKG tidak berlaku. */
export const INDONESIA_BOUNDS = { minLat: -11.5, maxLat: 6.5, minLon: 94.5, maxLon: 141.5 };

export function isInIndonesia(latitude: number, longitude: number): boolean {
  return (
    latitude >= INDONESIA_BOUNDS.minLat &&
    latitude <= INDONESIA_BOUNDS.maxLat &&
    longitude >= INDONESIA_BOUNDS.minLon &&
    longitude <= INDONESIA_BOUNDS.maxLon
  );
}

export interface NearestArea {
  area: WeatherArea;
  /** Jarak koordinat pengguna ke titik wilayah (km). */
  distanceKm: number;
}

/**
 * Mencari kecamatan terdekat dari sebuah koordinat. Pencarian linear cukup
 * karena daftar hanya ribuan baris dan hasilnya juga di-cache server.
 */
export function nearestArea(areas: WeatherArea[], latitude: number, longitude: number): NearestArea | null {
  let best: NearestArea | null = null;
  for (const area of areas) {
    const d = distanceKm(latitude, longitude, area.latitude, area.longitude);
    if (!best || d < best.distanceKm) best = { area, distanceKm: d };
  }
  return best;
}

/* ---------------------------------------------------- prakiraan cuaca -- */

/** Normalisasi satu titik prakiraan dari `api.bmkg.go.id`. */
export function normalizeWeatherPoint(row: unknown, timezone: string): import('../../types/weather').WeatherPoint | null {
  const r = obj(row);
  // Waktu lokal BMKG berbentuk "2026-10-29 05:00:00" tanpa zona; ubah ke ISO
  // dengan offset zona wilayah agar tidak bergeser saat dibaca peramban.
  const local = str(r.local_datetime);
  const time = local
    ? `${local.replace(' ', 'T')}${timezone.startsWith('+') || timezone.startsWith('-') ? timezone : localOffset(timezone)}`
    : str(r.datetime);
  if (!time) return null;
  return {
    time,
    temperatureC: num(r.t),
    cloudCoverPct: num(r.tcc),
    precipitationMm: num(r.tp),
    weatherCode: num(r.weather),
    description: str(r.weather_desc) || 'Tidak tercantum',
    humidityPct: num(r.hu),
    windSpeedKmh: num(r.ws),
    windFrom: str(r.wd) || null,
    windTo: str(r.wd_to) || null,
    visibilityM: num(r.vs),
    visibilityText: str(r.vs_text) || null,
    iconUrl: str(r.image) || null,
  };
}

const ZONE_OFFSET: Record<string, string> = {
  'Asia/Jakarta': '+07:00',
  'Asia/Pontianak': '+07:00',
  'Asia/Makassar': '+08:00',
  'Asia/Jayapura': '+09:00',
};

const localOffset = (timezone: string): string => ZONE_OFFSET[timezone] ?? '+07:00';
/** Nama zona dari kode offset BMKG ("+0700", "+08:00", "+0900"). */
export function zoneFromOffset(offset: string | null | undefined): string | null {
  if (!offset) return null;
  const match = offset.trim().match(/^([+-])(\d{2}):?(\d{2})$/);
  if (!match) return null;
  const sign = match[1] === '-' ? '-' : '+';
  const key = `${sign}${match[2]}:${match[3]}`;
  for (const [zone, value] of Object.entries(ZONE_OFFSET)) {
    if (value === key && zone !== 'Asia/Pontianak') return zone;
  }
  return null;
}


/** Normalisasi satu kecamatan lengkap (lokasi + semua titik prakiraan). */
export function normalizeWeatherArea(location: unknown, rows: unknown[], fetchedAt: string): {
  area: import('../../types/weather').WeatherArea | null;
  timezone: string;
  points: import('../../types/weather').WeatherPoint[];
  analysisAt: string | null;
} {
  const l = obj(location);
  const timezone = str(l.timezone) || 'Asia/Jakarta';
  const code = str(l.adm4);
  const points = rows
    .map((row) => normalizeWeatherPoint(row, timezone))
    .filter((point): point is import('../../types/weather').WeatherPoint => point !== null)
    .sort((a, b) => Date.parse(a.time) - Date.parse(b.time));
  const analysisAt = str(obj(rows[0]).analysis_date) || null;
  void fetchedAt;
  if (!code) return { area: null, timezone, points, analysisAt };
  return {
    area: {
      code,
      village: str(l.desa) || str(l.kecamatan),
      district: str(l.kecamatan),
      regency: str(l.kotkab),
      province: str(l.provinsi),
      latitude: num(l.lat) ?? 0,
      longitude: num(l.lon) ?? 0,
    },
    timezone,
    points,
    analysisAt,
  };
}

/** Mengelompokkan titik prakiraan per tanggal lokal (YYYY-MM-DD). */
export function groupByLocalDate(
  points: import('../../types/weather').WeatherPoint[],
): { date: string; points: import('../../types/weather').WeatherPoint[] }[] {
  const groups = new Map<string, import('../../types/weather').WeatherPoint[]>();
  for (const point of points) {
    const date = point.time.slice(0, 10);
    const list = groups.get(date);
    if (list) list.push(point);
    else groups.set(date, [point]);
  }
  const instant = (point: WeatherPoint) => {
    const value = Date.parse(point.time);
    return Number.isFinite(value) ? value : 0;
  };
  return [...groups.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, list]) => ({ date, points: [...list].sort((a, b) => instant(a) - instant(b)) }));
}

/** Label tanggal lengkap Bahasa Indonesia, mis. "Kamis, 29 Oktober 2026". */
export function dateLabel(date: string): string {
  const target = new Date(`${date}T00:00:00`);
  if (Number.isNaN(target.getTime())) return date;
  return new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(target);
}

/** Label hari Bahasa Indonesia dari tanggal lokal, mis. "Kamis, 29 Okt". */
export function dayLabel(date: string, now = new Date()): string {
  const target = new Date(`${date}T00:00:00`);
  if (Number.isNaN(target.getTime())) return date;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.round((target.getTime() - today.getTime()) / 86_400_000);
  if (diffDays === 0) return 'Hari ini';
  if (diffDays === 1) return 'Besok';
  return new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'short' }).format(target);
}

/* -------------------------------------------- peringatan dini cuaca -- */

/** Mengurai satu `<item>` RSS nowcast BMKG menjadi peringatan terstruktur. */
export function normalizeWeatherAlert(item: unknown): import('../../types/weather').WeatherAlert | null {
  const r = obj(item);
  const title = str(r.title);
  const id = str(r.id) || str(r.link);
  const pubDate = str(r.pubDate);
  if (!title || !id || !pubDate) return null;
  const issuedAt = new Date(pubDate);
  if (Number.isNaN(issuedAt.getTime())) return null;
  const description = str(r.description);

  // Judul BMKG berakhiran "di <wilayah>".
  const regionMatch = title.match(/\bdi\s+(.+)$/i);
  const lines = description.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);

  const impacts: string[] = [];
  const impactLine = lines.find((line) => /potensi menimbulkan dampak/i.test(line));
  if (impactLine) {
    const list = impactLine.replace(/^.*?dampak berupa\s*/i, '').replace(/\.$/, '');
    // Pemisah dampak BMKG berbentuk "a, b, dan c": "dan" di depan butir
    // terakhir dibuang agar daftar tidak memuat kata sambung.
    for (const part of list.split(/,\s*/)) {
      const clean = part.replace(/^dan\s+/i, '').trim();
      if (clean) impacts.push(clean);
    }
  }

  const adviceLine = lines.find((line) => /dihimbau|diminta|disarankan/i.test(line)) ?? null;
  const expiryLine = lines.find((line) => /diperkirakan dapat berlangsung hingga/i.test(line));
  let expiresAt: string | null = null;
  if (expiryLine) {
    const datePart = expiryLine.match(/hingga\s+(\d{1,2}\s+\w+\s+\d{4},?\s+\d{2}:\d{2})/i);
    if (datePart) {
      const parsed = new Date(datePart[1].replace(/,/, ''));
      if (!Number.isNaN(parsed.getTime())) expiresAt = parsed.toISOString();
    }
  }

  return {
    id,
    title,
    region: regionMatch ? regionMatch[1].trim() : null,
    issuedAt: issuedAt.toISOString(),
    description,
    impacts,
    advice: adviceLine,
    expiresAt,
    sourceUrl: str(r.link) || 'https://www.bmkg.go.id/cuaca/peringatan-dini-cuaca',
  };
}

/**
 * Pengurai RSS minimal untuk nowcast BMKG. Tidak memakai pustaka XML penuh
 * karena bentuk feed-nya tetap dan sederhana; entitas diurai agar judul serta
 * deskripsi tampil wajar.
 */
export function parseRssItems(xml: string): {
  channelTitle: string;
  channelDate: string | null;
  items: Record<string, string>[];
} {
  const cdata = (value: string): string =>
    value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim();
  const unescape = (value: string): string =>
    value
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;|&apos;/g, "'")
      .replace(/&amp;/g, '&');
  const pick = (xml_: string, tag: string): string => {
    const match = xml_.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'));
    return match ? unescape(cdata(match[1])) : '';
  };

  const channelTitle = pick(xml, 'title');
  const channelDate = pick(xml.slice(0, xml.indexOf('<item')), 'pubDate') || null;
  const items: Record<string, string>[] = [];
  for (const match of xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)) {
    const block = match[1];
    const guidMatch = block.match(/<guid[^>]*>([\s\S]*?)<\/guid>/i);
    items.push({
      title: pick(block, 'title'),
      link: pick(block, 'link'),
      description: pick(block, 'description'),
      pubDate: pick(block, 'pubDate'),
      id: guidMatch ? unescape(cdata(guidMatch[1])) : '',
    });
  }
  return { channelTitle, channelDate, items };
}

/* ------------------------------------------------------------- satelit -- */

export interface SatelliteDefinition {
  id: string;
  name: string;
  description: string;
  group: 'himawari' | 'gk2a' | 'gsmap' | 'lingkungan';
  sourceUrl: string;
  width: number;
  height: number;
}

/**
 * Daftar produk satelit yang ditampilkan situs BMKG
 * (https://www.bmkg.go.id/cuaca/satelit). Daftar ini dibuat tetap di kode
 * karena situs BMKG tidak menerbitkan katalog JSON untuk citra INDERAJA;
 * alamat dan nama produk di bawah diambil dari halaman tersebut.
 */
export const SATELLITE_PRODUCTS: SatelliteDefinition[] = [
  {
    id: 'himawari-ir-enhanced',
    name: 'Himawari-9 IR Enhanced',
    description: 'Suhu puncak awan yang ditingkatkan kontrasnya; membantu melihat pertumbuhan awan konvektif.',
    group: 'himawari',
    sourceUrl: 'https://inderaja.bmkg.go.id/IMAGE/HIMA/H08_EH_Indonesia.png',
    width: 1674,
    height: 1118,
  },
  {
    id: 'himawari-natural',
    name: 'Himawari-9 Natural Color',
    description: 'Citra menyerupai warna asli untuk gambaran awan dan permukaan secara umum.',
    group: 'himawari',
    sourceUrl: 'https://inderaja.bmkg.go.id/IMAGE/HIMA/H08_NC_Indonesia.png',
    width: 1674,
    height: 1118,
  },
  {
    id: 'himawari-water-vapour',
    name: 'Himawari-9 Water Vapor Enhanced',
    description: 'Uap air di lapisan atas; berguna melihat aliran massa udara kering dan lembap.',
    group: 'himawari',
    sourceUrl: 'https://inderaja.bmkg.go.id/IMAGE/HIMA/H08_WE_Indonesia.png',
    width: 1674,
    height: 1118,
  },
  {
    id: 'himawari-rainfall',
    name: 'Himawari-9 Rainfall Potential',
    description: 'Potensi curah hujan dari analisis awan; indikasi wilayah yang berpeluang hujan lebat.',
    group: 'himawari',
    sourceUrl: 'https://inderaja.bmkg.go.id/IMAGE/HIMA/H08_RP_Indonesia.png',
    width: 1674,
    height: 1118,
  },
  {
    id: 'himawari-convective',
    name: 'Himawari-9 Convective Cloud',
    description: 'Sebaran awan konvektif; berkaitan dengan pembentukan hujan lebat dan petir.',
    group: 'himawari',
    sourceUrl: 'https://inderaja.bmkg.go.id/IMAGE/HCAI/CVC/HCAI_CVC_Indonesia.png',
    width: 1674,
    height: 1118,
  },
  {
    id: 'himawari-cloud-top',
    name: 'Himawari-9 Cloud Top Height',
    description: 'Ketinggian puncak awan; awan sangat tinggi menandakan konveksi kuat.',
    group: 'himawari',
    sourceUrl: 'https://inderaja.bmkg.go.id/IMAGE/HCAI/HTC/HCAI_HTC_Indonesia.png',
    width: 1674,
    height: 1118,
  },
  {
    id: 'himawari-cloud-type',
    name: 'Himawari-9 Cloud Type',
    description: 'Klasifikasi jenis awan hasil analisis citra satelit.',
    group: 'himawari',
    sourceUrl: 'https://inderaja.bmkg.go.id/IMAGE/HCAI/CLC/HCAI_CLC_Indonesia.png',
    width: 1674,
    height: 1118,
  },
  {
    id: 'himawari-rdca',
    name: 'Himawari-9 RDCA',
    description: 'Rainfall Detection and Cloud Analysis: analisis awan hujan berbasis citra.',
    group: 'himawari',
    sourceUrl: 'https://inderaja.bmkg.go.id/IMAGE/HIMA/H08_RD_Indonesia.png',
    width: 1674,
    height: 1118,
  },
  {
    id: 'himawari-visible',
    name: 'Himawari-9 Visible',
    description: 'Kanal tampak; hanya bermakna pada siang hari di wilayah yang tersinari matahari.',
    group: 'himawari',
    sourceUrl: 'https://inderaja.bmkg.go.id/IMAGE/MTS/VS/MTS_VS_Indonesia.png',
    width: 1674,
    height: 1118,
  },
  {
    id: 'himawari-jabodetabek',
    name: 'Himawari-9 Enhanced Jabodetabek',
    description: 'Perbesaran wilayah Jabodetabek dari produk IR Enhanced.',
    group: 'himawari',
    sourceUrl: 'https://inderaja.bmkg.go.id/IMAGE/HIMA/H08_EH_Jakarta.png',
    width: 1674,
    height: 1118,
  },
  {
    id: 'gk2a-enhanced',
    name: 'GK2A Enhanced',
    description: 'Citra satelit GEO-KOMPSAT-2A sebagai pembanding cakupan regional.',
    group: 'gk2a',
    sourceUrl: 'https://inderaja.bmkg.go.id/IMAGE/GK2/GK2_EH_Indonesia.png',
    width: 1674,
    height: 1118,
  },
  {
    id: 'gk2a-water-vapour',
    name: 'GK2A Water Vapor Enhanced',
    description: 'Uap air lapisan atas dari satelit GEO-KOMPSAT-2A.',
    group: 'gk2a',
    sourceUrl: 'https://inderaja.bmkg.go.id/IMAGE/GK2/GK2_WE_Indonesia.png',
    width: 1674,
    height: 1118,
  },
  {
    id: 'gsmap-rainrate-hourly',
    name: 'GSMaP Rainrate Hourly',
    description: 'Intensitas hujan per jam hasil analisis GSMaP.',
    group: 'gsmap',
    sourceUrl: 'https://inderaja.bmkg.go.id/IMAGE/GSMAP/Hourly_Prec.png',
    width: 1674,
    height: 1118,
  },
  {
    id: 'gsmap-rainrate-daily',
    name: 'GSMaP Rainrate Daily',
    description: 'Akumulasi hujan 24 jam hasil analisis GSMaP.',
    group: 'gsmap',
    sourceUrl: 'https://inderaja.bmkg.go.id/IMAGE/GSMAP/GSMaP_Precipitation_24hr.png',
    width: 1674,
    height: 1118,
  },
  {
    id: 'gsmap-dry-days',
    name: 'GSMaP Consecutive Dry Days',
    description: 'Jumlah hari kering berturut-turut; indikasi awal kekeringan meteorologis.',
    group: 'gsmap',
    sourceUrl: 'https://inderaja.bmkg.go.id/IMAGE/GSMAP/GSMaP_HTH.png',
    width: 1674,
    height: 1118,
  },
  {
    id: 'hotspot',
    name: 'Sebaran Titik Panas (Hotspot)',
    description: 'Titik panas hasil deteksi satelit; indikasi kebakaran lahan dan hutan.',
    group: 'lingkungan',
    sourceUrl: 'https://inderaja.bmkg.go.id/IMAGE/HOTSPOT/Hotspot_Indonesia.png',
    width: 1674,
    height: 1118,
  },
  {
    id: 'smoke',
    name: 'Citra Sebaran Asap',
    description: 'Sebaran asap karhutla hasil analisis citra satelit.',
    group: 'lingkungan',
    sourceUrl: 'https://inderaja.bmkg.go.id/Trajektori/Asap.png',
    width: 1674,
    height: 1118,
  },
  {
    id: 'volcanic-ash',
    name: 'Citra Sebaran Abu Vulkanik',
    description: 'Sebaran abu vulkanik; relevan dengan penerbangan dan gunung api aktif.',
    group: 'lingkungan',
    sourceUrl: 'https://inderaja.bmkg.go.id/Trajektori/Anak_Krakatau.png',
    width: 1674,
    height: 1118,
  },
  {
    id: 'lightning',
    name: 'Citra Sebaran Kejadian Petir',
    description: 'Sebaran kejadian petir 10 menit terakhir dari deteksi jaringan BMKG.',
    group: 'lingkungan',
    sourceUrl: 'https://inderaja.bmkg.go.id/IMAGE/LDN/ld_a10.png',
    width: 2051,
    height: 1077,
  },
  {
    id: 'wind-vector',
    name: 'Vektor Angin',
    description: 'Arah dan kecepatan angin permukaan hasil analisis citra.',
    group: 'lingkungan',
    sourceUrl: 'https://inderaja.bmkg.go.id/IMAGE/MTS/IW/MTS_IW_Indonesia.png',
    width: 1674,
    height: 1118,
  },
];

export const SATELLITE_GROUP_LABEL: Record<SatelliteDefinition['group'], string> = {
  himawari: 'Himawari-9',
  gk2a: 'GEO-KOMPSAT-2A',
  gsmap: 'GSMaP (hujan)',
  lingkungan: 'Lingkungan & penerbangan',
};

/* ------------------------------------------------------------ ringkasan -- */

/** Cuaca yang "layak diperhatikan": hujan lebat, petir, atau angin kencang. */
export function isSignificantWeather(point: import('../../types/weather').WeatherPoint): boolean {
  return (
    (point.precipitationMm ?? 0) >= 2 ||
    /hujan|petir|badai|angin/i.test(point.description)
  );
}

/** Uraian satu baris untuk teks laporan/dashboard, mis. "27°C · Berawan · 94%". */
export function pointSummary(point: import('../../types/weather').WeatherPoint): string {
  const parts: string[] = [];
  if (point.temperatureC !== null) parts.push(`${Math.round(point.temperatureC)}°C`);
  parts.push(point.description);
  if (point.humidityPct !== null) parts.push(`${Math.round(point.humidityPct)}%`);
  return parts.join(' · ');
}

/** Statistik ringkas satu hari untuk kartu dashboard. */
export function daySummary(points: import('../../types/weather').WeatherPoint[]): {
  minTemp: number | null;
  maxTemp: number | null;
  totalRainMm: number;
  dominant: string;
} {
  const temps = points.map((p) => p.temperatureC).filter((v): v is number => v !== null);
  const rain = points.reduce((sum, p) => sum + (p.precipitationMm ?? 0), 0);
  const counts = new Map<string, number>();
  for (const point of points) counts.set(point.description, (counts.get(point.description) ?? 0) + 1);
  let dominant = 'Tidak tercantum';
  let best = 0;
  for (const [label, count] of counts) {
    if (count > best) { dominant = label; best = count; }
  }
  return {
    minTemp: temps.length ? Math.min(...temps) : null,
    maxTemp: temps.length ? Math.max(...temps) : null,
    totalRainMm: Math.round(rain * 10) / 10,
    dominant,
  };
}
