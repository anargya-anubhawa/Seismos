/**
 * Validasi bersama untuk langganan Web Push: host endpoint dan kunci VAPID.
 *
 * Dipakai oleh jalur gunung api dan tsunami supaya aturannya tidak bercabang.
 * Kedua jalur memakai service worker dan kunci VAPID yang sama, jadi
 * allowlist dan pemeriksaan kunci memang harus identik.
 */

/**
 * Host layanan push yang sah per ekosistem peramban.
 *
 * Daftar ini sengaja dibuat ketat, tetapi perlu dirawat: layanan push baru
 * (atau domain baru dari layanan yang sudah ada) harus ditambahkan di sini.
 * Host yang ditolak dicatat lewat `describeRejectedPushEndpoint()` agar mudah
 * ditambahkan. Pengembangan lokal tetap diizinkan lewat `isLoopback()`.
 */
const EXACT_PUSH_HOSTS = new Set([
  // Chrome, Edge, Opera, Android (FCM)
  'fcm.googleapis.com',
  // Firefox
  'updates.push.services.mozilla.com',
  // Apple (Safari macOS & iOS 16.4+)
  'web.push.apple.com',
]);

/** Akhiran domain push Windows (WNS) — subdomainnya per aplikasi. */
const PUSH_HOST_SUFFIXES = [
  '.notify.windows.com',
];

/** Host loopback untuk pengembangan lokal (tanpa HTTPS). */
export function isLoopbackHostname(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host === '::1';
}

/** Apakah host endpoint termasuk layanan push yang diizinkan. */
export function isAllowedPushHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (EXACT_PUSH_HOSTS.has(host)) return true;
  return PUSH_HOST_SUFFIXES.some((suffix) => host === suffix.slice(1) || host.endsWith(suffix));
}

/**
 * Periksa endpoint langganan.
 *
 * Mengembalikan `null` bila sah, atau alasan penolakan yang aman dicatat ke log
 * server. Alasan tidak pernah dikirim mentah ke klien; API tetap memakai pesan
 * umum "Langganan push tidak valid".
 */
export function describeRejectedPushEndpoint(endpoint: string): string | null {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return 'endpoint bukan URL yang sah';
  }

  const loopback = isLoopbackHostname(url.hostname);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) {
    return `protokol ${url.protocol} tidak diizinkan`;
  }

  // Loopback hanya untuk pengembangan lokal; tidak pernah ke layanan push nyata.
  if (loopback) return null;

  if (!isAllowedPushHost(url.hostname)) {
    return `host ${url.hostname} tidak ada di allowlist layanan push`;
  }

  return null;
}

/**
 * Validasi kriptografis kunci VAPID dari variabel lingkungan.
 *
 * Kunci publik P-256 tanpa kompresi tepat 65 byte dan kunci privat 32 byte
 * setelah decode base64url. Pemeriksaan panjang string saja tidak cukup: kunci
 * acak sepanjang 87 karakter lolos pemeriksaan itu tetapi tidak akan pernah
 * bisa memvalidasi langganan, sehingga pengguna mendaftar lalu tidak pernah
 * menerima notifikasi tanpa peringatan apa pun.
 *
 * Mengembalikan `{ publicKey, privateKey }` bila sah, atau `{ error }` berisi
 * alasan yang aman dicatat ke log (bukan untuk klien).
 */
export function validateVapidKeys(
  publicKeyInput: string | undefined,
  privateKeyInput: string | undefined,
): { publicKey: string; privateKey: string } | { error: string } {
  const publicKey = (publicKeyInput ?? '').trim();
  const privateKey = (privateKeyInput ?? '').trim();

  if (!publicKey || !privateKey) return { error: 'kunci VAPID kosong' };

  // Toleran terhadap padding `=`, yang tidak dipakai di base64url Web Push.
  const decode = (value: string): Buffer | null => {
    if (!/^[A-Za-z0-9_-]+={0,2}$/.test(value)) return null;
    try {
      return Buffer.from(value, 'base64url');
    } catch {
      return null;
    }
  };

  const publicBytes = decode(publicKey);
  if (!publicBytes) return { error: 'kunci publik VAPID bukan base64url yang sah' };
  if (publicBytes.length !== 65) {
    return { error: `kunci publik VAPID harus 65 byte, terbaca ${publicBytes.length} byte` };
  }
  // Byte pertama kunci P-256 tanpa kompresi harus 0x04 (uncompressed point).
  if (publicBytes[0] !== 0x04) {
    return { error: 'kunci publik VAPID bukan titik P-256 tanpa kompresi' };
  }

  const privateBytes = decode(privateKey);
  if (!privateBytes) return { error: 'kunci privat VAPID bukan base64url yang sah' };
  if (privateBytes.length !== 32) {
    return { error: `kunci privat VAPID harus 32 byte, terbaca ${privateBytes.length} byte` };
  }

  return { publicKey, privateKey };
}
