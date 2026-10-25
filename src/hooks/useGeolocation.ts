'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export interface UserLocation {
  latitude: number;
  longitude: number;
  /** Perkiraan radius akurasi dari browser, dalam meter. */
  accuracy: number;
  timestamp: number;
}

export type GeolocationStatus = 'idle' | 'requesting' | 'success' | 'error';

function errorMessage(error: GeolocationPositionError): string {
  if (error.code === error.PERMISSION_DENIED) {
    return 'Izin lokasi ditolak. Aktifkan izin lokasi untuk situs ini di pengaturan browser.';
  }
  if (error.code === error.POSITION_UNAVAILABLE) {
    return 'Lokasi tidak tersedia. Periksa GPS, koneksi, atau coba lagi.';
  }
  if (error.code === error.TIMEOUT) {
    return 'Permintaan lokasi melewati batas waktu. Coba lagi.';
  }
  return 'Lokasi tidak dapat diambil. Coba lagi.';
}

/**
 * Meminta lokasi hanya setelah dipanggil dari aksi pengguna. Koordinat tetap
 * di memori halaman ini dan tidak dikirim ke server aplikasi.
 */
export function useGeolocation() {
  const [location, setLocation] = useState<UserLocation | null>(null);
  const [status, setStatus] = useState<GeolocationStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const request = useCallback(() => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      setStatus('error');
      setError('Browser ini tidak mendukung lokasi GPS.');
      return;
    }
    if (!window.isSecureContext) {
      setStatus('error');
      setError('Lokasi hanya dapat diakses lewat HTTPS atau localhost.');
      return;
    }

    setStatus('requesting');
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (!mounted.current) return;
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp,
        });
        setStatus('success');
      },
      (positionError) => {
        if (!mounted.current) return;
        setStatus('error');
        setError(errorMessage(positionError));
      },
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 300_000 },
    );
  }, []);

  const clear = useCallback(() => {
    setLocation(null);
    setStatus('idle');
    setError(null);
  }, []);

  return { location, status, error, request, clear };
}
