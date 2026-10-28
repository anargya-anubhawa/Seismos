import { NextResponse } from 'next/server';
import { getVolcanoDetail } from '@/lib/volcano/service';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

/** Data lengkap satu gunung api (status, laporan, riwayat, CCTV, KRB, gallery, seismogram). */
export async function GET(_request: Request, { params }: { params: { code: string } }) {
  const code = params.code?.trim() ?? '';
  if (!/^[A-Za-z0-9-]{1,20}$/.test(code)) {
    return NextResponse.json({ error: 'Kode gunung api tidak valid' }, { status: 400 });
  }
  try {
    const detail = await getVolcanoDetail(code);
    if (!detail) {
      return NextResponse.json({
        error: `Gunung api "${code}" tidak ada pada daftar pemantauan MAGMA.`,
      }, { status: 404, headers: { 'Cache-Control': 'no-store, max-age=0' } });
    }
    return NextResponse.json(detail, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
  } catch (error) {
    return NextResponse.json({
      error: `Detail gunung api tidak dapat dimuat: ${error instanceof Error ? error.message : 'kesalahan tidak dikenal'}`,
    }, { status: 503, headers: { 'Cache-Control': 'no-store, max-age=0' } });
  }
}
