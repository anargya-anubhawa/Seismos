'use client';

import dynamic from 'next/dynamic';

/**
 * Leaflet butuh `window`, jadi hanya dimuat di browser.
 * Tetap 100% lebar (bukan 100vw) agar tidak menimbulkan gulir horizontal ketika
 * ada scrollbar vertikal.
 */
export const VolcanoMapLazy = dynamic(() => import('./VolcanoMap'), {
  ssr: false,
  loading: () => (
    <div
      className="h-[min(60vh,520px)] min-h-[280px] w-full animate-pulse rounded-lg bg-line/60"
      aria-label="Memuat peta gunung api"
    />
  ),
});
