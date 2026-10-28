import type { Metadata } from 'next';
import { VolcanoReportList } from '@/components/volcano/VolcanoReportList';

export const metadata: Metadata = {
  title: 'Laporan Harian Gunung Api',
  description: 'Laporan harian resmi MAGMA/PVMBG untuk gunung api yang diamati.',
};

export default function LaporanHarianPage() {
  return <VolcanoReportList kind="harian" />;
}
