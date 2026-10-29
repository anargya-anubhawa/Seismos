/**
 * Pembersih pesan kesalahan untuk respons HTTP.
 *
 * Layanan sumber (BMKG/MAGMA) melempar pesan yang memang ditujukan untuk
 * pengguna: "Sumber data membalas HTTP 503", "Waktu tunggu 8000 ms habis",
 * "Respons sumber bukan JSON yang valid". Pesan itu berguna dan aman
 * ditampilkan, jadi tetap diteruskan.
 *
 * Yang tidak boleh keluar ke klien adalah pesan teknis dari runtime: kegagalan
 * jaringan Node (`fetch failed`, `getaddrinfo ENOTFOUND ...`, `connect ECONNREFUSED
 * 10.0.0.5:443`), kesalahan filesystem (`ENOENT: open '/srv/...'`), dan stack
 * internal. Pesan seperti itu membocorkan alamat internal, nama host, dan
 * susunan direktori server tanpa membantu pengguna.
 *
 * Pendekatan: pesan hanya diteruskan bila berbentuk kalimat yang kita tulis
 * sendiri di lapisan layanan. Pesan lain diganti kalimat umum berbahasa
 * Indonesia. Ini daftar-tolak keamanan, bukan daftar-izin: pesan tak dikenal
 * dianggap tidak boleh ditampilkan.
 */

/** Pola pesan yang berasal dari runtime/Node dan tidak boleh dikirim ke klien. */
const TECHNICAL_PATTERNS: RegExp[] = [
  /\bfetch failed\b/i,
  /\b(ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ECONNRESET|ETIMEDOUT|EHOSTUNREACH|ENETUNREACH)\b/,
  /\bgetaddrinfo\b/i,
  /\bsocket hang up\b/i,
  /\b(open|stat|read)\s+'[^']*'/i, // ENOENT: open '/srv/seismos/.data/...'
  /\bat\s+\S+\s+\(/i, // jejak stack
  /\/home\/|\/srv\/|\/var\/|\/app\/|node_modules/i,
  /\b[A-Za-z]:\\/, // path Windows
  /\blocalhost\b|\b127\.0\.0\.1\b/i,
  /\b\d{1,3}(\.\d{1,3}){3}(:\d+)?\b/, // alamat IP + port
  /\b(127|10|172|192)\.\d{1,3}\./,
];

/**
 * Pesan kesalahan yang aman ditampilkan pada respons galat.
 *
 * `fallback` dipakai bila pesan asli tidak ada atau tidak layak ditampilkan.
 * Batas panjang 200 karakter menjaga pesan tetap ringkas dan mencegah respons
 * galat dipakai memantulkan isi berkas sumber yang besar.
 */
export function publicErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof Error)) return fallback;

  const message = error.message.trim();
  if (message.length === 0 || message.length > 200) return fallback;

  // Pesan berisi baris baru hampir selalu jejak stack, bukan kalimat.
  if (/[\r\n]/.test(message)) return fallback;

  for (const pattern of TECHNICAL_PATTERNS) {
    if (pattern.test(message)) return fallback;
  }

  return message;
}
