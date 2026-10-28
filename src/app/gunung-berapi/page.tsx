import type { Metadata } from 'next';
import { VolcanoOverview } from '@/components/volcano/VolcanoOverview';

export const metadata: Metadata = {
  title: 'Daftar Gunung Api',
  description:
    'Daftar gunung api Indonesia beserta peta persebaran, status aktivitas, laporan, riwayat letusan, CCTV, dan VONA dari data resmi MAGMA Indonesia/PVMBG.',
};

export default function GunungBerapiPage() {
  return <VolcanoOverview />;
}
