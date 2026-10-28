import type { Metadata } from 'next';
import { VolcanoDetailMap } from '@/components/volcano/VolcanoDetailMap';

export const metadata: Metadata = {
  title: 'Gunung Api — peta',
  description: 'Lokasi gunung api pada peta, bersumber dari koordinat resmi MAGMA/PVMBG.',
};

export default function Page({ params }: { params: { kode: string } }) {
  return <VolcanoDetailMap code={params.kode} />;
}
