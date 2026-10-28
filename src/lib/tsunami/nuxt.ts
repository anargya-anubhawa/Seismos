/**
 * Decoder kecil untuk payload `__NUXT_DATA__` (devalue) yang dipakai halaman BMKG.
 * Halaman BMKG menaruh daftar pembaruan peringatan tsunami di dalam payload ini,
 * sehingga kita perlu menyelesaikan referensi indeksnya tanpa mengeksekusi JS halaman.
 *
 * Decoder ini sengaja hanya menangani bentuk yang dipakai BMKG (objek, array,
 * primitive, Ref/Reactive, dan nilai khusus devalue). Bila struktur berubah,
 * pemanggil akan menerima daftar kosong dan sumber ditandai gagal — bukan
 * dianggap "tidak ada tsunami".
 */

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

const SPECIAL: Record<number, unknown> = {
  [-1]: undefined,
  [-2]: Number.NaN,
  [-3]: Number.POSITIVE_INFINITY,
  [-4]: Number.NEGATIVE_INFINITY,
  [-5]: -0,
};

class DevalueDecoder {
  private readonly memo = new Map<number, unknown>();
  private readonly visiting = new Set<number>();

  constructor(private readonly data: unknown[]) {}

  read(value: unknown): unknown {
    if (typeof value === 'number') return this.readIndex(value);
    if (Array.isArray(value)) return this.readArray(value);
    if (value && typeof value === 'object') return this.readObject(value as Record<string, unknown>);
    return value;
  }

  private readIndex(index: number): unknown {
    if (index < 0) return SPECIAL[index];
    if (index >= this.data.length) return undefined;
    if (this.memo.has(index)) return this.memo.get(index);
    if (this.visiting.has(index)) return undefined;
    this.visiting.add(index);
    try {
      const value = this.data[index];
      if (Array.isArray(value)) {
        const decoded = this.readArray(value);
        this.memo.set(index, decoded);
        return decoded;
      }
      if (value && typeof value === 'object') {
        const decoded = this.readObject(value as Record<string, unknown>);
        this.memo.set(index, decoded);
        return decoded;
      }
      this.memo.set(index, value);
      return value;
    } finally {
      this.visiting.delete(index);
    }
  }

  private readObject(value: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [key, ref] of Object.entries(value)) out[key] = this.read(ref);
    return out;
  }

  private readArray(value: unknown[]): unknown {
    const tag = value[0];
    if (typeof tag === 'string') {
      if (tag === 'ShallowReactive' || tag === 'Reactive' || tag === 'Ref' || tag === 'ShallowRef') {
        return value.length > 1 ? this.read(value[1]) : undefined;
      }
      if (tag === 'EmptyRef') return undefined;
      if (tag === 'Set') return value.slice(1).map((item) => this.read(item));
      if (tag === 'Map') {
        const out: Record<string, unknown> = {};
        for (let i = 1; i + 1 < value.length; i += 2) {
          out[String(this.read(value[i]))] = this.read(value[i + 1]);
        }
        return out;
      }
      if (tag === 'Date' || tag === 'URL' || tag === 'BigInt' || tag === 'RegExp') {
        return value.length > 1 ? this.read(value[1]) : undefined;
      }
    }
    return value.map((item) => this.read(item));
  }
}

/** Mengambil JSON `__NUXT_DATA__` dari HTML dan menyelesaikan referensinya. */
export function decodeNuxtData(html: string): unknown {
  const match = html.match(/<script[^>]*id="__NUXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
  if (!match) throw new Error('Payload __NUXT_DATA__ tidak ditemukan');
  let parsed: unknown;
  try {
    parsed = JSON.parse(match[1]);
  } catch {
    throw new Error('Payload __NUXT_DATA__ bukan JSON yang valid');
  }
  if (!Array.isArray(parsed)) throw new Error('Struktur __NUXT_DATA__ tidak dikenali');
  return new DevalueDecoder(parsed).read(1);
}

function isInfoRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return typeof record.subject === 'string' || typeof record.eventid === 'string' || typeof record.eventid === 'number';
}

/**
 * Mencari semua objek info peringatan di dalam payload Nuxt.
 * Dikembalikan tanpa duplikat dan tanpa bergantung pada jalur properti tertentu.
 */
export function findNuxtAlertInfos(decoded: unknown): Record<string, unknown>[] {
  const found: Record<string, unknown>[] = [];
  const seen = new WeakSet<object>();

  const walk = (value: unknown): void => {
    if (!value || typeof value !== 'object') return;
    if (seen.has(value)) return;
    seen.add(value);

    if (Array.isArray(value)) {
      if (value.every(isInfoRecord)) {
        found.push(...value);
      }
      for (const item of value) walk(item);
      return;
    }

    const record = value as Record<string, unknown>;
    const possibleInfo = record.info;
    if (isInfoRecord(record)) {
      found.push(record);
      return;
    }
    if (Array.isArray(possibleInfo) && possibleInfo.every(isInfoRecord)) {
      found.push(...possibleInfo);
    }
    for (const item of Object.values(record)) walk(item);
  };

  walk(decoded);

  // Beberapa payload bisa memuat objek info lebih dari sekali (induk + alert).
  const unique = new Map<string, Record<string, unknown>>();
  for (const info of found) {
    const key = `${String(info.eventid ?? '')}|${String(info.timesent ?? '')}|${String(info.subject ?? '')}`;
    if (!unique.has(key)) unique.set(key, info);
  }
  return Array.from(unique.values());
}

export type { Json };
