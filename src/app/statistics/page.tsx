
'use client';

import { useMemo, useState } from 'react';
import { useEarthquakes } from '@/hooks/useEarthquakes';
import { bin } from '@/lib/stats';
import { fmtTime, wibDate } from '@/lib/formatting';
import {
  Attribution,
  LoadingNotice,
  MagBadge,
  PageTitle,
  Panel,
  Skeleton,
  StaleDataNotice,
  StateBox,
} from '@/components/ui/common';
import { BarCard } from '@/components/charts/BarCard';

const RANGES = [
  { v: 'all', label: 'Semua data dimuat', hours: Infinity },
  { v: '24', label: '24 jam', hours: 24 },
  { v: '168', label: '7 hari', hours: 168 },
  { v: '720', label: '30 hari', hours: 720 },
] as const;

export default function StatisticsPage() {
  const { data, loading, error } = useEarthquakes();

  const [range, setRange] = useState<(typeof RANGES)[number]['v']>('all');

  const events = useMemo(() => {
    const selectedRange = RANGES.find((r) => r.v === range);
    const hours = selectedRange?.hours ?? Infinity;
    const now = Date.now();

    return (data?.events ?? []).filter((event) => {
      const timestamp = Date.parse(event.originTime);

      return (
        Number.isFinite(timestamp) &&
        now - timestamp <= hours * 3_600_000
      );
    });
  }, [data, range]);

  const perDay = useMemo(() => {
    const counts = new Map<string, number>();

    for (const event of events) {
      const date = wibDate(event.originTime);
      counts.set(date, (counts.get(date) ?? 0) + 1);
    }

    return Array.from(counts.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, jumlah]) => ({
        name: name.slice(5),
        jumlah,
      }));
  }, [events]);

  const magDist = useMemo(
    () =>
      bin(events, [
        { label: '< 3', test: (e) => e.magnitude < 3 },
        { label: '3–3,9', test: (e) => e.magnitude >= 3 && e.magnitude < 4 },
        { label: '4–4,9', test: (e) => e.magnitude >= 4 && e.magnitude < 5 },
        { label: '5–5,9', test: (e) => e.magnitude >= 5 && e.magnitude < 6 },
        { label: '≥ 6', test: (e) => e.magnitude >= 6 },
      ]),
    [events],
  );

  const depthDist = useMemo(
    () =>
      bin(events, [
        { label: '0–10', test: (e) => e.depthKm <= 10 },
        { label: '11–60', test: (e) => e.depthKm > 10 && e.depthKm <= 60 },
        { label: '61–150', test: (e) => e.depthKm > 60 && e.depthKm <= 150 },
        { label: '151–300', test: (e) => e.depthKm > 150 && e.depthKm <= 300 },
        { label: '> 300', test: (e) => e.depthKm > 300 },
      ]),
    [events],
  );

  const top = useMemo(
    () =>
      [...events]
        .sort((a, b) => b.magnitude - a.magnitude)
        .slice(0, 5),
    [events],
  );

  if (loading && !data) {
    return (
      <>
        <PageTitle title="Statistik Seismik" />
        <LoadingNotice>Mengambil data gempa…</LoadingNotice>

        <div className="grid w-full min-w-0 grid-cols-1 gap-4 lg:grid-cols-2">
          <Skeleton className="h-96 min-w-0 w-full" />
          <Skeleton className="h-96 min-w-0 w-full" />
          <Skeleton className="h-96 min-w-0 w-full" />
          <Skeleton className="h-96 min-w-0 w-full" />
        </div>
      </>
    );
  }

  if (!data) {
    return (
      <>
        <PageTitle title="Statistik Seismik" />
        <StateBox kind="error" title="Data gempa tidak dapat dimuat">
          {error ?? 'Sumber BMKG tidak merespons.'}
        </StateBox>
      </>
    );
  }

  const sorted = [...events].sort((a, b) =>
    a.originTime.localeCompare(b.originTime),
  );

  const period = sorted.length
    ? `${fmtTime(sorted[0].originTime)} – ${fmtTime(sorted[sorted.length - 1].originTime)}`
    : 'tidak ada kejadian';

  const sub = `${events.length} kejadian · ${period} · Sumber: BMKG`;

  return (
    <>
      <PageTitle
        title="Statistik Seismik"
        hint="Dihitung dari jendela data BMKG saat ini; tidak mewakili seluruh aktivitas seismik. Tidak ada prediksi."
      />

      <StaleDataNotice error={error} updatedAt={data.updatedAt} />

      {/* Filter rentang waktu */}
      <div
        className="mb-4 flex w-full min-w-0 flex-wrap items-center gap-2"
        role="group"
        aria-label="Rentang waktu"
      >
        {RANGES.map((r) => (
          <button
            key={r.v}
            type="button"
            onClick={() => setRange(r.v)}
            aria-pressed={range === r.v}
            className={`max-w-full rounded-md border px-3 py-2 text-left text-sm ${
              range === r.v
                ? 'border-accent bg-accent font-medium text-accent-ink'
                : 'border-line hover:bg-line/40'
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* Grid statistik responsif */}
      <div className="grid w-full min-w-0 grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="w-full min-w-0 max-w-full">
          <BarCard
            title="Jumlah kejadian per hari (WIB)"
            subtitle={sub}
            data={perDay}
            xLabel="Tanggal (bulan-hari)"
          />
        </div>

        <div className="w-full min-w-0 max-w-full">
          <BarCard
            title="Distribusi magnitudo"
            subtitle={sub}
            data={magDist}
            xLabel="Magnitudo"
          />
        </div>

        <div className="w-full min-w-0 max-w-full">
          <BarCard
            title="Distribusi kedalaman"
            subtitle={sub}
            data={depthDist}
            xLabel="Kedalaman (km)"
          />
        </div>

        {/* Tabel magnitudo terbesar */}
        <div className="w-full min-w-0 max-w-full">
          <Panel
            title="Magnitudo terbesar pada periode ini"
            className="min-w-0 overflow-hidden"
          >
            {top.length === 0 ? (
              <p className="p-6 text-sm text-muted">
                Tidak ada data pada periode ini.
              </p>
            ) : (
              <div className="w-full max-w-full overflow-x-auto overscroll-x-contain">
                <table className="w-full min-w-[520px] text-sm">
                  <thead className="border-b border-line text-left text-muted">
                    <tr>
                      <th className="whitespace-nowrap px-4 py-2 font-medium">
                        Mag.
                      </th>
                      <th className="px-2 py-2 font-medium">Lokasi</th>
                      <th className="whitespace-nowrap px-2 py-2 font-medium">
                        Waktu
                      </th>
                      <th className="whitespace-nowrap px-4 py-2 font-medium">
                        Kedalaman
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {top.map((q) => (
                      <tr
                        key={q.id}
                        className="border-b border-line last:border-0"
                      >
                        <td className="px-4 py-2">
                          <MagBadge m={q.magnitude} />
                        </td>

                        <td className="max-w-[180px] break-words px-2 py-2 [overflow-wrap:anywhere]">
                          {q.region}
                        </td>

                        <td className="whitespace-nowrap px-2 py-2 text-muted">
                          {fmtTime(q.originTime)}
                        </td>

                        <td className="whitespace-nowrap px-4 py-2">
                          {q.depthKm} km
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </div>
      </div>

      <Attribution />
    </>
  );
}
