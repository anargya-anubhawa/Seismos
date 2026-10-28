import type { Metadata } from 'next';
import { VolcanoSeismogramView } from '@/components/volcano/VolcanoSeismogram';
import { VolcanoTabs } from '@/components/volcano/VolcanoTabs';

export const metadata: Metadata = {
  title: 'Live Seismogram Gunung Api',
  description: 'Seismogram live stasiun gunung api dari MAGMA Indonesia (PVMBG).',
};

export default function SeismogramPage() {
  return (
    <div className="min-w-0">
      <h1 className="mb-1 text-xl font-semibold">Live Seismogram Gunung Api</h1>
      <p className="mb-3 max-w-3xl text-sm text-muted">
        Grafik getaran tanah dari stasiun seismograf MAGMA. Pilih gunung api untuk memuat stasiunnya; gambar hanya
        dimuat setelah dipilih agar tidak membebani browser.
      </p>
      <VolcanoTabs />
      <VolcanoSeismogramView />
    </div>
  );
}
