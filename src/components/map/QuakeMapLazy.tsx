'use client';

import dynamic from 'next/dynamic';

/** Leaflet butuh `window`, jadi hanya dimuat di browser. */
export const QuakeMapLazy = dynamic(() => import('./QuakeMap'), {
  ssr: false,
  loading: () => <div className="h-full min-h-[240px] w-full animate-pulse bg-line/60" aria-label="Memuat peta" />,
});
