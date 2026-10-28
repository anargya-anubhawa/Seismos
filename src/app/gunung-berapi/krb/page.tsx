import type { Metadata } from 'next';
import { VolcanoKrb } from '@/components/volcano/VolcanoKrb';

export const metadata: Metadata = {
  title: 'Peta KRB Gunung Api',
  description: 'Peta Kawasan Rawan Bencana resmi PVMBG melalui MAGMA Indonesia.',
};

export default function KrbPage() {
  return <VolcanoKrb />;
}
