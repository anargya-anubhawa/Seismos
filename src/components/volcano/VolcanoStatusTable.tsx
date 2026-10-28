'use client';

import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { LoadingNotice, Panel, Skeleton } from '@/components/ui/common';
import { fmtTime } from '@/lib/formatting';
import { useVolcanoQuery } from '@/hooks/useVolcano';
import { VOLCANO_LEVELS } from '@/types/volcano';
import type { VolcanoLevel } from '@/types/volcano';
import type { VolcanoOverviewPayload } from '@/types/volcano-ui';
import { VolcanoLevelBadge, VolcanoLink } from './parts';
import { Disclaimer, OfflineNotice, VolcanoEmpty, VolcanoErrorBox, VolcanoPage } from './layout';

/** Tabel status aktivitas resmi seluruh gunung api yang dipantau. */
export function VolcanoStatusTable() {
  const query = useVolcanoQuery<VolcanoOverviewPayload>('/api/volcano/status', { pollMs: 120_000 });
  const [level, setLevel] = useState<VolcanoLevel | null>(null);
  const [search, setSearch] = useState('');

  const volcanoes = useMemo(() => query.data?.volcanoes ?? [], [query.data]);
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return volcanoes
      .filter((volcano) => level === null || volcano.level === level)
      .filter((volcano) => term === '' || `${volcano.name} ${volcano.code} ${volcano.province}`.toLowerCase().includes(term))
      .sort((a, b) => b.level - a.level || a.name.localeCompare(b.name, 'id'));
  }, [volcanoes, level, search]);

  if (query.loading && !query.data) {
    return (
      <VolcanoPage title="Status Aktivitas" hint="Tingkat aktivitas resmi PVMBG untuk setiap gunung api yang dipantau.">
        <LoadingNotice>Mengambil status aktivitas dari MAGMA…</LoadingNotice>
        <Skeleton className="h-64 w-full" />
      </VolcanoPage>
    );
  }

  if (!query.data) {
    return (
      <VolcanoPage title="Status Aktivitas">
        <OfflineNotice offline={query.offline} />
        <VolcanoErrorBox message={query.error ?? 'Status aktivitas tidak tersedia.'} retry={() => void query.refresh()} />
      </VolcanoPage>
    );
  }

  return (
    <VolcanoPage
      title="Status Aktivitas Gunung Api"
      hint="Nomenklatur resmi: Level I Normal, Level II Waspada, Level III Siaga, Level IV Awas."
      updatedAt={query.data.summary.updatedAt}
      errors={query.data.error ? [query.data.error] : []}
    >
      <OfflineNotice offline={query.offline} />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <label className="relative flex min-h-10 flex-1 items-center sm:max-w-xs">
          <Search size={15} aria-hidden className="pointer-events-none absolute left-2.5 text-muted" />
          <span className="sr-only">Cari gunung api</span>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Cari nama gunung atau provinsi"
            className="min-h-10 w-full rounded-md border border-line bg-surface pl-8 pr-2 text-sm"
          />
        </label>
        <div className="flex flex-wrap gap-1">
          <button
            type="button"
            onClick={() => setLevel(null)}
            aria-pressed={level === null}
            className={`min-h-9 rounded-md border px-2.5 text-xs font-medium ${level === null ? 'border-accent bg-accent/10' : 'border-line text-muted'}`}
          >
            Semua ({volcanoes.length})
          </button>
          {VOLCANO_LEVELS.map((entry) => {
            const count = volcanoes.filter((volcano) => volcano.level === entry.level).length;
            return (
              <button
                key={entry.level}
                type="button"
                onClick={() => setLevel(level === entry.level ? null : entry.level)}
                aria-pressed={level === entry.level}
                className={`min-h-9 rounded-md border px-2.5 text-xs font-medium ${level === entry.level ? 'border-accent bg-accent/10' : 'border-line text-muted'}`}
              >
                {entry.short} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {filtered.length === 0 ? (
        <VolcanoEmpty title="Tidak ada gunung api yang cocok dengan filter">Ubah kata kunci atau pilih tingkat lain.</VolcanoEmpty>
      ) : (
        <Panel>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem] text-sm">
              <caption className="sr-only">Status aktivitas gunung api dari MAGMA Indonesia</caption>
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                  <th scope="col" className="px-3 py-2">Gunung api</th>
                  <th scope="col" className="px-3 py-2">Wilayah</th>
                  <th scope="col" className="px-3 py-2">Tingkat aktivitas</th>
                  <th scope="col" className="px-3 py-2">Koordinat</th>
                  <th scope="col" className="px-3 py-2">Informasi</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((volcano) => (
                  <tr key={volcano.code} className="border-b border-line last:border-0">
                    <td className="px-3 py-2">
                      <VolcanoLink code={volcano.code} name={volcano.name} />
                      <span className="block text-[11px] text-muted">Kode {volcano.code}</span>
                    </td>
                    <td className="px-3 py-2 text-xs text-muted">{volcano.province}</td>
                    <td className="px-3 py-2"><VolcanoLevelBadge level={volcano.level} compact /></td>
                    <td className="whitespace-nowrap px-3 py-2 text-xs text-muted">
                      {volcano.latitude.toFixed(3)}, {volcano.longitude.toFixed(3)}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      <span className="flex flex-wrap gap-1">
                        {volcano.hasVen && <span className="rounded border border-line px-1.5 py-0.5">Informasi letusan tersedia</span>}
                        {volcano.hasVona && <span className="rounded border border-line px-1.5 py-0.5">VONA tersedia</span>}
                        {!volcano.hasVen && !volcano.hasVona && <span className="text-muted">—</span>}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="border-t border-line px-3 py-2 text-[11px] text-muted">
            Data diambil dari MAGMA pada {fmtTime(query.data.summary.updatedAt ?? new Date().toISOString())}. Status
            adalah tingkat aktivitas resmi PVMBG, bukan prakiraan erupsi.
          </p>
        </Panel>
      )}

      <Disclaimer>
        Tabel ini mengikuti daftar pemantauan PVMBG. Bila tingkat aktivitas naik, ikuti rekomendasi resmi pada
        laporan aktivitas terbaru; kenaikan tingkat tidak identik dengan letusan.
      </Disclaimer>
    </VolcanoPage>
  );
}
