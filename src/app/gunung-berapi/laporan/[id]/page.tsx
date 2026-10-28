import type { Metadata } from 'next';
import { VolcanoReportDetail } from '@/components/volcano/VolcanoReportDetail';

export const metadata: Metadata = {
  title: 'Detail Laporan Gunung Api',
  description: 'Laporan resmi MAGMA/PVMBG: pengamatan visual, kegempaan, klimatologi, dan rekomendasi lengkap.',
};

export default function LaporanDetailPage({ params }: { params: { id: string } }) {
  const kind = params.id.startsWith('harian-') ? 'harian' : 'aktivitas';
  return <VolcanoReportDetail id={params.id} kind={kind} />;
}
