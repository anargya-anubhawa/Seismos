import { NextResponse } from 'next/server';
import { getActivityReport, getDailyReports } from '@/services/magma/volcano';
import { publicErrorMessage } from '@/lib/public-error';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

/**
 * Detail laporan resmi MAGMA.
 * - ID UUID dari `/var/list` → detail laporan aktivitas (VAR).
 * - Laporan harian tidak punya endpoint detail tersendiri pada API publik, jadi
 *   rincian diambil dari daftar laporan harian untuk gunung api yang sama.
 */
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const id = params.id ?? '';
  if (!/^[A-Za-z0-9-]{1,80}$/.test(id)) {
    return NextResponse.json({ error: 'ID laporan tidak valid' }, { status: 400 });
  }
  if (id.startsWith('harian-')) {
    const volcanoCode = id.slice('harian-'.length).toUpperCase();
    if (!/^[A-Z0-9]{2,6}$/.test(volcanoCode)) {
      return NextResponse.json({ error: 'ID laporan harian tidak valid' }, { status: 400 });
    }
    try {
      const daily = await getDailyReports();
      const report = daily.value.reports.find((item) => item.volcanoCode === volcanoCode) ?? null;
      if (!report) return NextResponse.json({ error: 'Laporan harian tidak ditemukan' }, { status: 404 });
      return NextResponse.json({ report, stale: daily.stale, error: daily.error }, {
        headers: { 'Cache-Control': 'no-store, max-age=0' },
      });
    } catch (error) {
      return NextResponse.json({
        error: publicErrorMessage(error, 'Laporan harian tidak dapat dimuat: kesalahan tidak dikenal'),
      }, { status: 502 });
    }
  }

  try {
    const result = await getActivityReport(id);
    if (!result.value) {
      return NextResponse.json({ error: 'Laporan tidak ditemukan pada MAGMA' }, { status: 404 });
    }
    return NextResponse.json({ report: result.value, stale: result.stale, error: result.error }, {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  } catch (error) {
    return NextResponse.json({
      error: publicErrorMessage(error, 'Laporan aktivitas tidak dapat dimuat: kesalahan tidak dikenal'),
    }, { status: 502, headers: { 'Cache-Control': 'no-store, max-age=0' } });
  }
}
