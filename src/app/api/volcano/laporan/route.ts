import { NextResponse } from 'next/server';
import { getActivityReports, getDailyReports } from '@/services/magma/volcano';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

/**
 * Daftar laporan resmi MAGMA.
 * - `kind=aktivitas` (bawaan): VAR per periode dari `/var/list`.
 * - `kind=harian`: laporan harian dari `/volcano/latest-daily-var` atau
 *   `/volcano/daily-var?date=YYYY-MM-DD`.
 * Filter gunung api dan pencarian dilakukan di server setelah pengambilan.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const kind = params.get('kind') === 'harian' ? 'harian' : 'aktivitas';
  const volcano = params.get('volcano')?.trim() ?? '';
  const search = params.get('q')?.trim().toLowerCase() ?? '';
  const date = params.get('date') ?? '';
  const size = Math.min(60, Math.max(1, Number(params.get('size') ?? 30) || 30));
  const page = Math.max(0, Number(params.get('page') ?? 0) || 0);

  try {
    if (kind === 'harian') {
      const result = await getDailyReports(date || undefined);
      let reports = result.value.reports;
      if (volcano) reports = reports.filter((item) => item.volcanoCode.toUpperCase() === volcano.toUpperCase());
      if (search) {
        reports = reports.filter((item) => `${item.volcanoName} ${item.volcanoCode}`.toLowerCase().includes(search));
      }
      return NextResponse.json({
        kind,
        reports,
        date: result.value.date,
        updatedAt: new Date(result.at).toISOString(),
        stale: result.stale,
        error: result.error,
        note: 'Laporan harian diterbitkan MAGMA sekali sehari untuk setiap gunung api yang diamati.',
      }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
    }

    const result = await getActivityReports({ size, page, date: date || undefined });
    let reports = result.value;
    if (volcano) reports = reports.filter((item) => item.volcanoCode.toUpperCase() === volcano.toUpperCase());
    if (search) {
      reports = reports.filter((item) => `${item.volcanoName} ${item.volcanoCode} ${item.date}`.toLowerCase().includes(search));
    }
    return NextResponse.json({
      kind,
      reports,
      date: date || null,
      updatedAt: new Date(result.at).toISOString(),
      stale: result.stale,
      error: result.error,
      note: 'Laporan aktivitas (VAR) diterbitkan per periode pengamatan 6/12/24 jam.',
    }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
  } catch (error) {
    return NextResponse.json({
      kind,
      reports: [],
      error: `Laporan MAGMA tidak dapat dimuat: ${error instanceof Error ? error.message : 'kesalahan tidak dikenal'}`,
    }, { status: 502, headers: { 'Cache-Control': 'no-store, max-age=0' } });
  }
}
