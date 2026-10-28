'use client';

import { useMemo, useState } from 'react';
import { CalendarDays, ExternalLink, Info } from 'lucide-react';
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

      <Panel className="mb-4" title="Wilayah prakiraan">
        <div className="space-y-3">
          {area ? (
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <p className="text-base font-semibold">{area.district}</p>
              <p className="text-sm text-muted">
                {area.regency} · {area.province} · kode BMKG {area.code}
              </p>
              <p className="text-[11px] text-muted">
                {area.mode === 'geo'
                  ? `Diambil dari lokasi perangkat${area.distanceKm !== undefined ? ` (±${Math.round(area.distanceKm)} km)` : ''}`
                  : 'Dipilih manual'}
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted">
              Belum ada wilayah tersimpan. Gunakan lokasi perangkat agar cuaca sesuai tempat Anda, atau cari wilayah sendiri.
            </p>
          )}
          <AreaPicker onSelect={() => setDayIndex(0)} />
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

          <div className="grid gap-4 lg:grid-cols-3">
            <Panel title="Saat ini" className="lg:col-span-1">
              {nowPoint ? (
                <div className="space-y-3">
                  <WeatherMain point={nowPoint} />
                  <p className="text-xs text-muted">
                    {formatClock(nowPoint.time, timezone)} {zoneLabel(timezone)} · {dayLabel(nowPoint.time.slice(0, 10))}
                  </p>
                  <WeatherFacts point={nowPoint} />
                  {isSignificantWeather(nowPoint) && (
                    <p className="rounded-md border border-accent/40 bg-accent/5 px-2.5 py-1.5 text-xs">
                      BMKG menyebut potensi hujan/petir pada interval ini. Siapkan perlindungan bila beraktivitas di luar.
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted">
                  Tidak ada interval berjalan pada data ini. Lihat prakiraan per hari di samping.
                </p>
              )}
              <dl className="mt-4 space-y-1 border-t border-line pt-3 text-[11px] text-muted">
                <div className="flex justify-between gap-2">
                  <dt>Data diperbarui</dt>
                  <dd>{forecast.updatedAt ? fmtAgo(forecast.updatedAt) : 'tidak tercantum'}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt>Analisis model BMKG</dt>
                  <dd>{forecast.data.analysisAt ? new Date(`${forecast.data.analysisAt}Z`).toISOString().slice(0, 16).replace('T', ' ') + ' UTC' : 'tidak tercantum'}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt>Jumlah interval</dt>
                  <dd>{forecast.data.points.length} titik</dd>
                </div>
              </dl>
              <p className="mt-3 text-[11px] leading-relaxed text-muted">
                Prakiraan BMKG berlaku untuk satu kecamatan. Angka yang tidak diterbitkan BMKG ditampilkan sebagai “—”.
              </p>
            </Panel>

            <Panel className="lg:col-span-2" title="Prakiraan per hari">
              <div className="-mx-1 mb-3 flex gap-1 overflow-x-auto pb-1">
                {days.map((day, index) => (
                  <button
                    key={day.date}
                    type="button"
                    onClick={() => setDayIndex(index)}
                    aria-pressed={index === dayIndex}
                    className={`shrink-0 rounded-md border px-3 py-1.5 text-xs font-medium ${
                      index === dayIndex ? 'border-accent bg-accent/10 text-ink' : 'border-line hover:bg-line/40'
                    }`}
                  >
                    <span className="flex items-center gap-1">
                      <CalendarDays size={12} aria-hidden />
                      {dayLabel(day.date)}
                    </span>
                    <span className="text-[10px] text-muted">{day.points.length} interval</span>
                  </button>
                ))}
              </div>

              {activeDay ? (
                <>
                  <ul className="space-y-1.5">
                    {list.visible.map((point) => (
                      <li
                        key={point.time}
                        className={`flex items-start gap-3 rounded-md border px-2.5 py-2 ${rainTone(point)}`}
                      >
                        <span className="w-12 shrink-0 pt-1 text-xs font-medium tabular-nums">
                          {formatClock(point.time, timezone)}
                        </span>
                        <WeatherIcon point={point} size={30} />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm">
                            <strong className="font-semibold">
                              {point.temperatureC !== null ? `${Math.round(point.temperatureC)}°C` : '—'}
                            </strong>{' '}
                            {point.description}
                          </span>
                          <span className="mt-0.5 block">
                            <WeatherFacts point={point} />
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-[11px] text-muted">
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
                <p className="text-sm text-muted">Tidak ada interval cuaca pada hari ini.</p>
              )}
            </Panel>
          </div>

          <Panel className="mt-4" title="Ringkasan semua hari">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {days.map((day) => {
                const wet = day.points.filter(isSignificantWeather);
                return (
                  <div key={day.date} className={`rounded-lg border p-3 ${wet.length > 0 ? 'border-accent/40 bg-accent/5' : 'border-line bg-surface'}`}>
                    <p className="text-sm font-medium">{dayLabel(day.date)}</p>
                    <p className="mt-1 text-xs text-muted">
                      {wet.length > 0
                        ? `${wet.length} interval berpotensi hujan dari ${day.points.length}`
                        : 'BMKG tidak menyebut hujan lebat/petir'}
                    </p>
                  </div>
                );
              })}
            </div>
          </Panel>

          <section className="mt-4" aria-label="Bagikan prakiraan">
            <ShareActions
              pageUrl={undefined}
              reportText={reportText}
              shareTitle={`Prakiraan cuaca ${forecast.data.area.district}`}
              origin="Seismos Indonesia"
              source={SOURCE_BMKG_WEATHER}
            />
            <p className="mt-2 flex items-start gap-1.5 text-[11px] text-muted">
              <Info size={12} aria-hidden className="mt-0.5 shrink-0" />
              <span>
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
