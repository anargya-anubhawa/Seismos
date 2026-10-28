import type { Metadata } from 'next';
import { VolcanoDetailSection } from '@/components/volcano/VolcanoDetailSection';

export const metadata: Metadata = {
  title: 'Gunung Api — Laporan Harian',
  description: 'Laporan Harian untuk satu gunung api, bersumber dari MAGMA/PVMBG.',
};

export default function Page({ params }: { params: { kode: string } }) {
  return <VolcanoDetailSection code={params.kode} section="laporan-harian" />;
}
