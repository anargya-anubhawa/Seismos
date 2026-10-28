'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { CloudSun, Droplets, ExternalLink, LocateFixed, Mountain, TriangleAlert, Waves, Wind } from 'lucide-react';
import { Panel } from '@/components/ui/common';
import { AreaPicker } from '@/components/weather/AreaPicker';
import { WeatherIcon, formatClock, zoneLabel } from '@/components/weather/parts';
import { useVolcanoQuery } from '@/hooks/useVolcano';
import { useSavedArea, useWeatherAlerts, useWeatherForecast } from '@/hooks/useWeather';
import { fmtAgo, fmtTime } from '@/lib/formatting';
import { dayLabel, groupByLocalDate, isSignificantWeather } from '@/lib/weather/parse';
import type { EruptionEvent } from '@/types/volcano';
import type { TsunamiFeed } from '@/types/tsunami';
import type { WeatherAlert } from '@/types/weather';

/**
 * Blok dashboard cuaca + kejadian penting.
 *
 * Prinsip isi:
 *  - Cuaca merupakan kartu pertama dashboard dan mengikuti wilayah tersimpan
 *    (lokasi perangkat bila pengguna mengizinkan, atau pilihan manual).
 *  - Bagian "perlu perhatian" hanya muncul bila memang ada kejadian terkini
 *    yang diterbitkan sumber resmi (letusan MAGMA/PVMBG, peringatan tsunami
 *    BMKG, peringatan dini cuaca BMKG). Tidak ada kejadian = tidak ada bagian
 *    kosong, bukan teks "tidak ada data".
 */

/** Jendela "masih hangat": letusan/peristiwa yang lebih lama dari ini tidak lagi ditonjolkan. */
export const HOT_WINDOW_MS = 24 * 60 * 60 * 1_000;

/** Peringatan cuaca yang terbit lebih lama dari ini dianggap tidak lagi mendesak. */
export const ALERT_WINDOW_MS = 6 * 60 * 60 * 1_000;

export function isHot(occurredAt: string | null | undefined, now = Date.now()): boolean {
  if (!occurredAt) return false;
  const time = Date.parse(occurredAt);
  if (!Number.isFinite(time)) return false;
  return now - time <= HOT_WINDOW_MS;
}

/* ---------------------------------------------------------------- cuaca -- */

