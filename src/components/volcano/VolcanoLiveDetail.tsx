'use client';

import Link from 'next/link';
import { ArrowLeft, ExternalLink, Info, Youtube } from 'lucide-react';
import { Panel } from '@/components/ui/common';
import { CopyLinkButton, ShareMenu } from '@/components/share/ShareActions';
import { SOURCE_MAGMA, creditLines } from '@/lib/share/report-text';
import {
  LIVE_STREAMS, findLiveStream, liveStreamEmbedUrl, liveStreamUrl,
} from '@/lib/volcano/live';
import { Disclaimer } from './layout';
import { VolcanoLevelBadge } from './parts';

/**
 * Halaman satu siaran langsung YouTube.
 *
 * Pemutar (`iframe`) baru dimuat di halaman ini, bukan di daftar, sehingga
 * membuka menu Live YouTube tidak memuat skrip YouTube. Penjelasan gunung api
 * ditulis dari fakta PVMBG yang terbuka untuk umum; siaran itu sendiri
 * dijalankan kanal penyedia.
 */
export function VolcanoLiveDetail({ videoId }: { videoId: string }) {
  const stream = findLiveStream(videoId);

  if (!stream) {
    return (
      <div className="min-w-0">
        <Link href="/gunung-berapi/live-youtube" className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
          <ArrowLeft size={14} aria-hidden /> Semua siaran langsung
        </Link>
        <Panel title="Siaran tidak ditemukan">
          <p className="px-4 py-4 text-sm text-muted">
            Video <code className="font-mono text-xs">{videoId}</code> tidak ada pada daftar siaran yang dipakai
            aplikasi. Buka daftar siaran untuk memilih kanal yang tersedia.
          </p>
        </Panel>
      </div>
    );
  }

  const others = LIVE_STREAMS.filter((item) => item.videoId !== stream.videoId && item.volcano === stream.volcano);
  const alsoFromChannel = LIVE_STREAMS.filter((item) => item.videoId !== stream.videoId && item.channel === stream.channel);

  return (
    <div className="min-w-0">
      <Link href="/gunung-berapi/live-youtube" className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
        <ArrowLeft size={14} aria-hidden /> Semua siaran langsung
      </Link>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
        <div className="min-w-0 space-y-4">
          <Panel className="min-w-0 overflow-hidden" title={`Siaran langsung — Gunung ${stream.volcano}`}>
            <div className="aspect-video w-full bg-black">
              <iframe
                src={liveStreamEmbedUrl(stream.videoId)}
                title={stream.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
                className="h-full w-full border-0"
              />
            </div>
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line px-3 py-2 text-[11px] text-muted">
              <span className="inline-flex items-center gap-1">
                <Youtube size={11} aria-hidden /> {stream.channel}
              </span>
              {stream.level !== null && <VolcanoLevelBadge level={stream.level} compact />}
              <a
                href={liveStreamUrl(stream.videoId)}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto inline-flex items-center gap-1 underline"
              >
                Buka di YouTube <ExternalLink size={10} aria-hidden />
              </a>
            </p>
          </Panel>

          <Panel className="min-w-0" title={`Tentang Gunung ${stream.volcano}`}>
            <div className="space-y-3 px-4 py-3">
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted">
                <span className="rounded-full border border-line px-2 py-0.5">{stream.location}</span>
              </p>
              <p className="text-sm leading-relaxed [overflow-wrap:anywhere]">{stream.description}</p>
              <p className="flex items-start gap-1.5 rounded-md border border-line bg-bg/40 px-2.5 py-2 text-xs text-muted">
                <Info size={12} aria-hidden className="mt-0.5 shrink-0" />
                <span className="min-w-0">{stream.watchingTips}</span>
              </p>
            </div>
          </Panel>
        </div>

        <div className="min-w-0 space-y-4">
          <Panel className="min-w-0" title="Bagikan siaran">
            <div className="space-y-3 px-4 py-3">
              <div className="flex flex-wrap gap-2">
                <CopyLinkButton label="Salin tautan" path={`/gunung-berapi/live-youtube/${stream.videoId}`} />
                <ShareMenu
                  title={`Siaran langsung Gunung ${stream.volcano} — Seismos Indonesia`}
                  text={[
                    `SIARAN LANGSUNG — GUNUNG ${stream.volcano.toUpperCase()}`,
                    stream.title,
                    `Kanal: ${stream.channel}`,
                    `Lokasi: ${stream.location}`,
                    '',
                    stream.description,
                    '',
                    `Tonton: ${liveStreamUrl(stream.videoId)}`,
                    '',
                    creditLines('Seismos Indonesia', SOURCE_MAGMA),
                  ].join('\n')}
                />
              </div>
              <p className="text-[11px] leading-relaxed text-muted">
                Siaran dijalankan kanal penyedia. Status resmi gunung api selalu mengikuti PVMBG/Badan Geologi.
              </p>
            </div>
          </Panel>

          {(others.length > 0 || alsoFromChannel.length > 0) && (
            <Panel className="min-w-0" title="Siaran lain">
              <ul className="divide-y divide-line text-sm">
                {others.map((item) => (
                  <li key={item.videoId} className="min-w-0 px-4 py-2">
                    <Link href={`/gunung-berapi/live-youtube/${item.videoId}`} className="block min-w-0 truncate font-medium text-accent underline">
                      {item.channel} — Gunung {item.volcano}
                    </Link>
                  </li>
                ))}
                {alsoFromChannel.map((item) => (
                  <li key={item.videoId} className="min-w-0 px-4 py-2">
                    <Link href={`/gunung-berapi/live-youtube/${item.videoId}`} className="block min-w-0 truncate font-medium text-accent underline">
                      Gunung {item.volcano}
                    </Link>
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          <Panel className="min-w-0" title="Periksa status resmi">
            <ul className="divide-y divide-line text-sm">
              <li className="px-4 py-2">
                <a href={stream.statusUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-accent underline">
                  Tingkat aktivitas PVMBG <ExternalLink size={10} aria-hidden />
                </a>
              </li>
              <li className="px-4 py-2">
                <Link href="/gunung-berapi" className="font-medium text-accent underline">Daftar gunung api</Link>
              </li>
            </ul>
          </Panel>
        </div>
      </div>

      <Disclaimer>
        Video disiarkan melalui YouTube oleh kanal penyedia dan dapat berhenti sewaktu-waktu. Seismos tidak
        mengendalikan isi siaran serta tidak menyimpulkan status gunung api dari gambar kamera.
      </Disclaimer>
    </div>
  );
}
