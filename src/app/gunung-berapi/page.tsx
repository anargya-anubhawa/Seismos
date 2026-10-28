import type { Metadata } from 'next';
import { VolcanoOverview } from '@/components/volcano/VolcanoOverview';

export const metadata: Metadata = {
  title: 'Gunung Berapi',
  description:
    'Status aktivitas, laporan, riwayat letusan, CCTV, seismogram, peta KRB, gallery, dan VONA gunung api Indonesia dari data resmi MAGMA Indonesia/PVMBG.',
};

export default function GunungBerapiPage() {
  return <VolcanoOverview />;
}
