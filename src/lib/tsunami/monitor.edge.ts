/**
 * Stub untuk kompilasi Edge. Pemantau tsunami hanya berjalan di runtime Node
 * (lihat `instrumentation.ts`), tetapi Next 14 tetap membundel instrumentasi
 * untuk Edge. Modul ini menggantikan pemantau Node agar modul `node:*` tidak
 * ikut dicoba di-resolve oleh webpack Edge.
 */
export function startTsunamiMonitor(): void {
  // Tidak ada proses latar belakang di Edge.
}

export function stopTsunamiMonitor(): void {
  // Tidak ada proses latar belakang di Edge.
}
