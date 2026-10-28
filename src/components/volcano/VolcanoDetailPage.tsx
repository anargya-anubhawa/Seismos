'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  ArrowLeft, Camera, ChevronRight, ExternalLink, FileText, MapPin, Mountain, Radio, TrendingDown, TrendingUp,
} from 'lucide-react';
import { LoadingNotice, Panel, Skeleton } from '@/components/ui/common';
import { fmtAgo, fmtTime } from '@/lib/formatting';
import { reportText, volcanoStatusText } from '@/lib/share/report-text';
import { useVolcanoQuery } from '@/hooks/useVolcano';
import type { VolcanoDetail } from '@/types/volcano';
import {
  CameraGallery, GalleryGrid, ReportCard, SourceImage, VonaCard, VolcanoLevelBadge,
} from './parts';
import { Disclaimer, OfflineNotice, VolcanoEmpty, VolcanoErrorBox, VolcanoPage } from './layout';

type Payload = VolcanoDetail & { error?: string };

const SECTION_LINKS = [
  { href: 'laporan', label: 'Laporan aktivitas', icon: FileText },
  { href: 'cctv', label: 'CCTV', icon: Camera },
  { href: 'seismogram', label: 'Seismogram', icon: Radio },
  { href: 'krb', label: 'Peta KRB', icon: MapPin },
];

