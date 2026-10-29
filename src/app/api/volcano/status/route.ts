import { NextResponse } from 'next/server';
import { getStatuses } from '@/lib/volcano/service';
import { MAGMA_SOURCE_REF } from '@/lib/volcano/magma';
import { publicErrorMessage } from '@/lib/public-error';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

/** Daftar status aktivitas resmi seluruh gunung api yang dipantau. */
export async function GET() {
  let result: Awaited<ReturnType<typeof getStatuses>>;
  try {
    result = await getStatuses();
  } catch (error) {
    // Tanpa cache sebelumnya, kegagalan sumber melempar galat. Tangkap di sini
    // supaya klien menerima JSON yang bisa ditampilkan, bukan 500 tanpa body.
    // Bentuk payload tetap seperti sukses (volcanoes + summary) agar komponen
    // pembaca tidak perlu menangani kasus `summary` kosong.
    return NextResponse.json({
      volcanoes: [],
      summary: {
        total: 0,
        byLevel: { 1: 0, 2: 0, 3: 0, 4: 0 },
        stale: false,
        error: publicErrorMessage(error, 'Status gunung api MAGMA tidak dapat dimuat.'),
        updatedAt: null,
        source: MAGMA_SOURCE_REF,
      },
      updatedAt: null,
      stale: false,
      error: publicErrorMessage(error, 'Status gunung api MAGMA tidak dapat dimuat.'),
    }, { status: 502, headers: { 'Cache-Control': 'no-store, max-age=0' } });
  }

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
