import type { Metadata } from 'next';
import { VolcanoDetailSection } from '@/components/volcano/VolcanoDetailSection';

export const metadata: Metadata = {
  title: 'Gunung Api — krb',
  description: 'Data resmi MAGMA/PVMBG untuk gunung api terpilih.',
};

export default function Page({ params }: { params: { kode: string } }) {
  return <VolcanoDetailSection code={params.kode} section="krb" />;
}
