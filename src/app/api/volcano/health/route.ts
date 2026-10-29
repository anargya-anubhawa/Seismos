import { NextResponse } from 'next/server';
import {
  getCameras, getEruptions, getKrbMaps, getVonaNotices,
} from '@/services/magma/volcano';
import { getStatuses } from '@/lib/volcano/service';
import { POLL_SECONDS } from '@/lib/volcano/monitor';
import { publicErrorMessage } from '@/lib/public-error';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

/** Kesehatan sumber gunung api: status, VEN, VONA, CCTV, dan KRB. */
export async function GET() {
  const [statuses, eruptions, vona, cameras, krb] = await Promise.all([
    getStatuses().catch((error) => ({ error: publicErrorMessage(error, 'kesalahan tidak dikenal'), volcanoes: [] })),
    getEruptions(5).catch(() => null),
    getVonaNotices(5).catch(() => null),
    getCameras().catch(() => null),
    getKrbMaps().catch(() => null),
  ]);

  const sources = [
    { id: 'status', label: 'Status aktivitas (/home/maps)', count: statuses.volcanoes.length, error: statuses.error ?? null },
    { id: 'ven', label: 'Informasi letusan (/ven/list)', count: eruptions?.value.length ?? 0, error: eruptions?.error ?? (eruptions ? null : 'gagal') },
    { id: 'vona', label: 'VONA (/vona/list)', count: vona?.value.length ?? 0, error: vona?.error ?? (vona ? null : 'gagal') },
    { id: 'cctv', label: 'CCTV (/cctv/list)', count: cameras?.value.length ?? 0, error: cameras?.error ?? (cameras ? null : 'gagal') },
    { id: 'krb', label: 'Peta KRB (/volcano/krb)', count: krb?.value.length ?? 0, error: krb?.error ?? (krb ? null : 'gagal') },
  ];
  const ok = sources.every((source) => source.error === null && source.count > 0);
  return NextResponse.json({
    ok,
    pollSeconds: POLL_SECONDS,
    sources,
    checkedAt: new Date().toISOString(),
  }, { status: ok ? 200 : 207, headers: { 'Cache-Control': 'no-store, max-age=0' } });
}
