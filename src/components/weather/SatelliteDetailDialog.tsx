'use client';

import { useEffect, useRef } from 'react';
import { ExternalLink, Info, X } from 'lucide-react';
import { CopyLinkButton } from '@/components/share/ShareActions';
import type { SatelliteFrame, SatelliteProduct } from '@/types/weather';

/**
 * Panel detail satu produk satelit.
 *
 * Isi penjelasan diambil dari halaman resmi BMKG (`bmkg.go.id/cuaca/satelit`),
 * tidak ditulis ulang oleh aplikasi, sehingga pengguna membaca keterangan yang
 * sama dengan sumbernya. Ditampilkan sebagai dialog di atas halaman supaya
 * pengguna tidak kehilangan posisi gulir pada galeri.
 */
export function SatelliteDetailDialog({
  product,
  frame,
  onClose,
}: {
  product: SatelliteProduct;
  frame: SatelliteFrame | null;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      // Jaga fokus tetap di dalam dialog selama terbuka.
      if (event.key === 'Tab' && hostRef.current) {
        const focusable = hostRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        } else if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  const capturedAt = frame?.capturedAt ?? null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4" role="presentation">
      <div aria-hidden className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div
        ref={hostRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="satelit-detail-judul"
        className="relative z-10 max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-t-xl border border-line bg-surface shadow-2xl sm:rounded-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sticky top-0 flex items-start justify-between gap-3 border-b border-line bg-surface/95 px-4 py-3 backdrop-blur">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Detail produk satelit</p>
            <h2 id="satelit-detail-judul" className="mt-0.5 min-w-0 text-base font-semibold [overflow-wrap:anywhere]">
              {product.name}
            </h2>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Tutup detail satelit"
            className="shrink-0 rounded-md border border-line p-1.5 text-muted hover:bg-line/40 hover:text-ink"
          >
            <X size={16} aria-hidden />
          </button>
        </div>

        <div className="space-y-4 px-4 py-4">
          <section aria-labelledby="satelit-detail-deskripsi">
            <h3 id="satelit-detail-deskripsi" className="flex items-center gap-1.5 text-xs font-semibold text-muted">
              <Info size={13} aria-hidden />
              Penjelasan produk (BMKG)
            </h3>
            <p className="mt-1.5 text-sm leading-relaxed [overflow-wrap:anywhere]">{product.description}</p>
          </section>

          <dl className="grid gap-2 rounded-lg border border-line bg-bg/40 p-3 text-xs sm:grid-cols-2">
            <div className="min-w-0">
              <dt className="text-muted">Nama produk di BMKG</dt>
              <dd className="mt-0.5 truncate font-medium" title={product.name}>{product.name}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-muted">Kode produk</dt>
              <dd className="mt-0.5 truncate font-mono text-[11px]">{product.id}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-muted">Ukuran citra</dt>
              <dd className="mt-0.5 font-medium tabular-nums">{product.width} × {product.height} piksel</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-muted">Pembaruan citra</dt>
              <dd className="mt-0.5 font-medium">
                {capturedAt
                  ? new Date(capturedAt).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }) + ' WIB'
                  : 'tidak tercantum pada sumber'}
              </dd>
            </div>
          </dl>

          <p className="text-[11px] leading-relaxed text-muted">
            Setiap penggunaan citra satelit wajib mencantumkan BMKG sebagai sumber. Pemotongan gambar tanpa
            menyertakan sumber dan logo BMKG tidak diperbolehkan.
          </p>

          <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
            <a
              href={product.detailUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-9 items-center gap-1.5 rounded-md bg-accent px-3 text-sm font-medium text-white hover:opacity-90 dark:text-[#0b1a2f]"
            >
              Buka halaman detail BMKG <ExternalLink size={13} aria-hidden />
            </a>
            <a
              href={product.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-line px-3 text-sm font-medium hover:bg-line/40"
            >
              Citra asli <ExternalLink size={13} aria-hidden />
            </a>
            <CopyLinkButton label="Salin tautan detail" path={product.detailUrl} />
          </div>
        </div>
      </div>
    </div>
  );
}
