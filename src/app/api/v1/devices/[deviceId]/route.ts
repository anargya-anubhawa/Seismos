import { NextResponse } from 'next/server';
import { publicErrorMessage } from '@/lib/public-error';
import { rateLimit } from '@/lib/rate-limit';
import { removeDevice } from '@/lib/quake/store';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' };

/**
 * Menghapus pendaftaran perangkat. Dipakai saat pengguna mematikan notifikasi.
 *
 * Sengaja idempoten: menghapus perangkat yang sudah tidak ada tetap `200` dengan
 * `removed: false`, supaya aplikasi bisa memanggilnya berulang tanpa menangani 404 palsu.
 * Pola ini sama dengan `DELETE /api/tsunami/push/subscribe` yang mengembalikan `removed`.
 */
export async function DELETE(
  request: Request,
  context: { params: { deviceId: string } },
) {
  const limited = rateLimit(request, { name: 'v1-devices-delete', limit: 30, windowMs: 600_000 });
  if (limited) return limited;

  try {
    const removed = await removeDevice(context.params.deviceId);
    return NextResponse.json({ ok: true, removed }, { headers: NO_STORE });
  } catch (error) {
    return NextResponse.json(
      { error: publicErrorMessage(error, 'Penghapusan perangkat gagal (kesalahan tidak dikenal).') },
      { status: 500, headers: NO_STORE },
    );
  }
}
