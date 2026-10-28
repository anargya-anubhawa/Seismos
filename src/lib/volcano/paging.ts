/** Jumlah entri yang ditampilkan sebelum tombol "Muat lebih banyak" muncul. */
export const LIST_INITIAL_COUNT = 10;

export interface ProgressiveSlice<T> {
  visible: T[];
  hasMore: boolean;
  remaining: number;
  /** Jumlah entri yang akan ditambahkan pada penekanan tombol berikutnya. */
  nextCount: number;
  shown: number;
}

/**
 * Bagian murni dari daftar bertahap: menentukan entri yang tampil, sisa, dan
 * langkah berikutnya. Dipisah dari komponen agar dapat diuji tanpa React.
 */
export function progressiveSlice<T>(items: T[], count: number, step = LIST_INITIAL_COUNT): ProgressiveSlice<T> {
  const activeCount = Math.max(0, count);
  const visible = items.slice(0, activeCount);
  const hasMore = items.length > visible.length;
  const remaining = Math.max(0, items.length - visible.length);
  const nextCount = Math.min(step, remaining);
  return { visible, hasMore, remaining, nextCount, shown: visible.length };
}
