import { chmod, mkdir } from 'node:fs/promises';

/**
 * Penanda bahwa direktori data tidak dapat ditulis (sistem berkas baca-saja).
 * Hosting serverless seperti Vercel menjalankan kode dari `/var/task` yang
 * baca-saja, sehingga `mkdir` gagal dan penyimpanan JSON tidak mungkin dipakai.
 */
export class StorageUnavailableError extends Error {
  readonly code = 'STORAGE_UNAVAILABLE';
  constructor(message: string) {
    super(message);
    this.name = 'StorageUnavailableError';
  }
}

/** Kode kesalahan yang berarti "sistem berkas tidak bisa ditulis". */
const UNWRITABLE_CODES = new Set(['EROFS', 'ENOENT', 'EACCES', 'EPERM', 'ENOTDIR']);

/**
 * Memastikan direktori data dapat dipakai, sekali per proses. Hasilnya di-cache
 * agar percobaan `mkdir` yang gagal tidak diulang pada setiap permintaan.
 *
 * Mengembalikan alasan kegagalan (string) bila penyimpanan tidak tersedia, atau
 * `null` bila direktori siap dipakai.
 */
export function createStorageProbe(dataDir: string, label: string) {
  let state: { checked: true; reason: string | null } | null = null;

  return {
    /** Alasan penyimpanan tidak tersedia, atau null bila normal. */
    warning(): string | null {
      return state?.reason ?? null;
    },

    /** True bila penyimpanan persisten tersedia (atau belum pernah dicek). */
    available(): boolean {
      return !state?.reason;
    },

    /** Melempar `StorageUnavailableError` bila direktori tidak bisa ditulis. */
    async ensure(): Promise<void> {
      if (state) {
        if (state.reason) throw new StorageUnavailableError(state.reason);
        return;
      }
      try {
        await mkdir(dataDir, { recursive: true, mode: 0o700 });
        await chmod(dataDir, 0o700).catch(() => { /* filesystem tanpa izin chmod */ });
        state = { checked: true, reason: null };
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (code && UNWRITABLE_CODES.has(code)) {
          const reason = `Penyimpanan server tidak dapat ditulis (${code} pada ${dataDir}). ${label} hanya disimpan di memori instance ini dan hilang saat instance berhenti. Arahkan direktori data ke volume yang dapat ditulis agar data bertahan.`;
          state = { checked: true, reason };
          console.error(`[storage] ${reason}`);
          throw new StorageUnavailableError(reason);
        }
        throw error;
      }
    },
  };
}

/** Penyimpanan cadangan di memori, dipakai saat direktori tidak dapat ditulis. */
export function createMemoryStore() {
  const entries = new Map<string, string>();
  return {
    get(name: string): string | undefined {
      return entries.get(name);
    },
    set(name: string, value: string): void {
      entries.set(name, value);
    },
    clear(): void {
      entries.clear();
    },
  };
}
