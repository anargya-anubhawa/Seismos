'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ChevronRight, Search } from 'lucide-react';
import { LoadingNotice, Panel, Skeleton } from '@/components/ui/common';
import { fmtTime } from '@/lib/formatting';
import { useVolcanoQuery } from '@/hooks/useVolcano';
import type { VolcanoReportPayload } from '@/types/volcano-ui';
import { ReportCard, VolcanoLevelBadge, VolcanoLink } from './parts';
import { LoadMoreButton, useProgressiveList } from './progressive';
import { Disclaimer, OfflineNotice, VolcanoEmpty, VolcanoErrorBox, VolcanoPage } from './layout';

/**
 * Daftar laporan resmi: `kind=aktivitas` (VAR per periode) atau
 * `kind=harian` (laporan harian per gunung api).
 */
export function VolcanoReportList({ kind }: { kind: 'aktivitas' | 'harian' }) {
  const [date, setDate] = useState('');
  const [search, setSearch] = useState('');
  const query = useVolcanoQuery<VolcanoReportPayload>(
    `/api/volcano/laporan?kind=${kind}${date ? `&date=${date}` : ''}`,
    { pollMs: 300_000 },
  );

  const reports = useMemo(() => query.data?.reports ?? [], [query.data]);
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return reports;
    return reports.filter((report) => `${report.volcanoName} ${report.volcanoCode} ${report.date}`.toLowerCase().includes(term));
  }, [reports, search]);

  const list = useProgressiveList(filtered, { resetKey: `${search.trim().toLowerCase()}|${date}` });

  const title = kind === 'harian' ? 'Laporan Harian Gunung Api' : 'Laporan Aktivitas Gunung Api';
  const hint = kind === 'harian'
    ? 'Laporan harian resmi MAGMA untuk setiap gunung api yang diamati pada tanggal terbit.'
    : 'Laporan aktivitas (VAR) resmi MAGMA per periode pengamatan 6/12/24 jam beserta rekomendasi PVMBG.';

  if (query.loading && !query.data) {
    return (
      <VolcanoPage title={title} hint={hint}>
        <LoadingNotice>Mengambil laporan dari MAGMA…</LoadingNotice>
        <Skeleton className="h-40 w-full" />
      </VolcanoPage>
    );
  }

  if (!query.data) {
    return (
      <VolcanoPage title={title} hint={hint}>
        <OfflineNotice offline={query.offline} />
        <VolcanoErrorBox message={query.error ?? 'Laporan tidak tersedia.'} retry={() => void query.refresh()} />
      </VolcanoPage>
    );
  }

  return (
    <VolcanoPage
      title={title}
      hint={hint}
      updatedAt={query.data.updatedAt}
      errors={query.data.error ? [query.data.error] : []}
    >
      <OfflineNotice offline={query.offline} />

      <div className="mb-3 flex flex-wrap items-end gap-2">
        <label className="relative flex min-h-10 flex-1 items-center sm:max-w-xs">
          <Search size={15} aria-hidden className="pointer-events-none absolute left-2.5 text-muted" />
          <span className="sr-only">Cari laporan berdasarkan gunung api</span>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Cari gunung api"
            className="min-h-10 w-full rounded-md border border-line bg-surface pl-8 pr-2 text-sm"
          />
        </label>
        <label className="text-xs text-muted">
          <span className="mb-1 block">Tanggal {kind === 'harian' ? 'terbit' : 'periode'}</span>
          <input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className="min-h-10 rounded-md border border-line bg-surface px-2 text-sm text-ink"
          />
        </label>
        {date && (
          <button type="button" onClick={() => setDate('')} className="min-h-10 rounded-md border border-line px-2.5 text-xs font-medium">
            Hapus tanggal
          </button>
        )}
        <span className="text-xs text-muted">{filtered.length} laporan</span>
      </div>

      {query.data.note && <p className="mb-3 rounded-md border border-line bg-surface px-3 py-2 text-xs text-muted">{query.data.note}</p>}

      {kind === 'harian' ? (
        filtered.length === 0 ? (
          <VolcanoEmpty title="Tidak ada laporan harian pada filter ini">
            Laporan harian diterbitkan sekali sehari. Pilih tanggal lain atau kosongkan filter tanggal.
          </VolcanoEmpty>
        ) : (
          <Panel>
            <ul className="divide-y divide-line">
              {list.visible.map((report) => (
                <li key={report.id} className="flex flex-wrap items-center gap-2 px-4 py-2.5">
                  <div className="min-w-0 flex-1">
                    <VolcanoLink code={report.volcanoCode} name={report.volcanoName} />
                    <p className="truncate text-xs text-muted">
                      {report.date}{report.period ? ` · ${report.period}` : ''}{report.timeZone ? ` ${report.timeZone}` : ''}
                      {report.author ? ` · disusun ${report.author}` : ''}
                    </p>
                  </div>
                  <VolcanoLevelBadge level={report.level} compact />
                  <Link
                    href={`/gunung-berapi/laporan/${encodeURIComponent(`harian-${report.volcanoCode}`)}`}
                    className="inline-flex items-center gap-1 rounded border border-line px-2 py-1 text-xs font-medium hover:bg-line/40"
                  >
                    Buka <ChevronRight size={11} aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
            <LoadMoreButton
              hasMore={list.hasMore}
              nextCount={list.nextCount}
              shown={list.shown}
              total={filtered.length}
              onLoadMore={list.showMore}
              label="laporan"
              divided
            />
          </Panel>
        )
      ) : filtered.length === 0 ? (
        <VolcanoEmpty title="Tidak ada laporan aktivitas pada filter ini">
          MAGMA mungkin belum menerbitkan laporan untuk tanggal tersebut. Kosongkan filter tanggal untuk melihat
          laporan terbaru.
        </VolcanoEmpty>
      ) : (
        <>
          <div className="grid gap-3 lg:grid-cols-2">
            {list.visible.map((report) => <ReportCard key={report.id} report={report} />)}
          </div>
          <LoadMoreButton
            hasMore={list.hasMore}
            nextCount={list.nextCount}
            shown={list.shown}
            total={filtered.length}
            onLoadMore={list.showMore}
            label="laporan"
            className="mt-3 rounded-lg border border-line bg-surface"
          />
        </>
      )}

      <p className="mt-3 text-xs text-muted">
        Waktu pengambilan data Seismos: {fmtTime(query.data.updatedAt)}. Isi laporan ditampilkan apa adanya dari
        MAGMA; rekomendasi keselamatan tidak diringkas.
      </p>

      <Disclaimer>
        Laporan resmi diterbitkan PVMBG berdasarkan pengamatan pos pengamatan gunung api. Untuk keputusan
        keselamatan, gunakan laporan dan arahan resmi terbaru.
      </Disclaimer>
    </VolcanoPage>
  );
}
