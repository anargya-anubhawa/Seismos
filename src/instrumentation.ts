/**
 * Hook server Next.js: mulai pemantauan tsunami dan gunung api sekali per proses.
 * Route API juga memicu pemeriksaan bila data sudah kedaluwarsa, sehingga
 * deployment serverless tetap memperoleh data segar saat halaman dibuka.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME && process.env.NEXT_RUNTIME !== 'nodejs') return;
  if (process.env.NEXT_PHASE === 'phase-production-build') return;
  try {
    const { startTsunamiMonitor } = await import('@/lib/tsunami/monitor');
    startTsunamiMonitor();
  } catch (error) {
    console.error(`[tsunami] pemantau gagal dimulai: ${error instanceof Error ? error.message : String(error)}`);
  }
  try {
    const { startVolcanoMonitor } = await import('@/lib/volcano/monitor');
    startVolcanoMonitor();
  } catch (error) {
    console.error(`[volcano] pemantau gagal dimulai: ${error instanceof Error ? error.message : String(error)}`);
  }
  try {
    // Pemantau gempa + FCM. Berbeda dari dua di atas: ini mengirim push ke perangkat
    // Android, sebuah kemampuan yang tidak dimiliki web. Lihat docs/STAGE_5_PUSH_CONTRACT.md.
    const { startQuakeMonitor } = await import('@/lib/quake/monitor');
    startQuakeMonitor();
  } catch (error) {
    console.error(`[quake] pemantau gagal dimulai: ${error instanceof Error ? error.message : String(error)}`);
  }
}
