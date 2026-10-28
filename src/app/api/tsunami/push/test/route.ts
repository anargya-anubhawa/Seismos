import { NextResponse } from 'next/server';
import { sendTestPush } from '@/lib/tsunami/push';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

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
    const message = error instanceof Error ? error.message : 'kesalahan tidak dikenal';
    const status = message.includes('Tunggu sebentar') ? 429 : message.includes('tidak ditemukan') ? 404 : 502;
    return NextResponse.json({ error: message }, {
      status,
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  }
}
