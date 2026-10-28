import { NextResponse } from 'next/server';
import { ensureTsunamiFresh } from '@/lib/tsunami/monitor';
import { getTsunamiFeed } from '@/lib/tsunami/service';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

export async function GET() {
  await ensureTsunamiFresh();
  try {
    const feed = await getTsunamiFeed();
    return NextResponse.json(feed, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    return NextResponse.json({
      state: 'unknown',
      stale: true,
      checkedAt: null,
      updatedAt: null,
      activeAlerts: [],
      alerts: [],
      sources: [],
      message: `Status tsunami tidak dapat dipastikan: penyimpanan server gagal dibaca (${error instanceof Error ? error.message : 'kesalahan tidak dikenal'}). Jangan anggap situasi aman; ikuti kanal resmi BMKG.`,
    }, {
      status: 503,
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  }
}
