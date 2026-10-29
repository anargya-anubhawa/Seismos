import { publicErrorMessage } from '@/lib/public-error';

interface Entry<T> {
  value: T;
  at: number;
}

const store = new Map<string, Entry<unknown>>();

export interface CachedResult<T> {
  value: T;
  /** epoch ms saat nilai berhasil diambil dari sumber */
  at: number;
  /** true bila pengambilan terbaru gagal dan nilai lama dipakai */
  stale: boolean;
  error: string | null;
}

/** Cache di memori server. Nilai lama hanya dipakai bila sumber gagal, dan ditandai stale. */
export async function cached<T>(
  key: string,
  ttlMs: number,
  loader: () => Promise<T>,
): Promise<CachedResult<T>> {
  const hit = store.get(key) as Entry<T> | undefined;
  const now = Date.now();
  if (hit && now - hit.at < ttlMs) {
    return { value: hit.value, at: hit.at, stale: false, error: null };
  }
  try {
    const value = await loader();
    const entry = { value, at: Date.now() };
    store.set(key, entry);
    return { value, at: entry.at, stale: false, error: null };
  } catch (e) {
    // `error` di sini dikirim ke klien sebagai `SourceStatus.error`, jadi pesan
    // teknis runtime disaring seperti pada respons API lain.
    const error = publicErrorMessage(e, 'Kesalahan tidak dikenal');
    if (hit) return { value: hit.value, at: hit.at, stale: true, error };
    throw e;
  }
}
