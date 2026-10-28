import { NextResponse } from 'next/server';
import { ensureVolcanoFresh, POLL_SECONDS } from '@/lib/volcano/monitor';
import { loadState } from '@/lib/volcano/store';
import { getOverview } from '@/lib/volcano/service';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

/** Ringkasan dashboard gunung api beserta status pemrosesan notifikasi. */
export async function GET() {
  await ensureVolcanoFresh();
  try {
    const overview = await getOverview();
    const state = await loadState();
    const errors = [...overview.errors];
    if (overview.volcanoes.length === 0) errors.push('Status gunung api kosong.');
    const payload = {
      ...overview,
      error: overview.volcanoes.length === 0 ? 'Status gunung api tidak dapat dimuat.' : null,
      errors,
      monitor: {
        lastCheckAt: state.lastCheckAt,
        lastSuccessAt: state.lastSuccessAt,
        checkCount: state.checkCount,
        pollSeconds: POLL_SECONDS,
        seeded: state.seededAt !== null,
        sources: Object.entries(state.sources).map(([id, source]) => ({ id, ...source })),
        notifications: state.notifications.slice(0, 20),
      },
    };
    return NextResponse.json(payload, {
      status: overview.volcanoes.length === 0 ? 502 : 200,
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  } catch (error) {
    return NextResponse.json({
      error: `Data gunung api tidak dapat dimuat: ${error instanceof Error ? error.message : 'kesalahan tidak dikenal'}`,
    }, {
      status: 503,
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  }
}
