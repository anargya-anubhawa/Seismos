import { NextResponse } from 'next/server';
import { getGallery } from '@/services/magma/volcano';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

/**
 * Gallery dokumentasi visual resmi MAGMA (`/volcano/gallery`).
 * API sumber hanya mendukung pencarian teks (`search`), bukan filter gunung api.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const search = params.get('search')?.slice(0, 60) ?? undefined;
  const size = Math.min(48, Math.max(1, Number(params.get('size') ?? 24) || 24));
  const page = Math.max(0, Number(params.get('page') ?? 0) || 0);
  try {
    const gallery = await getGallery(search, size, page);
    return NextResponse.json({
      photos: gallery.value,
      search: search ?? null,
      updatedAt: new Date(gallery.at).toISOString(),
      stale: gallery.stale,
      error: gallery.error,
    }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
  } catch (error) {
    return NextResponse.json({
      photos: [],
      error: `Gallery MAGMA tidak dapat dimuat: ${error instanceof Error ? error.message : 'kesalahan tidak dikenal'}`,
    }, { status: 502, headers: { 'Cache-Control': 'no-store, max-age=0' } });
  }
}
