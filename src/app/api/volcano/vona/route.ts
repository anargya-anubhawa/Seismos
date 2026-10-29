import { NextResponse } from 'next/server';
import { getVonaNotices } from '@/services/magma/volcano';
import { publicErrorMessage } from '@/lib/public-error';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

/** VONA (Volcano Observatory Notice for Aviation) resmi MAGMA. */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const size = Math.min(60, Math.max(1, Number(params.get('size') ?? 30) || 30));
  const page = Math.max(0, Number(params.get('page') ?? 0) || 0);
  try {
    const result = await getVonaNotices(size, page);
    return NextResponse.json({
      notices: result.value,
      updatedAt: new Date(result.at).toISOString(),
      stale: result.stale,
      error: result.error,
      note: 'VONA diterbitkan untuk penerbangan. MAGMA tidak menyediakan endpoint detail VONA publik; Informasi letusan (VEN) memuat rincian kejadian.',
    }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
  } catch (error) {
    return NextResponse.json({
      notices: [],
      error: publicErrorMessage(error, 'VONA MAGMA tidak dapat dimuat: kesalahan tidak dikenal'),
    }, { status: 502, headers: { 'Cache-Control': 'no-store, max-age=0' } });
  }
}
