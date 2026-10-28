import { NextResponse } from 'next/server';
import { getPublicKey } from '@/lib/volcano/push';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

/**
 * Kunci publik VAPID untuk langganan push. Kunci privat tidak pernah dikirim
 * ke browser. Kunci yang dipakai sama dengan notifikasi tsunami/gempa.
 */
export async function GET() {
  try {
    const publicKey = await getPublicKey();
    return NextResponse.json({ publicKey, enabled: true }, {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  } catch (error) {
    return NextResponse.json({
      enabled: false,
      error: `Konfigurasi push gunung api tidak tersedia (${error instanceof Error ? error.message : 'kesalahan tidak dikenal'}).`,
    }, { status: 503, headers: { 'Cache-Control': 'no-store, max-age=0' } });
  }
}
