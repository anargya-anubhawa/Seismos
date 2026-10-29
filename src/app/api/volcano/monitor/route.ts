import { NextResponse } from 'next/server';
import { runVolcanoCheck, POLL_SECONDS } from '@/lib/volcano/monitor';
import { loadState } from '@/lib/volcano/store';
import { publicErrorMessage } from '@/lib/public-error';
import { rateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

function sameSecret(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i++) diff |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return diff === 0;
}

function authorized(request: Request): boolean {
  const secret = process.env.VOLCANO_MONITOR_SECRET?.trim();
  if (!secret) return true;
  const bearer = request.headers.get('authorization') ?? '';
  const header = request.headers.get('x-volcano-secret') ?? '';
  return sameSecret(bearer, `Bearer ${secret}`) || sameSecret(header, secret);
}

async function status() {
  const state = await loadState();
  return {
    lastCheckAt: state.lastCheckAt,
    lastCheckReason: state.lastCheckReason,
    lastSuccessAt: state.lastSuccessAt,
    seeded: state.seededAt !== null,
    checkCount: state.checkCount,
    pollSeconds: POLL_SECONDS,
    sources: state.sources,
    levels: Object.keys(state.levels).length,
    notifications: state.notifications.slice(0, 20),
  };
}

/** Status pemrosesan notifikasi gunung api (tanpa rahasia). */
export async function GET() {
  try {
    return NextResponse.json(await status(), { headers: { 'Cache-Control': 'no-store, max-age=0' } });
  } catch (error) {
    return NextResponse.json({
      error: publicErrorMessage(error, 'Status pemantauan gunung api tidak dapat dibaca: kesalahan tidak dikenal'),
    }, { status: 500 });
  }
}

/** Jalankan pemeriksaan sumber resmi sekarang (untuk cron / admin). */
export async function POST(request: Request) {
  // Batasi percobaan dari satu klien: endpoint ini menulis ke penyimpanan
  // langganan atau memicu kiriman push, jadi tidak boleh bisa dibanjiri.
  const limited = rateLimit(request, { name: 'volcano-monitor', limit: 20, windowMs: 300000 });
  if (limited) return limited;

  // Tolak body yang jelas lebih besar sebelum dibaca seluruhnya.
  const declaredLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > 8000) {
    return NextResponse.json(
      { error: 'Body permintaan terlalu besar' },
      { status: 413, headers: { 'Cache-Control': 'no-store, max-age=0' } },
    );
  }
  if (!authorized(request)) return NextResponse.json({ error: 'Tidak diizinkan' }, { status: 401 });
  const force = new URL(request.url).searchParams.get('force') === '1';
  try {
    const result = await runVolcanoCheck('cron', force);
    return NextResponse.json({ ...result, state: await status() }, {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  } catch (error) {
    return NextResponse.json({
      error: publicErrorMessage(error, 'Pemeriksaan gunung api gagal: kesalahan tidak dikenal'),
    }, { status: 500 });
  }
}
