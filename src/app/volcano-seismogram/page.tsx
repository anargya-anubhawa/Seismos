import type { Metadata } from 'next';
import { PageTitle } from '@/components/ui/common';
import { VolcanoSeismogramView } from '@/components/volcano/VolcanoSeismogram';
import { VolcanoTabs } from '@/components/volcano/VolcanoTabs';

export const metadata: Metadata = {
  title: 'Seismogram Gunung Api',
  description: 'Seismogram live stasiun gunung api dari MAGMA Indonesia (PVMBG, Badan Geologi, Kementerian ESDM).',
};

/**
 * Alamat lama halaman seismogram tetap berfungsi; navigasi utamanya kini ada di
 * menu Gunung Berapi → Live Seismogram.
 */
export default function VolcanoSeismogramPage() {
  return (
    <div className="min-w-0">
      <PageTitle
        title="Seismogram Gunung Api"
        hint="Pilih gunung api untuk memuat seismogram stasiunnya. Daftar dan gambar berasal dari MAGMA Indonesia (PVMBG, Badan Geologi, Kementerian ESDM)."
      />
      <VolcanoTabs />
      <VolcanoSeismogramView />
    </div>
  );
}