export function WeatherDashboardCard() {
  const [area] = useSavedArea();
  const forecast = useWeatherForecast(area?.code ?? null);
  const alerts = useWeatherAlerts(area?.district ?? null);

  const timezone = forecast.data?.timezone ?? 'Asia/Jakarta';
  const points = useMemo(() => forecast.data?.points ?? [], [forecast.data]);
  const nowPoint = useMemo(() => {
    const now = Date.now();
    return points.find((point) => Date.parse(point.time) >= now - 60 * 60_000) ?? points[0] ?? null;
  }, [points]);
  const days = useMemo(() => groupByLocalDate(points).slice(0, 3), [points]);

  if (!area) {
    return (
      <Panel title="Cuaca di lokasi Anda" className="min-w-0">
        <div className="space-y-3 px-4 py-3">
          <p className="flex items-start gap-2 text-sm text-muted">
            <LocateFixed size={16} aria-hidden className="mt-0.5 shrink-0 text-accent" />
            <span>
              Cuaca disesuaikan dengan lokasi Anda bila diizinkan. Prakiraan BMKG diterbitkan per desa/kelurahan, jadi
              wilayah perlu dipilih sekali agar cuaca akurat.
            </span>
          </p>
          <AreaPicker />
        </div>
      </Panel>
    );
  }

  return (
    <Panel title="Cuaca di lokasi Anda" className="min-w-0">
      <div className="space-y-3 px-4 py-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{area.district}</p>
            <p className="truncate text-[11px] text-muted">
              {area.regency} · {area.province}
              {area.mode === 'geo' && area.distanceKm !== undefined
                ? ` · ±${Math.round(area.distanceKm)} km dari lokasi`
                : ''}
            </p>
          </div>
          <Link href="/cuaca" className="inline-flex items-center gap-1 text-xs font-medium text-accent underline">
            <CloudSun size={13} aria-hidden />
            Prakiraan lengkap
          </Link>
        </div>

        {nowPoint ? (
          <>
            <div className="flex items-center gap-3">
              <WeatherIcon point={nowPoint} size={46} />
              <div className="min-w-0">
                <p className="text-3xl font-semibold leading-none">
                  {nowPoint.temperatureC !== null ? `${Math.round(nowPoint.temperatureC)}°C` : '—'}
                </p>
                <p className="mt-1 truncate text-sm text-muted">{nowPoint.description}</p>
              </div>
              <div className="ml-auto text-right text-[11px] text-muted">
                <p>{formatClock(nowPoint.time, timezone)} {zoneLabel(timezone)}</p>
                <p>{forecast.updatedAt ? `data ${fmtAgo(forecast.updatedAt)}` : ''}</p>
              </div>
            </div>

            <dl className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
              {nowPoint.humidityPct !== null && (
                <div className="flex items-center gap-1">
                  <Droplets size={12} aria-hidden className="text-muted" />
                  <dt className="sr-only">Kelembapan</dt>
                  <dd>{Math.round(nowPoint.humidityPct)}%</dd>
                </div>
              )}
              {nowPoint.windSpeedKmh !== null && (
                <div className="flex items-center gap-1">
                  <Wind size={12} aria-hidden className="text-muted" />
                  <dt className="sr-only">Angin</dt>
                  <dd>{nowPoint.windFrom ? `${nowPoint.windFrom} ` : ''}{Math.round(nowPoint.windSpeedKmh)} km/jam</dd>
                </div>
              )}
              {nowPoint.precipitationMm !== null && (
                <div className="flex items-center gap-1">
                  <Droplets size={12} aria-hidden className="text-muted" />
                  <dt className="sr-only">Hujan</dt>
                  <dd>{nowPoint.precipitationMm > 0 ? `${nowPoint.precipitationMm} mm` : 'tanpa hujan'}</dd>
                </div>
              )}
            </dl>

            {days.length > 1 && (
              <ul className="grid grid-cols-2 gap-2 border-t border-line pt-2.5 sm:grid-cols-3">
                {days.slice(1).map((day) => {
                  const wet = day.points.filter(isSignificantWeather).length;
                  const temps = day.points.map((p) => p.temperatureC).filter((v): v is number => v !== null);
                  return (
                    <li key={day.date} className="text-[11px]">
                      <p className="font-medium">{dayLabel(day.date)}</p>
                      <p className="text-muted">
                        {temps.length > 0 ? `${Math.round(Math.min(...temps))}–${Math.round(Math.max(...temps))}°C` : '—'}
                        {wet > 0 ? ` · ${wet} interval hujan` : ''}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        ) : forecast.loading ? (
          <p className="text-sm text-muted">Memuat prakiraan {area.district}…</p>
        ) : (
          <p className="text-sm text-muted">
            Prakiraan {area.district} tidak dapat dimuat{forecast.error ? `: ${forecast.error}` : '.'}
          </p>
        )}

        {alerts.data && alerts.data.length > 0 && (
          <Link
            href="/cuaca/peringatan-dini"
            className="flex items-start gap-2 rounded-md border border-[#C0392B]/40 bg-[#C0392B]/5 px-2.5 py-2 text-xs hover:bg-[#C0392B]/10"
          >
            <TriangleAlert size={13} aria-hidden className="mt-0.5 shrink-0 text-danger" />
            <span>
              <strong className="font-semibold">Peringatan dini cuaca</strong> untuk {area.district}: {alerts.data[0].title}
            </span>
          </Link>
        )}

        <details className="text-xs">
          <summary className="cursor-pointer text-muted underline">Ganti wilayah</summary>
          <div className="mt-2"><AreaPicker /></div>
        </details>
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------- kejadian panas -- */

interface EruptionPayload {
  eruptions: EruptionEvent[];
  error?: string;
}

interface AlertsPayload {
  alerts: WeatherAlert[];
  error?: string;
}

export interface HotItem {
  kind: 'erupsi' | 'tsunami' | 'cuaca';
  title: string;
  detail: string;
  time: string;
  href: string;
  /** Tautan sumber resmi di luar aplikasi (dokumen BMKG). */
  external?: string;
}

/**
 * Bagian "Perlu perhatian". Hanya merangkum kejadian yang benar-benar hangat:
 * letusan ≤ 24 jam, peringatan tsunami yang masih aktif, dan peringatan cuaca
 * ekstrem ≤ 6 jam. Sumber yang gagal dimuat tidak ditampilkan sebagai
 * "aman" — barisnya diberi keterangan gagal.
 */
export function HotEventsPanel({ now = Date.now() }: { now?: number }) {
  const eruptions = useVolcanoQuery<EruptionEvent[]>('/api/volcano/erupsi?size=20', {
    pollMs: 5 * 60_000,
    transform: (payload) => (payload as EruptionPayload).eruptions ?? [],
  });
  const tsunami = useVolcanoQuery<TsunamiFeed>('/api/tsunami', {
    pollMs: 2 * 60_000,
    transform: (payload) => (payload && typeof payload === 'object' ? payload as TsunamiFeed : null),
  });
  const weather = useVolcanoQuery<WeatherAlert[]>('/api/weather/peringatan', {
    pollMs: 5 * 60_000,
    transform: (payload) => (payload as AlertsPayload).alerts ?? [],
  });

  const items = useMemo(() => {
    const out: HotItem[] = [];

    for (const event of (eruptions.data ?? []).filter((e) => isHot(e.occurredAt, now)).slice(0, 3)) {
      out.push({
        kind: 'erupsi',
        title: `Letusan ${event.volcanoName}`,
        detail: [
          event.province ?? null,
          event.ashHeightM !== null ? `kolom abu ±${Math.round(event.ashHeightM)} m` : null,
        ].filter(Boolean).join(' · ') || 'Informasi letusan resmi PVMBG',
        time: event.occurredAt,
        href: '/gunung-berapi/erupsi',
      });
    }

    for (const alert of (tsunami.data?.activeAlerts ?? []).slice(0, 2)) {
      out.push({
        kind: 'tsunami',
        title: `Peringatan tsunami${alert.phase ? ` ${alert.phase}` : ''}: ${alert.subject}`,
        detail: alert.regions.length > 0
          ? `${alert.regions.length} wilayah pesisir disebut BMKG`
          : 'Peringatan resmi BMKG masih berlaku',
        time: alert.issueTime,
        href: '/tsunami',
      });
    }

    for (const alert of (weather.data ?? []).filter((a) => isHot(a.issuedAt, now) && now - Date.parse(a.issuedAt) <= ALERT_WINDOW_MS).slice(0, 3)) {
      out.push({
        kind: 'cuaca',
        title: alert.title,
        detail: [
          alert.region,
          alert.impacts.length > 0 ? `Potensi: ${alert.impacts.join(', ')}` : 'Peringatan dini cuaca ekstrem BMKG',
        ].filter(Boolean).join(' · '),
        time: alert.issuedAt,
        href: '/cuaca/peringatan-dini',
        external: alert.sourceUrl,
      });
    }

    return out.sort((a, b) => Date.parse(b.time) - Date.parse(a.time));
  }, [eruptions.data, tsunami.data, weather.data, now]);

  const anyLoaded = eruptions.data !== null || tsunami.data !== null || weather.data !== null;
  const failures = [
    eruptions.error ? 'letusan MAGMA' : null,
    tsunami.error ? 'status tsunami' : null,
    weather.error ? 'peringatan cuaca' : null,
  ].filter(Boolean) as string[];

  if (items.length === 0) {
    // Tidak ada kejadian panas: panel disembunyikan sepenuhnya agar dashboard
    // tidak dipenuhi kotak kosong. Namun bila semua sumber gagal, keadaan itu
    // penting untuk diketahui sehingga diberi baris ringkas.
    if (!anyLoaded || failures.length === 0) return null;
    return (
      <p className="mt-4 rounded-lg border border-line bg-surface px-4 py-2.5 text-xs text-muted">
        Sebagian sumber belum dapat diperiksa ({failures.join(', ')}). Buka menu terkait untuk memastikan status terbaru.
      </p>
    );
  }

  return (
    <Panel title="Perlu perhatian" className="mt-4 min-w-0">
      <ul className="divide-y divide-line">
        {items.map((item) => (
          <li key={`${item.kind}-${item.time}-${item.title}`} className="flex items-start gap-2.5 px-4 py-2.5 text-sm">
            {item.kind === 'erupsi' && <Mountain size={16} aria-hidden className="mt-0.5 shrink-0 text-[#C0392B]" />}
            {item.kind === 'tsunami' && <Waves size={16} aria-hidden className="mt-0.5 shrink-0 text-[#C0392B]" />}
            {item.kind === 'cuaca' && <TriangleAlert size={16} aria-hidden className="mt-0.5 shrink-0 text-[#C97B1E]" />}
            <div className="min-w-0 flex-1">
              <Link href={item.href} className="block font-medium hover:underline">{item.title}</Link>
              <p className="text-xs text-muted">{item.detail} · {fmtTime(item.time)}</p>
            </div>
            {item.external && (
              <a
                href={item.external}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Buka sumber resmi"
                className="mt-0.5 shrink-0 text-muted hover:text-ink"
              >
                <ExternalLink size={14} aria-hidden />
              </a>
            )}
          </li>
        ))}
      </ul>
      {failures.length > 0 && (
        <p className="border-t border-line px-4 py-2 text-[11px] text-muted">
          Sumber yang belum dapat diperiksa: {failures.join(', ')}. Daftar di atas tetap berasal dari sumber resmi.
        </p>
      )}
    </Panel>
  );
}
