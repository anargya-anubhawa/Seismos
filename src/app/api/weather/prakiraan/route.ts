import { NextResponse } from 'next/server';
import { getForecastByCode, getForecastForPoint, searchWeatherAreas } from '@/services/bmkg/weather';
import { publicErrorMessage } from '@/lib/public-error';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

/**
 * Prakiraan cuaca BMKG.
 *
 * Tiga cara pemakaian, sesuai kebutuhan halaman:
 *   ?lat=..&lon=..  → wilayah terdekat dari koordinat pengguna
 *   ?adm4=..        → wilayah menurut kode BMKG (dipakai saat tautan dibagikan)
 *   ?q=..           → pencarian wilayah untuk kotak pencarian (mengembalikan
 *                     daftar wilayah, bukan prakiraan)
 *
 * Koordinat hanya dipakai di server untuk memilih wilayah terdekat dan tidak
 * disimpan maupun dicatat.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const noStore = { 'Cache-Control': 'no-store, max-age=0' } as const;

  const query = params.get('q');
  if (query) {
    try {
      const results = await searchWeatherAreas(query);
      return NextResponse.json({ results, query }, { headers: noStore });
    } catch (error) {
      return NextResponse.json(
        { results: [], error: publicErrorMessage(error, 'Daftar wilayah cuaca tidak dapat dibaca: kesalahan tidak dikenal') },
        { status: 503, headers: noStore },
      );
    }
  }

  const adm4 = params.get('adm4');
  if (adm4) {
    try {
      const result = await getForecastByCode(adm4);
      return NextResponse.json({
        forecast: { ...result.value, stale: result.stale, error: result.error },
        updatedAt: new Date(result.at).toISOString(),
        stale: result.stale,
        error: result.error,
      }, { headers: noStore });
    } catch (error) {
      return NextResponse.json(
        { forecast: null, error: publicErrorMessage(error, 'Prakiraan cuaca BMKG tidak dapat dimuat: kesalahan tidak dikenal') },
        { status: 502, headers: noStore },
      );
    }
  }

  const latitude = Number(params.get('lat'));
  const longitude = Number(params.get('lon'));
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return NextResponse.json(
      { forecast: null, error: 'Kirim koordinat lat & lon, atau kode wilayah adm4, atau kata kunci q.' },
      { status: 400, headers: noStore },
    );
  }

  try {
    const result = await getForecastForPoint(latitude, longitude);
    if (!result) {
      return NextResponse.json({
        forecast: null,
        outsideCoverage: true,
        error: 'Koordinat berada di luar cakupan prakiraan desa/kelurahan BMKG. Pilih wilayah secara manual.',
      }, { status: 200, headers: noStore });
    }
    return NextResponse.json({
      forecast: { ...result.value, stale: result.stale, error: result.error },
      areaDistanceKm: Math.round(result.areaDistanceKm * 10) / 10,
      updatedAt: new Date(result.at).toISOString(),
      stale: result.stale,
      error: result.error,
    }, { headers: noStore });
  } catch (error) {
    return NextResponse.json(
      { forecast: null, error: publicErrorMessage(error, 'Prakiraan cuaca BMKG tidak dapat dimuat: kesalahan tidak dikenal') },
      { status: 502, headers: noStore },
    );
  }
}
