import { fmtTime } from '../formatting';
import { mmiRoman } from '../felt';
import { levelLabel } from '../volcano/magma';
import type { Earthquake } from '../../types/earthquake';
import type {
  EruptionEvent, KrbMap, VolcanoLevel, VolcanoReport, VonaNotice,
} from '../../types/volcano';
import type { WeatherAlert, WeatherForecast, WeatherPoint } from '../../types/weather';

/**
 * Teks laporan siap-salin/siap-bagikan untuk gempa, tsunami, dan gunung api.
 *
 * Semua fungsi di sini murni (tanpa DOM) agar dapat diuji dan supaya format
 * yang disalin konsisten di setiap halaman. Prinsip isi:
 *
 * 1. Hanya memuat angka yang memang diterbitkan sumber. Tidak ada bidang yang
 *    dikarang bila sumber tidak menyediakan (mis. magnitudo KRB tidak ada).
 * 2. Setiap teks selalu ditutup kredit dua baris: aplikasi asal laporan dan
 *    sumber data resmi. Kredit tidak boleh dihapus karena memenuhi kewajiban
 *    atribusi data publik.
 * 3. Waktu disajikan WIB, sama seperti format informasi gempa BMKG.
 */

export const SEISMOS_NAME = 'Seismos Indonesia';
export const SEISMOS_DEFAULT_ORIGIN = 'https://seismos.anargya.my.id';

/** Alamat situs publik untuk baris kredit. Diambil dari origin browser. */
export function siteOrigin(url?: string | null): string {
  const value = (url ?? '').trim();
  if (!value) return SEISMOS_DEFAULT_ORIGIN;
  try {
    return new URL(value).origin;
  } catch {
    return SEISMOS_DEFAULT_ORIGIN;
  }
}

/** Awalan koordinat gaya BMKG: LU/LS untuk lintang, BT/BB untuk bujur. */
export function formatCoordinate(latitude: number, longitude: number): string {
  const lat = `${Math.abs(latitude).toFixed(2)} ${latitude >= 0 ? 'LU' : 'LS'}`;
  const lon = `${Math.abs(longitude).toFixed(2)} ${longitude >= 0 ? 'BT' : 'BB'}`;
  return `${lat} ${lon}`;
}

/**
 * Dua baris kredit penutup. Baris pertama menyebut aplikasi asal (beserta
 * tautan agar penerima dapat memeriksa data terbaru), baris kedua menyebut
 * sumber data resmi sesuai jenis laporan.
 */
export function creditLines(origin: string, source: string): string {
  return `Laporan dari ${SEISMOS_NAME} — ${origin}\nSumber data: ${source}`;
}

export const SOURCE_BMKG = 'BMKG / InaTEWS (data.bmkg.go.id)';
export const SOURCE_MAGMA = 'MAGMA Indonesia — PVMBG, Badan Geologi, KESDM';
export const SOURCE_BMKG_WEATHER = 'BMKG — Badan Meteorologi, Klimatologi, dan Geofisika (bmkg.go.id/cuaca)';

/**
 * Halaman resmi tiap sumber data.
 *
 * Dipisahkan dari label supaya tautan "buka sumber" tidak perlu menebak dari
 * nama sumber. Sebelumnya hanya MAGMA yang dikenali, sehingga halaman cuaca
 * ikut menautkan ke daftar gempa BMKG.
 */
const SOURCE_URLS: Record<string, string> = {
  [SOURCE_BMKG]: 'https://data.bmkg.go.id/gempabumi/',
  [SOURCE_MAGMA]: 'https://magma.esdm.go.id',
  [SOURCE_BMKG_WEATHER]: 'https://www.bmkg.go.id/cuaca',
};

/** URL halaman resmi untuk sebuah label sumber; jatuh ke beranda BMKG. */
export function sourceUrl(source: string): string {
  return SOURCE_URLS[source] ?? 'https://www.bmkg.go.id';
}

/* ------------------------------------------------------------------- gempa -- */

