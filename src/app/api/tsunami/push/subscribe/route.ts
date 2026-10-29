import { NextResponse } from 'next/server';
import {
  isValidPushSubscription, removeSubscription, upsertSubscription,
} from '@/lib/tsunami/push';
import { publicErrorMessage } from '@/lib/public-error';
import { rateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

function endpointFrom(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null;
  const endpoint = (value as { endpoint?: unknown }).endpoint;
  return typeof endpoint === 'string' && endpoint.length > 0 && endpoint.length <= 2048 ? endpoint : null;
}

export async function POST(request: Request) {
  // Batasi percobaan dari satu klien: endpoint ini menulis ke penyimpanan
  // langganan atau memicu kiriman push, jadi tidak boleh bisa dibanjiri.
  const limited = rateLimit(request, { name: 'tsunami-push-subscribe', limit: 30, windowMs: 600000 });
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
  const subscription = body && typeof body === 'object'
    ? (body as { subscription?: unknown }).subscription
    : null;
  if (!isValidPushSubscription(subscription)) {
    return NextResponse.json({ error: 'Langganan push tidak valid' }, { status: 400 });
  }
  try {
    await upsertSubscription(subscription);
    return NextResponse.json({ ok: true }, {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  } catch (error) {
    return NextResponse.json({
      error: publicErrorMessage(error, 'Langganan push gagal disimpan (kesalahan tidak dikenal).'),
    }, {
      status: 500,
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  }
}

export async function DELETE(request: Request) {
  // Batasi percobaan dari satu klien: endpoint ini menulis ke penyimpanan
  // langganan atau memicu kiriman push, jadi tidak boleh bisa dibanjiri.
  const limited = rateLimit(request, { name: 'tsunami-push-subscribe', limit: 30, windowMs: 600000 });
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
  const endpoint = endpointFrom(body);
  if (!endpoint) return NextResponse.json({ error: 'Endpoint langganan tidak valid' }, { status: 400 });
  try {
    const removed = await removeSubscription(endpoint);
    return NextResponse.json({ ok: true, removed }, {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  } catch (error) {
    return NextResponse.json({
      error: publicErrorMessage(error, 'Langganan push gagal dihapus (kesalahan tidak dikenal).'),
    }, {
      status: 500,
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  }
}
