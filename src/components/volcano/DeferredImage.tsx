'use client';

import { useId, useState, type ReactNode } from 'react';
import { ChevronDown, ImageOff, Loader2 } from 'lucide-react';

/**
 * Gambar berat (peta KRB, CCTV, galeri) yang hanya diunduh setelah pengguna
 * membuka panelnya. Tanpa ini, satu halaman dengan puluhan berkas gambar
 * langsung meminta semuanya sekaligus sehingga halaman terasa berat.
 *
 * Saat panel ditutup, gambar dilepas dari DOM agar unduhan dibatalkan dan
 * memori browser kembali lega. Status "sudah pernah dibuka" diingat agar
 * pengguna tidak perlu mengunduh ulang ketika membuka panel yang sama.
 */
export function DeferredImage({
  title,
  meta,
  alt,
  src,
  imageClassName = 'block w-full object-contain',
  buttonLabel = 'Buka',
  footer,
  actions,
}: {
  title: string;
  /** Keterangan kecil di samping judul (tahun peta, waktu gambar, dsb.). */
  meta?: string;
  alt: string;
  src: string;
  imageClassName?: string;
  buttonLabel?: string;
  /** Aksi di dalam panel yang ikut tersembunyi saat panel tertutup. */
  footer?: ReactNode;
  /**
   * Aksi ringan yang selalu tampil (tautan detail, salin, bagikan). Dipisah
   * dari `footer` supaya pengguna tidak perlu membuka gambar berukuran besar
   * hanya untuk menyalin tautan atau membuka detail gunung api.
   */
  actions?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const panelId = useId();

  return (
    <div className="overflow-hidden rounded-lg border border-line bg-surface">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left hover:bg-line/30"
      >
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-sm font-semibold">{title}</span>
            <ChevronDown
              size={15}
              aria-hidden
              className={`shrink-0 text-muted transition-transform ${open ? 'rotate-180' : ''}`}
            />
          </span>
          {meta && <span className="mt-0.5 block truncate text-xs text-muted">{meta}</span>}
        </span>
        <span className="shrink-0 rounded-md border border-line px-2 py-1 text-xs font-medium">
          {open ? 'Tutup' : buttonLabel}
        </span>
      </button>

      {/* Panel tertutup tidak me-render <img>, jadi tidak ada unduhan sama sekali. */}
      {open && (
        <div id={panelId} className="border-t border-line">
          {failed ? (
            <div className="flex flex-col items-center justify-center gap-1 bg-bg p-6 text-center text-xs text-muted">
              <ImageOff size={18} aria-hidden />
              <span>Gambar sedang tidak tersedia dari sumber MAGMA.</span>
            </div>
          ) : (
            <>
              {!loaded && (
                <div role="status" className="flex items-center justify-center gap-2 bg-bg px-3 py-8 text-xs text-muted">
                  <Loader2 size={14} aria-hidden className="animate-spin" />
                  Memuat gambar besar…
                </div>
              )}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                key={src}
                src={src}
                alt={alt}
                loading="eager"
                decoding="async"
                className={`${imageClassName} ${loaded ? '' : 'hidden'} bg-white`}
                onLoad={() => setLoaded(true)}
                onError={() => setFailed(true)}
              />
            </>
          )}
          {footer && <div className="border-t border-line px-3 py-2 text-xs">{footer}</div>}
        </div>
      )}
      {actions && <div className="border-t border-line px-3 py-2 text-xs">{actions}</div>}
    </div>
  );
}
