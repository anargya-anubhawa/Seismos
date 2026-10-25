import type { Earthquake } from '@/types/earthquake';
import { fmtTime } from '@/lib/formatting';

/** Teks yang diawali = + - @ diberi tanda kutip tunggal agar tidak dieksekusi sebagai rumus spreadsheet. */
const cell = (v: string | undefined): string => {
  let s = v ?? '';
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
};

export function earthquakesToCsv(rows: Earthquake[]): string {
  const header = [
    'id', 'waktu_utc', 'waktu_wib', 'lintang', 'bujur', 'magnitudo',
    'kedalaman_km', 'wilayah', 'potensi_tsunami_bmkg', 'dirasakan_bmkg',
    'mmi_maks_bmkg', 'jumlah_lokasi_mmi', 'daftar_sumber_bmkg',
  ];
  const lines = rows.map((q) =>
    [
      cell(q.id), cell(q.originTime), cell(fmtTime(q.originTime)),
      q.latitude, q.longitude, q.magnitude, q.depthKm,
      cell(q.region), cell(q.tsunamiNote), cell(q.felt),
      q.maxMmi ?? '', q.feltReports?.length ?? 0, cell(q.sources.join('|')),
    ].join(','),
  );
  return '\uFEFF' + [header.join(','), ...lines].join('\r\n');
}

export function downloadText(filename: string, content: string, mime = 'text/csv;charset=utf-8'): void {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
