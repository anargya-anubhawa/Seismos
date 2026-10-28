'use client';

import Link from 'next/link';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { LoadingNotice, Panel } from '@/components/ui/common';
import { fmtAgo, fmtTime } from '@/lib/formatting';
import { useVolcanoQuery } from '@/hooks/useVolcano';
import type { EruptionEvent } from '@/types/volcano';
import { VolcanoLink } from './parts';
import { Disclaimer, OfflineNotice, VolcanoEmpty, VolcanoErrorBox, VolcanoPage } from './layout';

/** Detail satu informasi letusan (VEN) resmi beserta rekomendasi. */
export function VolcanoEruptionDetail({ id }: { id: string }) {
  const query = useVolcanoQuery<{ eruption?: EruptionEvent | null; error?: string }>(
    `/api/volcano/erupsi/${encodeURIComponent(id)}`,
  );

  if (query.loading && !query.data) {
    return (
      <VolcanoPage title="Informasi Letusan">
        <LoadingNotice>Mengambil informasi letusan dari MAGMA…</LoadingNotice>
      </VolcanoPage>
    );
  }

  const event = query.data?.eruption ?? null;
  if (!event) {
    return (
      <VolcanoPage title="Informasi Letusan">
        <OfflineNotice offline={query.offline} />
        <VolcanoEmpty title="Informasi letusan tidak ditemukan">
          Informasi letusan ini tidak tersedia pada API publik MAGMA. Lihat daftar informasi letusan terbaru.
        </VolcanoEmpty>
        <Link href="/gunung-berapi/erupsi" className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-accent underline">
          <ArrowLeft size={13} aria-hidden /> Kembali ke riwayat erupsi
        </Link>
      </VolcanoPage>
    );
  }

  return (
    <VolcanoPage
      title={`Informasi Letusan — ${event.volcanoName}`}
      hint={`Kejadian ${fmtTime(event.occurredAt)} (${fmtAgo(event.occurredAt)})`}
      updatedAt={query.updatedAt}
    >
      <OfflineNotice offline={query.offline} />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <Panel title="Informasi kejadian (teks resmi)">
            <p className="whitespace-pre-line px-4 py-3 text-sm">
              {event.information || 'MAGMA tidak mencantumkan teks informasi letusan untuk kejadian ini.'}
            </p>
          </Panel>
          <Panel title="Rekomendasi resmi PVMBG">
            <p className="whitespace-pre-line px-4 py-3 text-sm">
              {event.recommendation || 'Rekomendasi tidak tercantum pada informasi letusan ini.'}
            </p>
          </Panel>
        </div>
        <div className="space-y-3">
          <Panel title="Parameter yang diterbitkan">
            <dl className="space-y-1.5 px-4 py-3 text-xs">
              <div><dt className="inline font-semibold">Gunung api: </dt><dd className="inline"><VolcanoLink code={event.volcanoCode} name={event.volcanoName} /></dd></div>
              <div><dt className="inline font-semibold">Waktu kejadian: </dt><dd className="inline text-muted">{fmtTime(event.occurredAt)}</dd></div>
              <div><dt className="inline font-semibold">Tinggi kolom abu: </dt><dd className="inline text-muted">{event.ashHeightM !== null && event.ashHeightM > 0 ? `${event.ashHeightM} m` : 'tidak teramati / tidak tercantum'}</dd></div>
              <div><dt className="inline font-semibold">Durasi: </dt><dd className="inline text-muted">{event.durationSeconds !== null ? `${event.durationSeconds} detik` : 'tidak tercantum'}</dd></div>
              {event.zoneArea && <div><dt className="inline font-semibold">Zona: </dt><dd className="inline text-muted">{event.zoneArea}</dd></div>}
              <div><dt className="inline font-semibold">Penyusun: </dt><dd className="inline text-muted">{event.author ?? 'tidak tercantum'}</dd></div>
              {event.latitude !== null && event.longitude !== null && (
                <div><dt className="inline font-semibold">Koordinat: </dt><dd className="inline text-muted">{event.latitude.toFixed(3)}, {event.longitude.toFixed(3)}</dd></div>
              )}
              <div className="pt-1">
                <a href={event.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-accent underline">
                  Informasi letusan MAGMA <ExternalLink size={11} aria-hidden />
                </a>
              </div>
            </dl>
          </Panel>
          <Panel title="Navigasi">
            <div className="flex flex-wrap gap-2 px-4 py-3 text-xs">
              <Link href={`/gunung-berapi/${event.volcanoCode.toLowerCase()}`} className="inline-flex min-h-9 items-center gap-1 rounded-md border border-line px-2 font-medium">
                <ArrowLeft size={12} aria-hidden /> Detail gunung api
              </Link>
              <Link href="/gunung-berapi/erupsi" className="inline-flex min-h-9 items-center rounded-md border border-line px-2 font-medium">
                Semua letusan
              </Link>
            </div>
          </Panel>
        </div>
      </div>

      <Disclaimer>
        Informasi letusan berasal dari VEN MAGMA. Kejadian yang tidak memiliki VEN resmi tidak ditampilkan sebagai
        erupsi di Seismos, meskipun status aktivitas gunung api meningkat.
      </Disclaimer>
    </VolcanoPage>
  );
}
