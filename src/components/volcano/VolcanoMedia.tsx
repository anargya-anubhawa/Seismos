'use client';

import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { LoadingNotice, Panel, Skeleton } from '@/components/ui/common';
import { fmtTime } from '@/lib/formatting';
import { useVolcanoQuery } from '@/hooks/useVolcano';
import type { VolcanoGalleryPayload, VolcanoVonaPayload } from '@/types/volcano-ui';
import { GalleryGrid, VonaBadge, VonaCard } from './parts';
import { Disclaimer, OfflineNotice, VolcanoEmpty, VolcanoErrorBox, VolcanoPage } from './layout';

/** Gallery dokumentasi visual resmi MAGMA (visual pengamatan per gunung api). */
export function VolcanoGallery() {
  const [input, setInput] = useState('');
  const [search, setSearch] = useState('');
  const query = useVolcanoQuery<VolcanoGalleryPayload>(
    `/api/volcano/gallery?size=36${search ? `&search=${encodeURIComponent(search)}` : ''}`,
    { pollMs: 600_000 },
  );

  const photos = useMemo(() => query.data?.photos ?? [], [query.data]);

  if (query.loading && !query.data) {
    return (
      <VolcanoPage title="Gallery Gunung Api" hint="Dokumentasi visual pengamatan yang diterbitkan MAGMA.">
        <LoadingNotice>Mengambil gallery dari MAGMA…</LoadingNotice>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-32" />)}
        </div>
      </VolcanoPage>
    );
  }

  if (!query.data) {
    return (
      <VolcanoPage title="Gallery Gunung Api">
        <OfflineNotice offline={query.offline} />
        <VolcanoErrorBox message={query.error ?? 'Gallery tidak tersedia.'} retry={() => void query.refresh()} />
      </VolcanoPage>
    );
  }

  return (
    <VolcanoPage
      title="Gallery Gunung Api"
      hint="Foto pengamatan visual resmi MAGMA. Tanggal yang ditampilkan adalah tanggal visual pada nama berkas sumber, bukan tanggal foto."
      updatedAt={query.data.updatedAt}
      errors={query.data.error ? [query.data.error] : []}
    >
      <OfflineNotice offline={query.offline} />

      <form
        className="mb-3 flex flex-wrap items-end gap-2"
        onSubmit={(event) => { event.preventDefault(); setSearch(input.trim()); }}
      >
        <label className="relative flex min-h-10 flex-1 items-center sm:max-w-xs">
          <Search size={15} aria-hidden className="pointer-events-none absolute left-2.5 text-muted" />
          <span className="sr-only">Cari nama gunung api pada gallery</span>
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Cari gunung api"
            className="min-h-10 w-full rounded-md border border-line bg-surface pl-8 pr-2 text-sm"
          />
        </label>
        <button type="submit" className="min-h-10 rounded-md border border-line px-3 text-sm font-medium">Cari</button>
        {search && (
          <button
            type="button"
            onClick={() => { setInput(''); setSearch(''); }}
            className="min-h-10 rounded-md border border-line px-3 text-xs font-medium"
          >
            Tampilkan semua
          </button>
        )}
        <span className="text-xs text-muted">{photos.length} foto</span>
      </form>

      <p className="mb-3 rounded-md border border-line bg-surface px-3 py-2 text-xs text-muted">
        API gallery MAGMA hanya mendukung pencarian teks, bukan filter gunung api. Metadata keterangan foto tidak
        diterbitkan sumber, sehingga Seismos tidak mengarang keterangan atau lokasi.
      </p>

      {photos.length === 0 ? (
        <VolcanoEmpty title="Tidak ada foto untuk pencarian ini">
          Coba nama gunung api lain atau tampilkan semua foto terbaru.
        </VolcanoEmpty>
      ) : (
        <Panel>
          <div className="px-3 py-3">
            <GalleryGrid photos={photos} />
          </div>
          <p className="border-t border-line px-3 py-2 text-[11px] text-muted">
            Diambil {fmtTime(query.data.updatedAt)} dari MAGMA Indonesia/PVMBG. Atribusi dan ketentuan penggunaan
            mengikuti sumber.
          </p>
        </Panel>
      )}

      <Disclaimer>
        Gambar adalah dokumentasi pengamatan visual petugas pos pengamatan. Kualitas dan sudut pandang bergantung pada
        kondisi cuaca serta peralatan sumber.
      </Disclaimer>
    </VolcanoPage>
  );
}

/** VONA resmi untuk penerbangan. */
export function VolcanoVona() {
  const query = useVolcanoQuery<VolcanoVonaPayload>('/api/volcano/vona?size=40', { pollMs: 300_000 });
  const notices = useMemo(() => query.data?.notices ?? [], [query.data]);
  const summary = useMemo(() => {
    const counts = { GREEN: 0, YELLOW: 0, ORANGE: 0, RED: 0 };
    for (const notice of notices) if (notice.currentCode) counts[notice.currentCode] += 1;
    return counts;
  }, [notices]);

  if (query.loading && !query.data) {
    return (
      <VolcanoPage title="VONA" hint="Volcano Observatory Notice for Aviation dari MAGMA.">
        <LoadingNotice>Mengambil VONA terbaru dari MAGMA…</LoadingNotice>
        <Skeleton className="h-40 w-full" />
      </VolcanoPage>
    );
  }

  if (!query.data) {
    return (
      <VolcanoPage title="VONA">
        <OfflineNotice offline={query.offline} />
        <VolcanoErrorBox message={query.error ?? 'VONA tidak tersedia.'} retry={() => void query.refresh()} />
      </VolcanoPage>
    );
  }

  return (
    <VolcanoPage
      title="VONA — Informasi Abu Vulkanik untuk Penerbangan"
      hint="VONA diterbitkan PVMBG untuk keselamatan penerbangan. Kode warna mengikuti skala ICAO."
      updatedAt={query.data.updatedAt}
      errors={query.data.error ? [query.data.error] : []}
    >
      <OfflineNotice offline={query.offline} />

      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
        {(['GREEN', 'YELLOW', 'ORANGE', 'RED'] as const).map((code) => (
          <span key={code} className="inline-flex items-center gap-1.5">
            <VonaBadge code={code} />
            <span className="text-muted">{summary[code]}</span>
          </span>
        ))}
        <span className="text-muted">· {notices.length} VONA terbaru</span>
      </div>

      <p className="mb-3 rounded-md border border-line bg-surface px-3 py-2 text-xs text-muted">{query.data.note}</p>

      {notices.length === 0 ? (
        <VolcanoEmpty title="Belum ada VONA terbaru">
          VONA hanya diterbitkan ketika ada kejadian berabu yang signifikan bagi penerbangan.
        </VolcanoEmpty>
      ) : (
        <Panel>
          <ul className="space-y-2 px-3 py-3">
            {notices.map((notice) => <VonaCard key={notice.id} notice={notice} />)}
          </ul>
        </Panel>
      )}

      <Disclaimer>
        Seismos tidak menghitung atau memprakirakan pergerakan abu vulkanik. Untuk informasi penerbangan resmi,
        gunakan VONA, NOTAM, dan arahan otoritas penerbangan.
      </Disclaimer>
    </VolcanoPage>
  );
}
