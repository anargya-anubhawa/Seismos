import { fetchMagmaImage, isAllowedMagmaImage } from '@/services/magma/image';
import { publicErrorMessage } from '@/lib/public-error';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Proxy gambar resmi MAGMA (visual laporan, gallery, CCTV).
 * Hanya host gambar MAGMA yang diizinkan, supaya route ini tidak dapat dipakai
 * sebagai proxy terbuka ke alamat sembarang.
 */
export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get('url') ?? '';
  const url = isAllowedMagmaImage(raw);
  if (!url) {
    return new Response('URL gambar tidak diizinkan (hanya berkas gambar MAGMA)', {
      status: 400,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }

  try {
    const { body, contentType } = await fetchMagmaImage(url);
    return new Response(body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(body.byteLength),
        // Gambar visual diperbarui berkala oleh MAGMA; cache singkat di browser.
        'Cache-Control': 'public, max-age=120, stale-while-revalidate=600',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    return new Response(
      publicErrorMessage(error, 'kesalahan tidak dikenal'),
      {
        status: 502,
        headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
      },
    );
  }
}
