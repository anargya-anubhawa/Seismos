/**
 * Stub untuk kompilasi Edge. Pemantau gempa hanya berjalan di runtime Node
 * (lihat `instrumentation.ts`), tetapi Next 14 tetap membundel instrumentasi
 * untuk Edge. Modul ini menggantikan pemantau Node agar modul `node:*`
 * (`node:crypto`, `node:fs/promises`, `node:path`) tidak ikut dicoba
 * di-resolve oleh webpack Edge.
 *
 * Tanpa stub ini, `npm run build` gagal dengan `UnhandledSchemeError` untuk
 * `node:fs/promises` — kegagalan yang tidak akan pernah terlihat di unit test.
 */

export const POLL_SECONDS = 60;

export function startQuakeMonitor(): void {
  // Tidak ada proses latar belakang di Edge.
}

export function stopQuakeMonitor(): void {
  // Tidak ada proses latar belakang di Edge.
}
