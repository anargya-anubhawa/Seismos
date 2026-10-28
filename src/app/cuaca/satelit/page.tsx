import type { Metadata } from 'next';
import { SatellitePage } from '@/components/weather/SatellitePage';

export const metadata: Metadata = {
  title: 'Satelit',
  description: 'Citra satelit cuaca resmi BMKG: Himawari-9, GEO-KOMPSAT-2A, GSMaP, titik panas, asap, abu vulkanik, dan petir.',
};

export default function SatelitPage() {
  return <SatellitePage />;
}
