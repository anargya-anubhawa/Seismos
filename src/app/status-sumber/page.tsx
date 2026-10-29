import type { Metadata } from 'next';
import { SourceHealth } from '@/components/ui/SourceHealth';

export const metadata: Metadata = {
  title: 'Status Sumber Data',
  description:
    'Kesehatan sumber data resmi Seismos: BMKG (gempa, tsunami, cuaca) dan MAGMA/PVMBG (gunung api).',
};

export default function StatusSumberPage() {
  return <SourceHealth />;
}
