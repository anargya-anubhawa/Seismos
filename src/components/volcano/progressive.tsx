'use client';

import { useCallback, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { LIST_INITIAL_COUNT, progressiveSlice } from '@/lib/volcano/paging';

export { LIST_INITIAL_COUNT };

/**
 * Menampilkan daftar bertahap agar halaman tidak terlalu padat: mula-mula
 * `initial` entri, lalu bertambah `step` entri setiap kali pengguna menekan
 * tombol. Daftar yang lebih pendek dari `initial` ditampilkan seluruhnya tanpa
 * tombol. Bila `resetKey` berubah (mis. kata kunci atau tanggal filter berubah),
 * hitungan kembali ke awal agar pengguna melihat hasil filter dari atas.
 */
export function useProgressiveList<T>(
  items: T[],
  { initial = LIST_INITIAL_COUNT, step = LIST_INITIAL_COUNT, resetKey = '' }: {
    initial?: number;
    step?: number;
    resetKey?: string;
  } = {},
) {
  const [state, setState] = useState(() => ({ count: initial, key: resetKey }));

  // Menyesuaikan state saat render (pola resmi React) bila kunci filter berubah,
  // sehingga hasil filter baru selalu dimulai dari `initial` entri pertama.
  if (state.key !== resetKey) {
    setState({ count: initial, key: resetKey });
  }

  const count = state.key === resetKey ? state.count : initial;
  const slice = progressiveSlice(items, count, step);

  const showMore = useCallback(() => {
    setState((previous) => ({ count: previous.count + step, key: previous.key }));
  }, [step]);

  return { ...slice, showMore };
}

/**
 * Tombol "Muat lebih banyak" untuk daftar bertahap. Teks menyebut jumlah entri
 * yang akan ditambahkan dan sisa total, sehingga pengguna tahu daftar belum
 * habis tanpa harus menggulir.
 */
export function LoadMoreButton({
  hasMore,
  nextCount,
  shown,
  total,
  onLoadMore,
  label = 'entri',
  className = '',
  divided = false,
}: {
  hasMore: boolean;
  nextCount: number;
  shown: number;
  total: number;
  onLoadMore: () => void;
  label?: string;
  className?: string;
  /** Garis atas untuk menempel pada daftar di dalam Panel. */
  divided?: boolean;
}) {
  if (!hasMore) return null;
  return (
    <div className={`flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 ${divided ? 'border-t border-line' : ''} ${className}`}>
      <p className="text-xs text-muted" aria-live="polite">
        Menampilkan {shown} dari {total} {label}
      </p>
      <button
        type="button"
        onClick={onLoadMore}
        className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-line px-3 text-xs font-medium hover:bg-line/40"
      >
        <ChevronDown size={13} aria-hidden />
        Muat {nextCount} {label} lagi
      </button>
    </div>
  );
}
