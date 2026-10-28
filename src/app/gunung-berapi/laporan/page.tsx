import type { Metadata } from 'next';
import { VolcanoReportList } from '@/components/volcano/VolcanoReportList';

export const metadata: Metadata = {
  title: 'Laporan Aktivitas Gunung Api',
  description: 'Laporan aktivitas (VAR) resmi MAGMA/PVMBG per periode pengamatan beserta rekomendasi.',
};

export default function LaporanAktivitasPage() {
  return <VolcanoReportList kind="aktivitas" />;
}
