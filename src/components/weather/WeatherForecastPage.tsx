'use client';

import { useMemo, useState } from 'react';
import { CalendarDays, ExternalLink, Info, LocateFixed } from 'lucide-react';
import {
  PageTitle, Panel, Skeleton, StaleDataNotice, StateBox,
} from '@/components/ui/common';
import { ShareActions } from '@/components/share/ShareActions';
import { LoadMoreButton, useProgressiveList } from '@/components/volcano/progressive';
import { fmtAgo } from '@/lib/formatting';
import { SOURCE_BMKG_WEATHER, weatherForecastText } from '@/lib/share/report-text';
import { groupByLocalDate, dayLabel, isSignificantWeather } from '@/lib/weather/parse';
import { useSavedArea, useWeatherForecast } from '@/hooks/useWeather';
import { AreaPicker } from './AreaPicker';
import { WeatherFacts, WeatherIcon, WeatherMain, formatClock, rainTone, zoneLabel } from './parts';

/**
 * Halaman menu Prakiraan Cuaca.
 *
 * Sumber dan susunan mengikuti halaman BMKG `cuaca/prakiraan-cuaca`: prakiraan
 * per desa/kelurahan, satu baris per interval waktu, dikelompokkan per hari.
 * Semua fitur menu lain tetap ada: salin tautan, salin laporan, kirim ke,
 * daftar bertahap (10 entri), dan pencarian wilayah.
 */
