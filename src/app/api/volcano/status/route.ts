import { NextResponse } from 'next/server';
import { getStatuses } from '@/lib/volcano/service';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

/** Daftar status aktivitas resmi seluruh gunung api yang dipantau. */
export async function GET() {
  const result = await getStatuses();
  if (result.volcanoes.length === 0) {
    return NextResponse.json({
      ...result,
      error: result.error ?? 'Status gunung api MAGMA tidak dapat dimuat.',
    }, {
      status: 502,
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  }
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
}
