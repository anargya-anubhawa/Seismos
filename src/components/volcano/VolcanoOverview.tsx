'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ChevronRight, MapPin, Mountain, Search, Waves } from 'lucide-react';
import { LoadingNotice, Panel, Skeleton } from '@/components/ui/common';
import { fmtAgo, fmtTime } from '@/lib/formatting';
import { useVolcanoQuery } from '@/hooks/useVolcano';
import { VOLCANO_LEVELS } from '@/types/volcano';
import type { VolcanoLevel } from '@/types/volcano';
import type { VolcanoOverviewPayload } from '@/types/volcano-ui';
import { ReportCard, VonaCard, VolcanoLevelBadge, VolcanoLink } from './parts';
import { Disclaimer, OfflineNotice, VolcanoEmpty, VolcanoErrorBox, VolcanoPage } from './layout';
import { LoadMoreButton, useProgressiveList } from './progressive';
import { VolcanoMapLazy } from './VolcanoMapLazy';

const LEVEL_ACCENT: Record<VolcanoLevel, string> = {
  1: 'border-ok/50',
  2: 'border-[#B08A00]/50',
  3: 'border-[#C2711A]/60',
  4: 'border-danger/60',
};

const LEVEL_TEXT: Record<VolcanoLevel, string> = {
  1: 'text-ok',
  2: 'text-[#8A6A00] dark:text-[#F2C14E]',
  3: 'text-[#C2711A] dark:text-[#F0A868]',
  4: 'text-danger',
};

/**
 * Halaman Daftar Gunung.
 *
 * Tata letaknya mengikuti dashboard: baris kartu statistik tingkat aktivitas di
 * atas, lalu peta persebaran dan daftar gunung berdampingan. Peta memakai data
 * yang sama dengan daftar, jadi tidak ada permintaan tambahan ke server.
 */
