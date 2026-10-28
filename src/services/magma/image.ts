import { MAGMA_USER_AGENT } from '@/services/magma/volcano';

/**
 * Proxy server-side untuk gambar resmi MAGMA (visual laporan, gallery, CCTV,
 * KRB). Host gambar MAGMA hanya dapat diakses dengan User-Agent/Referer wajar,
 * jadi browser tidak boleh memuatnya langsung; server Seismos meneruskan berkas
 * dan membatasi ukuran agar tidak ada pengambilan tak terbatas.
 */

const MAGMA_HOSTS = new Set([
  'vsi.esdm.go.id',
  'magma.vsi.esdm.go.id',
  'magma.esdm.go.id',
]);

const MAX_BYTES = Number(process.env.MAGMA_IMAGE_MAX_BYTES ?? 40_000_000);

export function isAllowedMagmaImage(raw: string): URL | null {
  let url: URL;
  try { url = new URL(raw); } catch { return null; }
  if (url.protocol !== 'https:') return null;
  if (!MAGMA_HOSTS.has(url.hostname)) return null;
  return url;
}

export interface ProxiedImage {
  body: ArrayBuffer;
  contentType: string;
  /** Ukuran total bila dilaporkan sumber (bisa lebih besar dari body saat terpotong). */
  contentLength: number | null;
}

export async function fetchMagmaImage(url: URL, timeoutMs = 25_000): Promise<ProxiedImage> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: ctl.signal,
      cache: 'no-store',
      redirect: 'follow',
      headers: {
        Accept: 'image/png,image/jpeg,image/webp,image/*',
        Referer: 'https://magma.esdm.go.id/',
        'User-Agent': MAGMA_USER_AGENT,
      },
    });
    if (!response.ok) throw new Error(`Sumber gambar MAGMA membalas HTTP ${response.status}`);
    // Host akhir setelah redirect tetap harus MAGMA.
    const finalHost = new URL(response.url).hostname;
    if (!MAGMA_HOSTS.has(finalHost)) throw new Error('Sumber gambar mengarah ke host di luar MAGMA');
    const contentType = (response.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
    if (!contentType.startsWith('image/')) throw new Error('Sumber tidak mengirim berkas gambar');

    const declared = Number(response.headers.get('content-length'));
    const contentLength = Number.isFinite(declared) && declared > 0 ? declared : null;
    if (contentLength !== null && contentLength > MAX_BYTES) {
      throw new Error(`Berkas gambar terlalu besar (${Math.round(contentLength / 1_000_000)} MB)`);
    }
    const body = await response.arrayBuffer();
    if (body.byteLength === 0) throw new Error('Berkas gambar kosong');
    if (body.byteLength > MAX_BYTES) throw new Error('Berkas gambar terlalu besar');
    return { body, contentType, contentLength: contentLength ?? body.byteLength };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Waktu tunggu ${Math.round(timeoutMs / 1000)} detik habis saat mengambil gambar MAGMA`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
