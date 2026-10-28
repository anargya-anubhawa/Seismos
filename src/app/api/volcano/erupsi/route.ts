import { NextResponse } from 'next/server';
import { getEruptions } from '@/services/magma/volcano';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

/**
 * Riwayat informasi letusan resmi (VEN) MAGMA.
 * Setiap baris adalah laporan erupsi yang diterbitkan PVMBG; perubahan tingkat
 * aktivitas tidak pernah ditampilkan sebagai erupsi di endpoint ini.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const size = Math.min(80, Math.max(1, Number(params.get('size') ?? 40) || 40));
  const page = Math.max(0, Number(params.get('page') ?? 0) || 0);
  try {
    const result = await getEruptions(size, page);
    return NextResponse.json({
      eruptions: result.value,
      updatedAt: new Date(result.at).toISOString(),
      stale: result.stale,
      error: result.error,
    }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
  } catch (error) {
    return NextResponse.json({
      eruptions: [],
      error: `Informasi letusan MAGMA tidak dapat dimuat: ${error instanceof Error ? error.message : 'kesalahan tidak dikenal'}`,
    }, { status: 502, headers: { 'Cache-Control': 'no-store, max-age=0' } });
  }
}
