import { NextResponse } from 'next/server';
import { getKrbMaps } from '@/services/magma/volcano';
import { publicErrorMessage } from '@/lib/public-error';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

/**
 * Daftar peta Kawasan Rawan Bencana (KRB) resmi PVMBG.
 *
 * MAGMA hanya menerbitkan berkas gambar/PDF peta; layanan fitur ArcGIS yang
 * memuat poligon KRB memerlukan token sehingga tidak dapat dipakai publik.
 * Karena itu aplikasi menampilkan peta sumber apa adanya, bukan menggambar
 * batas sendiri.
 */
export async function GET() {
  try {
    const result = await getKrbMaps();
    return NextResponse.json({
      maps: result.value,
      updatedAt: new Date(result.at).toISOString(),
      stale: result.stale,
      error: result.error,
      note: 'Batas zona KRB hanya ditampilkan sebagai gambar resmi PVMBG; poligon geospasial tidak tersedia untuk publik.',
    }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
  } catch (error) {
    return NextResponse.json({
      maps: [],
      error: publicErrorMessage(error, 'Daftar peta KRB MAGMA tidak dapat dimuat: kesalahan tidak dikenal'),
    }, { status: 502, headers: { 'Cache-Control': 'no-store, max-age=0' } });
  }
}
