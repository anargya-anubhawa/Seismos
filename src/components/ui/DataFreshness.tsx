'use client';

import { fmtAgo, fmtTime } from '@/lib/formatting';

/**
 * Indikator kesegaran & atribusi data (OI-03).
 *
 * Untuk aplikasi kebencanaan, "kapan data ini diambil" adalah informasi
 * keselamatan, bukan hiasan. Komponen ini menampilkan:
 *
 * - waktu pengambilan (`updatedAt`) dan berapa lama lalu;
 * - lencana "Data lama" bila respons ditandai `stale`;
 * - daftar sumber beserta jumlah, waktu ambil, dan galat per sumber.
 *
 * Sifatnya hanya presentasional: tidak mengubah cara data diambil.
 *
 * Catatan aksesibilitas: status selalu disertai teks, bukan hanya warna.
 */

export interface DataSourceInfo {
  id: string;
  label: string;
  fetchedAt?: string | null;
  stale?: boolean;
  error?: string | null;
  count?: number;
  url?: string;
}

export function DataFreshness({
  updatedAt,
  stale = false,
  sources = [],
  label = 'Data diambil',
  showSources = true,
  className = '',
}: {
  updatedAt?: string | null;
  stale?: boolean;
  sources?: DataSourceInfo[];
  label?: string;
  /** Tampilkan rincian per sumber. Matikan bila hanya butuh baris ringkas. */
  showSources?: boolean;
  className?: string;
}) {
  const failed = sources.filter((s) => s.error);
  const nothing = !updatedAt && sources.length === 0;
  if (nothing) return null;

  return (
    <div className={`text-xs ${className}`}>
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-muted">
        <span>
          {label}
          {updatedAt ? (
            <>
              {' '}
              <time dateTime={updatedAt} title={fmtTime(updatedAt)}>{fmtTime(updatedAt)}</time>
              {' '}
              <span className="text-muted/80">({fmtAgo(updatedAt)})</span>
            </>
          ) : (
            ' tidak diketahui'
          )}
        </span>

        {stale && (
          <span
            role="status"
            className="inline-flex items-center gap-1 rounded border border-accent/50 bg-accent/10 px-1.5 py-0.5 font-medium text-accent"
          >
            Data lama — menampilkan hasil terakhir yang berhasil
          </span>
        )}

        {failed.length > 0 && (
          <span
            role="status"
            className="inline-flex items-center gap-1 rounded border border-danger/50 bg-danger/10 px-1.5 py-0.5 font-medium text-danger"
          >
            {failed.length} dari {sources.length} sumber gagal
          </span>
        )}
      </p>

      {showSources && sources.length > 0 && (
        <ul className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-muted">
          {sources.map((source) => {
            const ok = !source.error;
            return (
              <li key={source.id} className="flex items-center gap-1.5">
                <span
                  aria-hidden
                  className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${ok ? 'bg-ok' : 'bg-danger'}`}
                />
                <span className={ok ? '' : 'text-danger'}>
                  {source.label}
                  {typeof source.count === 'number' && ` · ${source.count}`}
                  {ok
                    ? (source.fetchedAt ? ` · ${fmtAgo(source.fetchedAt)}` : '')
                    : ` · gagal${source.error ? ` (${source.error})` : ''}`}
                  {/* Status juga diucapkan, tidak hanya diwarnai. */}
                  <span className="sr-only">{ok ? ' — berhasil' : ' — gagal'}</span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
