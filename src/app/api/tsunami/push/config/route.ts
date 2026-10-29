import { NextResponse } from 'next/server';
import { getPushConfig } from '@/lib/tsunami/push';
import { publicErrorMessage } from '@/lib/public-error';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

export async function GET() {
  try {
    const config = await getPushConfig();
    return NextResponse.json(config, {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  } catch (error) {
    return NextResponse.json({
      error: publicErrorMessage(error, 'Konfigurasi push tsunami tidak tersedia (kesalahan tidak dikenal).'),
    }, {
      status: 503,
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  }
}
