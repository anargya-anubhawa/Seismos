import { NextResponse } from 'next/server';
import { findSubscription, normalizeTopics } from '@/lib/volcano/push';
import { publicErrorMessage } from '@/lib/public-error';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

/**
 * Kategori notifikasi gunung api untuk satu endpoint langganan.
 * Endpoint push bersifat rahasia (kapabilitas token), jadi hanya dikembalikan
 * bila pemanggil sudah mengetahui endpoint tersebut.
 */
export async function GET(request: Request) {
  const endpoint = new URL(request.url).searchParams.get('endpoint') ?? '';
  if (endpoint.length === 0 || endpoint.length > 2048) {
    return NextResponse.json({ error: 'Endpoint langganan tidak valid' }, { status: 400 });
  }
  try {
    const subscription = await findSubscription(endpoint);
    if (!subscription) return NextResponse.json({ topics: null, subscribed: false }, { headers: { 'Cache-Control': 'no-store' } });
    return NextResponse.json({ topics: normalizeTopics(subscription.topics, 'off'), subscribed: true }, {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  } catch (error) {
    return NextResponse.json({
      error: publicErrorMessage(error, 'Kategori notifikasi tidak dapat dibaca: kesalahan tidak dikenal'),
    }, { status: 500 });
  }
}
