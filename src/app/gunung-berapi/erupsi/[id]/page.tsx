import type { Metadata } from 'next';
import { VolcanoEruptionDetail } from '@/components/volcano/VolcanoEruptionDetail';

export const metadata: Metadata = {
  title: 'Informasi Letusan',
  description: 'Detail informasi letusan resmi MAGMA/PVMBG.',
};

export default function ErupsiDetailPage({ params }: { params: { id: string } }) {
  return <VolcanoEruptionDetail id={params.id} />;
}
