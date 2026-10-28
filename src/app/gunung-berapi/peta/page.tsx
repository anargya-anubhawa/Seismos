import type { Metadata } from 'next';
import { VolcanoDistribution } from '@/components/volcano/VolcanoDistribution';

export const metadata: Metadata = {
  title: 'Peta Gunung Api',
  description: 'Persebaran gunung api Indonesia dengan koordinat dan tingkat aktivitas resmi MAGMA/PVMBG.',
};

export default function PetaGunungApiPage() {
  return <VolcanoDistribution />;
}
