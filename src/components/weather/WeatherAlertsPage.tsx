'use client';

import { useMemo, useState } from 'react';
import { ExternalLink, RefreshCw, Search, TriangleAlert } from 'lucide-react';
import {
  PageTitle, Panel, Skeleton, StaleDataNotice, StateBox,
} from '@/components/ui/common';
import { CopyMiniReport } from '@/components/share/CopyMiniReport';
import { ShareActions } from '@/components/share/ShareActions';
import { LoadMoreButton, useProgressiveList } from '@/components/volcano/progressive';
import { fmtAgo, fmtTime } from '@/lib/formatting';
import { SOURCE_BMKG_WEATHER, weatherAlertText } from '@/lib/share/report-text';
import { useSavedArea, useWeatherAlerts } from '@/hooks/useWeather';
import type { WeatherAlert } from '@/types/weather';

/**
 * Halaman menu Peringatan Dini Cuaca Ekstrem.
 *
 * Sumber: RSS nowcast CAP BMKG (`bmkg.go.id/alerts/nowcast/id`) — feed yang sama
 * dengan yang dipakai halaman peringatan dini cuaca BMKG. Aplikasi tidak
 * menilai sendiri tingkat bahaya; judul, wilayah, dampak, dan imbauan dimuat
 * apa adanya dari BMKG.
 */
export function WeatherAlertsPage() {
  const [area] = useSavedArea();
  const alerts = useWeatherAlerts();
  const [query, setQuery] = useState('');
  const [onlyMine, setOnlyMine] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (alerts.data ?? []).filter((alert) => {
      if (onlyMine && area) {
        const haystack = `${alert.region ?? ''} ${alert.description}`.toLowerCase();
        if (!haystack.includes(area.province.toLowerCase()) && !haystack.includes(area.district.toLowerCase())) {
          return false;
        }
      }
      if (!q) return true;
      return `${alert.title} ${alert.description}`.toLowerCase().includes(q);
    });
  }, [alerts.data, query, onlyMine, area]);

  const list = useProgressiveList(filtered, { resetKey: `${query}|${onlyMine}|${alerts.data?.length ?? 0}` });
  const newest = alerts.data?.[0] ?? null;
  const reportText = newest ? weatherAlertText(newest) : '';

  return (
    <>
      <PageTitle
        title="Peringatan Dini Cuaca Ekstrem"
        hint="Peringatan cuaca ekstrem resmi BMKG (nowcast): hujan lebat, petir, angin kencang, dan potensi dampaknya. Daftar dimuat langsung dari feed peringatan BMKG."
      />

      {alerts.loading && !alerts.data && (
        <>
          <Skeleton className="mb-4 h-24" />
          <Skeleton className="h-64" />
        </>
      )}

      {!alerts.loading && !alerts.data && (
        <StateBox kind="error" title="Peringatan cuaca tidak dapat dimuat">
          {alerts.error ?? 'Server tidak mengembalikan peringatan cuaca.'}
        </StateBox>
      )}

      {alerts.data && (
        <>
          <StaleDataNotice error={alerts.error} updatedAt={alerts.updatedAt} />

          <Panel className="mb-4">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <p className="flex items-center gap-2 text-sm">
                <TriangleAlert size={16} aria-hidden className="text-danger" />
                <strong className="font-semibold">{alerts.data.length}</strong> peringatan aktif dari BMKG
              </p>
              {alerts.updatedAt && (
                <p className="text-xs text-muted">Diperiksa {fmtAgo(alerts.updatedAt)}</p>
              )}
              <button
                type="button"
                onClick={() => void alerts.refresh()}
                className="ml-auto inline-flex min-h-9 items-center gap-1.5 rounded-md border border-line px-3 text-sm font-medium hover:bg-line/40"
              >
                <RefreshCw size={14} aria-hidden className={alerts.loading ? 'animate-spin' : ''} />
                Perbarui
              </button>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <div className="relative min-w-[220px] flex-1">
                <label htmlFor="alert-search" className="sr-only">Cari wilayah atau jenis cuaca</label>
                <Search size={14} aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  id="alert-search"
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Cari wilayah, mis. Bali atau Kalimantan…"
                  className="min-h-9 w-full rounded-md border border-line bg-surface pl-8 pr-3 text-sm"
                />
              </div>
              {area && (
                <label className="inline-flex items-center gap-1.5 text-xs">
                  <input
                    type="checkbox"
                    checked={onlyMine}
                    onChange={(event) => setOnlyMine(event.target.checked)}
                    className="size-3.5"
                  />
                  Hanya wilayah saya ({area.province})
                </label>
              )}
            </div>
          </Panel>

          {filtered.length === 0 ? (
            <StateBox kind="empty" title="Tidak ada peringatan yang cocok">
              {alerts.data.length === 0
                ? 'BMKG tidak sedang menerbitkan peringatan dini cuaca ekstrem. Halaman ini akan ikut diperbarui saat peringatan baru terbit.'
                : 'Ubah kata kunci atau matikan filter wilayah untuk melihat semua peringatan.'}
            </StateBox>
          ) : (
            <ul className="space-y-3">
              {list.visible.map((alert) => (
                <li key={alert.id}>
                  <AlertCard alert={alert} />
                </li>
              ))}
            </ul>
          )}

          <div className="rounded-lg border border-line bg-surface">
            <LoadMoreButton
              hasMore={list.hasMore}
              nextCount={list.nextCount}
              shown={list.shown}
              total={filtered.length}
              onLoadMore={list.showMore}
              label="peringatan"
            />
          </div>

          {newest && (
            <section className="mt-4" aria-label="Bagikan peringatan terbaru">
              <ShareActions
                reportText={reportText}
                shareTitle={`Peringatan cuaca ekstrem: ${newest.title}`}
                origin="Seismos Indonesia"
                source={SOURCE_BMKG_WEATHER}
              />
            </section>
          )}

          <p className="mt-6 text-xs text-muted">
            Sumber: <a className="underline" href="https://www.bmkg.go.id/cuaca/peringatan-dini-cuaca" target="_blank" rel="noopener noreferrer">BMKG — Peringatan Dini Cuaca</a>.
            Peringatan berlaku untuk periode waktu yang tercantum; ikuti imbauan BMKG dan pemerintah daerah setempat.
          </p>
        </>
      )}
    </>
  );
}

