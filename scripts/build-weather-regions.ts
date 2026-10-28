/**
 * Membangun berkas kode wilayah untuk prakiraan cuaca BMKG.
 *
 * API prakiraan BMKG (`api.bmkg.go.id/publik/prakiraan-cuaca`) hanya menerima
 * kode wilayah level desa/kelurahan (adm4). Endpoint pencarian lokasi milik
 * situs BMKG memerlukan token sehingga tidak dapat dipakai, jadi aplikasi
 * memerlukan daftar kode wilayah sendiri untuk mengubah koordinat pengguna
 * menjadi adm4.
 *
 * Sumber data: rilis publik `rafiyq/wilayah` (turunan kode wilayah
 * Kemendagri/BPS). Berkas rilis ini memuat nama desa, kecamatan, kabupaten,
 * provinsi, dan koordinat desa dalam satu tabel SQLite.
 *
 * Hasil yang disimpan hanya yang benar-benar dipakai aplikasi:
 *   - satu baris per kecamatan (prakiraan BMKG sama untuk satu kecamatan),
 *   - kode adm4 desa pertama kecamatan tersebut sebagai kode prakiraan,
 *   - koordinat desa pertama itu untuk pencocokan lokasi terdekat.
 *
 * Pemakaian:
 *   npx sucrase-node scripts/build-weather-regions.ts            # unduh + bangun
 *   npx sucrase-node scripts/build-weather-regions.ts --file x.db # dari berkas lokal
 *
 * Keluaran: src/data/weather-regions.json.gz (di-commit, bukan data mentah).
 */
import { createWriteStream } from 'node:fs';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';

const RELEASE = 'https://github.com/rafiyq/wilayah/releases/download/v0.6.2/locations.db';
const OUT = path.join(process.cwd(), 'src', 'data', 'weather-regions.json.gz');

interface RegionRow {
  /** Kode adm4 yang dipakai untuk permintaan prakiraan cuaca. */
  c: string;
  /** Nama kecamatan, mis. "Gambir". */
  d: string;
  /** Kabupaten/kota, mis. "Kota Administrasi Jakarta Pusat". */
  k: string;
  /** Provinsi tanpa awalan "Provinsi ". */
  p: string;
  lat: number;
  lon: number;
}

const strip = (value: string, prefix: string): string =>
  value.startsWith(prefix) ? value.slice(prefix.length).trim() : value.trim();

/** Membaca tabel `locations` dari SQLite tanpa dependensi tambahan. */
function readLocations(dbPath: string): RegionRow[] {
  const sql = [
    'SELECT kode, kecamatan, kota, provinsi, lat, lon FROM locations',
  ].join(' ');
  // `sqlite3` tersedia di sebagian besar lingkungan; bila tidak ada, gunakan
  // modul `node:sqlite` (Node 22+). Keduanya hanya dipakai saat membangun data.
  try {
    const raw = execFileSync('sqlite3', ['-json', dbPath, sql], { maxBuffer: 64 * 1024 * 1024 }).toString();
    return JSON.parse(raw).map((row: Record<string, unknown>) => ({
      c: String(row.kode),
      d: String(row.kecamatan),
      k: String(row.kota),
      p: strip(String(row.provinsi), 'Provinsi'),
      lat: Number(row.lat),
      lon: Number(row.lon),
    }));
  } catch {
    throw new Error(
      'Perintah `sqlite3` tidak tersedia. Pasang sqlite3 CLI lalu ulangi, atau ubah skrip ini memakai modul node:sqlite.',
    );
  }
}

/**
 * Satu kecamatan bisa punya banyak desa, tetapi prakiraan BMKG untuk seluruh
 * desa dalam satu kecamatan isinya sama (diuji pada beberapa kecamatan). Karena
 * itu hanya satu desa per kecamatan yang disimpan, dipilih yang paling dekat
 * dengan pusat kecamatan agar perkiraan posisi pengguna tidak melenceng jauh.
 */
function perDistrict(rows: RegionRow[]): RegionRow[] {
  const groups = new Map<string, RegionRow[]>();
  for (const row of rows) {
    const key = row.c.slice(0, 8);
    const list = groups.get(key);
    if (list) list.push(row);
    else groups.set(key, [row]);
  }

  const out: RegionRow[] = [];
  for (const [key, list] of groups) {
    const lat = list.reduce((sum, r) => sum + r.lat, 0) / list.length;
    const lon = list.reduce((sum, r) => sum + r.lon, 0) / list.length;
    let best = list[0];
    let bestDistance = Infinity;
    for (const row of list) {
      const distance = (row.lat - lat) ** 2 + (row.lon - lon) ** 2;
      if (distance < bestDistance) { best = row; bestDistance = distance; }
    }
    out.push({ ...best, c: best.c, d: best.d || key });
  }
  return out.sort((a, b) => a.c.localeCompare(b.c));
}

async function download(url: string): Promise<string> {
  const target = path.join(tmpdir(), `seismos-wilayah-${Date.now()}.db`);
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`Gagal mengunduh ${url}: HTTP ${res.status}`);
  await pipeline(res.body as unknown as NodeJS.ReadableStream, createWriteStream(target));
  return target;
}

async function main() {
  const fileArg = process.argv.indexOf('--file');
  let dbPath: string;
  let temporary = false;
  if (fileArg !== -1 && process.argv[fileArg + 1]) {
    dbPath = path.resolve(process.argv[fileArg + 1]);
  } else {
    console.log(`Mengunduh ${RELEASE} …`);
    dbPath = await download(RELEASE);
    temporary = true;
  }

  try {
    const rows = readLocations(dbPath);
    if (rows.length < 50_000) throw new Error(`Data wilayah terlalu sedikit (${rows.length} baris)`);
    const regions = perDistrict(rows);
    const payload = {
      source: 'rafiyq/wilayah v0.6.2 (kode wilayah Kemendagri/BPS)',
      generatedAt: new Date().toISOString(),
      regions,
    };
    await mkdir(path.dirname(OUT), { recursive: true });
    await writeFile(OUT, gzipSync(Buffer.from(JSON.stringify(payload)), { level: 9 }));
    const bytes = (await readFile(OUT)).byteLength;
    console.log(`Selesai: ${regions.length} kecamatan dari ${rows.length} desa`);
    console.log(`Ditulis ${path.relative(process.cwd(), OUT)} (${(bytes / 1024).toFixed(0)} KB gzip)`);
  } finally {
    if (temporary) await unlink(dbPath).catch(() => {});
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