export function WeatherForecastPage() {
  const [area] = useSavedArea();
  const forecast = useWeatherForecast(area?.code ?? null);
  const [dayIndex, setDayIndex] = useState(0);

  const days = useMemo(() => groupByLocalDate(forecast.data?.points ?? []), [forecast.data]);
  const activeDay = days[Math.min(dayIndex, Math.max(0, days.length - 1))] ?? null;
  const points = activeDay?.points ?? [];
  const list = useProgressiveList(points, { resetKey: `${area?.code ?? '-'}:${activeDay?.date ?? '-'}` });
  const timezone = forecast.data?.timezone ?? 'Asia/Jakarta';
  const reportText = forecast.data ? weatherForecastText(forecast.data, { pageUrl: undefined }) : '';

  const nowPoint = useMemo(() => {
    const now = Date.now();
    return forecast.data?.points.find((point) => Date.parse(point.time) >= now - 60 * 60_000) ?? null;
  }, [forecast.data]);

  return (
    <>
      <PageTitle
        title="Prakiraan Cuaca"
        hint="Prakiraan cuaca desa/kelurahan resmi BMKG untuk tiga hari ke depan, per interval tiga jam. Pilih wilayah lewat lokasi perangkat atau pencarian."
      />

      <Panel className="mb-4 min-w-0">
        <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:items-center">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
              <LocateFixed size={12} aria-hidden className="text-accent" />
              Wilayah prakiraan
            </p>
            {area ? (
              <>
                <p className="mt-1 truncate text-lg font-semibold">{area.district}</p>
                <p className="mt-0.5 truncate text-sm text-muted">
                  {area.regency} · {area.province}
                </p>
                <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted">
                  <span className="rounded-full border border-line px-2 py-0.5 tabular-nums">adm4 {area.code}</span>
                  <span>
                    {area.mode === 'geo'
                      ? `dari lokasi perangkat${area.distanceKm !== undefined ? ` (±${Math.round(area.distanceKm)} km)` : ''}`
                      : 'dipilih manual'}
                  </span>
                </p>
              </>
            ) : (
              <p className="mt-1 text-sm text-muted">
                Belum ada wilayah tersimpan. Gunakan lokasi perangkat agar cuaca sesuai tempat Anda, atau cari wilayah sendiri.
              </p>
            )}
          </div>
          <div className="min-w-0 rounded-lg border border-line bg-bg/40 p-3">
            <AreaPicker onSelect={() => setDayIndex(0)} />
          </div>
        </div>
      </Panel>

      {!area && (
        <StateBox kind="empty" title="Pilih wilayah terlebih dahulu">
          Prakiraan BMKG diterbitkan per desa/kelurahan, jadi wilayah perlu ditentukan sebelum data dapat ditampilkan.
        </StateBox>
      )}

      {area && forecast.loading && !forecast.data && (
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-44" />
          <Skeleton className="h-44 lg:col-span-2" />
        </div>
      )}

      {area && !forecast.loading && !forecast.data && (
        <StateBox kind="error" title="Prakiraan cuaca tidak dapat dimuat">
          {forecast.error ?? 'Server tidak mengembalikan prakiraan cuaca.'}
          <div className="mt-3">
            <button
              type="button"
              onClick={() => void forecast.refresh()}
              className="rounded-md border border-line px-3 py-1.5 text-sm font-medium hover:bg-line/40"
            >
              Coba lagi
            </button>
          </div>
        </StateBox>
      )}

      {forecast.data && (
        <>
          <StaleDataNotice error={forecast.error} updatedAt={forecast.updatedAt} />

          {/*
            Tata letak dua kolom hanya dipakai mulai layar sangat lebar. Di
            layar menengah kolom "Saat ini" akan terlalu sempit sehingga angka
            suhu dan fakta cuaca berdesakan, jadi satu kolom penuh lebih rapi.
          */}
          <div className="grid gap-4 xl:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
            <Panel className="min-w-0" title="Saat ini">
              {nowPoint ? (
                <div className="space-y-4 p-4">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <WeatherMain point={nowPoint} />
                    <p className="ml-auto text-right text-[11px] leading-tight text-muted">
                      {formatClock(nowPoint.time, timezone)} {zoneLabel(timezone)}
                      <br />
                      {dayLabel(nowPoint.time.slice(0, 10))}
                    </p>
                  </div>
                  <WeatherFacts point={nowPoint} />
                  {isSignificantWeather(nowPoint) && (
                    <p className="rounded-md border border-accent/40 bg-accent/5 px-2.5 py-1.5 text-xs">
                      BMKG menyebut potensi hujan/petir pada interval ini. Siapkan perlindungan bila beraktivitas di luar.
                    </p>
                  )}
                  <dl className="space-y-1 border-t border-line pt-3 text-[11px] text-muted">
                    <div className="flex items-baseline justify-between gap-3">
                      <dt className="shrink-0">Data diperbarui</dt>
                      <dd className="min-w-0 text-right">{forecast.updatedAt ? fmtAgo(forecast.updatedAt) : 'tidak tercantum'}</dd>
                    </div>
                    <div className="flex items-baseline justify-between gap-3">
                      <dt className="shrink-0">Analisis model</dt>
                      <dd className="min-w-0 text-right">
                        {forecast.data.analysisAt ? `${forecast.data.analysisAt.slice(0, 16).replace('T', ' ')} UTC` : 'tidak tercantum'}
                      </dd>
                    </div>
                    <div className="flex items-baseline justify-between gap-3">
                      <dt className="shrink-0">Interval tersedia</dt>
                      <dd className="min-w-0 text-right">{forecast.data.points.length} titik</dd>
                    </div>
                  </dl>
                </div>
              ) : (
                <p className="p-4 text-sm text-muted">
                  Tidak ada interval berjalan pada data ini. Lihat prakiraan per hari di samping.
                </p>
              )}
            </Panel>

            <Panel className="min-w-0" title="Prakiraan per hari">
              {/* Pemilih hari: gulir horizontal HANYA di dalam panelnya. */}
              <div className="min-w-0 overflow-x-auto border-b border-line px-3 pt-3">
                <div role="tablist" aria-label="Pilih hari" className="flex w-max gap-1.5 pb-3">
                  {days.map((day, index) => (
                    <button
                      key={day.date}
                      type="button"
                      role="tab"
                      onClick={() => setDayIndex(index)}
                      aria-selected={index === dayIndex}
                      className={`shrink-0 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                        index === dayIndex
                          ? 'border-accent bg-accent/10 text-ink'
                          : 'border-line text-muted hover:bg-line/40 hover:text-ink'
                      }`}
                    >
                      <span className="flex items-center gap-1 whitespace-nowrap">
                        <CalendarDays size={12} aria-hidden />
                        {dayLabel(day.date)}
                      </span>
                      <span className="block text-[10px] font-normal text-muted">{day.points.length} interval</span>
                    </button>
                  ))}
                </div>
              </div>

              {activeDay ? (
                <>
                  <ul className="space-y-1.5 p-3">
                    {list.visible.map((point) => (
                      <li
                        key={point.time}
                        className={`flex min-w-0 items-start gap-3 rounded-lg border px-3 py-2 ${rainTone(point)}`}
                      >
                        <span className="w-11 shrink-0 pt-1.5 text-xs font-semibold tabular-nums">
                          {formatClock(point.time, timezone)}
                        </span>
                        <span className="shrink-0 pt-0.5"><WeatherIcon point={point} size={28} /></span>
                        {/* min-w-0 wajib: tanpa ini teks panjang mendorong lebar baris. */}
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-baseline gap-x-1.5">
                            <strong className="text-sm font-semibold tabular-nums">
                              {point.temperatureC !== null ? `${Math.round(point.temperatureC)}°C` : '—'}
                            </strong>
                            <span className="min-w-0 truncate text-sm">{point.description}</span>
                          </span>
                          <span className="mt-1 block"><WeatherFacts point={point} /></span>
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p className="px-3 pb-2 text-[11px] text-muted">
                    Petak berwarna menandai interval yang disebut BMKG berpotensi hujan lebat/petir.
                  </p>
                  <LoadMoreButton
                    hasMore={list.hasMore}
                    nextCount={list.nextCount}
                    shown={list.shown}
                    total={points.length}
                    onLoadMore={list.showMore}
                    label="interval"
                    divided
                  />
                </>
              ) : (
                <p className="p-4 text-sm text-muted">Tidak ada interval cuaca pada hari ini.</p>
              )}
            </Panel>
          </div>

          <Panel className="mt-4 min-w-0" title="Ringkasan semua hari">
            <div className="grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-3">
              {days.map((day) => {
                const wet = day.points.filter(isSignificantWeather);
                const temps = day.points.map((p) => p.temperatureC).filter((v): v is number => v !== null);
                return (
                  <div
                    key={day.date}
                    className={`min-w-0 rounded-lg border p-3 ${wet.length > 0 ? 'border-accent/40 bg-accent/5' : 'border-line bg-surface'}`}
                  >
                    <p className="truncate text-sm font-medium">{dayLabel(day.date)}</p>
                    <p className="mt-0.5 text-xs text-muted">
                      {temps.length > 0
                        ? `${Math.round(Math.min(...temps))}–${Math.round(Math.max(...temps))}°C`
                        : 'Suhu tidak tercantum'}
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      {wet.length > 0
                        ? `${wet.length} dari ${day.points.length} interval berpotensi hujan`
                        : 'BMKG tidak menyebut hujan lebat/petir'}
                    </p>
                  </div>
                );
              })}
            </div>
          </Panel>

          <section className="mt-4 min-w-0" aria-label="Bagikan prakiraan">
            <ShareActions
              pageUrl={undefined}
              reportText={reportText}
              shareTitle={`Prakiraan cuaca ${forecast.data.area.district}`}
              origin="Seismos Indonesia"
              source={SOURCE_BMKG_WEATHER}
            />
            <p className="mt-2 flex items-start gap-1.5 text-[11px] text-muted">
              <Info size={12} aria-hidden className="mt-0.5 shrink-0" />
              <span className="min-w-0">
                Laporan hanya memuat {Math.min(8, forecast.data.points.length)} interval pertama. Prakiraan resmi selalu di{' '}
                <a
                  href={forecast.data.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-0.5 underline"
                >
                  bmkg.go.id <ExternalLink size={10} aria-hidden />
                </a>
                .
              </span>
            </p>
          </section>

          <p className="mt-6 text-xs text-muted">
            Sumber: <a className="underline" href="https://www.bmkg.go.id/cuaca/prakiraan-cuaca" target="_blank" rel="noopener noreferrer">BMKG — prakiraan cuaca desa/kelurahan</a>.
            Kode wilayah dari data terbuka Kemendagri/BPS; prakiraan BMKG berlaku satu kecamatan. Prakiraan dapat berubah
            setelah pemutakhiran, jadi rujuk kanal resmi BMKG sebelum mengambil keputusan penting.
          </p>
        </>
      )}
    </>
  );
}
