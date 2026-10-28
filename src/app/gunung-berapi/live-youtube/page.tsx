import type { Metadata } from 'next';
import { VolcanoLiveList } from '@/components/volcano/VolcanoLiveList';

export const metadata: Metadata = {
  title: 'Live YouTube Gunung Api',
  description:
    'Daftar siaran langsung YouTube pemantauan gunung api Indonesia dari Badan Geologi dan kanal pemantau, beserta penjelasan tiap gunung.',
};

export default function LiveYoutubePage() {
  return <VolcanoLiveList />;
}
