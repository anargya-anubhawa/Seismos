'use client';

import { useEffect, useRef, useState } from 'react';
import { LocateFixed, Search, TriangleAlert } from 'lucide-react';
import { resolveAreaFromPoint, saveArea, type SavedArea } from '@/hooks/useWeather';
import type { WeatherArea } from '@/types/weather';

/**
 * Pemilih wilayah cuaca: tombol "gunakan lokasi saya" dan kotak pencarian
 * kecamatan/kabupaten/provinsi.
 *
 * Pencarian memakai daftar wilayah internal (`/api/weather/prakiraan?q=`),
 * bukan endpoint pencarian situs BMKG, karena endpoint tersebut memerlukan
 * token yang tidak tersedia untuk pemakaian publik.
 */
export function AreaPicker({ onSelect }: { onSelect?: (area: SavedArea) => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<WeatherArea[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [geoMessage, setGeoMessage] = useState<string | null>(null);
  const [outside, setOutside] = useState(false);
  const sequence = useRef(0);

  // Pencarian ditunda sebentar agar tidak mengirim permintaan per ketikan.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setSearching(false);
      setSearchError(null);
      return;
    }
    const id = ++sequence.current;
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/weather/prakiraan?q=${encodeURIComponent(q)}`, { cache: 'no-store' });
        const payload = await res.json() as { results?: WeatherArea[]; error?: string };
        if (sequence.current !== id) return;
        setResults(payload.results ?? []);
        setSearchError(payload.error ?? null);
      } catch (error) {
        if (sequence.current !== id) return;
        setResults([]);
        setSearchError(error instanceof Error ? error.message : 'Pencarian gagal');
      } finally {
        if (sequence.current === id) setSearching(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  const pick = (area: WeatherArea) => {
    const saved: SavedArea = { ...area, mode: 'manual' };
    saveArea(saved);
    setQuery('');
    setResults([]);
    onSelect?.(saved);
  };

  const requestLocation = async () => {
    setGeoMessage(null);
    setOutside(false);
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGeoMessage('Peramban ini tidak menyediakan layanan lokasi. Pilih wilayah secara manual.');
      return;
    }
    setAsking(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const resolved = await resolveAreaFromPoint(position.coords.latitude, position.coords.longitude);
        setAsking(false);
        if (resolved.area) {
          const saved: SavedArea = {
            ...resolved.area,
            mode: 'geo',
            distanceKm: resolved.distanceKm ?? undefined,
          };
          saveArea(saved);
          onSelect?.(saved);
          setGeoMessage(
            resolved.distanceKm !== null
              ? `Wilayah terdekat: ${resolved.area.district}, ${resolved.area.regency} (±${Math.round(resolved.distanceKm)} km dari lokasi Anda).`
              : null,
          );
        } else {
          setOutside(resolved.outsideCoverage);
          setGeoMessage(resolved.error ?? 'Wilayah cuaca tidak ditemukan untuk lokasi Anda.');
        }
      },
      (error) => {
        setAsking(false);
        setGeoMessage(
          error.code === error.PERMISSION_DENIED
            ? 'Izin lokasi ditolak. Anda dapat memilih wilayah secara manual di bawah ini.'
            : 'Lokasi tidak dapat dibaca saat ini. Pilih wilayah secara manual di bawah ini.',
        );
      },
      { enableHighAccuracy: false, timeout: 12_000, maximumAge: 10 * 60_000 },
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void requestLocation()}
          disabled={asking}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-line px-3 text-sm font-medium hover:bg-line/40 disabled:opacity-60"
        >
          <LocateFixed size={15} aria-hidden className={asking ? 'animate-pulse' : ''} />
          {asking ? 'Membaca lokasi…' : 'Gunakan lokasi saya'}
        </button>
        <span className="text-xs text-muted">atau cari wilayah:</span>
      </div>

      <div className="relative">
        <label htmlFor="weather-area-search" className="sr-only">
          Cari kecamatan, kabupaten, atau provinsi
        </label>
        <Search size={14} aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
        <input
          id="weather-area-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Cari kecamatan, kabupaten, atau provinsi…"
          autoComplete="off"
          className="min-h-9 w-full rounded-md border border-line bg-surface pl-8 pr-3 text-sm"
        />
        {(searching || results.length > 0 || searchError) && (
          <div className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-md border border-line bg-surface shadow-lg">
            {searching && <p className="px-3 py-2 text-xs text-muted">Mencari wilayah…</p>}
            {!searching && searchError && <p className="px-3 py-2 text-xs text-danger">{searchError}</p>}
            {!searching && !searchError && results.length === 0 && query.trim().length >= 2 && (
              <p className="px-3 py-2 text-xs text-muted">
                Tidak ada wilayah yang cocok. Coba nama kecamatan atau kabupaten lain.
              </p>
            )}
            <ul>
              {results.map((area) => (
                <li key={area.code}>
                  <button
                    type="button"
                    onClick={() => pick(area)}
                    className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left hover:bg-line/40"
                  >
                    <span className="text-sm font-medium">{area.district}</span>
                    <span className="text-[11px] text-muted">
                      {area.regency} · {area.province} · {area.code}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {geoMessage && (
        <p role="status" className={`flex items-start gap-1.5 text-xs ${outside ? 'text-danger' : 'text-muted'}`}>
          <TriangleAlert size={12} aria-hidden className="mt-0.5 shrink-0" />
          <span>{geoMessage}</span>
        </p>
      )}
    </div>
  );
}
