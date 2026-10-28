import { NextResponse } from 'next/server';
import { getSatelliteFrame, satelliteProducts } from '@/services/bmkg/weather';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

/**
 * Katalog produk satelit BMKG yang ditampilkan aplikasi.
 * Waktu citra diambil dari header `Last-Modified` sumber sehingga halaman dapat
 * menyebut kapan gambar terakhir diperbarui, bukan mengarang waktu sendiri.
 */
export async function GET() {
  const products = satelliteProducts();
  const frames = await Promise.all(products.map((product) => getSatelliteFrame(product.id)));
  return NextResponse.json({
    products,
    frames: frames.filter((frame) => frame !== null),
    note: 'Citra satelit diteruskan apa adanya dari INDERAJA BMKG (bmkg.go.id/cuaca/satelit). Waktu mengikuti header sumber.',
  }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
}
