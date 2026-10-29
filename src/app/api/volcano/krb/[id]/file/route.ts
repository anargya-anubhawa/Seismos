import { fetchKrbFile } from '@/services/magma/volcano';
import { fetchMagmaImage, isAllowedMagmaImage } from '@/services/magma/image';
import { publicErrorMessage } from '@/lib/public-error';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Berkas peta KRB resmi (gambar) dari MAGMA.
 *
 * Berkas KRB dapat berukuran puluhan MB, jadi route ini meneruskan berkas apa
 * adanya tanpa menyimpannya, dan memberi tahu browser ukuran sebenarnya.
 * `mode=download` memakai Content-Disposition attachment.
 */
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const id = params.id ?? '';
  if (!/^[A-Za-z0-9-]{8,64}$/.test(id)) {
    return new Response('ID peta KRB tidak valid', { status: 400 });
  }
  const mode = new URL(request.url).searchParams.get('mode') === 'download' ? 'download' : 'preview';

  try {
    const file = await fetchKrbFile(id);
    if (!file) return new Response('Peta KRB tidak ditemukan pada daftar MAGMA', { status: 404 });
    const url = isAllowedMagmaImage(file.url);
    if (!url) return new Response('Sumber berkas KRB tidak diizinkan', { status: 502 });

    const { body, contentType, contentLength } = await fetchMagmaImage(url, 120_000);
    const headers: Record<string, string> = {
      'Content-Type': contentType,
      'Content-Length': String(body.byteLength),
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
      'X-Content-Type-Options': 'nosniff',
    };
    if (mode === 'download') {
      const ext = contentType.includes('pdf') ? 'pdf' : contentType.includes('png') ? 'png' : 'jpg';
      headers['Content-Disposition'] = `attachment; filename="KRB-${id.slice(0, 8)}.${ext}"`;
    }
    if (contentLength && contentLength !== body.byteLength) {
      headers['X-Source-Length'] = String(contentLength);
    }
    return new Response(body, { status: 200, headers });
  } catch (error) {
    return new Response(
      publicErrorMessage(error, 'kesalahan tidak dikenal'),
      { status: 502, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } },
    );
  }
}
