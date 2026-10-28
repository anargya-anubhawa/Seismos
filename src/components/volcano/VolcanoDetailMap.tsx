'use client';

import Link from 'next/link';
import { ArrowLeft, ExternalLink, MapPin } from 'lucide-react';
import { LoadingNotice, Panel, Skeleton } from '@/components/ui/common';
import { fmtTime } from '@/lib/formatting';
import { useVolcanoQuery } from '@/hooks/useVolcano';
import { MAGMA_SOURCES } from '@/lib/volcano/magma';
import type { VolcanoDetail } from '@/types/volcano';
import { VolcanoLevelBadge } from './parts';
import { Disclaimer, OfflineNotice, VolcanoErrorBox, VolcanoPage } from './layout';
import { VolcanoMapLazy } from './VolcanoMapLazy';

type Payload = VolcanoDetail & { error?: string };

/**
 * Peta lokasi satu gunung api.
 *
 * Memakai komponen peta yang sama dengan halaman Peta Sebaran, tetapi hanya
 * memuat gunung api ini saja sehingga penanda langsung berada di pusat peta.
 * Koordinat berasal dari MAGMA; tidak ada titik yang diperkirakan aplikasi.
 */
export function VolcanoDetailMap({ code }: { code: string }) {
  const query = useVolcanoQuery<Payload>(`/api/volcano/volcano/${encodeURIComponent(code)}`, { pollMs: 300_000 });
  const volcano = query.data?.volcano ?? null;
  const base = `/gunung-berapi/${code.toLowerCase()}`;

  if (query.loading && !query.data) {
    return (
      <VolcanoPage title={`Peta Gunung ${code.toUpperCase()}`}>
        <LoadingNotice>Mengambil koordinat gunung api dari MAGMA…</LoadingNotice>
        <Skeleton className="h-72 w-full" />
      </VolcanoPage>
    );
  }

  if (!volcano) {
    return (
      <VolcanoPage title={`Peta Gunung ${code.toUpperCase()}`}>
        <OfflineNotice offline={query.offline} />
        <VolcanoErrorBox
          message={query.data?.error ?? query.error ?? 'Koordinat gunung api tidak tersedia.'}
          retry={() => void query.refresh()}
        />
        <Link href="/gunung-berapi" className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-accent underline">
          <ArrowLeft size={13} aria-hidden /> Daftar gunung api
        </Link>
      </VolcanoPage>
    );
  }

  return (
    <VolcanoPage
      title={`Peta Gunung ${volcano.name}`}
      hint={`${volcano.province} · ${volcano.latitude.toFixed(4)}, ${volcano.longitude.toFixed(4)}`}
      updatedAt={query.data?.updatedAt}
      errors={query.data?.errors ?? []}
      code={volcano.code}
    >
      <OfflineNotice offline={query.offline} />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
        <Panel className="min-w-0" title="Lokasi pada peta">
          <div className="p-3">
            <VolcanoMapLazy
              volcanoes={[{
                code: volcano.code,
                name: volcano.name,
                province: volcano.province,
                latitude: volcano.latitude,
                longitude: volcano.longitude,
                level: volcano.level,
                levelLabel: volcano.levelLabel,
              }]}
              selectedCode={volcano.code}
              onSelect={() => undefined}
            />
          </div>
        </Panel>

        <div className="min-w-0 space-y-4">
          <Panel className="min-w-0" title="Keterangan titik">
            <dl className="space-y-1.5 px-4 py-3 text-xs">
              <div className="flex items-baseline justify-between gap-3">
                <dt className="shrink-0 text-muted">Nama resmi</dt>
                <dd className="min-w-0 truncate text-right font-medium">{volcano.name}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="shrink-0 text-muted">Kode MAGMA</dt>
                <dd className="min-w-0 truncate text-right font-mono text-[11px]">{volcano.code}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="shrink-0 text-muted">Lintang</dt>
                <dd className="tabular-nums">{volcano.latitude.toFixed(5)}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="shrink-0 text-muted">Bujur</dt>
                <dd className="tabular-nums">{volcano.longitude.toFixed(5)}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="shrink-0 text-muted">Elevasi</dt>
                <dd className="tabular-nums">{volcano.elevation !== null ? `${Math.round(volcano.elevation)} m` : 'tidak tercantum'}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="shrink-0 text-muted">Data diterima</dt>
                <dd className="min-w-0 text-right">{fmtTime(volcano.receivedAt)}</dd>
              </div>
            </dl>
            <div className="flex flex-wrap items-center gap-2 border-t border-line px-4 py-2.5">
              <VolcanoLevelBadge level={volcano.level} compact />
              <a
                href={MAGMA_SOURCES.status}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto inline-flex min-h-8 items-center gap-1 rounded-md border border-line px-2 text-xs font-medium hover:bg-line/40"
              >
                <MapPin size={11} aria-hidden /> MAGMA <ExternalLink size={10} aria-hidden />
              </a>
            </div>
          </Panel>

          <Panel className="min-w-0" title="Pindah ke">
            <ul className="divide-y divide-line text-xs">
              <li className="px-4 py-2">
                <Link href={base} className="font-medium text-accent underline">Ringkasan Gunung {volcano.name}</Link>
              </li>
              <li className="px-4 py-2">
                <Link href="/gunung-berapi/peta" className="font-medium text-accent underline">Peta sebaran semua gunung api</Link>
              </li>
            </ul>
          </Panel>
        </div>
      </div>

      <Disclaimer>
        Koordinat gunung api berasal dari MAGMA Indonesia/PVMBG. Peta ini hanya menunjukkan posisi, bukan batas
        kawasan rawan bencana.
      </Disclaimer>
    </VolcanoPage>
  );
}
