const TZ = 'Asia/Jakarta';

export const fmtTime = (iso: string): string =>
  `${new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'medium', timeZone: TZ }).format(new Date(iso))} WIB`;

export const fmtClock = (iso: string): string =>
  `${new Intl.DateTimeFormat('id-ID', { timeStyle: 'short', timeZone: TZ }).format(new Date(iso))} WIB`;

/** Tanggal YYYY-MM-DD menurut WIB */
export const wibDate = (iso: string): string =>
  new Intl.DateTimeFormat('sv-SE', { timeZone: TZ }).format(new Date(iso));

export function fmtAgo(iso: string, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (s < 60) return `${s} detik lalu`;
  if (s < 3600) return `${Math.floor(s / 60)} menit lalu`;
  if (s < 86400) return `${Math.floor(s / 3600)} jam lalu`;
  return `${Math.floor(s / 86400)} hari lalu`;
}

/** Kelas magnitudo: warna + label teks, agar informasi tidak hanya bergantung pada warna. */
export const MAG_CLASSES = [
  { min: 6, label: 'M ≥ 6', color: '#D1495B' },
  { min: 5, label: 'M 5–5,9', color: '#E8833A' },
  { min: 4, label: 'M 4–4,9', color: '#F2C14E' },
  { min: 3, label: 'M 3–3,9', color: '#8FBF6A' },
  { min: 0, label: 'M < 3', color: '#5FA8D3' },
] as const;

export const magColor = (m: number): string =>
  (MAG_CLASSES.find((c) => m >= c.min) ?? MAG_CLASSES[MAG_CLASSES.length - 1]).color;
