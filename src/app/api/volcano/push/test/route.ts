import { NextResponse } from 'next/server';
import { sendTestPush } from '@/lib/volcano/push';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

/** Kirim notifikasi uji ke satu langganan yang sudah terdaftar. */
export async function POST(request: Request) {
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
    const message = error instanceof Error ? error.message : 'Push uji gagal dikirim';
    const status = (error as { statusCode?: number }).statusCode;
    return NextResponse.json({ error: message, providerStatus: status ?? null }, {
      status: 502,
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  }
}
