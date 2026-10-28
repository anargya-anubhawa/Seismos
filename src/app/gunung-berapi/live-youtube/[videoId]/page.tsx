import type { Metadata } from 'next';
import { VolcanoLiveDetail } from '@/components/volcano/VolcanoLiveDetail';
import { findLiveStream } from '@/lib/volcano/live';

export function generateMetadata({ params }: { params: { videoId: string } }): Metadata {
  const stream = findLiveStream(params.videoId);
  if (!stream) {
    return { title: 'Siaran langsung tidak ditemukan' };
  }
  return {
    title: `Siaran Langsung Gunung ${stream.volcano} — ${stream.channel}`,
    description: `Tonton siaran langsung Gunung ${stream.volcano} dari kanal ${stream.channel}, beserta penjelasan karakter gunung api tersebut.`,
  };
}

export default function LiveYoutubeDetailPage({ params }: { params: { videoId: string } }) {
  return <VolcanoLiveDetail videoId={params.videoId} />;
}
