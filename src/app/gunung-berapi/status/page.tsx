import type { Metadata } from 'next';
import { VolcanoStatusTable } from '@/components/volcano/VolcanoStatusTable';

export const metadata: Metadata = {
  title: 'Status Aktivitas Gunung Api',
  description: 'Tingkat aktivitas resmi PVMBG: Level I Normal, II Waspada, III Siaga, IV Awas.',
};

export default function StatusPage() {
  return <VolcanoStatusTable />;
}
