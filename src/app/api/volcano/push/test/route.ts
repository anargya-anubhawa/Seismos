import { NextResponse } from 'next/server';
import { sendTestPush } from '@/lib/volcano/push';
import { publicErrorMessage } from '@/lib/public-error';
import { rateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

/** Kirim notifikasi uji ke satu langganan yang sudah terdaftar. */
export async function POST(request: Request) {
  // Batasi percobaan dari satu klien: endpoint ini menulis ke penyimpanan
  // langganan atau memicu kiriman push, jadi tidak boleh bisa dibanjiri.
  const limited = rateLimit(request, { name: 'volcano-push-test', limit: 5, windowMs: 600000 });
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
    const message = publicErrorMessage(error, 'Push uji gagal dikirim');
    const status = (error as { statusCode?: number }).statusCode;
    return NextResponse.json({ error: message, providerStatus: status ?? null }, {
      status: 502,
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  }
}
