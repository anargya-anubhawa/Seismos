'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ChevronRight, Locate, Search } from 'lucide-react';
import { LoadingNotice, Panel, Skeleton } from '@/components/ui/common';
import { useVolcanoQuery } from '@/hooks/useVolcano';
import { VOLCANO_LEVELS } from '@/types/volcano';
import type { VolcanoLevel } from '@/types/volcano';
import type { VolcanoOverviewPayload } from '@/types/volcano-ui';
import { VolcanoLevelBadge, VolcanoLink } from './parts';
import { Disclaimer, OfflineNotice, VolcanoEmpty, VolcanoErrorBox, VolcanoPage } from './layout';
import { VolcanoMapLazy } from './VolcanoMapLazy';

export function VolcanoDistribution() {
  const query = useVolcanoQuery<VolcanoOverviewPayload>('/api/volcano/status', { pollMs: 120_000 });
  const [level, setLevel] = useState<VolcanoLevel | null>(null);
  const [province, setProvince] = useState<string>('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string | null>(null);

  const volcanoes = useMemo(() => query.data?.volcanoes ?? [], [query.data]);
  const provinces = useMemo(
    () => Array.from(new Set(volcanoes.map((volcano) => volcano.province))).sort((a, b) => a.localeCompare(b, 'id')),
    [volcanoes],
  );
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return volcanoes.filter((volcano) => (
      (level === null || volcano.level === level)
      && (province === '' || volcano.province === province)
      && (term === '' || `${volcano.name} ${volcano.code} ${volcano.province}`.toLowerCase().includes(term))
    ));
  }, [volcanoes, level, province, search]);

  const selectedVolcano = volcanoes.find((volcano) => volcano.code === selected) ?? null;

  if (query.loading && !query.data) {
    return (
      <VolcanoPage title="Peta Gunung Api" hint="Persebaran gunung api yang dipantau PVMBG beserta tingkat aktivitas resminya.">
        <LoadingNotice>Mengambil koordinat dan status gunung api dari MAGMA…</LoadingNotice>
        <Skeleton className="h-[min(60vh,520px)] min-h-[280px] w-full" />
      </VolcanoPage>
    );
  }

  if (!query.data) {
    return (
      <VolcanoPage title="Peta Gunung Api">
        <OfflineNotice offline={query.offline} />
        <VolcanoErrorBox message={query.error ?? 'Data gunung api tidak tersedia.'} retry={() => void query.refresh()} />
      </VolcanoPage>
    );
  }

  return (
    <VolcanoPage
      title="Peta Gunung Api"
      hint="Koordinat dan tingkat aktivitas berasal dari MAGMA. Pilih penanda atau daftar untuk melihat ringkasan gunung api."
      updatedAt={query.data.updatedAt}
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
            placeholder="Cari nama gunung atau kode"
            className="min-h-10 w-full rounded-md border border-line bg-surface pl-8 pr-2 text-sm"
          />
        </label>
        <label className="min-h-10">
          <span className="sr-only">Filter tingkat aktivitas</span>
          <select
            value={level ?? ''}
            onChange={(event) => setLevel(event.target.value ? Number(event.target.value) as VolcanoLevel : null)}
            className="min-h-10 rounded-md border border-line bg-surface px-2 text-sm"
          >
            <option value="">Semua tingkat</option>
            {VOLCANO_LEVELS.map((entry) => <option key={entry.level} value={entry.level}>{entry.label}</option>)}
          </select>
        </label>
        <label className="min-h-10">
          <span className="sr-only">Filter provinsi</span>
          <select
            value={province}
            onChange={(event) => setProvince(event.target.value)}
            className="min-h-10 max-w-[13rem] rounded-md border border-line bg-surface px-2 text-sm"
          >
            <option value="">Semua wilayah</option>
            {provinces.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </label>
        <span className="text-xs text-muted">{filtered.length} dari {volcanoes.length} gunung api</span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
        <VolcanoMapLazy
          volcanoes={filtered.map((volcano) => ({
            code: volcano.code,
            name: volcano.name,
            province: volcano.province,
            latitude: volcano.latitude,
            longitude: volcano.longitude,
            level: volcano.level,
            levelLabel: volcano.levelLabel,
          }))}
          selectedCode={selected}
          onSelect={setSelected}
        />

        <div className="space-y-3">
          {selectedVolcano ? (
            <Panel title="Detail pilihan">
              <div className="space-y-2 px-4 py-3 text-sm">
                <p className="text-base font-semibold">{selectedVolcano.name}</p>
                <VolcanoLevelBadge level={selectedVolcano.level} />
                <dl className="space-y-1 text-xs text-muted">
                  <div><dt className="inline font-semibold text-ink">Wilayah: </dt><dd className="inline">{selectedVolcano.province}</dd></div>
                  <div><dt className="inline font-semibold text-ink">Koordinat: </dt><dd className="inline">{selectedVolcano.latitude.toFixed(3)}, {selectedVolcano.longitude.toFixed(3)}</dd></div>
                  {selectedVolcano.elevation !== null && (
                    <div><dt className="inline font-semibold text-ink">Elevasi: </dt><dd className="inline">{Math.round(selectedVolcano.elevation)} m</dd></div>
                  )}
                  <div><dt className="inline font-semibold text-ink">Kode MAGMA: </dt><dd className="inline">{selectedVolcano.code}</dd></div>
                </dl>
                <Link href={`/gunung-berapi/${selectedVolcano.code.toLowerCase()}`} className="inline-flex items-center gap-1 font-medium text-accent underline">
                  Buka status, laporan & rekomendasi <ChevronRight size={12} aria-hidden />
                </Link>
              </div>
            </Panel>
          ) : (
            <VolcanoEmpty title="Belum ada gunung api dipilih">
              Pilih penanda pada peta atau baris pada daftar untuk melihat status dan tautan detail.
            </VolcanoEmpty>
          )}

          <Panel title="Gunung api pada filter">
            <ul className="max-h-[22rem] divide-y divide-line overflow-y-auto">
              {filtered.map((volcano) => (
                <li key={volcano.code} className="flex items-center gap-2 px-3 py-2 text-sm">
                  <div className="min-w-0 flex-1">
                    <VolcanoLink code={volcano.code} name={volcano.name} />
                    <p className="truncate text-xs text-muted">{volcano.province}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelected(volcano.code)}
                    className="shrink-0 rounded border border-line p-1.5 text-muted hover:bg-line/40"
                    aria-label={`Pusatkan peta pada ${volcano.name}`}
                  >
                    <Locate size={13} aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>

      <Disclaimer>
        Peta ini memakai ubin OpenStreetMap dan koordinat resmi MAGMA. Warna penanda mengikuti tingkat aktivitas
        resmi (Normal, Waspada, Siaga, Awas) dan selalu disertai teks. Peta bukan pengganti peta KRB atau arahan
        evakuasi resmi.
      </Disclaimer>
    </VolcanoPage>
  );
}
