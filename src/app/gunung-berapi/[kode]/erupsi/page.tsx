import type { Metadata } from 'next';
import { VolcanoDetailSection } from '@/components/volcano/VolcanoDetailSection';

export const metadata: Metadata = {
  title: 'Gunung Api — Riwayat Erupsi',
  description: 'Riwayat Erupsi untuk satu gunung api, bersumber dari MAGMA/PVMBG.',
};

export default function Page({ params }: { params: { kode: string } }) {
  return <VolcanoDetailSection code={params.kode} section="erupsi" />;
}