/** Pusat informasi satu gunung api: status, laporan, riwayat, CCTV, KRB, gallery, seismogram. */
export function VolcanoDetailPage({ code }: { code: string }) {
  const query = useVolcanoQuery<Payload>(`/api/volcano/volcano/${encodeURIComponent(code)}`, { pollMs: 180_000 });
  const [showAllHistory, setShowAllHistory] = useState(false);

  const data = query.data;
  const volcano = data?.volcano ?? null;

  const history = useMemo(() => data?.levelHistory ?? [], [data?.levelHistory]);

  if (query.loading && !data) {
    return (
      <VolcanoPage title="Detail Gunung Api">
        <LoadingNotice>Mengambil data gunung api dari MAGMA…</LoadingNotice>
        <Skeleton className="h-40 w-full" />
      </VolcanoPage>
    );
  }

  if (!volcano) {
    return (
      <VolcanoPage title="Detail Gunung Api">
        <OfflineNotice offline={query.offline} />
        {data?.error?.includes('tidak ada pada daftar') ? (
          <VolcanoEmpty title="Gunung api tidak ditemukan">
            Kode gunung api ini tidak ada pada daftar pemantauan MAGMA. Lihat daftar status aktivitas untuk memilih
            gunung api yang dipantau PVMBG.
          </VolcanoEmpty>
        ) : (
          <VolcanoErrorBox message={data?.error ?? query.error ?? 'Detail tidak tersedia.'} retry={() => void query.refresh()} />
        )}
        <Link href="/gunung-berapi/status" className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-accent underline">
          <ArrowLeft size={13} aria-hidden /> Daftar status gunung api
        </Link>
      </VolcanoPage>
    );
  }

  const base = `/gunung-berapi/${volcano.code.toLowerCase()}`;
  const errors = data?.errors ?? [];

  return (
    <VolcanoPage
      title={`Gunung ${volcano.name}`}
      hint={`${volcano.province} · Kode MAGMA ${volcano.code}`}
      updatedAt={data?.updatedAt}
      errors={errors}
      shareTitle={`Status Gunung ${volcano.name} — Seismos Indonesia`}
      reportText={data?.latestReport
        ? reportText(data.latestReport)
        : volcanoStatusText(volcano)}
      attachments={data?.latestReport?.visualImagePath
        ? [{
            fileName: `visual-${volcano.code.toLowerCase()}-${data.latestReport.date}.png`,
            url: data.latestReport.visualImagePath,
            type: 'image/png',
            label: 'Gambar pengamatan visual (laporan terbaru)',
          }]
        : []}
    >
      <OfflineNotice offline={query.offline} />

      <div className="mb-4 grid gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Panel title="Status aktivitas resmi">
          <div className="space-y-2 px-4 py-3 text-sm">
            <VolcanoLevelBadge level={volcano.level} />
            <p className="text-xs text-muted">
              {volcano.levelLabel}
              {data?.levelChangedAt ? ` · penetapan terakhir ${data.levelChangedAt}` : ''}
            </p>
            <dl className="grid gap-1 text-xs sm:grid-cols-2">
              <div><dt className="inline font-semibold">Koordinat: </dt><dd className="inline text-muted">{volcano.latitude.toFixed(4)}, {volcano.longitude.toFixed(4)}</dd></div>
              <div><dt className="inline font-semibold">Elevasi: </dt><dd className="inline text-muted">{volcano.elevation !== null ? `${Math.round(volcano.elevation)} m` : 'tidak tercantum'}</dd></div>
              <div><dt className="inline font-semibold">Wilayah: </dt><dd className="inline text-muted">{volcano.province}{volcano.city ? ` · ${volcano.city}` : ''}</dd></div>
              <div><dt className="inline font-semibold">Data diterima: </dt><dd className="inline text-muted">{fmtTime(volcano.receivedAt)}</dd></div>
            </dl>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {SECTION_LINKS.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={`${base}/${href}`}
                  className="inline-flex min-h-8 items-center gap-1 rounded-md border border-line px-2 text-xs font-medium hover:bg-line/40"
                >
                  <Icon size={12} aria-hidden /> {label}
                </Link>
              ))}
            </div>
          </div>
        </Panel>

        <Panel title="Pilihan cepat">
          <ul className="divide-y divide-line text-xs">
            <li className="px-4 py-2">
              {data?.latestReport
                ? <Link href={`/gunung-berapi/laporan/${data.latestReport.id}`} className="inline-flex items-center gap-1 font-medium text-accent underline">Laporan aktivitas terbaru ({data.latestReport.date}) <ChevronRight size={11} aria-hidden /></Link>
                : <span className="text-muted">Laporan aktivitas terbaru belum tersedia</span>}
            </li>
            <li className="px-4 py-2">
              {data?.dailyReport
                ? <Link href={`/gunung-berapi/laporan/harian-${data.dailyReport.volcanoCode}`} className="inline-flex items-center gap-1 font-medium text-accent underline">Laporan harian ({data.dailyReport.date}) <ChevronRight size={11} aria-hidden /></Link>
                : <span className="text-muted">Laporan harian belum tersedia</span>}
            </li>
            <li className="px-4 py-2">
              {data?.krb
                ? <Link href={`${base}/krb`} className="inline-flex items-center gap-1 font-medium text-accent underline">Peta KRB tersedia <ChevronRight size={11} aria-hidden /></Link>
                : <span className="text-muted">Tidak ada berkas peta KRB pada daftar MAGMA</span>}
            </li>
            <li className="px-4 py-2">
              {data && data.cameras.length > 0
                ? <Link href={`${base}/cctv`} className="inline-flex items-center gap-1 font-medium text-accent underline">{data.cameras.length} kamera CCTV <ChevronRight size={11} aria-hidden /></Link>
                : <span className="text-muted">Tidak ada kamera CCTV terdaftar</span>}
            </li>
            <li className="px-4 py-2">
              {data && data.seismograms.length > 0
                ? <Link href={`${base}/seismogram`} className="inline-flex items-center gap-1 font-medium text-accent underline">{data.seismograms.length} stasiun seismograf <ChevronRight size={11} aria-hidden /></Link>
                : <span className="text-muted">Tidak ada stasiun seismograf terdaftar</span>}
            </li>
            <li className="px-4 py-2">
              {data && data.eruptions.length > 0
                ? <span className="text-muted">{data.eruptions.length} informasi letusan terbaru tersedia di <Link href="/gunung-berapi/erupsi" className="text-accent underline">riwayat erupsi</Link></span>
                : <span className="text-muted">Tidak ada informasi letusan (VEN) terbaru untuk gunung ini</span>}
            </li>
          </ul>
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="space-y-3">
          <h2 className="text-sm font-semibold">Laporan terbaru</h2>
          {data?.latestReport ? (
            <ReportCard report={data.latestReport} showVolcano={false} />
          ) : (
            <VolcanoEmpty title="Laporan aktivitas belum tersedia">
              MAGMA belum menerbitkan laporan aktivitas untuk gunung ini pada daftar terbaru.
            </VolcanoEmpty>
          )}
          {data?.dailyReport && (
            <>
              <h2 className="text-sm font-semibold">Laporan harian</h2>
              <div className="rounded-lg border border-line bg-surface px-4 py-3 text-sm">
                <p className="text-xs text-muted">{data.dailyReport.date}{data.dailyReport.period ? ` · ${data.dailyReport.period}` : ''}</p>
                <p className="mt-1 line-clamp-4 whitespace-pre-line">{data.dailyReport.visualText || 'Pengamatan visual tidak dicantumkan.'}</p>
                <Link href={`/gunung-berapi/laporan/harian-${data.dailyReport.volcanoCode}`} className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-accent underline">
                  Buka laporan harian <ChevronRight size={11} aria-hidden />
                </Link>
              </div>
            </>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold">Riwayat perubahan tingkat aktivitas</h2>
          {history.length === 0 ? (
            <VolcanoEmpty title="Riwayat tingkat tidak tersedia">
              MAGMA tidak mengembalikan riwayat perubahan tingkat untuk gunung ini. Seismos tidak mengarang riwayat
              sebelum periode data yang tersedia.
            </VolcanoEmpty>
          ) : (
            <Panel>
              <ol className="divide-y divide-line">
                {(showAllHistory ? history : history.slice(0, 6)).map((change) => (
                  <li key={`${change.id}-${change.changeDate}`} className="flex flex-wrap items-center gap-2 px-4 py-2 text-xs">
                    {change.direction === 'NAIK'
                      ? <TrendingUp size={13} aria-hidden className="text-danger" />
                      : <TrendingDown size={13} aria-hidden className="text-ok" />}
                    <span className="font-medium">{change.previousLabel ?? '—'} → {change.currentLabel ?? '—'}</span>
                    <span className="text-muted">{change.changeDate}</span>
                    {change.sourceName && <span className="rounded border border-line px-1 text-[10px] text-muted">{change.sourceName}</span>}
                    {change.durationDays !== null && <span className="ml-auto text-muted">{change.durationDays} hari</span>}
                  </li>
                ))}
              </ol>
              {history.length > 6 && (
                <button
                  type="button"
                  onClick={() => setShowAllHistory((value) => !value)}
                  className="w-full border-t border-line px-4 py-2 text-xs font-medium text-accent"
                >
                  {showAllHistory ? 'Tampilkan lebih sedikit' : `Tampilkan semua (${history.length})`}
                </button>
              )}
            </Panel>
          )}
        </section>
      </div>

      <section className="mt-6">
        <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold"><Mountain size={15} aria-hidden /> Informasi letusan resmi terbaru</h2>
        {!data || data.eruptions.length === 0 ? (
          <VolcanoEmpty title="Tidak ada informasi letusan (VEN) terbaru">
            Status aktivitas yang naik tidak ditampilkan sebagai erupsi. Erupsi hanya ditampilkan bila PVMBG
            menerbitkan informasi letusan.
          </VolcanoEmpty>
        ) : (
          <Panel>
            <ul className="divide-y divide-line">
              {data.eruptions.slice(0, 5).map((event) => (
                <li key={event.id} className="px-4 py-2.5 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{fmtTime(event.occurredAt)}</span>
                    <span className="text-xs text-muted">
                      {event.ashHeightM !== null && event.ashHeightM > 0 ? `kolom abu ${event.ashHeightM} m` : 'kolom abu tidak teramati'}
                      {event.durationSeconds !== null ? ` · ${event.durationSeconds} detik` : ''}
                    </span>
                    <Link href={`/gunung-berapi/erupsi/${event.id}`} className="ml-auto text-xs font-medium text-accent underline">Detail</Link>
                  </div>
                  {event.information && <p className="mt-1 line-clamp-2 text-xs text-muted">{event.information}</p>}
                </li>
              ))}
            </ul>
          </Panel>
        )}
      </section>

      {data && data.vona.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 text-sm font-semibold">VONA</h2>
          <ul className="space-y-2">{data.vona.slice(0, 4).map((notice) => <VonaCard key={notice.id} notice={notice} />)}</ul>
        </section>
      )}

      <section className="mt-6">
        <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold"><Camera size={15} aria-hidden /> CCTV</h2>
        {!data || data.cameras.length === 0 ? (
          <VolcanoEmpty title="Tidak ada kamera CCTV terdaftar untuk gunung ini">
            Buka halaman CCTV resmi MAGMA untuk memeriksa kamera yang aktif.
          </VolcanoEmpty>
        ) : (
          <CameraGallery cameras={data.cameras} label={`${volcano.name} — MAGMA`} />
        )}
      </section>

      <section className="mt-6">
        <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold"><Radio size={15} aria-hidden /> Live seismogram</h2>
        {!data || data.seismograms.length === 0 ? (
          <VolcanoEmpty title="Tidak ada stasiun seismograf untuk gunung ini pada daftar MAGMA">
            <Link href="/gunung-berapi/seismogram" className="text-accent underline">Buka Live Seismogram</Link>
          </VolcanoEmpty>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {data.seismograms.slice(0, 6).map((station) => (
              <li key={station.id} className="overflow-hidden rounded-lg border border-line bg-surface">
                <div className="px-3 py-2 text-xs">
                  <p className="truncate font-semibold">{station.station || station.scnl}</p>
                  <p className="truncate text-muted">{station.scnl}</p>
                </div>
                <div className="border-y border-line bg-white">
                  <SourceImage
                    src={station.imagePath}
                    alt={`Seismogram stasiun ${station.scnl} Gunung ${volcano.name}`}
                    className="block aspect-[5/3] w-full object-contain"
                  />
                </div>
                <div className="flex items-center justify-between px-3 py-1.5 text-xs">
                  <Link href={`${base}/seismogram`} className="font-medium text-accent underline">Semua stasiun</Link>
                  <a href={station.pageUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-muted underline">
                    MAGMA <ExternalLink size={10} aria-hidden />
                  </a>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-6">
        <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold"><MapPin size={15} aria-hidden /> Peta KRB</h2>
        {!data?.krb ? (
          <VolcanoEmpty title="Tidak ada berkas peta KRB untuk gunung ini">
            MAGMA hanya menerbitkan peta KRB untuk sebagian gunung api. <Link href="/gunung-berapi/krb" className="text-accent underline">Lihat semua peta KRB</Link>.
          </VolcanoEmpty>
        ) : (
          <div className="rounded-lg border border-line bg-surface p-3">
            <p className="mb-2 text-xs text-muted">
              Peta KRB {data.krb.year ? `tahun ${data.krb.year}` : ''}{data.krb.description ? ` · ${data.krb.description}` : ''}
            </p>
            <Link href={`${base}/krb`} className="block overflow-hidden rounded border border-line bg-white">
              <SourceImage
                src={data.krb.imagePath}
                alt={`Peta KRB Gunung ${volcano.name}`}
                className="block max-h-72 w-full object-contain"
              />
            </Link>
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              <Link href={`${base}/krb`} className="inline-flex min-h-8 items-center rounded-md border border-line px-2 font-medium">Buka peta penuh</Link>
              <a href={data.krb.downloadPath} className="inline-flex min-h-8 items-center rounded-md border border-line px-2 font-medium">Unduh</a>
            </div>
          </div>
        )}
      </section>

      {data && data.gallery.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 text-sm font-semibold">Gallery</h2>
          <GalleryGrid photos={data.gallery} />
        </section>
      )}

      <section className="mt-6">
        <h2 className="mb-2 text-sm font-semibold">Sumber data</h2>
        <ul className="space-y-1 text-xs">
          {(data?.sources ?? []).map((source) => (
            <li key={source.url}>
              <a href={source.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-accent underline">
                {source.name} <ExternalLink size={10} aria-hidden />
              </a>
            </li>
          ))}
          <li className="text-muted">Data diterima {data?.updatedAt ? `${fmtTime(data.updatedAt)} (${fmtAgo(data.updatedAt)})` : '—'}</li>
        </ul>
      </section>

      <Disclaimer>
        Semua informasi pada halaman ini berasal dari MAGMA Indonesia/PVMBG. Rekomendasi keselamatan yang berlaku
        adalah rekomendasi resmi terbaru dari PVMBG; Seismos tidak menambahkan prakiraan atau interpretasi sendiri.
      </Disclaimer>
    </VolcanoPage>
  );
}
