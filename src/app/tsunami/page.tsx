import type { Metadata } from 'next';
import { TsunamiContent } from '@/components/tsunami/TsunamiContent';

export const metadata: Metadata = {
  title: 'Peringatan Tsunami',
  description: 'Status peringatan tsunami resmi BMKG/InaTEWS: gempa pemicu, wilayah pesisir, pembaruan, ETA resmi bila tersedia, dan panduan keselamatan.',
};

export default function TsunamiPage() {
  return <TsunamiContent />;
}
