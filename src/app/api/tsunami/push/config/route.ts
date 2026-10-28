import { NextResponse } from 'next/server';
import { getPushConfig } from '@/lib/tsunami/push';

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
      error: `Konfigurasi push tsunami tidak tersedia (${error instanceof Error ? error.message : 'kesalahan tidak dikenal'}).`,
    }, {
      status: 503,
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  }
}
