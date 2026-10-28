'use client';

import Link from 'next/link';
import { useCallback, useState } from 'react';
import { CloudSun, LocateFixed, RefreshCw, TriangleAlert, X } from 'lucide-react';
import {
  resolveAreaFromPoint, saveArea, useSavedArea, useWeatherAlerts, useWeatherForecast,
} from '@/hooks/useWeather';
import { fmtAgo } from '@/lib/formatting';
import { WeatherIcon, formatClock, zoneLabel } from './parts';

/**
 * Bar cuaca persisten di bagian atas halaman.
 *
 * Perilaku yang disengaja:
 *  - Tidak meminta izin lokasi otomatis. Pengguna menekan "Gunakan lokasi" dulu;
 *    permintaan izin yang tiba-tiba sering ditolak dan membuat cuaca tidak akurat.
 *  - Wilayah terakhir disimpan di perangkat sehingga kunjungan berikutnya
 *    langsung menampilkan cuaca tanpa bertanya lagi.
 *  - Bila izin ditolak atau lokasi di luar cakupan, pengguna diarahkan memilih
 *    wilayah manual (tautan ke menu cuaca), bukan diberi prakiraan wilayah lain.
 */
export function WeatherStrip() {
  const [area, setArea] = useSavedArea();
  const [asking, setAsking] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  const forecast = useWeatherForecast(area?.code ?? null);
  const alerts = useWeatherAlerts(area?.district ?? null);

  const requestLocation = useCallback(async () => {
    setAsking(true);
    setGeoError(null);
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGeoError('Peramban ini tidak menyediakan layanan lokasi. Pilih wilayah manual.');
      setAsking(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const resolved = await resolveAreaFromPoint(position.coords.latitude, position.coords.longitude);
        if (resolved.area) {
          setArea({
            ...resolved.area,
            mode: 'geo',
            distanceKm: resolved.distanceKm ?? undefined,
          });
          setGeoError(null);
        } else {
          setGeoError(resolved.error ?? 'Wilayah tidak ditemukan untuk lokasi Anda.');
        }
        setAsking(false);
      },
      (error) => {
        setGeoError(error.code === error.PERMISSION_DENIED
          ? 'Izin lokasi ditolak. Anda tetap bisa memilih wilayah manual di menu Cuaca.'
          : 'Lokasi tidak dapat dibaca. Coba lagi atau pilih wilayah manual.');
        setAsking(false);
      },
      { enableHighAccuracy: false, timeout: 12_000, maximumAge: 10 * 60_000 },
    );
  }, [setArea]);

  const point = forecast.data?.points.find((p) => Date.parse(p.time) >= Date.now() - 60 * 60_000)
    ?? forecast.data?.points[0]
    ?? null;
  const timezone = forecast.data?.timezone ?? 'Asia/Jakarta';
  const activeAlerts = alerts.data ?? [];

  return (
    <section
      aria-label="Cuaca lokasi Anda"
      className="border-b border-line bg-surface/80 print:hidden"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-1.5 text-xs md:px-6">
        <Link href="/cuaca" className="inline-flex items-center gap-1.5 font-semibold hover:underline">
          <CloudSun size={15} aria-hidden className="text-accent" />
          Cuaca
        </Link>

        {area && point ? (
          <>
            <span className="hidden font-medium sm:inline">{area.district}</span>
            <span className="inline-flex items-center gap-1.5">
              <WeatherIcon point={point} size={18} />
              <span className="font-semibold">
                {point.temperatureC !== null ? `${Math.round(point.temperatureC)}°C` : '—'}
              </span>
              <span className="text-muted">{point.description}</span>
            </span>
            {point.humidityPct !== null && (
              <span className="hidden text-muted md:inline">Lembap {Math.round(point.humidityPct)}%</span>
            )}
            {point.precipitationMm !== null && point.precipitationMm > 0 && (
              <span className="text-muted">Hujan {point.precipitationMm} mm</span>
            )}
            <span className="hidden text-muted lg:inline">
              {formatClock(point.time, timezone)} {zoneLabel(timezone)}
            </span>
            {forecast.updatedAt && (
              <span className="hidden text-muted xl:inline">· data {fmtAgo(forecast.updatedAt)}</span>
            )}
          </>
        ) : area && forecast.loading ? (
          <span className="text-muted">Memuat cuaca {area.district}…</span>
        ) : area ? (
          <span className="text-muted">
            Cuaca {area.district} belum tersedia{forecast.error ? ` · ${forecast.error}` : ''}
          </span>
        ) : (
          <span className="text-muted">
            Cuaca sesuai lokasi Anda —
            {' '}
            <button
              type="button"
              onClick={() => void requestLocation()}
              disabled={asking}
              className="inline-flex items-center gap-1 font-medium text-accent underline disabled:opacity-60"
            >
              <LocateFixed size={12} aria-hidden />
              {asking ? 'Membaca lokasi…' : 'gunakan lokasi saya'}
            </button>
            {' '}atau <Link href="/cuaca" className="underline">pilih wilayah</Link>
          </span>
        )}

        {activeAlerts.length > 0 && (
          <Link
            href="/cuaca/peringatan-dini"
            className="inline-flex items-center gap-1 rounded-full border border-[#C0392B]/40 bg-[#C0392B]/10 px-2 py-0.5 font-medium text-[#8E2A1F] dark:text-[#F0A79C]"
          >
            <TriangleAlert size={11} aria-hidden />
            {activeAlerts.length} peringatan cuaca ekstrem di {area?.district ?? 'Indonesia'}
          </Link>
        )}

        <span className="ml-auto flex items-center gap-1">
          {area && (
            <button
              type="button"
              onClick={() => void requestLocation()}
              disabled={asking}
              aria-label="Perbarui cuaca sesuai lokasi saat ini"
              title="Perbarui cuaca sesuai lokasi saat ini"
              className="rounded p-1 text-muted hover:bg-line/50 hover:text-ink disabled:opacity-50"
            >
              <LocateFixed size={13} aria-hidden className={asking ? 'animate-pulse' : ''} />
            </button>
          )}
          {area && (
            <button
              type="button"
              onClick={() => void forecast.refresh()}
              aria-label="Muat ulang prakiraan cuaca"
              title="Muat ulang prakiraan cuaca"
              className="rounded p-1 text-muted hover:bg-line/50 hover:text-ink"
            >
              <RefreshCw size={13} aria-hidden className={forecast.loading ? 'animate-spin' : ''} />
            </button>
          )}
          {area && (
            <button
              type="button"
              onClick={() => saveArea(null)}
              aria-label="Hapus wilayah cuaca tersimpan"
              title="Hapus wilayah cuaca tersimpan"
              className="rounded p-1 text-muted hover:bg-line/50 hover:text-ink"
            >
              <X size={13} aria-hidden />
            </button>
          )}
        </span>
      </div>

      {geoError && (
        <p role="status" className="flex items-start gap-1.5 border-t border-line px-4 py-1 text-[11px] text-danger md:px-6">
          <TriangleAlert size={11} aria-hidden className="mt-0.5 shrink-0" />
          <span>
            {geoError}{' '}
            <Link href="/cuaca" className="underline">Pilih wilayah manual</Link>
          </span>
        </p>
      )}
    </section>
  );
}
