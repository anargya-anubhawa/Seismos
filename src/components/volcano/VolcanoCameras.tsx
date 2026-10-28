'use client';

import { useMemo, useState } from 'react';
import { Camera, ExternalLink, Search } from 'lucide-react';
import { LoadingNotice, Panel, Skeleton } from '@/components/ui/common';
import { useVolcanoQuery } from '@/hooks/useVolcano';
import type { VolcanoCamera } from '@/types/volcano';
import type { VolcanoCameraPayload } from '@/types/volcano-ui';
import { CameraGallery } from './parts';
import { LoadMoreButton, useProgressiveList } from './progressive';
import { Disclaimer, OfflineNotice, VolcanoEmpty, VolcanoErrorBox, VolcanoPage } from './layout';

const ageHours = (capturedAt: string | null): number | null => {
  if (!capturedAt) return null;
  const at = Date.parse(capturedAt);
  return Number.isFinite(at) ? (Date.now() - at) / 3_600_000 : null;
};

/**
 * CCTV MAGMA berupa gambar snapshot (bukan video live). Gambar dimuat hanya saat
 * kartu terlihat, jadi membuka halaman ini tidak memicu puluhan unduhan.
 */
export function VolcanoCameras() {
  const query = useVolcanoQuery<VolcanoCameraPayload>('/api/volcano/cameras', { pollMs: 300_000 });
  const [search, setSearch] = useState('');
  const [freshOnly, setFreshOnly] = useState(false);

  const cameras = useMemo(() => query.data?.cameras ?? [], [query.data]);

  const grouped = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = cameras.filter((camera) => {
      if (term && !`${camera.volcanoName} ${camera.volcanoCode} ${camera.station}`.toLowerCase().includes(term)) return false;
      if (freshOnly) {
        const hours = ageHours(camera.capturedAt);
        if (hours === null || hours > 24) return false;
      }
      return true;
    });
    const map = new Map<string, { name: string; code: string; cameras: VolcanoCamera[] }>();
    for (const camera of filtered) {
      const entry = map.get(camera.volcanoCode) ?? { name: camera.volcanoName, code: camera.volcanoCode, cameras: [] };
      entry.cameras.push(camera);
      map.set(camera.volcanoCode, entry);
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'id'));
  }, [cameras, search, freshOnly]);

  const cameraList = useProgressiveList(grouped, { resetKey: `${search.trim().toLowerCase()}|${freshOnly}` });

  if (query.loading && !query.data) {
    return (
      <VolcanoPage title="CCTV Gunung Api" hint="Gambar kamera pemantau resmi MAGMA per gunung api.">
        <LoadingNotice>Mengambil daftar kamera dari MAGMA…</LoadingNotice>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-56" />)}
        </div>
      </VolcanoPage>
    );
  }

  if (!query.data) {
    return (
      <VolcanoPage title="CCTV Gunung Api">
        <OfflineNotice offline={query.offline} />
        <VolcanoErrorBox message={query.error ?? 'Daftar kamera tidak tersedia.'} retry={() => void query.refresh()} />
      </VolcanoPage>
    );
  }

  const freshCount = cameras.filter((camera) => {
    const hours = ageHours(camera.capturedAt);
    return hours !== null && hours <= 6;
  }).length;

  return (
    <VolcanoPage
      title="CCTV Gunung Api"
      hint="MAGMA menerbitkan gambar snapshot kamera pemantau, bukan stream video. Waktu gambar selalu ditampilkan."
      updatedAt={query.data.updatedAt}
      errors={query.data.error ? [query.data.error] : []}
    >
      <OfflineNotice offline={query.offline} />

      <div className="mb-3 rounded-lg border border-line bg-surface px-3 py-2.5 text-xs">
        <p className="flex items-start gap-2">
          <Camera size={14} aria-hidden className="mt-0.5 shrink-0 text-muted" />
          <span>
            <strong>{cameras.length} kamera</strong> dari {grouped.length} gunung api; {freshCount} gambar diperbarui
            dalam 6 jam terakhir. Gambar dimuat saat terlihat di layar. Bila gambar tertunda lama, kamera di pos
            pengamatan kemungkinan sedang tidak aktif — gunakan tautan sumber MAGMA untuk memeriksa langsung.
          </span>
        </p>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <label className="relative flex min-h-10 flex-1 items-center sm:max-w-xs">
          <Search size={15} aria-hidden className="pointer-events-none absolute left-2.5 text-muted" />
          <span className="sr-only">Cari kamera atau gunung api</span>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Cari gunung api atau stasiun"
            className="min-h-10 w-full rounded-md border border-line bg-surface pl-8 pr-2 text-sm"
          />
        </label>
        <label className="flex min-h-10 items-center gap-2 text-xs">
          <input type="checkbox" checked={freshOnly} onChange={(event) => setFreshOnly(event.target.checked)} className="h-4 w-4" />
          Hanya gambar ≤ 24 jam
        </label>
        <a
          href="https://magma.esdm.go.id/v1/gunung-api/cctv"
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto inline-flex min-h-9 items-center gap-1 rounded-md border border-line px-2.5 text-xs font-medium text-accent"
        >
          CCTV MAGMA <ExternalLink size={11} aria-hidden />
        </a>
      </div>

      {grouped.length === 0 ? (
        <VolcanoEmpty title="Tidak ada kamera yang cocok">
          {cameras.length === 0
            ? 'MAGMA tidak mengembalikan daftar kamera saat ini. Buka halaman CCTV resmi MAGMA untuk memeriksa kamera aktif.'
            : 'Ubah kata kunci atau matikan filter "Hanya gambar ≤ 24 jam".'}
        </VolcanoEmpty>
      ) : (
        <div className="space-y-5">
          {cameraList.visible.map((group) => (
            <Panel key={group.code} title={`Gunung ${group.name} (${group.cameras.length} kamera)`}>
              <div className="px-3 py-3">
                <CameraGallery cameras={group.cameras} label={`${group.name} — MAGMA`} />
              </div>
            </Panel>
          ))}
          <LoadMoreButton
            hasMore={cameraList.hasMore}
            nextCount={cameraList.nextCount}
            shown={cameraList.shown}
            total={grouped.length}
            onLoadMore={cameraList.showMore}
            label="gunung api"
            className="rounded-lg border border-line bg-surface"
          />
        </div>
      )}

      <Disclaimer>
        Kamera dipasang dan dioperasikan oleh PVMBG/MAGMA. Kesegaran gambar bergantung pada koneksi pos pengamatan.
        Seismos tidak menambahkan prediksi apa pun terhadap gambar kamera.
      </Disclaimer>
    </VolcanoPage>
  );
}