export interface ShareTextInput {
  /** URL halaman sumber laporan, dipakai untuk baris kredit. */
  pageUrl?: string;
}

/**
 * MAGMA kadang menerbitkan entitas HTML mentah pada teks laporan (mis.
 * "26.7-27.6&deg;C"). Untuk teks yang disalin/dibagikan, entitas itu diurai
 * agar penerima tidak melihat kode `&deg;` yang membingungkan.
 */
const NAMED_ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", deg: '°', nbsp: ' ' };

export function decodeEntities(text: string): string {
  return text.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, entity: string) => {
    if (entity.startsWith('#x') || entity.startsWith('#X')) {
      const code = Number.parseInt(entity.slice(2), 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    if (entity.startsWith('#')) {
      const code = Number.parseInt(entity.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    return NAMED_ENTITIES[entity.toLowerCase()] ?? match;
  });
}

/** Membersihkan teks bebas sumber sebelum dimasukkan ke laporan. */
const clean = (text: string | null | undefined): string => decodeEntities(text ?? '').trim();

/**
 * Teks wilayah BMKG sering sudah berawalan "Pusat gempa berada di …".
 * Awalan itu dilepas pada baris "Pusat gempa:" agar tidak terbaca ganda
 * ("Pusat gempa: Pusat gempa berada di …").
 */
function cleanRegion(region: string): string {
  return region.trim().replace(/^pusat\s+gempa\s+(?:berada\s+)?di\s+/i, '');
}

/**
 * Teks informasi gempa mengikuti susunan yang lazim dibagikan BMKG sehingga
 * dapat dipahami penerima tanpa membuka tautan. Baris "Dirasakan" hanya muncul
 * bila BMKG menerbitkannya; baris "Potensi" selalu ada karena BMKG selalu
 * mencantumkannya untuk gempa yang dipublikasikan.
 */
export function earthquakeReportText(quake: Earthquake, options: ShareTextInput = {}): string {
  const lines = [
    'INFORMASI GEMPA BUMI',
    `Tanggal: ${fmtTime(quake.originTime)}`,
    `Magnitudo: ${quake.magnitude.toFixed(1)}`,
    `Kedalaman: ${quake.depthKm.toFixed(0)} km`,
    `Lokasi: ${formatCoordinate(quake.latitude, quake.longitude)}`,
    `Pusat gempa: ${cleanRegion(clean(quake.region))}`,
  ];
  if (clean(quake.felt)) lines.push(`Dirasakan: ${clean(quake.felt)}`);
  else if (quake.maxMmi) lines.push(`Dirasakan: sekitar skala ${mmiRoman(quake.maxMmi)} MMI`);
  lines.push(`Potensi: ${clean(quake.tsunamiNote) || 'Tidak berpotensi tsunami'}`);
  lines.push('', creditLines(siteOrigin(options.pageUrl), SOURCE_BMKG));
  return lines.join('\n');
}

/**
 * Ringkasan satu baris untuk daftar/bagikan cepat. Tetap menyertakan kredit
 * sumber karena teks dapat diteruskan tanpa konteks halaman asal.
 */
export function earthquakeSummaryText(quake: Earthquake, options: ShareTextInput = {}): string {
  const origin = siteOrigin(options.pageUrl);
  return [
    `Gempa M ${quake.magnitude.toFixed(1)}, kedalaman ${quake.depthKm.toFixed(0)} km, ${cleanRegion(clean(quake.region))}.`,
    `${fmtTime(quake.originTime)} · ${formatCoordinate(quake.latitude,quake.longitude)}.`,
    `${clean(quake.tsunamiNote) || 'Tidak berpotensi tsunami'}`,
    creditLines(origin, SOURCE_BMKG),
  ].join('\n');
}

/* ----------------------------------------------------------------- gunung api -- */

/** Label tingkat aktivitas resmi; memakai label sumber bila ada. */
const volcanoLevelText = (level: VolcanoLevel | null, label?: string | null): string =>
  (clean(label) || (level ? levelLabel(level) : '') || 'Tidak tercantum');

export function eruptionReportText(
  event: Pick<EruptionEvent, 'volcanoName' | 'occurredAt' | 'ashHeightM' | 'durationSeconds' | 'information' | 'recommendation' | 'author' | 'zoneArea'>,
  options: ShareTextInput = {},
): string {
  const lines = [
    `INFORMASI LETUSAN — GUNUNG ${event.volcanoName.toUpperCase()}`,
    `Waktu: ${fmtTime(event.occurredAt)}`,
    `Tinggi kolom abu: ${event.ashHeightM !== null && event.ashHeightM > 0 ? `${event.ashHeightM} m` : 'Tidak teramati/tercantum'}`,
  ];
  if (event.durationSeconds !== null) lines.push(`Durasi: ${event.durationSeconds} detik`);
  if (event.zoneArea) lines.push(`Zona: ${event.zoneArea}`);
  if (clean(event.information)) lines.push('', clean(event.information));
  if (clean(event.recommendation)) lines.push('', `Rekomendasi: ${clean(event.recommendation)}`);
  if (clean(event.author)) lines.push('', `Disusun: ${clean(event.author)}`);
  lines.push('', creditLines(siteOrigin(options.pageUrl), SOURCE_MAGMA));
  return lines.join('\n');
}

export function reportText(report: VolcanoReport, options: ShareTextInput = {}): string {
  const lines = [
    `LAPORAN AKTIVITAS — GUNUNG ${report.volcanoName.toUpperCase()}`,
    `Periode: ${report.date}${report.period ? ` · ${report.period}` : ''}${report.timeZone ? ` ${report.timeZone}` : ''}`,
    `Tingkat aktivitas: ${volcanoLevelText(report.level, report.levelLabel)}`,
  ];
  if (clean(report.visualText)) lines.push('', `Visual: ${clean(report.visualText)}`);
  if (clean(report.climatologyText)) lines.push('', `Klimatologi: ${clean(report.climatologyText)}`);
  if (report.seismic.length > 0) {
    lines.push('', 'Kegempaan:');
    for (const item of report.seismic) lines.push(`- ${clean(item.name)}: ${clean(item.text)}`);
  }
  if (clean(report.recommendation)) lines.push('', `Rekomendasi: ${clean(report.recommendation)}`);
  if (clean(report.remarks)) lines.push('', `Keterangan: ${clean(report.remarks)}`);
  if (clean(report.author)) lines.push('', `Disusun: ${clean(report.author)}`);
  lines.push('', creditLines(siteOrigin(options.pageUrl), SOURCE_MAGMA));
  return lines.join('\n');
}

export function vonaText(notice: VonaNotice, options: ShareTextInput = {}): string {
  const lines = [
    `VONA — GUNUNG ${notice.volcanoName.toUpperCase()}${notice.noticeNumber ? ` (${notice.noticeNumber})` : ''}`,
    `Diterbitkan: ${fmtTime(notice.issuedAt)}`,
    `Kode warna: ${notice.previousCode ? `${notice.previousCode} → ` : ''}${notice.currentCode ?? 'tidak tercantum'}`,
  ];
  if (notice.ashHeightM !== null) lines.push(`Tinggi kolom abu: ${notice.ashHeightM} m`);
  if (notice.durationMinutes !== null) lines.push(`Durasi: ${notice.durationMinutes} menit`);
  if (clean(notice.description)) lines.push('', clean(notice.description));
  if (clean(notice.issuedBy)) lines.push('', `Diterbitkan oleh: ${clean(notice.issuedBy)}`);
  lines.push('', creditLines(siteOrigin(options.pageUrl), SOURCE_MAGMA));
  return lines.join('\n');
}

export function krbText(map: Pick<KrbMap, 'volcanoName' | 'year' | 'fileSize'>, options: ShareTextInput = {}): string {
  const lines = [
    `PETA KRB — GUNUNG ${map.volcanoName.toUpperCase()}`,
    `Tahun peta: ${map.year || 'tidak tercantum'}`,
  ];
  if (map.fileSize) lines.push(`Ukuran berkas: ${(map.fileSize / 1_000_000).toFixed(1)} MB`);
  lines.push(
    '',
    'Peta Kawasan Rawan Bencana resmi PVMBG. Batas zona mengikuti dokumen sumber, bukan prakiraan erupsi.',
    '',
    creditLines(siteOrigin(options.pageUrl), SOURCE_MAGMA),
  );
  return lines.join('\n');
}

/** Teks ringkas status aktivitas satu gunung api (dipakai di detail gunung). */
export function volcanoStatusText(
  volcano: { name: string; code: string; province: string; level: VolcanoLevel; levelLabel: string },
  options: ShareTextInput = {},
): string {
  return [
    `STATUS GUNUNG ${volcano.name.toUpperCase()}`,
    `Kode: ${volcano.code}`,
    `Wilayah: ${volcano.province}`,
    `Tingkat aktivitas: ${volcanoLevelText(volcano.level, volcano.levelLabel)}`,
    '',
    creditLines(siteOrigin(options.pageUrl), SOURCE_MAGMA),
  ].join('\n');
}

/* ----------------------------------------------------------------- tsunami -- */

/**
 * Ringkasan daftar (mis. status aktivitas seluruh gunung api atau VONA terbaru)
 * untuk dibagikan tanpa membuka satu per satu. `lines` dibatasi pemanggil agar
 * teks yang disalin tetap pendek dan layak dikirim lewat pesan.
 */
export function listSummaryText(
  title: string,
  lines: string[],
  source: string,
  options: ShareTextInput = {},
): string {
  return [
    title.toUpperCase(),
    ...lines,
    '',
    creditLines(siteOrigin(options.pageUrl), source),
  ].join('\n');
}

export interface TsunamiShareInput {
  subject: string;
  issueTime: string;
  status: string;
  phase: string | null;
  region: string;
  magnitude: number | null;
  depthKm: number | null;
  potential: string;
  instructions: string[];
}

export function tsunamiReportText(alert: TsunamiShareInput, options: ShareTextInput = {}): string {
  const lines = [
    'INFORMASI PERINGATAN TSUNAMI',
    `Judul: ${clean(alert.subject)}`,
    `Diterbitkan: ${fmtTime(alert.issueTime)}`,
    `Status: ${alert.status}${alert.phase ? ` · ${alert.phase}` : ''}`,
  ];
  if (alert.magnitude !== null) lines.push(`Magnitudo: ${alert.magnitude.toFixed(1)}`);
  if (alert.depthKm !== null) lines.push(`Kedalaman: ${alert.depthKm.toFixed(0)} km`);
  lines.push(`Lokasi gempa: ${clean(alert.region)}`, `Potensi: ${clean(alert.potential)}`);
  if (alert.instructions.length > 0) {
    lines.push('', 'Arahan:');
    for (const instruction of alert.instructions.slice(0, 6)) lines.push(`- ${clean(instruction)}`);
  }
  lines.push('', creditLines(siteOrigin(options.pageUrl), SOURCE_BMKG));
  return lines.join('\n');
}

/* ------------------------------------------------------------------ cuaca -- */

/** Label jam lokal WIB/WITA/WIT berdasarkan zona wilayah. */
const zoneLabel = (timezone: string): string =>
  ({ 'Asia/Jakarta': 'WIB', 'Asia/Pontianak': 'WIB', 'Asia/Makassar': 'WITA', 'Asia/Jayapura': 'WIT' })[timezone] ?? 'WIB';

/**
 * Teks prakiraan cuaca mengikuti susunan halaman BMKG: wilayah, lalu satu baris
 * per waktu berisi suhu, cuaca, kelembapan, angin, dan hujan. Angka yang tidak
 * diterbitkan BMKG tidak dicantumkan agar laporan tidak mengarang nilai.
 */
export function weatherForecastText(
  forecast: WeatherForecast,
  options: ShareTextInput & { maxPoints?: number } = {},
): string {
  const max = options.maxPoints ?? 8;
  const zone = zoneLabel(forecast.timezone);
  const lines = [
    `PRAKIRAAN CUACA — ${forecast.area.district.toUpperCase()}`,
    `Wilayah: ${forecast.area.village}, ${forecast.area.district}, ${forecast.area.regency}, ${forecast.area.province}`,
    `Kode wilayah BMKG: ${forecast.area.code}`,
  ];
  for (const point of forecast.points.slice(0, max)) {
    lines.push('', pointLine(point, zone));
  }
  lines.push('', creditLines(siteOrigin(options.pageUrl), SOURCE_BMKG_WEATHER));
  return lines.join('\n');
}

const pointLine = (point: WeatherPoint, zone: string): string => {
  const time = new Date(point.time);
  const clock = Number.isNaN(time.getTime())
    ? point.time
    : new Intl.DateTimeFormat('id-ID', {
        weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
        timeZone: point.time.split(/[+-]\d{2}:\d{2}$/)[1] ? undefined : 'Asia/Jakarta',
      }).format(time);
  const parts = [`${clock} ${zone}`, point.description];
  if (point.temperatureC !== null) parts.push(`${Math.round(point.temperatureC)}°C`);
  if (point.humidityPct !== null) parts.push(`lembap ${Math.round(point.humidityPct)}%`);
  if (point.windSpeedKmh !== null) {
    parts.push(`angin ${point.windFrom ? `${point.windFrom} ` : ''}${Math.round(point.windSpeedKmh)} km/jam`);
  }
  if (point.precipitationMm !== null && point.precipitationMm > 0) parts.push(`hujan ${point.precipitationMm} mm`);
  return `- ${parts.join(' · ')}`;
};

/** Teks ringkas satu titik cuaca untuk baris daftar/kartu. */
export function weatherPointText(point: WeatherPoint, zone: string): string {
  const parts = [point.description];
  if (point.temperatureC !== null) parts.push(`${Math.round(point.temperatureC)}°C`);
  if (point.humidityPct !== null) parts.push(`${Math.round(point.humidityPct)}%`);
  if (point.precipitationMm !== null && point.precipitationMm > 0) parts.push(`${point.precipitationMm} mm`);
  void zone;
  return parts.join(' · ');
}

/**
 * Teks peringatan dini cuaca ekstrem. Deskripsi resmi dimuat apa adanya karena
 * berisi wilayah rinci, dampak, dan imbauan yang tidak boleh diringkas sembarang.
 */
export function weatherAlertText(alert: WeatherAlert, options: ShareTextInput = {}): string {
  const lines = [
    'PERINGATAN DINI CUACA EKSTREM',
    `Judul: ${clean(alert.title)}`,
    `Diterbitkan: ${fmtTime(alert.issuedAt)}`,
  ];
  if (alert.expiresAt) lines.push(`Diperkirakan berakhir: ${fmtTime(alert.expiresAt)}`);
  if (alert.region) lines.push(`Wilayah: ${clean(alert.region)}`);
  if (clean(alert.description)) lines.push('', clean(alert.description));
  if (alert.impacts.length > 0) {
    lines.push('', 'Potensi dampak:');
    for (const impact of alert.impacts) lines.push(`- ${clean(impact)}`);
  }
  if (alert.advice) lines.push('', `Imbauan: ${clean(alert.advice)}`);
  lines.push('', creditLines(siteOrigin(options.pageUrl), SOURCE_BMKG_WEATHER));
  return lines.join('\n');
}

/** Ringkasan satu baris peringatan untuk daftar/kartu dashboard. */
export function weatherAlertSummary(alert: WeatherAlert): string {
  const parts = [clean(alert.title)];
  if (alert.expiresAt) parts.push(`hingga ${fmtTime(alert.expiresAt)}`);
  return parts.join(' · ');
}
