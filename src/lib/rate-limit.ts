import { NextResponse } from 'next/server';

/**
 * Pembatas laju sederhana untuk endpoint tulis (langganan push dan kirim tes).
 *
 * Seismos adalah satu proses Next.js tanpa layanan bersama, jadi penghitung
 * disimpan di memori proses. Keterbatasannya nyata dan diterima:
 * - bila aplikasi dijalankan di beberapa instance, tiap instance menghitung
 *   sendiri sehingga batas efektif berlipat sebanyak jumlah instance;
 * - penghitung hilang saat proses restart.
 *
 * Untuk tujuan di sini — mencegah satu klien membanjiri penyimpanan langganan
 * atau memicu kiriman push bertubi-tubi — batas per proses sudah cukup dan
 * tidak memerlukan Redis/penyimpanan tambahan.
 *
 * Penghitung memakai peta berukuran terbatas dan dibersihkan berkala supaya
 * dirinya sendiri tidak bisa dijadikan sarana menghabiskan memori.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

/** Batas jumlah alamat yang dilacak sekaligus. */
const MAX_BUCKETS = 5_000;

const buckets = new Map<string, number[]>();

/** Buang entri kedaluwarsa bila peta sudah terlalu besar. */
function prune(now: number, windowMs: number): void {
  if (buckets.size < MAX_BUCKETS) return;
  for (const [key, hits] of buckets) {
    if (hits.length === 0 || now - hits[hits.length - 1] > windowMs) buckets.delete(key);
  }
  // Bila masih penuh setelah pembersihan, hentikan pelacakan alamat baru
  // ketimbang tumbuh tanpa batas. Alamat lama tetap dibatasi.
  if (buckets.size >= MAX_BUCKETS) buckets.delete(buckets.keys().next().value as string);
}

/**
 * Ambil alamat klien untuk dijadikan kunci pembatas.
 *
 * `x-forwarded-for` hanya dipercaya bila aplikasi memang berada di belakang
 * proxy (ditetapkan lewat `TRUST_PROXY_HEADERS=1`). Tanpa itu, klien bisa
 * memalsukan header dan lolos dari pembatasan, jadi dipakai kunci tunggal
 * (`'anon'`) yang membatasi seluruh lalu lintas tak dikenal secara bersama.
 */
export function clientKey(request: Request): string {
  if (process.env.TRUST_PROXY_HEADERS !== '1') return 'anon';
  const forwarded = request.headers.get('x-forwarded-for');
  const first = forwarded?.split(',')[0]?.trim();
  if (first) return first;
  return request.headers.get('x-real-ip')?.trim() || 'anon';
}

const RATE_LIMIT_MESSAGE = 'Terlalu banyak permintaan. Tunggu sebentar lalu coba lagi.';

/**
 * Periksa dan catat satu permintaan.
 *
 * Mengembalikan `NextResponse` 429 bila batas terlampaui, atau `null` bila
 * permintaan boleh dilanjutkan. Respons 429 menyertakan `Retry-After` dalam
 * detik agar klien tahu kapan boleh mencoba lagi.
 */
export function rateLimit(
  request: Request,
  options: { name: string; limit: number; windowMs: number },
): NextResponse | null {
  const now = Date.now();
  prune(now, options.windowMs);

  const key = `${options.name}:${clientKey(request)}`;
  const hits = (buckets.get(key) ?? []).filter((time) => now - time < options.windowMs);

  if (hits.length >= options.limit) {
    const retryAfter = Math.max(1, Math.ceil((options.windowMs - (now - hits[0])) / 1000));
    buckets.set(key, hits);
    return NextResponse.json(
      { error: RATE_LIMIT_MESSAGE },
      {
        status: 429,
        headers: {
          'Cache-Control': 'no-store, max-age=0',
          'Retry-After': String(retryAfter),
        },
      },
    );
  }

  hits.push(now);
  buckets.set(key, hits);
  return null;
}

/** Hanya untuk tes: kosongkan penghitung. */
export function resetRateLimits(): void {
  buckets.clear();
}
