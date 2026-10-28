import type { Metadata } from 'next';
import { VolcanoNotifications } from '@/components/volcano/VolcanoNotifications';

export const metadata: Metadata = {
  title: 'Notifikasi Gunung Api',
  description: 'Aktifkan dan atur kategori notifikasi gunung api (perubahan tingkat, laporan erupsi, VONA).',
};

export default function NotifikasiPage() {
  return <VolcanoNotifications />;
}
