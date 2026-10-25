import { NextResponse } from 'next/server';
import { getSeismograms } from '@/services/magma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const data = await getSeismograms();
    if (data.stations.length === 0) {
      return NextResponse.json(
        { error: 'Daftar stasiun seismograf MAGMA kosong.', source: data.source },
        { status: 502 },
      );
    }
    return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    const error = e instanceof Error ? e.message : 'Sumber MAGMA tidak dapat diakses.';
    return NextResponse.json(
      {
        error,
        source: {
          name: 'MAGMA Indonesia — PVMBG, Badan Geologi, Kementerian ESDM',
          home: 'https://magma.esdm.go.id',
          live: 'https://magma.esdm.go.id/volcano/live-seismograf',
        },
      },
      { status: 502 },
    );
  }
}