export function VolcanoOverview() {
  const query = useVolcanoQuery<VolcanoOverviewPayload>('/api/volcano/overview', { pollMs: 120_000 });
  const [level, setLevel] = useState<VolcanoLevel | null>(null);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string | null>(null);

  const data = query.data;
  const all = useMemo(() => data?.volcanoes ?? [], [data?.volcanoes]);

  const volcanoes = useMemo(() => {
    const term = search.trim().toLowerCase();
    return all.filter((volcano) => {
      if (level !== null && volcano.level !== level) return false;
      if (term && !`${volcano.name} ${volcano.province} ${volcano.code}`.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [all, level, search]);

  // 12 entri pertama saja agar halaman tidak padat; sisanya lewat "Muat lebih
  // banyak". Kunci reset memuat filter agar hitungan kembali ke awal.
  const list = useProgressiveList(volcanoes, { resetKey: `${level ?? 'all'}|${search.trim().toLowerCase()}` });

  if (query.loading && !data) {
    return (
      <VolcanoPage title="Daftar Gunung Api" hint="Kondisi gunung api yang dipantau PVMBG berdasarkan data resmi MAGMA.">
        <LoadingNotice>Mengambil data gunung api dari MAGMA…</LoadingNotice>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24" />)}
        </div>
      </VolcanoPage>
    );
  }

  if (!data) {
    return (
      <VolcanoPage title="Daftar Gunung Api">
        <OfflineNotice offline={query.offline} />
        <VolcanoErrorBox message={query.error ?? 'Sumber MAGMA tidak merespons.'} retry={() => void query.refresh()} />
      </VolcanoPage>
    );
  }

  const summary = data.summary;
  const levelCounts = summary.byLevel;
  const active = level !== null ? VOLCANO_LEVELS.find((l) => l.level === level) ?? null : null;

  return (
    <VolcanoPage
      title="Daftar Gunung Api"
      hint="Status aktivitas resmi, persebaran pada peta, laporan terbaru, informasi letusan, dan VONA dari MAGMA Indonesia (PVMBG)."
      updatedAt={data.updatedAt}
      errors={data.errors}
    >
      <OfflineNotice offline={query.offline} />
      {data.error && <VolcanoErrorBox message={data.error} retry={() => void query.refresh()} />}

      {/* Kartu statistik: sekaligus filter tingkat aktivitas. */}
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <button
          type="button"
          onClick={() => setLevel(null)}
          aria-pressed={level === null}
          className={`min-w-0 rounded-lg border bg-surface px-4 py-3 text-left ${level === null ? 'border-accent' : 'border-line'}`}
        >
          <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
            <Mountain size={13} aria-hidden /> Dipantau
          </span>
          <span className="mt-1 block text-2xl font-semibold">{summary.total}</span>
          <span className="text-xs text-muted">gunung api</span>
        </button>
        {VOLCANO_LEVELS.map((entry) => {
          const isOn = level === entry.level;
          return (
            <button
              key={entry.level}
              type="button"
              onClick={() => setLevel(isOn ? null : entry.level)}
              aria-pressed={isOn}
              className={`min-w-0 rounded-lg border bg-surface px-4 py-3 text-left ${isOn ? 'border-accent' : LEVEL_ACCENT[entry.level]}`}
            >
              <span className="block text-xs font-semibold uppercase tracking-wide text-muted">{entry.label}</span>
              <span className="mt-1 flex items-baseline gap-1">
                <span className={`text-2xl font-semibold ${LEVEL_TEXT[entry.level]}`}>{levelCounts[entry.level] ?? 0}</span>
                <span className="text-xs text-muted">gunung api</span>
              </span>
              <VolcanoLevelBadge level={entry.level} compact />
            </button>
          );
        })}
      </div>

      {summary.stale && (
        <p role="status" className="mb-3 rounded-lg border border-[#C2711A]/50 bg-[#C2711A]/5 px-3 py-2 text-xs">
          Status terakhir gagal diperbarui dari MAGMA. Angka di atas adalah data terakhir yang berhasil diambil
          {summary.updatedAt ? ` pada ${fmtTime(summary.updatedAt)}` : ''}.
        </p>
      )}

      {/*
        Peta dan daftar berdampingan seperti dashboard: peta mendapat ruang
        tetap, daftar mengisi sisanya. Di layar menengah keduanya bertumpuk agar
        nama gunung dan peta tidak berdesakan.
      */}
      <div className="grid w-full min-w-0 grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
        <Panel className="min-w-0 overflow-hidden" title="Persebaran gunung api">
          <div className="h-80 xl:h-[32rem]">
            <VolcanoMapLazy
              volcanoes={volcanoes}
              selectedCode={selected}
              onSelect={setSelected}
            />
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line px-3 py-2 text-[11px] text-muted">
            {VOLCANO_LEVELS.map((entry) => (
              <span key={entry.level} className="inline-flex items-center gap-1.5">
                <span
                  aria-hidden
                  className={`inline-block h-2.5 w-2.5 rounded-full ${
                    entry.level === 1 ? 'bg-ok' : entry.level === 2 ? 'bg-[#C9A227]' : entry.level === 3 ? 'bg-[#C2711A]' : 'bg-danger'
                  }`}
                />
                {entry.label}
              </span>
            ))}
            <span className="ml-auto">{volcanoes.length} titik ditampilkan</span>
          </div>
        </Panel>

        <Panel
          className="min-w-0 self-start"
          title={active ? `Gunung api ${active.label}` : 'Daftar gunung api'}
        >
          <div className="border-b border-line px-3 py-2">
            <label className="relative flex min-h-9 items-center">
              <Search size={14} aria-hidden className="pointer-events-none absolute left-2.5 text-muted" />
              <span className="sr-only">Cari gunung api</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Cari gunung api atau provinsi"
                className="min-h-9 w-full min-w-0 rounded-md border border-line bg-surface pl-8 pr-2 text-sm"
              />
            </label>
          </div>

          {volcanoes.length === 0 ? (
            <div className="px-4 py-4">
              <VolcanoEmpty title="Tidak ada gunung api yang cocok">
                Daftar ini mengikuti klasifikasi resmi MAGMA; bila kosong berarti tidak ada gunung api pada
                tingkat tersebut saat ini.
              </VolcanoEmpty>
            </div>
          ) : (
            <>
              <ul className="divide-y divide-line">
                {list.visible.map((volcano) => (
                  <li
                    key={volcano.code}
                    className={`flex items-center gap-3 px-4 py-2.5 ${selected === volcano.code ? 'bg-accent/5' : ''}`}
                  >
                    <div className="min-w-0 flex-1">
                      <VolcanoLink code={volcano.code} name={volcano.name} />
                      <p className="truncate text-xs text-muted">
                        {volcano.province}
                        {volcano.elevation !== null ? ` · ${Math.round(volcano.elevation)} m` : ''}
                      </p>
                    </div>
                    <VolcanoLevelBadge level={volcano.level} compact />
                    <button
                      type="button"
                      onClick={() => setSelected(volcano.code === selected ? null : volcano.code)}
                      aria-label={`Tampilkan Gunung ${volcano.name} di peta`}
                      className="shrink-0 rounded border border-line px-2 py-1 text-xs font-medium hover:bg-line/40"
                    >
                      <MapPin size={12} aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
              <LoadMoreButton
                hasMore={list.hasMore}
                nextCount={list.nextCount}
                shown={list.shown}
                total={volcanoes.length}
                onLoadMore={list.showMore}
                label="gunung api"
                divided
              />
            </>
          )}
        </Panel>
      </div>

      <div className="mt-4 grid w-full min-w-0 grid-cols-1 gap-4 xl:grid-cols-2">
        <Panel className="min-w-0" title="Informasi letusan resmi terbaru">
          {data.latestEruptions.length === 0 ? (
            <div className="px-4 py-4">
              <VolcanoEmpty title="Belum ada informasi letusan yang diterbitkan">
                MAGMA menerbitkan informasi letusan (VEN) hanya ketika ada letusan yang teramati. Naiknya tingkat
                aktivitas tidak otomatis berarti erupsi.
              </VolcanoEmpty>
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {data.latestEruptions.slice(0, 6).map((event) => (
                <li key={event.id} className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <Waves size={14} aria-hidden className="shrink-0 text-muted" />
                    <VolcanoLink code={event.volcanoCode || 'na'} name={event.volcanoName} className="truncate" />
                    <span className="ml-auto shrink-0 text-xs text-muted">{fmtTime(event.occurredAt)}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted">
                    {event.ashHeightM !== null && event.ashHeightM > 0 ? `Kolom abu ${event.ashHeightM} m` : 'Tinggi kolom abu tidak tercantum'}
                    {event.durationSeconds !== null ? ` · durasi ${event.durationSeconds} detik` : ''}
                  </p>
                  <Link href={`/gunung-berapi/erupsi/${event.id}`} className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-accent underline">
                    Buka informasi letusan <ChevronRight size={11} aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel className="min-w-0" title="VONA terbaru (penerbangan)">
          {data.latestVona.length === 0 ? (
            <div className="px-4 py-4">
              <VolcanoEmpty title="Belum ada VONA terbaru">VONA diterbitkan untuk kepentingan penerbangan bila terjadi erupsi berabu.</VolcanoEmpty>
            </div>
          ) : (
            <ul className="space-y-2 px-3 py-2">
              {data.latestVona.slice(0, 4).map((notice) => <VonaCard key={notice.id} notice={notice} />)}
            </ul>
          )}
        </Panel>
      </div>

      <h2 className="mb-2 mt-6 flex items-center gap-2 text-sm font-semibold">
        Laporan aktivitas terbaru
        {data.reportDate && <span className="text-xs font-normal text-muted">periode {data.reportDate}</span>}
      </h2>
      {data.latestReports.length === 0 ? (
        <VolcanoEmpty title="Belum ada laporan aktivitas yang dapat dimuat" />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {data.latestReports.slice(0, 6).map((report) => <ReportCard key={report.id} report={report} />)}
        </div>
      )}

      {data.monitor && (
        <Panel title="Status pemantauan otomatis" className="mt-6">
          <div className="grid gap-2 px-4 py-3 text-xs sm:grid-cols-2">
            <p>
              Pemeriksaan terakhir:{' '}
              <strong>{data.monitor.lastCheckAt ? `${fmtTime(data.monitor.lastCheckAt)} (${fmtAgo(data.monitor.lastCheckAt)})` : 'belum berjalan'}</strong>
            </p>
            <p>Interval pemeriksaan server: <strong>{Math.round(data.monitor.pollSeconds / 60)} menit</strong></p>
            <p>
              Dasar notifikasi:{' '}
              <strong>{data.monitor.seeded ? 'sudah tercatat (perubahan baru akan diberitakan)' : 'belum tercatat'}</strong>
            </p>
            <p>Notifikasi terproses: <strong>{data.monitor.notifications.length}</strong></p>
          </div>
          {data.monitor.notifications.length > 0 && (
            <ul className="divide-y divide-line border-t border-line text-xs">
              {data.monitor.notifications.slice(0, 5).map((notification) => (
                <li key={notification.key} className="px-4 py-2">
                  <p className="font-medium">{notification.title}</p>
                  <p className="text-muted">
                    {fmtTime(notification.detectedAt)} · status pengiriman: {notification.delivery.status}
                    {notification.delivery.sent > 0 ? ` (${notification.delivery.sent} perangkat)` : ''}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      )}

      <Disclaimer>
        Ringkasan ini disusun dari data resmi MAGMA Indonesia/PVMBG dan hanya untuk pemantauan. Naiknya tingkat
        aktivitas bukan bukti telah terjadi erupsi; erupsi hanya dinyatakan bila PVMBG menerbitkan informasi
        letusan. Ikuti selalu arahan resmi PVMBG, Badan Geologi, dan pemerintah daerah.
      </Disclaimer>
    </VolcanoPage>
  );
}
