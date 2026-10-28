import type { Metadata } from 'next';
import { TsunamiDetail } from '@/components/tsunami/TsunamiDetail';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Detail Peringatan Tsunami',
  description: 'Detail resmi peringatan tsunami BMKG: status, waktu terbit, gempa pemicu, wilayah pesisir, pengamatan muka laut, dan riwayat pembaruan.',
};

export default function TsunamiDetailPage({ params }: { params: { id: string } }) {
  return <TsunamiDetail id={params.id} />;
}
