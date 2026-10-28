import type { Metadata } from 'next';
import { VolcanoGallery } from '@/components/volcano/VolcanoMedia';

export const metadata: Metadata = {
  title: 'Gallery Gunung Api',
  description: 'Dokumentasi visual pengamatan gunung api resmi MAGMA/PVMBG.',
};

export default function GalleryPage() {
  return <VolcanoGallery />;
}