function AlertCard({ alert }: { alert: WeatherAlert }) {
  const [expanded, setExpanded] = useState(false);
  const expired = alert.expiresAt ? Date.parse(alert.expiresAt) < Date.now() : false;
  const text = weatherAlertText(alert);

  return (
    <article className="rounded-lg border border-line bg-surface">
      <div className="flex flex-wrap items-start gap-2 border-b border-line px-3 py-2.5">
        <TriangleAlert size={15} aria-hidden className="mt-0.5 shrink-0 text-danger" />
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold">{alert.title}</h2>
          <p className="mt-0.5 text-[11px] text-muted">
            Diterbitkan {fmtTime(alert.issuedAt)}
            {alert.expiresAt ? ` · diperkirakan hingga ${fmtTime(alert.expiresAt)}` : ''}
            {expired ? ' · periode peringatan sudah lewat' : ''}
          </p>
        </div>
        <CopyMiniReport text={text} label={`Salin peringatan cuaca: ${alert.title}`} />
      </div>

      <div className="space-y-2 px-3 py-2.5 text-sm">
        <p className={`whitespace-pre-line ${expanded ? '' : 'line-clamp-3'}`}>{alert.description}</p>
        {alert.description.split(/\n/).filter(Boolean).length > 3 && (
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            className="text-xs font-medium text-accent underline"
          >
            {expanded ? 'Ringkas' : 'Baca lengkap'}
          </button>
        )}
        {alert.impacts.length > 0 && (
          <div>
            <p className="text-xs font-medium">Potensi dampak</p>
            <ul className="mt-1 flex flex-wrap gap-1">
              {alert.impacts.map((impact) => (
                <li key={impact} className="rounded-full border border-line px-2 py-0.5 text-[11px]">
                  {impact}
                </li>
              ))}
            </ul>
          </div>
        )}
        <a
          href={alert.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-muted underline"
        >
          Dokumen peringatan resmi BMKG <ExternalLink size={11} aria-hidden />
        </a>
      </div>
    </article>
  );
}
