import { fetchSeismogramImage } from '@/services/magma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  request: Request,
  { params }: { params: { id: string } },
) {
  if (!/^\d{1,12}$/.test(params.id)) {
    return new Response('ID stasiun tidak valid', { status: 400 });
  }

  const sizeParam = new URL(request.url).searchParams.get('size');
  const size = sizeParam === 'full' ? 'full' : 'thumb';

  try {
    const { body, contentType } = await fetchSeismogramImage(Number(params.id), size);
    return new Response(body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(body.byteLength),
        // Gambar sumber diperbarui berkala; jangan simpan terlalu lama di browser.
        'Cache-Control': 'public, max-age=60, stale-while-revalidate=240',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (e) {
    const error = e instanceof Error ? e.message : 'Gambar seismogram tidak dapat diambil.';
    return new Response(error, {
      status: 502,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }
}
