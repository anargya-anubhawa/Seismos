'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ChevronRight, Mountain, Radio, Waves } from 'lucide-react';
import { LoadingNotice, Panel, Skeleton } from '@/components/ui/common';
import { fmtAgo, fmtTime } from '@/lib/formatting';
import { useVolcanoQuery } from '@/hooks/useVolcano';
import { VOLCANO_LEVELS } from '@/types/volcano';
import type { VolcanoLevel } from '@/types/volcano';
import type { VolcanoOverviewPayload } from '@/types/volcano-ui';
import {
  ReportCard, VonaCard, VolcanoLevelBadge, VolcanoLink,
} from './parts';
import { Disclaimer, OfflineNotice, VolcanoEmpty, VolcanoErrorBox, VolcanoPage } from './layout';
import { LoadMoreButton, useProgressiveList } from './progressive';

const LEVEL_ACCENT: Record<VolcanoLevel, string> = {
  1: 'border-ok/50',
  2: 'border-[#B08A00]/50',
  3: 'border-[#C2711A]/60',
  4: 'border-danger/60',
};

export function VolcanoOverview() {
  const query = useVolcanoQuery<VolcanoOverviewPayload>('/api/volcano/overview', { pollMs: 120_000 });
  const [level, setLevel] = useState<VolcanoLevel | null>(null);

  const data = query.data;
  const volcanoes = useMemo(() => {
    const list = data?.volcanoes ?? [];
    return level ? list.filter((volcano) => volcano.level === level) : list;
  }, [data?.volcanoes, level]);

  // 10 entri pertama saja agar halaman tidak padat; sisanya lewat "Muat lebih
  // banyak". Kunci reset memuat filter tingkat agar hitungan kembali ke awal.
  const list = useProgressiveList(volcanoes, { resetKey: String(level ?? 'all') });

  if (query.loading && !data) {
    return (
      <VolcanoPage title="Gunung Berapi Indonesia" hint="Kondisi gunung api yang dipantau PVMBG berdasarkan data resmi MAGMA.">
        <LoadingNotice>Mengambil data gunung api dari MAGMA…</LoadingNotice>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}
        </div>
      </VolcanoPage>
    );
  }

  if (!data) {
    return (
      <VolcanoPage title="Gunung Berapi Indonesia">
        <OfflineNotice offline={query.offline} />
        <VolcanoErrorBox message={query.error ?? 'Sumber MAGMA tidak merespons.'} retry={() => void query.refresh()} />
      </VolcanoPage>
    );
  }

  const summary = data.summary;
  const levelCounts = summary.byLevel;

  return (
    <VolcanoPage
      title="Gunung Berapi Indonesia"
      hint="Ringkasan status aktivitas resmi, laporan terbaru, informasi letusan, dan VONA dari MAGMA Indonesia (PVMBG)."
      updatedAt={data.updatedAt}
      errors={data.errors}
    >
      <OfflineNotice offline={query.offline} />
      {data.error && <VolcanoErrorBox message={data.error} retry={() => void query.refresh()} />}

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <button
          type="button"
          onClick={() => setLevel(null)}
          aria-pressed={level === null}
          className={`rounded-lg border bg-surface px-4 py-3 text-left ${level === null ? 'border-accent' : 'border-line'}`}
        >
          <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
            <Mountain size={13} aria-hidden /> Dipantau
          </span>
          <span className="mt-1 block text-2xl font-semibold">{summary.total}</span>
          <span className="text-xs text-muted">gunung api</span>
        </button>
        {VOLCANO_LEVELS.map((entry) => (
          <button
            key={entry.level}
            type="button"
            onClick={() => setLevel(level === entry.level ? null : entry.level)}
            aria-pressed={level === entry.level}
            className={`rounded-lg border bg-surface px-4 py-3 text-left ${level === entry.level ? 'border-accent' : LEVEL_ACCENT[entry.level]}`}
          >
            <span className="block text-xs font-semibold uppercase tracking-wide text-muted">{entry.label}</span>
            <span className="mt-1 flex items-baseline gap-1">
              <span className="text-2xl font-semibold">{levelCounts[entry.level] ?? 0}</span>
              <span className="text-xs text-muted">gunung api</span>
            </span>
            <VolcanoLevelBadge level={entry.level} compact />
          </button>
        ))}
      </div>

      {summary.stale && (
        <p role="status" className="mb-3 rounded-lg border border-[#C2711A]/50 bg-[#C2711A]/5 px-3 py-2 text-xs">
          Status terakhir gagal diperbarui dari MAGMA. Angka di atas adalah data terakhir yang berhasil diambil
          {summary.updatedAt ? ` pada ${fmtTime(summary.updatedAt)}` : ''}.
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {/*
          `self-start` penting: tanpa itu panel daftar ikut meregang setinggi
          kolom samping (letusan + VONA) sehingga muncul ruang kosong besar di
          bawah tombol "Muat". Dengan `self-start`, panel setinggi isinya saja.
        */}
        <Panel
          title={level ? `Gunung api ${VOLCANO_LEVELS.find((l) => l.level === level)?.label}` : 'Daftar gunung api'}
          className="self-start lg:col-span-2"
        >
          {volcanoes.length === 0 ? (
            <div className="px-4 py-4">
              <VolcanoEmpty title="Tidak ada gunung api pada tingkat ini">
                Daftar ini mengikuti klasifikasi resmi MAGMA; bila kosong berarti tidak ada gunung api pada tingkat tersebut saat ini.
              </VolcanoEmpty>
            </div>
          ) : (
            <>
              <ul className="divide-y divide-line">
                {list.visible.map((volcano) => (
                  <li key={volcano.code} className="flex items-center gap-3 px-4 py-2.5">
                    <div className="min-w-0 flex-1">
                      <VolcanoLink code={volcano.code} name={volcano.name} />
                      <p className="truncate text-xs text-muted">
                        {volcano.province}
                        {volcano.elevation !== null ? ` · ${Math.round(volcano.elevation)} m` : ''}
                      </p>
                    </div>
                    <VolcanoLevelBadge level={volcano.level} compact />
                    <Link
                      href={`/gunung-berapi/${volcano.code.toLowerCase()}`}
                      className="shrink-0 rounded border border-line px-2 py-1 text-xs font-medium hover:bg-line/40"
                      aria-label={`Buka detail Gunung ${volcano.name}`}
                    >
                      Detail
                    </Link>
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

        <div className="space-y-4">
          <Panel title="Informasi letusan resmi terbaru">
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

          <Panel title="VONA terbaru (penerbangan)">
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
      </div>

      <h2 className="mb-2 mt-6 flex items-center gap-2 text-sm font-semibold">
        <Radio size={15} aria-hidden /> Laporan aktivitas terbaru
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
