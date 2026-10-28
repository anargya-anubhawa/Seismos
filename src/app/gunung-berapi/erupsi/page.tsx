import type { Metadata } from 'next';
import { VolcanoEruptionList } from '@/components/volcano/VolcanoEruptionList';

export const metadata: Metadata = {
  title: 'Riwayat Erupsi Gunung Api',
  description: 'Informasi letusan resmi (VEN) MAGMA/PVMBG beserta parameter kejadian dan rekomendasi.',
};

export default function ErupsiPage() {
  return <VolcanoEruptionList />;
}
