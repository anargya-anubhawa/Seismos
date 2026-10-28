import type { Metadata } from 'next';
import { VolcanoCameras } from '@/components/volcano/VolcanoCameras';

export const metadata: Metadata = {
  title: 'CCTV Gunung Api',
  description: 'Gambar kamera pemantau gunung api resmi MAGMA/PVMBG beserta waktu pengambilan.',
};

export default function CctvPage() {
  return <VolcanoCameras />;
}
