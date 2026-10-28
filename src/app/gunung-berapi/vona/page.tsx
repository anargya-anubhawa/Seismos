import type { Metadata } from 'next';
import { VolcanoVona } from '@/components/volcano/VolcanoMedia';

export const metadata: Metadata = {
  title: 'VONA Gunung Api',
  description: 'VONA (Volcano Observatory Notice for Aviation) resmi MAGMA/PVMBG.',
};

export default function VonaPage() {
  return <VolcanoVona />;
}
