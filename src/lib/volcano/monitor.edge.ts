/**
 * Stub untuk kompilasi Edge. Pemantau gunung api hanya berjalan di runtime Node
 * (lihat `instrumentation.ts`), tetapi Next 14 tetap membundel instrumentasi
 * untuk Edge. Modul ini menggantikan pemantau Node agar modul `node:*` dan
 * `web-push` tidak ikut dicoba di-resolve oleh webpack Edge.
 */

export const POLL_SECONDS = 300;

export function startVolcanoMonitor(): void {
  // Tidak ada proses latar belakang di Edge.
}

export function stopVolcanoMonitor(): void {
  // Tidak ada proses latar belakang di Edge.
}
