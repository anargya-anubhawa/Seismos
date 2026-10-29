import { NextResponse } from 'next/server';
import { fetchSatelliteImage, findSatelliteProduct } from '@/services/bmkg/weather';
import { publicErrorMessage } from '@/lib/public-error';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Proxy citra satelit BMKG.
 *
 * Hanya produk yang terdaftar pada katalog internal yang dapat diambil, dan
 * hanya dari host INDERAJA BMKG. Dengan begitu route ini tidak dapat disalahkan
 * menjadi proxy terbuka ke alamat sembarang.
 */
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const product = findSatelliteProduct(params.id);
  if (!product) {
    return new Response('Produk satelit tidak dikenal', {
      status: 404,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }

  try {
    const image = await fetchSatelliteImage(product);
    return new Response(image.body, {
      status: 200,
      headers: {
        'Content-Type': image.contentType,
        'Content-Length': String(image.body.byteLength),
        // Citra INDERAJA diperbarui tiap beberapa menit; cache singkat di browser.
        'Cache-Control': 'public, max-age=120, stale-while-revalidate=300',
        'X-Content-Type-Options': 'nosniff',
        ...(image.capturedAt ? { 'X-Image-Captured-At': image.capturedAt } : {}),
      },
    });
  } catch (error) {
    return new Response(
      publicErrorMessage(error, 'kesalahan tidak dikenal'),
      { status: 502, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } },
    );
  }
}
