import type { FeltReport } from '@/types/earthquake';

/**
 * Skala MMI yang dipakai BMKG. Ringkasan ini disusun ulang dari halaman
 * "Skala MMI" BMKG; selalu rujuk sumber resmi untuk uraian lengkap.
 */
export const MMI_SCALE = [
  { mmi: 1, roman: 'I', short: 'Tidak terasa', description: 'Tidak dirasakan, kecuali oleh beberapa orang dalam keadaan luar biasa.' },
  { mmi: 2, roman: 'II', short: 'Sangat lemah', description: 'Dirasakan oleh beberapa orang; benda ringan yang digantung bergoyang.' },
  { mmi: 3, roman: 'III', short: 'Lemah', description: 'Dirasakan nyata dalam rumah; terasa getaran seakan-akan truk berlalu.' },
  { mmi: 4, roman: 'IV', short: 'Sedang', description: 'Dirasakan oleh banyak orang dalam rumah; gerabah pecah, jendela/pintu berderik, dinding berbunyi.' },
  { mmi: 5, roman: 'V', short: 'Agak kuat', description: 'Dirasakan oleh hampir semua penduduk; orang banyak terbangun, barang-barang terpelanting, tiang dan barang besar bergoyang.' },
  { mmi: 6, roman: 'VI', short: 'Kuat', description: 'Dirasakan oleh semua penduduk; kebanyakan terkejut dan lari keluar, plester dinding jatuh, cerobong asap rusak ringan.' },
  { mmi: 7, roman: 'VII', short: 'Sangat kuat', description: 'Semua orang lari keluar; kerusakan ringan pada bangunan dengan konstruksi kurang baik, retak pada dinding.' },
  { mmi: 8, roman: 'VIII', short: 'Merusak', description: 'Kerusakan ringan pada bangunan konstruksi baik; kerusakan berat pada konstruksi kurang baik, dinding terpisah.' },
  { mmi: 9, roman: 'IX', short: 'Sangat merusak', description: 'Kerusakan berat pada bangunan konstruksi baik; bangunan bergeser dari fondasi, tanah retak.' },
  { mmi: 10, roman: 'X', short: 'Sangat merusak', description: 'Kerusakan pada sebagian besar bangunan; tanah longsor, air sungai/danau menjadi keruh.' },
  { mmi: 11, roman: 'XI', short: 'Katastrofik', description: 'Kerusakan berat pada bangunan; jembatan rusak, rel kereta bengkok.' },
  { mmi: 12, roman: 'XII', short: 'Katastrofik', description: 'Kerusakan total; gelombang terlihat di permukaan tanah, pandangan dan garis lihat berubah.' },
] as const;

const ROMAN_VALUES: Record<string, number> = Object.fromEntries(
  MMI_SCALE.map((s) => [s.roman, s.mmi]),
);

export function romanToMmi(value: string): number {
  return ROMAN_VALUES[value.trim().toUpperCase()] ?? 0;
}

export function mmiRoman(mmi: number): string {
  const n = Math.min(12, Math.max(1, Math.round(mmi)));
  return MMI_SCALE[n - 1].roman;
}

export function mmiInfo(mmi: number) {
  const n = Math.min(12, Math.max(1, Math.round(mmi)));
  return MMI_SCALE[n - 1];
}

/** Warna untuk badge MMI, dengan kontras teks yang tetap aman di tema terang/gelap. */
export function mmiColor(mmi: number): string {
  if (mmi >= 9) return '#8E1B2C';
  if (mmi >= 7) return '#C0392B';
  if (mmi >= 5) return '#E8833A';
  if (mmi >= 3) return '#8FBF6A';
  return '#5FA8D3';
}

export function mmiTextColor(mmi: number): string {
  return mmi >= 3 && mmi < 5 ? '#0B1A2E' : '#FFFFFF';
}

const MMI_TOKEN = '(?:XII|XI|X|IX|VIII|VII|VI|V|IV|III|II|I)';
const REPORT_START = new RegExp(`(^|,\\s*)(${MMI_TOKEN}(?:\\s*[-–—]\\s*${MMI_TOKEN})?)\\s+`, 'g');

/**
 * Mengurai teks "Dirasakan" BMKG, misalnya:
 * "III Kota Bengkulu, II - III Curup, III Arga Makmur"
 * menjadi tiga laporan terpisah. Koma di dalam nama wilayah
 * ("III Ulu Belu, Tanggamus") tidak dianggap pemisah baru.
 */
export function parseFeltReports(text?: string): FeltReport[] {
  if (!text || !text.trim()) return [];
  const matches = Array.from(text.matchAll(REPORT_START));
  const out: FeltReport[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    const token = m[2];
    const start = (m.index ?? 0) + m[0].length;
    const end = i + 1 < matches.length ? (matches[i + 1].index ?? text.length) : text.length;
    const place = text.slice(start, end).replace(/^[\s,;]+|[\s,;]+$/g, '').trim();
    if (!place) continue;

    const parts = token
      .split(/[-–—]/)
      .map((p) => romanToMmi(p))
      .filter((n) => n > 0);
    if (parts.length === 0) continue;

    const mmiMin = Math.min(...parts);
    const mmiMax = Math.max(...parts);
    const key = `${mmiMin}-${mmiMax}-${place.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);

    out.push({
      mmiMin,
      mmiMax,
      mmiLabel: mmiMin === mmiMax ? mmiRoman(mmiMin) : `${mmiRoman(mmiMin)}–${mmiRoman(mmiMax)}`,
      place,
    });
  }

  return out.sort((a, b) => b.mmiMax - a.mmiMax || a.place.localeCompare(b.place, 'id'));
}

export function maxMmiOf(reports: FeltReport[]): number | undefined {
  if (reports.length === 0) return undefined;
  return Math.max(...reports.map((r) => r.mmiMax));
}
