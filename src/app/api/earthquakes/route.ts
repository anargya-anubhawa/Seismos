import { NextResponse } from 'next/server';
import { getBmkgEarthquakes } from '@/services/bmkg';

export const dynamic = 'force-dynamic';

export async function GET() {
  const data = await getBmkgEarthquakes();
  if (data.events.length === 0) {
    // Semua sumber gagal dan tidak ada cache: jangan kirim data kosong seolah-olah sukses.
    return NextResponse.json(
      { error: 'Semua sumber BMKG tidak dapat diakses saat ini.', sources: data.sources },
      { status: 502 },
    );
  }
  return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } });
}
