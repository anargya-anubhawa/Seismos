import type { Metadata } from 'next';
import { SatelliteDetailPage } from '@/components/weather/SatelliteDetailPage';

/** Menyusun nama produk yang ramah dibaca dari kode URL sebagai judul halaman. */
function humanize(id: string): string {
  return id.split('-').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}

export function generateMetadata({ params }: { params: { id: string } }): Metadata {
  const name = humanize(params.id);
  return {
    title: `Satelit — ${name}`,
    description: `Penjelasan dan citra produk satelit ${name} dari BMKG (INDERAJA), beserta waktu pembaruan citra.`,
  };
}

export default function SatelitDetailRoute({ params }: { params: { id: string } }) {
  return <SatelliteDetailPage id={params.id} />;
}
