import { NextResponse } from 'next/server';
import { publicErrorMessage } from '@/lib/public-error';
import { getStatuses } from '@/lib/volcano/service';
import { getTsunamiFeed } from '@/lib/tsunami/service';
import { getBmkgEarthquakes } from '@/services/bmkg';
import { getWeatherAlerts } from '@/services/bmkg/weather';
import { getCameras, getEruptions, getKrbMaps, getVonaNotices } from '@/services/magma/volcano';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

/**
 * Kesehatan seluruh sumber data untuk halaman `/status-sumber` (OI-04).
 *
 * Memanggil lapisan layanan secara langsung, bukan melakukan fetch balik ke
 * route lain: fetch internal bergantung pada base URL yang benar dan menggandakan
 * latensi. Tidak ada panel admin, tidak ada rahasia, dan tidak ada mutasi.
 *
 * Kegagalan tidak disembunyikan — halaman ini ada justru untuk memperlihatkan
 * sumber mana yang sedang bermasalah.
 */

export interface HealthSource {
  group: string;
  id: string;
  label: string;
  ok: boolean;
  count: number | null;
  error: string | null;
  checkedAt: string;
}

/** Ubah hasil sumber menjadi baris kesehatan tanpa melempar galat. */
async function check(
  group: string,
  id: string,
  label: string,
  run: () => Promise<{ count: number; error?: string | null }>,
): Promise<HealthSource> {
  const checkedAt = new Date().toISOString();
  try {
    const result = await run();
    const error = result.error ?? null;
    return { group, id, label, ok: error === null, count: result.count, error, checkedAt };
  } catch (caught) {
    return {
      group, id, label, ok: false, count: null,
      error: publicErrorMessage(caught, 'sumber tidak dapat dihubungi'),
      checkedAt,
    };
  }
}

export async function GET() {
  const jobs: Promise<HealthSource>[] = [
    check('Gunung api (MAGMA/PVMBG)', 'status', 'Status aktivitas gunung api', async () => {
      const result = await getStatuses();
      return { count: result.volcanoes.length, error: result.error ?? null };
    }),
    check('Gunung api (MAGMA/PVMBG)', 'ven', 'Informasi letusan (VEN)', async () => {
      const result = await getEruptions(5);
      return { count: result.value.length, error: result.error ?? null };
    }),
    check('Gunung api (MAGMA/PVMBG)', 'vona', 'VONA', async () => {
      const result = await getVonaNotices(5);
      return { count: result.value.length, error: result.error ?? null };
    }),
    check('Gunung api (MAGMA/PVMBG)', 'cctv', 'CCTV gunung api', async () => {
      const result = await getCameras();
      return { count: result.value.length, error: result.error ?? null };
    }),
    check('Gunung api (MAGMA/PVMBG)', 'krb', 'Peta KRB', async () => {
      const result = await getKrbMaps();
      return { count: result.value.length, error: result.error ?? null };
    }),
  ];

  // Gempa BMKG — satu sumber per feed, supaya kegagalan sebagian terlihat.
  jobs.push(check('Gempa (BMKG)', 'gempa', 'Feed gempa BMKG', async () => {
    const result = await getBmkgEarthquakes();
    const failed = (result.sources ?? []).filter((source) => source.error);
    const events = result.events?.length ?? 0;
    return {
      count: events,
      error: failed.length > 0
        ? `${failed.length} dari ${result.sources?.length ?? 0} feed gagal: ${failed.map((f) => f.id).join(', ')}`
        : null,
    };
  }));

  // Tsunami BMKG/InaTEWS
  jobs.push(check('Tsunami (BMKG/InaTEWS)', 'tsunami', 'Status peringatan tsunami', async () => {
    const feed = await getTsunamiFeed();
    const failed = (feed.sources ?? []).filter((source) => !source.ok);
    return {
      count: feed.alerts?.length ?? 0,
      error: failed.length > 0
        ? `${failed.length} dari ${feed.sources?.length ?? 0} sumber gagal`
        : null,
    };
  }));

  // Cuaca BMKG — peringatan dini (nowcast)
  jobs.push(check('Cuaca (BMKG)', 'peringatan', 'Peringatan dini cuaca ekstrem', async () => {
    const result = await getWeatherAlerts();
    return { count: result.value?.alerts?.length ?? 0, error: result.error ?? null };
  }));

  const sources = await Promise.all(jobs);
  const failedCount = sources.filter((source) => !source.ok).length;

  return NextResponse.json({
    ok: failedCount === 0,
    checkedAt: new Date().toISOString(),
    total: sources.length,
    failedCount,
    sources,
  }, { status: 200, headers: { 'Cache-Control': 'no-store, max-age=0' } });
}
