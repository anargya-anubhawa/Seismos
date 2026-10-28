import type { Metadata } from 'next';
import { VolcanoDetailPage } from '@/components/volcano/VolcanoDetailPage';

export function generateMetadata({ params }: { params: { kode: string } }): Metadata {
  const code = params.kode.toUpperCase();
  return {
    title: `Gunung Api ${code}`,
    description: `Status aktivitas, laporan resmi, riwayat tingkat, CCTV, seismogram, dan peta KRB untuk gunung api dengan kode MAGMA ${code}.`,
  };
}

export default function DetailPage({ params }: { params: { kode: string } }) {
  return <VolcanoDetailPage code={params.kode} />;
}
