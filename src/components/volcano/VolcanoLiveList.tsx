'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ExternalLink, Play, Youtube } from 'lucide-react';
import { PageTitle, Panel } from '@/components/ui/common';
import { LIVE_STREAMS, liveStreamThumbnail, liveStreamUrl } from '@/lib/volcano/live';
import type { VolcanoLiveStream } from '@/lib/volcano/live';
import { Disclaimer } from './layout';
import { VolcanoLevelBadge } from './parts';

/**
 * Daftar siaran langsung YouTube gunung api.
 *
 * Halaman ini hanya menampilkan thumbnail dan keterangan ringkas; pemutar
 * video baru dimuat setelah pengguna membuka halaman siaran. Dengan begitu
 * membuka daftar tidak memuat pemutar YouTube sama sekali, sehingga ringan dan
 * tidak menjalankan skrip pihak ketiga sebelum diminta.
 */
export function VolcanoLiveList() {
  const [channel, setChannel] = useState<string | null>(null);

  const channels = useMemo(
    () => Array.from(new Set(LIVE_STREAMS.map((stream) => stream.channel))).sort((a, b) => a.localeCompare(b, 'id')),
    [],
  );

  const streams = useMemo(
    () => (channel ? LIVE_STREAMS.filter((stream) => stream.channel === channel) : LIVE_STREAMS),
    [channel],
  );

  return (
    <div className="min-w-0">
      {/* Setiap halaman lain memakai PageTitle; tanpa ini halaman siaran
          langsung kehilangan heading utama untuk pembaca layar dan navigasi. */}
      <PageTitle
        title="Live YouTube Gunung Api"
        hint="Siaran langsung pemantauan gunung api Indonesia dari kanal Badan Geologi dan penyedia lain. Thumbnail dimuat di sini; video baru diputar setelah Anda membuka halaman siaran."
      />

      <div className="mb-4 rounded-lg border border-line bg-surface px-3 py-2.5 text-xs">
        <p className="flex items-start gap-2">
          <Youtube size={14} aria-hidden className="mt-0.5 shrink-0 text-[#CC0000] dark:text-[#FF6B6B]" />
          <span>
            <strong>{LIVE_STREAMS.length} siaran langsung</strong> dari {channels.length} kanal penyedia. Thumbnail
            dimuat di sini; video baru diputar setelah Anda membuka halamannya, sehingga halaman ini tetap ringan.
            Siaran dikelola pihak lain — bila tampak gelap atau terputus, kanal penyedia sedang tidak mengudara.
          </span>
        </p>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => setChannel(null)}
          aria-pressed={channel === null}
          className={`min-h-8 rounded-md border px-2.5 text-xs font-medium ${
            channel === null ? 'border-accent bg-accent/10 text-ink' : 'border-line text-muted hover:bg-line/40 hover:text-ink'
          }`}
        >
          Semua kanal
        </button>
        {channels.map((name) => (
          <button
            key={name}
            type="button"
            onClick={() => setChannel(channel === name ? null : name)}
            aria-pressed={channel === name}
            className={`min-h-8 rounded-md border px-2.5 text-xs font-medium ${
              channel === name ? 'border-accent bg-accent/10 text-ink' : 'border-line text-muted hover:bg-line/40 hover:text-ink'
            }`}
          >
            {name}
          </button>
        ))}
      </div>

      <ul className="grid w-full min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {streams.map((stream) => (
          <li key={stream.videoId} className="min-w-0">
            <LiveCard stream={stream} />
          </li>
        ))}
      </ul>

      <Disclaimer>
        Siaran langsung diproduksi kanal penyedia di YouTube, bukan oleh Seismos. Status gunung api yang berlaku
        adalah keterangan resmi PVMBG/Badan Geologi; rekaman kamera tidak dapat dipakai untuk menyimpulkan status.
      </Disclaimer>
    </div>
  );
}

function LiveCard({ stream }: { stream: VolcanoLiveStream }) {
  return (
    <Link
      href={`/gunung-berapi/live-youtube/${stream.videoId}`}
      className="group flex h-full min-w-0 flex-col overflow-hidden rounded-lg border border-line bg-surface hover:border-accent/60"
    >
      <span className="relative block aspect-video w-full overflow-hidden bg-bg">
        {/* Thumbnail YouTube: gambar biasa, jadi tidak ada skrip pihak ketiga di sini. */}
        <img
          src={liveStreamThumbnail(stream.videoId, false)}
          alt={`Thumbnail siaran ${stream.title}`}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
        />
        <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded bg-[#CC0000] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
          <span aria-hidden className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
          Live
        </span>
        <span className="absolute inset-0 flex items-center justify-center bg-black/25 opacity-0 transition-opacity group-hover:opacity-100">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-black/70 px-3 py-1.5 text-xs font-medium text-white">
            <Play size={13} aria-hidden /> Putar siaran
          </span>
        </span>
      </span>

      <span className="flex min-w-0 flex-1 flex-col gap-1 px-3 py-2.5">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-sm font-semibold">Gunung {stream.volcano}</span>
          {stream.level !== null && <VolcanoLevelBadge level={stream.level} compact />}
        </span>
        <span className="line-clamp-2 text-xs text-muted">{stream.title}</span>
        <span className="mt-auto flex items-center gap-1.5 pt-1 text-[11px] text-muted">
          <Youtube size={11} aria-hidden /> {stream.channel}
        </span>
      </span>
    </Link>
  );
}

/** Panel kecil untuk menyematkan daftar siaran di halaman gunung api. */
export function LiveStreamInlineLinks({ volcano }: { volcano: string }) {
  const own = LIVE_STREAMS.filter((stream) => stream.volcano.toLowerCase() === volcano.toLowerCase());
  if (own.length === 0) return null;
  return (
    <Panel title={`Siaran langsung Gunung ${volcano}`}>
      <ul className="divide-y divide-line text-sm">
        {own.map((stream) => (
          <li key={stream.videoId} className="flex min-w-0 items-center gap-2 px-4 py-2">
            <Youtube size={13} aria-hidden className="shrink-0 text-[#CC0000] dark:text-[#FF6B6B]" />
            <Link href={`/gunung-berapi/live-youtube/${stream.videoId}`} className="min-w-0 flex-1 truncate font-medium text-accent underline">
              {stream.channel}
            </Link>
            <a
              href={liveStreamUrl(stream.videoId)}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 text-[11px] text-muted underline"
            >
              YouTube <ExternalLink size={9} aria-hidden className="inline" />
            </a>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
