'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { ShieldCheck } from 'lucide-react';
import { useEarthquakes } from '@/hooks/useEarthquakes';
import { summarize } from '@/lib/stats';
import { fmtAgo, fmtTime } from '@/lib/formatting';
import {
  Attribution, EventRow, LoadingNotice, MagBadge, PageTitle, Panel, Skeleton, StaleDataNotice, StateBox,
} from '@/components/ui/common';
import { NotificationSummary } from '@/components/notifications/NotificationSettings';
import { QuakeMapLazy } from '@/components/map/QuakeMapLazy';
import { MmiSummary } from '@/components/mmi/MmiSummary';
import { HotEventsPanel, WeatherDashboardCard } from '@/components/weather/WeatherDashboard';

export default function DashboardPage() {
  const { data, loading, error } = useEarthquakes();
  const events = useMemo(() => data?.events ?? [], [data]);
  const s = useMemo(() => summarize(events), [events]);

  if (loading && !data) {
    return (
      <>
        <PageTitle title="Dashboard" />
        <LoadingNotice>Mengambil data gempa…</LoadingNotice>
        <div className="mb-4"><Skeleton className="h-48" /></div>
        <div className="grid w-full min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="mt-4 h-72" />
      </>
    );
  }
  if (!data) {
    return (
      <>
        <PageTitle title="Dashboard" />
        <div className="mb-4"><WeatherDashboardCard /></div>
        <HotEventsPanel />
        <div className="mt-4">
          <StateBox kind="error" title="Data gempa tidak dapat dimuat">
            {error ?? 'Sumber BMKG tidak merespons.'} Tidak ada data pengganti yang ditampilkan.
            Coba muat ulang dengan tombol di kanan atas.
          </StateBox>
        </div>
      </>
    );
  }

  return (
    <>
      <PageTitle
        title="Dashboard"
        hint="Ringkasan satu layar: cuaca di lokasi Anda, kejadian yang perlu perhatian (letusan gunung api, tsunami, peringatan cuaca ekstrem), lalu gempa terbaru. Semua angka berasal dari sumber resmi BMKG/PVMBG."
      />
      <StaleDataNotice error={error} updatedAt={data.updatedAt} />

      <div className="mb-4 grid w-full min-w-0 grid-cols-1 gap-4 lg:grid-cols-2">
        <WeatherDashboardCard />
        <HotEventsPanel />
      </div>

      <div className="grid w-full min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Panel className="min-w-0 p-4">
          <p className="break-words text-sm text-muted">Kejadian 24 jam terakhir</p>
          <p className="mt-1 text-3xl font-semibold">{s.last24h}</p>
          <p className="mt-1 text-xs text-muted">dari {s.total} kejadian yang dimuat</p>
        </Panel>
        <Panel className="min-w-0 p-4">
          <p className="break-words text-sm text-muted">Gempa M ≥ 5,0 dalam data</p>
          <p className="mt-1 text-3xl font-semibold">{s.m5plus}</p>
          <p className="mt-1 text-xs text-muted">dihitung dari magnitudo BMKG</p>
        </Panel>
        <Panel className="min-w-0 p-4">
          <p className="break-words text-sm text-muted">Gempa terbaru</p>
          {s.latest ? (
            <div className="mt-1 flex min-w-0 items-start gap-2.5">
              <MagBadge m={s.latest.magnitude} />
              <div className="min-w-0">
                <p className="min-w-0 break-words text-sm font-medium [overflow-wrap:anywhere]" title={s.latest.region}>{s.latest.region}</p>
                <p className="text-xs text-muted">{fmtAgo(s.latest.originTime)}</p>
              </div>
            </div>
          ) : <p className="mt-1 text-sm">Belum ada kejadian.</p>}
        </Panel>
        <Panel className="min-w-0 p-4">
          <p className="break-words text-sm text-muted">Terbesar dalam data yang dimuat</p>
          {s.largest ? (
            <div className="mt-1 flex min-w-0 items-start gap-2.5">
              <MagBadge m={s.largest.magnitude} />
              <div className="min-w-0">
                <p className="min-w-0 break-words text-sm font-medium [overflow-wrap:anywhere]" title={s.largest.region}>{s.largest.region}</p>
                <p className="text-xs text-muted">{fmtTime(s.largest.originTime)}</p>
              </div>
            </div>
          ) : <p className="mt-1 text-sm">Belum ada kejadian.</p>}
        </Panel>
      </div>

      <div className="mt-4 grid w-full min-w-0 grid-cols-1 gap-4 xl:grid-cols-5">
        <Panel title="Persebaran episenter" className="overflow-hidden xl:col-span-3">
          <div className="h-80 xl:h-[28rem]"><QuakeMapLazy events={events} /></div>
        </Panel>
        <Panel title="Gempa terbaru" className="xl:col-span-2">
          <ul className="max-h-[28rem] overflow-y-auto">
            {events.slice(0, 10).map((q) => <EventRow key={q.id} q={q} />)}
          </ul>
          <div className="border-t border-line px-4 py-2.5 text-sm">
            <Link href="/history" className="font-medium underline">Lihat semua riwayat</Link>
          </div>
        </Panel>
      </div>

      {/* Ringkasan MMI diletakkan tepat di bawah bagian gempa terbaru. */}
      <MmiSummary events={events} className="mt-4 min-w-0" />

      <div className="mt-4 grid w-full min-w-0 grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="Notifikasi & alarm gempa">
          <div className="px-4 py-3"><NotificationSummary /></div>
        </Panel>
        <Panel title="Kesiapsiagaan">
          <div className="flex items-start gap-2.5 px-4 py-3 text-sm">
            <ShieldCheck size={18} aria-hidden className="mt-0.5 shrink-0 text-accent" />
            <div>
              <p className="font-medium">Siap sebelum guncangan</p>
              <p className="mt-1 text-xs text-muted">
                Kenali jalur evakuasi, amankan benda berat, dan siapkan tas siaga. Panduan singkat tersedia di halaman mitigasi.
              </p>
              <Link href="/mitigasi" className="mt-2 inline-block font-medium text-accent underline">
                Buka panduan mitigasi
              </Link>
            </div>
          </div>
        </Panel>
      </div>

      <Panel title="Status sumber data" className="mt-4">
        <ul className="divide-y divide-line">
          {data.sources.map((src) => (
            <li key={src.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
              <span>
                <a href={src.url} target="_blank" rel="noopener noreferrer" className="font-medium underline">{src.label}</a>
                <span className="ml-2 text-muted">{src.count} kejadian</span>
              </span>
              <span className={src.error ? 'text-danger' : 'text-ok'}>
                {src.error
                  ? src.stale
                    ? `Data lama (diambil ${src.fetchedAt ? fmtTime(src.fetchedAt) : '-'}): ${src.error}`
                    : `Gagal: ${src.error}`
                  : `Diambil ${src.fetchedAt ? fmtTime(src.fetchedAt) : '-'}`}
              </span>
            </li>
          ))}
        </ul>
        <p className="border-t border-line px-4 py-2.5 text-xs text-muted">
          Seismogram gunung api live tersedia di{' '}
          <Link className="underline" href="/volcano-seismogram">halaman gunung api</Link>, bersumber dari MAGMA Indonesia (PVMBG).
        </p>
      </Panel>
      <Attribution />
    </>
  );
}
