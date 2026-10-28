import { NextResponse } from 'next/server';
import { getWeatherAlerts } from '@/services/bmkg/weather';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

/**
 * Peringatan dini cuaca ekstrem resmi BMKG (nowcast CAP).
 *
 * Hanya peringatan yang diterbitkan BMKG yang ditampilkan; aplikasi tidak
 * menilai sendiri apakah suatu wilayah berpotensi cuaca ekstrem.
 */
export async function GET(request: Request) {
  const noStore = { 'Cache-Control': 'no-store, max-age=0' } as const;
  const withRegion = new URL(request.url).searchParams.get('wilayah');

  try {
    const result = await getWeatherAlerts();
    const alerts = withRegion
      ? result.value.alerts.filter((alert) =>
          `${alert.region ?? ''} ${alert.description}`.toLowerCase().includes(withRegion.toLowerCase()),
        )
      : result.value.alerts;
    return NextResponse.json({
      alerts,
      updatedAt: new Date(result.at).toISOString(),
      sourceUpdatedAt: result.value.updatedAt,
      stale: result.stale,
      error: result.error,
      sourceUrl: result.value.sourceUrl,
    }, { headers: noStore });
  } catch (error) {
    return NextResponse.json({
      alerts: [],
      error: `Peringatan dini cuaca BMKG tidak dapat dimuat: ${error instanceof Error ? error.message : 'kesalahan tidak dikenal'}`,
    }, { status: 502, headers: noStore });
  }
}
