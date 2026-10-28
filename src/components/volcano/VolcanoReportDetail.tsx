'use client';

import Link from 'next/link';
import { ArrowLeft, ArrowRight, ExternalLink } from 'lucide-react';
import { LoadingNotice, Panel } from '@/components/ui/common';
import { fmtAgo, fmtTime } from '@/lib/formatting';
import { reportText } from '@/lib/share/report-text';
import { useVolcanoQuery } from '@/hooks/useVolcano';
import type { VolcanoReport } from '@/types/volcano';
import { SourceImage, VolcanoLevelBadge, VolcanoLink } from './parts';
import { Disclaimer, OfflineNotice, VolcanoEmpty, VolcanoErrorBox, VolcanoPage } from './layout';

interface Payload {
  report?: VolcanoReport | null;
  error?: string;
}

/**
 * Detail laporan resmi apa adanya: pengamatan visual, klimatologi, kegempaan,
 * dan rekomendasi lengkap tanpa diringkas.
 */
export function VolcanoReportDetail({ id, kind }: { id: string; kind: 'aktivitas' | 'harian' }) {
  const query = useVolcanoQuery<Payload>(`/api/volcano/laporan/${encodeURIComponent(id)}`);

  if (query.loading && !query.data) {
    return (
      <VolcanoPage title={kind === 'harian' ? 'Laporan Harian' : 'Laporan Aktivitas'}>
        <LoadingNotice>Mengambil laporan resmi dari MAGMA…</LoadingNotice>
      </VolcanoPage>
    );
  }

  const report = query.data?.report ?? null;
  if (!report) {
    return (
      <VolcanoPage title={kind === 'harian' ? 'Laporan Harian' : 'Laporan Aktivitas'}>
        <OfflineNotice offline={query.offline} />
        {query.data?.error?.includes('tidak ditemukan') ? (
          <VolcanoEmpty title="Laporan tidak ditemukan di MAGMA">
            Laporan ini mungkin sudah tidak tersedia pada API publik MAGMA. Buka daftar laporan terbaru untuk
            melihat laporan yang masih diterbitkan.
          </VolcanoEmpty>
        ) : (
          <VolcanoErrorBox message={query.data?.error ?? query.error ?? 'Laporan tidak tersedia.'} retry={() => void query.refresh()} />
        )}
        <Link href="/gunung-berapi/laporan" className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-accent underline">
          <ArrowLeft size={13} aria-hidden /> Kembali ke daftar laporan
        </Link>
      </VolcanoPage>
    );
  }

  return (
    <VolcanoPage
      title={`Laporan ${report.kind === 'harian' ? 'Harian' : 'Aktivitas'} — ${report.volcanoName}`}
      hint={`Periode ${report.date}${report.period ? ` · ${report.period}` : ''}${report.timeZone ? ` (${report.timeZone})` : ''}`}
      updatedAt={query.updatedAt}
      shareTitle={`Laporan ${report.kind === 'harian' ? 'Harian' : 'Aktivitas'} Gunung ${report.volcanoName} — Seismos Indonesia`}
      reportText={reportText(report)}
      attachments={report.visualImagePath
        ? [{
            fileName: `visual-${report.volcanoCode.toLowerCase()}-${report.date}.png`,
            url: report.visualImagePath,
            type: 'image/png',
            label: 'Gambar pengamatan visual resmi',
          }]
        : []}
    >
      <OfflineNotice offline={query.offline} />

      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
        <VolcanoLevelBadge level={report.level} />
        <VolcanoLink code={report.volcanoCode} name={report.volcanoName} />
        {report.province && <span className="text-xs text-muted">{report.province}</span>}
        {report.publishedAt && <span className="text-xs text-muted">Dipublikasikan {fmtTime(report.publishedAt)} ({fmtAgo(report.publishedAt)})</span>}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <Panel title="Pengamatan visual">
            <div className="space-y-2 px-4 py-3 text-sm">
              <p className="whitespace-pre-line">{report.visualText || 'Sumber tidak mencantumkan pengamatan visual.'}</p>
              {report.remarks && (
                <p className="text-xs text-muted"><strong className="text-ink">Keterangan lain: </strong>{report.remarks}</p>
              )}
            </div>
          </Panel>

          <Panel title="Pengamatan instrumental (kegempaan)">
            {report.seismic.length === 0 ? (
              <p className="px-4 py-3 text-sm text-muted">Sumber tidak mencantumkan data kegempaan pada laporan ini.</p>
            ) : (
              <ul className="divide-y divide-line">
                {report.seismic.map((item, index) => (
                  <li key={`${item.name}-${index}`} className="px-4 py-2 text-sm">
                    <span className="font-medium">{item.name}</span>
                    {item.text && <span className="block text-xs text-muted">{item.text}</span>}
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {report.climatologyText && (
            <Panel title="Klimatologi">
              <p className="whitespace-pre-line px-4 py-3 text-sm">{report.climatologyText}</p>
            </Panel>
          )}

          <Panel title="Rekomendasi resmi PVMBG">
            {report.recommendation ? (
              <p className="whitespace-pre-line px-4 py-3 text-sm">{report.recommendation}</p>
            ) : (
              <p className="px-4 py-3 text-sm text-muted">Rekomendasi tidak tercantum pada laporan ini.</p>
            )}
          </Panel>
        </div>

        <div className="space-y-3">
          {report.visualImagePath && (
            <Panel title="Foto visual resmi">
              <div className="bg-white p-2">
                <SourceImage
                  src={report.visualImagePath}
                  alt={`Foto pengamatan visual Gunung ${report.volcanoName} ${report.date}`}
                  className="block w-full object-contain"
                  caption="Gambar pengamatan dari MAGMA"
                />
              </div>
            </Panel>
          )}
          <Panel title="Sumber & waktu">
            <dl className="space-y-1.5 px-4 py-3 text-xs">
              <div><dt className="inline font-semibold">Disusun: </dt><dd className="inline text-muted">{report.author ?? 'tidak tercantum'}</dd></div>
              <div><dt className="inline font-semibold">Periode: </dt><dd className="inline text-muted">{report.date}{report.period ? ` ${report.period}` : ''}</dd></div>
              <div><dt className="inline font-semibold">Zona waktu: </dt><dd className="inline text-muted">{report.timeZone ?? 'tidak tercantum'}</dd></div>
              <div><dt className="inline font-semibold">Dipublikasikan: </dt><dd className="inline text-muted">{report.publishedAt ? fmtTime(report.publishedAt) : 'tidak tercantum'}</dd></div>
              <div><dt className="inline font-semibold">Diambil Seismos: </dt><dd className="inline text-muted">{fmtTime(query.updatedAt ?? new Date().toISOString())}</dd></div>
              <div className="pt-1">
                <a href={report.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-accent underline">
                  Laporan asli MAGMA <ExternalLink size={11} aria-hidden />
                </a>
              </div>
            </dl>
          </Panel>
          <Panel title="Navigasi">
            <div className="flex flex-wrap gap-2 px-4 py-3 text-xs">
              <Link href={`/gunung-berapi/${report.volcanoCode.toLowerCase()}`} className="inline-flex min-h-9 items-center gap-1 rounded-md border border-line px-2 font-medium">
                <ArrowLeft size={12} aria-hidden /> Detail gunung api
              </Link>
              <Link href={report.kind === 'harian' ? '/gunung-berapi/laporan-harian' : '/gunung-berapi/laporan'} className="inline-flex min-h-9 items-center gap-1 rounded-md border border-line px-2 font-medium">
                Semua laporan <ArrowRight size={12} aria-hidden />
              </Link>
            </div>
          </Panel>
        </div>
      </div>

      <Disclaimer>
        Isi laporan ditampilkan tanpa ringkasan yang menghilangkan bagian keselamatan. Bila terdapat perbedaan,
        dokumen resmi MAGMA/PVMBG yang berlaku.
      </Disclaimer>
    </VolcanoPage>
  );
}
