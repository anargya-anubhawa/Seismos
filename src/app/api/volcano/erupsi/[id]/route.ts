import { NextResponse } from 'next/server';
import { getEruption } from '@/services/magma/volcano';
import { publicErrorMessage } from '@/lib/public-error';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

/** Detail satu informasi letusan (VEN) resmi. */
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const id = params.id ?? '';
  if (!/^[A-Za-z0-9-]{8,64}$/.test(id)) {
    return NextResponse.json({ error: 'ID informasi letusan tidak valid' }, { status: 400 });
  }
  try {
    const result = await getEruption(id);
    if (!result.value) {
      return NextResponse.json({ error: 'Informasi letusan tidak ditemukan pada MAGMA' }, { status: 404 });
    }
    return NextResponse.json({ eruption: result.value, stale: result.stale, error: result.error }, {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  } catch (error) {
    return NextResponse.json({
      error: publicErrorMessage(error, 'Informasi letusan tidak dapat dimuat: kesalahan tidak dikenal'),
    }, { status: 502, headers: { 'Cache-Control': 'no-store, max-age=0' } });
  }
}
