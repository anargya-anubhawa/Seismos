'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { ArrowLeft, Camera, ChevronRight, FileText, Radio } from 'lucide-react';
import { LoadingNotice, Panel, Skeleton } from '@/components/ui/common';
import { useVolcanoQuery } from '@/hooks/useVolcano';
import type { VolcanoDetail } from '@/types/volcano';
import type { VolcanoReportPayload } from '@/types/volcano-ui';
import { CameraGallery, ReportCard, SourceImage, VolcanoLevelBadge } from './parts';
import { Disclaimer, OfflineNotice, VolcanoEmpty, VolcanoErrorBox, VolcanoPage } from './layout';

type DetailPayload = VolcanoDetail & { error?: string };

/**
 * Subhalaman konteks gunung api (laporan, CCTV, seismogram, KRB). Data diambil
 * dari endpoint yang sama dengan halaman fitur, lalu disaring untuk gunung api
 * yang sedang dibuka sehingga pengguna tidak kehilangan konteks.
 */
export function VolcanoDetailSection({
  code,
  section,
}: {
  code: string;
  section: 'laporan' | 'cctv' | 'seismogram' | 'krb';
}) {
  const query = useVolcanoQuery<DetailPayload>(`/api/volcano/volcano/${encodeURIComponent(code)}`, { pollMs: 180_000 });
  const reports = useVolcanoQuery<VolcanoReportPayload>(
    `/api/volcano/laporan?size=40&volcano=${encodeURIComponent(code.toUpperCase())}`,
    { pollMs: 300_000 },
  );

  const volcano = query.data?.volcano ?? null;
  const base = `/gunung-berapi/${code.toLowerCase()}`;

  const volcanoReports = useMemo(
    () => (reports.data?.reports ?? []).filter((report) => report.volcanoCode.toUpperCase() === code.toUpperCase()),
    [reports.data?.reports, code],
  );

  if (query.loading && !query.data) {
    return (
      <VolcanoPage title={`Gunung ${code.toUpperCase()}`}>
        <LoadingNotice>Mengambil data gunung api dari MAGMA…</LoadingNotice>
        <Skeleton className="h-32 w-full" />
      </VolcanoPage>
    );
  }

  if (!volcano) {
    return (
      <VolcanoPage title={`Gunung ${code.toUpperCase()}`}>
        <OfflineNotice offline={query.offline} />
        <VolcanoErrorBox message={query.data?.error ?? query.error ?? 'Data gunung api tidak tersedia.'} retry={() => void query.refresh()} />
        <Link href="/gunung-berapi/status" className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-accent underline">
          <ArrowLeft size={13} aria-hidden /> Daftar status gunung api
        </Link>
      </VolcanoPage>
    );
  }

  const titles: Record<typeof section, string> = {
    laporan: 'Laporan Aktivitas',
    cctv: 'CCTV',
    seismogram: 'Live Seismogram',
    krb: 'Peta KRB',
  };

  return (
    <VolcanoPage
      title={`${titles[section]} — Gunung ${volcano.name}`}
      hint={`${volcano.province} · status ${volcano.levelLabel}`}
      updatedAt={query.data?.updatedAt}
      errors={query.data?.errors ?? []}
    >
      <OfflineNotice offline={query.offline || reports.offline} />

      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
        <VolcanoLevelBadge level={volcano.level} compact />
        <Link href={base} className="inline-flex min-h-8 items-center gap-1 rounded-md border border-line px-2 font-medium">
          <ArrowLeft size={11} aria-hidden /> Detail gunung api
        </Link>
        <Link href={`${base}/laporan`} className="inline-flex min-h-8 items-center gap-1 rounded-md border border-line px-2 font-medium"><FileText size={11} aria-hidden /> Laporan</Link>
        <Link href={`${base}/cctv`} className="inline-flex min-h-8 items-center gap-1 rounded-md border border-line px-2 font-medium"><Camera size={11} aria-hidden /> CCTV</Link>
        <Link href={`${base}/seismogram`} className="inline-flex min-h-8 items-center gap-1 rounded-md border border-line px-2 font-medium"><Radio size={11} aria-hidden /> Seismogram</Link>
        <Link href={`${base}/krb`} className="inline-flex min-h-8 items-center gap-1 rounded-md border border-line px-2 font-medium">KRB</Link>
      </div>

      {section === 'laporan' && (
        <>
          {reports.loading && !reports.data ? (
            <LoadingNotice>Mengambil laporan aktivitas…</LoadingNotice>
          ) : volcanoReports.length === 0 ? (
            <VolcanoEmpty title="Belum ada laporan aktivitas pada daftar terbaru MAGMA">
              Laporan aktivitas diterbitkan per periode pengamatan. <Link href="/gunung-berapi/laporan" className="text-accent underline">Lihat semua laporan</Link>.
            </VolcanoEmpty>
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {volcanoReports.map((report) => <ReportCard key={report.id} report={report} showVolcano={false} />)}
            </div>
          )}
        </>
      )}

      {section === 'cctv' && (
        (query.data?.cameras ?? []).length === 0 ? (
          <VolcanoEmpty title="Tidak ada kamera CCTV terdaftar untuk gunung ini">
            MAGMA tidak menyertakan kamera untuk gunung api ini pada daftar CCTV publik.{' '}
            <a href="https://magma.esdm.go.id/v1/gunung-api/cctv" target="_blank" rel="noopener noreferrer" className="text-accent underline">Periksa CCTV MAGMA</a>.
          </VolcanoEmpty>
        ) : (
          <CameraGallery cameras={query.data!.cameras} label={`${volcano.name} — MAGMA`} />
        )
      )}

      {section === 'seismogram' && (
        (query.data?.seismograms ?? []).length === 0 ? (
          <VolcanoEmpty title="Tidak ada stasiun seismograf untuk gunung ini">
            <Link href="/gunung-berapi/seismogram" className="text-accent underline">Buka Live Seismogram semua gunung api</Link>
          </VolcanoEmpty>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {query.data!.seismograms.map((station) => (
              <li key={station.id} className="overflow-hidden rounded-lg border border-line bg-surface">
                <div className="px-3 py-2 text-xs">
                  <p className="truncate font-semibold">{station.station || station.scnl}</p>
                  <p className="truncate text-muted">{station.scnl}{station.channel ? ` · ${station.channel}` : ''}</p>
                </div>
                <div className="border-y border-line bg-white">
                  <SourceImage
                    src={station.imagePath}
                    alt={`Seismogram stasiun ${station.scnl} Gunung ${volcano.name}`}
                    className="block aspect-[5/3] w-full object-contain"
                  />
                </div>
                <div className="px-3 py-1.5 text-xs">
                  <a href={station.pageUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-accent underline">Buka di MAGMA</a>
                </div>
              </li>
            ))}
          </ul>
        )
      )}

      {section === 'krb' && (
        !query.data?.krb ? (
          <VolcanoEmpty title="Tidak ada berkas peta KRB untuk gunung ini">
            <Link href="/gunung-berapi/krb" className="text-accent underline">Lihat daftar semua peta KRB</Link>.
          </VolcanoEmpty>
        ) : (
          <Panel title={`Peta KRB${query.data.krb.year ? ` ${query.data.krb.year}` : ''}`}>
            <div className="bg-white p-2">
              <SourceImage
                eager
                src={query.data.krb.imagePath}
                alt={`Peta KRB Gunung ${volcano.name}`}
                className="mx-auto block w-full object-contain"
              />
            </div>
            <p className="flex flex-wrap items-center gap-2 border-t border-line px-3 py-2 text-xs">
              <span className="text-muted">Gambar peta resmi PVMBG melalui MAGMA.</span>
              <a href={query.data.krb.downloadPath} className="ml-auto inline-flex min-h-8 items-center rounded-md border border-line px-2 font-medium">Unduh berkas</a>
              <a href={query.data.krb.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-8 items-center rounded-md border border-line px-2 font-medium">Berkas sumber</a>
            </p>
          </Panel>
        )
      )}

      <div className="mt-4">
        <Link href={base} className="inline-flex items-center gap-1 text-sm font-medium text-accent underline">
          Kembali ke detail Gunung {volcano.name} <ChevronRight size={12} aria-hidden />
        </Link>
      </div>

      <Disclaimer>
        Data berasal dari MAGMA Indonesia/PVMBG. Interpretasi peta KRB dan rekomendasi keselamatan mengikuti dokumen
        resmi instansi berwenang.
      </Disclaimer>
    </VolcanoPage>
  );
}
