import { NextResponse } from 'next/server';
import { publicErrorMessage } from '@/lib/public-error';
import { rateLimit } from '@/lib/rate-limit';
import { readFcmCredentials } from '@/lib/quake/fcm';
import { runQuakeCheck } from '@/lib/quake/monitor';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' };

/** Perbandingan waktu-konstan, sama seperti `tsunami/monitor/route.ts`. */
function sameSecret(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i++) diff |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return diff === 0;
}

/**
 * Endpoint monitor untuk cron hosting.
 *
 * ## Berbeda dari monitor tsunami dan itu disengaja
 * `tsunami/monitor/route.ts` membuka akses bila `TSUNAMI_MONITOR_SECRET` tidak diisi
 * (`if (!secret) return true`). Untuk endpoint yang mengirim notifikasi ke seluruh pengguna,
 * perilaku itu berbahaya: siapa pun yang menemukan URL dapat memicu fan-out. Di sini
 * ketiadaan secret berarti **tertutup** (401), bukan terbuka.
 */
function authorized(request: Request): boolean {
  const secret = process.env.QUAKE_MONITOR_SECRET?.trim();
  if (!secret) return false;
  const bearer = request.headers.get('authorization') ?? '';
  const header = request.headers.get('x-quake-secret') ?? '';
  return sameSecret(bearer, `Bearer ${secret}`) || sameSecret(header, secret);
}

async function run(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'Tidak diizinkan' }, { status: 401, headers: NO_STORE });
  }
  const force = new URL(request.url).searchParams.get('force') === '1';
  try {
    const result = await runQuakeCheck('cron', {
      force,
      credentials: readFcmCredentials(),
    });
    return NextResponse.json(result, { headers: NO_STORE });
  } catch (error) {
    return NextResponse.json(
      { error: publicErrorMessage(error, 'Pemeriksaan gempa gagal (kesalahan tidak dikenal).') },
      { status: 500, headers: NO_STORE },
    );
  }
}

export async function GET(request: Request) {
  return run(request);
}

export async function POST(request: Request) {
  const limited = rateLimit(request, { name: 'v1-quake-monitor', limit: 20, windowMs: 300_000 });
  if (limited) return limited;
  return run(request);
}
