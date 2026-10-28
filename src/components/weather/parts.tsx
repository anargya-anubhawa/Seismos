'use client';

import Image from 'next/image';
import { CloudSun, Droplets, Wind } from 'lucide-react';
import type { WeatherPoint } from '@/types/weather';

/**
 * Komponen tampilan cuaca. Semua angka berasal dari respons BMKG dan tidak
 * diolah ulang selain pembulatan tampilan. Ikon memakai berkas resmi BMKG;
 * bila ikon gagal dimuat, teks deskripsi tetap menjadi informasi utama sehingga
 * cuaca tidak bergantung pada gambar.
 */

const clockFormatter = (timezone: string) =>
  new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: timezone });

export const ZONE_LABEL: Record<string, string> = {
  'Asia/Jakarta': 'WIB',
  'Asia/Pontianak': 'WIB',
  'Asia/Makassar': 'WITA',
  'Asia/Jayapura': 'WIT',
};

export function zoneLabel(timezone: string): string {
  return ZONE_LABEL[timezone] ?? 'WIB';
}

export function formatClock(iso: string, timezone: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return clockFormatter(timezone).format(date);
}

/** Ikon cuaca resmi BMKG dengan ukuran tetap agar tata letak tidak bergeser. */
export function WeatherIcon({ point, size = 40 }: { point: WeatherPoint; size?: number }) {
  if (!point.iconUrl) {
    return <CloudSun size={size} aria-hidden className="text-muted" />;
  }
  return (
    <Image
      src={point.iconUrl}
      alt=""
      aria-hidden
      width={size}
      height={size}
      className="shrink-0"
      unoptimized
    />
  );
}

/** Suhu besar + deskripsi, dipakai di bar atas dan kartu utama. */
export function WeatherMain({ point, compact = false }: { point: WeatherPoint; compact?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <WeatherIcon point={point} size={compact ? 30 : 48} />
      <div className="min-w-0">
        <p className={compact ? 'text-sm font-semibold leading-tight' : 'text-2xl font-semibold leading-tight'}>
          {point.temperatureC !== null ? `${Math.round(point.temperatureC)}°C` : '—'}
        </p>
        <p className={`truncate ${compact ? 'text-[11px]' : 'text-sm'} text-muted`}>{point.description}</p>
      </div>
    </div>
  );
}

/** Deret angka kecil: kelembapan, angin, hujan. */
export function WeatherFacts({ point }: { point: WeatherPoint }) {
  const items: { icon: typeof Droplets; label: string; value: string }[] = [];
  if (point.humidityPct !== null) {
    items.push({ icon: Droplets, label: 'Kelembapan', value: `${Math.round(point.humidityPct)}%` });
  }
  if (point.windSpeedKmh !== null) {
    items.push({
      icon: Wind,
      label: 'Angin',
      value: `${point.windFrom ? `${point.windFrom} ` : ''}${Math.round(point.windSpeedKmh)} km/jam`,
    });
  }
  if (point.precipitationMm !== null) {
    items.push({
      icon: Droplets,
      label: 'Hujan',
      value: point.precipitationMm > 0 ? `${point.precipitationMm} mm` : 'Tidak ada',
    });
  }
  if (items.length === 0) return null;
  return (
    <dl className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
      {items.map(({ icon: Icon, label, value }) => (
        <div key={label} className="flex items-center gap-1">
          <Icon size={12} aria-hidden className="text-muted" />
          <dt className="sr-only">{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Warna latar kartu titik cuaca menurut curah hujan/hujan yang disebut. */
export function rainTone(point: WeatherPoint): string {
  const mm = point.precipitationMm ?? 0;
  const heavy = /lebat|petir|badai/i.test(point.description);
  if (heavy || mm >= 10) return 'border-[#C0392B]/40 bg-[#C0392B]/5';
  if (mm >= 2 || /hujan/i.test(point.description)) return 'border-accent/40 bg-accent/5';
  return 'border-line bg-surface';
}
