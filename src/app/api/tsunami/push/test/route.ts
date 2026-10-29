import { NextResponse } from 'next/server';
import { sendTestPush } from '@/lib/tsunami/push';
import { publicErrorMessage } from '@/lib/public-error';
import { rateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

export async function POST(request: Request) {
  // Batasi percobaan dari satu klien: endpoint ini menulis ke penyimpanan
  // langganan atau memicu kiriman push, jadi tidak boleh bisa dibanjiri.
  const limited = rateLimit(request, { name: 'tsunami-push-test', limit: 5, windowMs: 600000 });
  if (limited) return limited;

  // Tolak body yang jelas lebih besar sebelum dibaca seluruhnya.
  const declaredLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > 4000) {
    return NextResponse.json(
      { error: 'Body permintaan terlalu besar' },
      { status: 413, headers: { 'Cache-Control': 'no-store, max-age=0' } },
    );
  }
  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Body JSON tidak valid' }, { status: 400 });
  }
  const endpoint = body && typeof body === 'object'
    ? (body as { endpoint?: unknown }).endpoint
    : null;
  if (typeof endpoint !== 'string' || endpoint.length === 0 || endpoint.length > 2048) {
    return NextResponse.json({ error: 'Endpoint langganan tidak valid' }, { status: 400 });
  }
  try {
    await sendTestPush(endpoint);
    return NextResponse.json({ ok: true }, {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  } catch (error) {
    const message = publicErrorMessage(error, 'kesalahan tidak dikenal');
    const status = message.includes('Tunggu sebentar') ? 429 : message.includes('tidak ditemukan') ? 404 : 502;
    return NextResponse.json({ error: message }, {
      status,
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  }
}
