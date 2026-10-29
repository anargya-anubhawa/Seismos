import { NextResponse } from 'next/server';
import { runTsunamiCheck } from '@/lib/tsunami/monitor';
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
  const secret = process.env.TSUNAMI_MONITOR_SECRET?.trim();
  if (!secret) return true;
  const bearer = request.headers.get('authorization') ?? '';
  const header = request.headers.get('x-tsunami-secret') ?? '';
  return sameSecret(bearer, `Bearer ${secret}`) || sameSecret(header, secret);
}

async function run(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'Tidak diizinkan' }, { status: 401 });
  }
  const force = new URL(request.url).searchParams.get('force') === '1';
  try {
    const result = await runTsunamiCheck('cron', force);
    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  } catch (error) {
    return NextResponse.json({
      error: publicErrorMessage(error, 'Pemeriksaan tsunami gagal (kesalahan tidak dikenal).'),
    }, {
      status: 500,
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  }
}

export async function GET(request: Request) {
  return run(request);
}

export async function POST(request: Request) {
  // Batasi percobaan dari satu klien: endpoint ini menulis ke penyimpanan
  // langganan atau memicu kiriman push, jadi tidak boleh bisa dibanjiri.
  const limited = rateLimit(request, { name: 'tsunami-monitor', limit: 20, windowMs: 300000 });
  if (limited) return limited;

  // Tolak body yang jelas lebih besar sebelum dibaca seluruhnya.
  const declaredLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > 8000) {
    return NextResponse.json(
      { error: 'Body permintaan terlalu besar' },
      { status: 413, headers: { 'Cache-Control': 'no-store, max-age=0' } },
    );
  }
  return run(request);
}
