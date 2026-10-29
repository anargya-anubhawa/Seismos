import { NextResponse } from 'next/server';
import { getCameras } from '@/services/magma/volcano';
import { publicErrorMessage } from '@/lib/public-error';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

/**
 * Daftar kamera pemantau MAGMA. Sumber hanya menyediakan gambar statis
 * (snapshot), bukan stream video; UI menandai hal ini secara eksplisit.
 */
export async function GET() {
  try {
    const result = await getCameras();
    return NextResponse.json({
      cameras: result.value,
      updatedAt: new Date(result.at).toISOString(),
      stale: result.stale,
      error: result.error,
      note: 'MAGMA menerbitkan gambar snapshot kamera; tidak ada stream video publik yang dapat disematkan langsung.',
    }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
  } catch (error) {
    return NextResponse.json({
      cameras: [],
      error: publicErrorMessage(error, 'Daftar CCTV MAGMA tidak dapat dimuat: kesalahan tidak dikenal'),
    }, { status: 502, headers: { 'Cache-Control': 'no-store, max-age=0' } });
  }
}
