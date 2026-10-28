import { NextResponse } from 'next/server';
import { getTsunamiAlert } from '@/lib/tsunami/service';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  let id = params.id;
  try { id = decodeURIComponent(params.id); } catch { /* pakai apa adanya */ }

  try {
    const detail = await getTsunamiAlert(id);
    if (!detail) {
      return NextResponse.json({
        error: 'Peringatan tsunami tidak ditemukan. Data lama dapat sudah dipangkas dari penyimpanan server.',
      }, {
        status: 404,
        headers: { 'Cache-Control': 'no-store, max-age=0' },
      });
    }
    return NextResponse.json(detail, {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  } catch (error) {
    return NextResponse.json({
      error: `Data peringatan tsunami tidak dapat dibaca (${error instanceof Error ? error.message : 'kesalahan tidak dikenal'}).`,
    }, {
      status: 503,
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  }
}
