import { NextResponse } from 'next/server';
import {
  isValidPushSubscription, removeSubscription, upsertSubscription,
} from '@/lib/tsunami/push';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

function endpointFrom(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null;
  const endpoint = (value as { endpoint?: unknown }).endpoint;
  return typeof endpoint === 'string' && endpoint.length > 0 && endpoint.length <= 2048 ? endpoint : null;
}

export async function POST(request: Request) {
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
      error: `Langganan push gagal disimpan (${error instanceof Error ? error.message : 'kesalahan tidak dikenal'}).`,
    }, {
      status: 500,
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  }
}

export async function DELETE(request: Request) {
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
      error: `Langganan push gagal dihapus (${error instanceof Error ? error.message : 'kesalahan tidak dikenal'}).`,
    }, {
      status: 500,
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  }
}
