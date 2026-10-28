'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ChevronRight, Search } from 'lucide-react';
import { LoadingNotice, Panel, Skeleton } from '@/components/ui/common';
import { fmtTime } from '@/lib/formatting';
import { useVolcanoQuery } from '@/hooks/useVolcano';
import type { VolcanoEruptionPayload } from '@/types/volcano-ui';
import { VolcanoLink } from './parts';
import { LoadMoreButton, useProgressiveList } from './progressive';
import { Disclaimer, OfflineNotice, VolcanoEmpty, VolcanoErrorBox, VolcanoPage } from './layout';

/** Riwayat informasi letusan resmi (VEN) — bukan riwayat perubahan tingkat. */
export function VolcanoEruptionList() {
  const query = useVolcanoQuery<VolcanoEruptionPayload>('/api/volcano/erupsi?size=60', { pollMs: 300_000 });
  const [search, setSearch] = useState('');
  const [date, setDate] = useState('');

  const eruptions = useMemo(() => query.data?.eruptions ?? [], [query.data]);
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return eruptions.filter((event) => {
      if (date && !event.occurredAt.startsWith(date)) return false;
      if (!term) return true;
      return `${event.volcanoName} ${event.volcanoCode} ${event.province ?? ''}`.toLowerCase().includes(term);
    });
  }, [eruptions, search, date]);

  const list = useProgressiveList(filtered, { resetKey: `${search.trim().toLowerCase()}|${date}` });

  if (query.loading && !query.data) {
    return (
      <VolcanoPage title="Riwayat Erupsi" hint="Informasi letusan resmi (VEN) yang diterbitkan PVMBG melalui MAGMA.">
        <LoadingNotice>Mengambil informasi letusan dari MAGMA…</LoadingNotice>
        <Skeleton className="h-40 w-full" />
      </VolcanoPage>
    );
  }

  if (!query.data) {
    return (
      <VolcanoPage title="Riwayat Erupsi">
        <OfflineNotice offline={query.offline} />
        <VolcanoErrorBox message={query.error ?? 'Informasi letusan tidak tersedia.'} retry={() => void query.refresh()} />
      </VolcanoPage>
    );
  }

  return (
    <VolcanoPage
      title="Riwayat Erupsi (Informasi Letusan Resmi)"
      hint="Setiap baris adalah informasi letusan (VEN) yang diterbitkan PVMBG. Kenaikan tingkat aktivitas tidak ditampilkan sebagai erupsi."
      updatedAt={query.data.updatedAt}
      errors={query.data.error ? [query.data.error] : []}
    >
      <OfflineNotice offline={query.offline} />

      <div className="mb-3 flex flex-wrap items-end gap-2">
        <label className="relative flex min-h-10 flex-1 items-center sm:max-w-xs">
          <Search size={15} aria-hidden className="pointer-events-none absolute left-2.5 text-muted" />
          <span className="sr-only">Cari gunung api</span>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Cari gunung api"
            className="min-h-10 w-full rounded-md border border-line bg-surface pl-8 pr-2 text-sm"
          />
        </label>
        <label className="text-xs text-muted">
          <span className="mb-1 block">Tanggal kejadian (UTC)</span>
          <input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className="min-h-10 rounded-md border border-line bg-surface px-2 text-sm text-ink"
          />
        </label>
        {date && <button type="button" onClick={() => setDate('')} className="min-h-10 rounded-md border border-line px-2.5 text-xs font-medium">Hapus tanggal</button>}
        <span className="text-xs text-muted">{filtered.length} dari {eruptions.length} kejadian</span>
      </div>

      {filtered.length === 0 ? (
        <VolcanoEmpty title="Tidak ada informasi letusan pada filter ini">
          PVMBG hanya menerbitkan informasi letusan ketika letusan teramati. Tidak adanya data bukan berarti gunung
          api tidak berpotensi erupsi; periksa status aktivitas dan rekomendasi resmi.
        </VolcanoEmpty>
      ) : (
        <Panel>
          <ul className="divide-y divide-line">
            {list.visible.map((event) => (
              <li key={event.id} className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <VolcanoLink code={event.volcanoCode} name={event.volcanoName} />
                  <span className="text-xs text-muted">{fmtTime(event.occurredAt)}</span>
                  {event.province && <span className="text-xs text-muted">· {event.province}</span>}
                  <Link
                    href={`/gunung-berapi/erupsi/${event.id}`}
                    className="ml-auto inline-flex items-center gap-1 rounded border border-line px-2 py-1 text-xs font-medium hover:bg-line/40"
                  >
                    Detail <ChevronRight size={11} aria-hidden />
                  </Link>
                </div>
                <p className="mt-1 text-xs text-muted">
                  {event.ashHeightM !== null && event.ashHeightM > 0 ? `Tinggi kolom abu ${event.ashHeightM} m` : 'Tinggi kolom abu tidak teramati/tercantum'}
                  {event.durationSeconds !== null ? ` · durasi ${event.durationSeconds} detik` : ''}
                  {event.zoneArea ? ` · zona ${event.zoneArea}` : ''}
                </p>
                {event.information && <p className="mt-1 line-clamp-2 text-sm">{event.information}</p>}
              </li>
            ))}
          </ul>
          <LoadMoreButton
            hasMore={list.hasMore}
            nextCount={list.nextCount}
            shown={list.shown}
            total={filtered.length}
            onLoadMore={list.showMore}
            label="informasi letusan"
            divided
          />
        </Panel>
      )}

      <p className="mt-3 text-xs text-muted">
        Daftar ini dibatasi pada {eruptions.length} informasi letusan terbaru dari API publik MAGMA. Riwayat letusan
        sebelum periode tersebut tidak ditampilkan agar tidak menyimpulkan data yang tidak diterbitkan.
      </p>

      <Disclaimer>
        Riwayat ini bukan prakiraan. Untuk riwayat geologi jangka panjang, rujuk publikasi Badan Geologi/PVMBG.
      </Disclaimer>
    </VolcanoPage>
  );
}
