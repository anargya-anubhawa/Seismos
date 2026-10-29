# TEMUAN AUDIT PRA-RILIS — SEISMOS

Dokumen ini mencatat temuan audit yang **terverifikasi** beserta buktinya. Setiap temuan
yang ditandai *Diperbaiki* sudah punya perubahan kode di repositori dan sudah diuji ulang.

- Tanggal audit: lint/typecheck/tes/build dijalankan pada sesi ini.
- Basis kode: `main` @ `8ee6d84`; perbaikan di `ea4314a`; verifikasi akhir diverifikasi ulang.
- Lingkungan: Node v24.22.0, npm 11.19.1, Linux.

Klasifikasi prioritas:

| Prioritas | Arti |
|---|---|
| P0 | Celah keamanan berat terkonfirmasi, risiko kehilangan data, atau kegagalan yang memblokir rilis |
| P1 | Fungsi utama rusak, masalah keamanan berarti, atau gangguan keandalan berat |
| P2 | Masalah performa, kegunaan, pemeliharaan, atau kompatibilitas yang nyata |
| P3 | Perapian kecil atau peningkatan opsional |

### Kosakata status yang dipakai (seragam di semua dokumen audit)

Setiap temuan dan pemeriksaan memakai salah satu dari empat label ini. Kolom "Status" pada
ringkasan memakai bahasa biasa (mis. *Diperbaiki*), dan label baku ada di kolom "Label".

| Label | Arti | Padanan status temuan |
|---|---|---|
| **PASS** | Sudah diperbaiki dan dibuktikan ulang di sesi ini; bukti tercatat | *Diperbaiki* |
| **FAIL** | Rusak atau belum tertangani, dan terbukti begitu | *Terbuka* yang belum disetujui perbaikannya |
| **BLOCKED** | Tidak dapat diuji di lingkungan ini (tanpa peramban/perangkat/kunci VAPID), **bukan** dianggap lulus | — |
| **NOT RUN** | Sengaja tidak dijalankan (di luar lingkup atau butuh persetujuan) | *Diterima, tercatat* hanya bila memang keputusan menerima risiko |

Temuan yang **diterima sebagai risiko** bukan PASS maupun FAIL: itu keputusan sadar, ditandai
sebagai *risiko diterima* dan tetap tercantum di [RELEASE_CHECKLIST.md](./RELEASE_CHECKLIST.md).

Dokumen rinci: [SECURITY_AUDIT.md](./SECURITY_AUDIT.md) ·
[TEST_RESULTS.md](./TEST_RESULTS.md) · [PERFORMANCE_AUDIT.md](./PERFORMANCE_AUDIT.md) ·
[RELEASE_CHECKLIST.md](./RELEASE_CHECKLIST.md) · [OPTIONAL_IMPROVEMENTS.md](./OPTIONAL_IMPROVEMENTS.md)

---

## Ringkasan temuan

| ID | Prioritas | Kategori | Status | Label |
|---|---|---|---|---|
| F-01 | P0 | Keamanan — RCE Image Optimization (`next@14.2.15`) | **Diperbaiki** | **PASS** |
| F-02 | P1 | Keamanan — Tidak ada Content-Security-Policy / HSTS | **Diperbaiki** | **PASS** |
| F-03 | P1 | Keamanan — `next` & `postcss` versi rentan | **Sebagian diperbaiki** (25 advisory, pemicu tidak ada) | **PASS dengan risiko diterima** |
| F-04 | P2 | Keamanan — Pesan galat internal bocor ke klien | **Diperbaiki** | **PASS** |
| F-05 | P2 | Keamanan — Tidak ada pembatas laju pada endpoint tulis | **Diperbaiki** | **PASS** |
| F-06 | P2 | Keamanan — Tidak ada batas ukuran body permintaan | **Diperbaiki** | **PASS** |
| F-07 | P2 | Keandalan — `/api/volcano/status` membalas 500 tanpa body | **Diperbaiki** | **PASS** |
| F-08 | P2 | Kepatuhan — 7 `eslint-disable` melanggar aturan AGENTS.md | **Diperbaiki** | **PASS** |
| F-09 | P3 | Kebersihan — `src/app/page.tsx.bak` tertinggal di repositori | **Diperbaiki** | **PASS** |
| F-10 | P3 | Keamanan — Endpoint langganan push menerima host apa pun | **Diperbaiki** (OI-02) | **PASS** |
| F-14 | P3 | Keandalan — Kunci VAPID tidak sah lolos pemeriksaan panjang | **Diperbaiki** (OI-13) | **PASS** |
| F-11 | P3 | Keandalan — Pembatas laju hanya per proses (in-memory) | Diterima, tercatat | **risiko diterima** |
| F-12 | P3 | Keamanan — CSP memakai `'unsafe-inline'` untuk script | Diterima, tercatat | **risiko diterima** |

F-13 (pemeriksaan push nyata di perangkat) → **BLOCKED**, lihat [RELEASE_CHECKLIST.md §2](./RELEASE_CHECKLIST.md).

---

## F-01 (P0) — RCE Image Optimization pada `next@14.2.15`

**Kategori:** Keamanan · **Status:** Diperbaiki · **Label: PASS**

### Bukti

`npm audit --omit=dev` pada baseline melaporkan 2 kerentanan (1 kritis, 1 tinggi). Entri
`next` memuat advisory kritis yang menyangkut Image Optimization:

- `GHSA-2xp9-vwfh-vxw4` — RCE di Image Optimization API bila berkas AVIF dipakai (CVSS 9.8)
- `GHSA-2464-fhr4-w9xw` — RCE di Image Optimization API bila berkas SVG dipakai
- `GHSA-p293-qw3h-jr36` — RCE tanpa autentikasi pada server Windows (CVSS 9.0)

Ketiganya bersarang di `next@14.2.15`. Versi tambal terendah pada jalur 14.x tidak ada:
`first_patched_version` untuk `GHSA-2xp9-vwfh-vxw4` adalah `15.5.24` / `16.3.3`, dan advisory
SVG baru tertambal di `15.5.28` / `16.4.1`. Dengan kata lain **seluruh keluarga 14.x tidak
akan pernah menerima tambalan** untuk advisory ini.

Jalur serangnya nyata karena aplikasi memakai `next/image`:

```
src/components/weather/parts.tsx:3   import Image from 'next/image';
```

Satu pemakaian itu cukup membuat rute `/_next/image` aktif di server produksi.

### Akar masalah

Aplikasi mengekspos endpoint pemrosesan gambar (Sharp) milik Next.js, padahal tidak pernah
memanfaatkan fitur optimasi tersebut — pemakaian tunggal `next/image` sudah memasang
`unoptimized`, dan semua gambar gunung api/gempa melewati proxy sendiri.

### Perbaikan

1. **Mematikan optimizer secara menyeluruh** di `next.config.mjs`:

   ```js
   images: { unoptimized: true },
   ```

   Dengan ini rute `/_next/image` tidak lagi melayani pemrosesan gambar, sehingga tidak ada
   jalur Sharp yang dapat dieksploitasi, dan `sharp` tidak dimuat sama sekali.

2. **Menaikkan `next` 14.2.15 → 14.2.35** (tambalan terakhir jalur 14.x). Ini menutup
   advisory lain yang memang dapat dijangkau: DoS Server Components (`GHSA-mwv6-3258-q52c`,
   `GHSA-5j59-xgg2-r9c4`), cache poisoning, serta cache-key confusion Image Optimization.

### Verifikasi

| Uji | Sebelum | Sesudah |
|---|---|---|
| `curl /_next/image` | `200` (aktif) | `404` |
| `curl /_next/image?url=…&w=64&q=75` | `200` | `404` |
| `sharp` di `node_modules` | tidak terpasang | tidak terpasang |
| `curl /icon-192.png` (berkas asli) | `200` | `200` (5.264 B) |
| `npm run build` | sukses | sukses |

Endpoint optimizer sudah tidak ada; penyajian berkas statis tetap normal.

### Risiko regresi

Rendah. Tidak ada gambar yang sebelumnya dioptimasi Next.js: pemakaian tunggal sudah
`unoptimized`, sisanya `<img>` biasa lewat proxy sendiri. Semua 22 rute halaman diuji ulang
dan tetap `200`.

---

## F-02 (P1) — Tidak ada Content-Security-Policy dan HSTS

**Kategori:** Keamanan · **Status:** Diperbaiki · **Label: PASS**

### Bukti

Sebelum perbaikan, `next.config.mjs` hanya mengirim tiga header:

```
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
X-Frame-Options: SAMEORIGIN
```

Tidak ada `Content-Security-Policy`, tidak ada `Strict-Transport-Security`, dan tidak ada
`Permissions-Policy`. Tanpa HSTS, kunjungan pertama lewat HTTP dapat dicegat sebelum
dialihkan ke HTTPS.

### Perbaikan

`next.config.mjs` kini mengirim tambahan:

- `Content-Security-Policy` dengan `object-src 'none'`, `base-uri 'self'`,
  `form-action 'self'`, `frame-ancestors 'self'`, dan `connect-src 'self'` (tidak ada
  koneksi keluar dari skrip pihak ketiga).
- `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- `Cross-Origin-Opener-Policy: same-origin`
- `Permissions-Policy: geolocation=(self), camera=(), microphone=(), payment=()`

Origin yang diizinkan ditentukan dari pemindaian kode, bukan tebakan:

| Arahan | Origin | Alasan (bukti) |
|---|---|---|
| `img-src` | `i.ytimg.com` | thumbnail siaran langsung YouTube |
| `img-src` | `tile.openstreetmap.org` | tile peta Leaflet (`src/lib/map/basemap.ts:15`) |
| `img-src` | `server.arcgisonline.com` | citra satelit basemap (`src/lib/map/basemap.ts:10`) |
| `frame-src` | `youtube-nocookie.com`, `youtube.com` | pemutar siaran langsung |

### Verifikasi

Header terverifikasi pada respons nyata (`curl -I http://localhost:3361/`):

```
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; …
Strict-Transport-Security: max-age=31536000; includeSubDomains
Cross-Origin-Opener-Policy: same-origin
Permissions-Policy: geolocation=(self), camera=(), microphone=(), payment=()
```

Verifikasi cakupan: seluruh origin eksternal pada HTML ter-render dibandingkan dengan
kebijakan.

```
5  https://i.ytimg.com
1  https://www.youtube-nocookie.com
1  https://www.youtube.com
1  https://magma.esdm.go.id   ← tautan <a>, bukan pemuatan sumber daya
```

Saat penyusunan awal, `img-src` belum memuat host tile peta. Kondisi itu ditemukan lewat
pemindaian `src/lib/map/basemap.ts` lalu diperbaiki sebelum dinyatakan selesai — tanpa
perbaikan tersebut, seluruh peta akan kosong di produksi. Cakupan akhir diverifikasi ulang
pada header `/map`.

`Permissions-Policy` menyatakan `geolocation=(self)` karena fitur "lokasi saya" memang
memakai geolokasi; kamera, mikrofon, dan pembayaran diblokir karena tidak dipakai.

### Risiko regresi

Sedang bila ada aset eksternal yang terlewat. Mitigasi: seluruh origin pada HTML ter-render
sudah dicocokkan, dan 22 rute halaman diuji `200` setelah header aktif.

Catatan jujur: `script-src` memakai `'unsafe-inline'` karena Next.js 14 menyisipkan skrip
bootstrap inline dan aplikasi memakai skrip tema inline statis. CSP ini menutup pemuatan
skrip eksternal dan `eval`, tetapi **tidak** mencegah XSS yang bersumber dari HTML
pihak pertama. Rincian ada di [SECURITY_AUDIT.md](./SECURITY_AUDIT.md).

---

## F-03 (P1) — Dependensi versi rentan; sisa advisory tidak dapat dijangkau

**Kategori:** Keamanan · **Status:** Sebagian diperbaiki · **Label: PASS dengan risiko diterima**

### Bukti & penanganan

| Paket | Sebelum | Sesudah | Advisory yang mencakup versi terpasang |
|---|---|---|---|
| `next` | 14.2.15 | 14.2.35 | **25** advisory (3 kritis, 9 tinggi, 11 sedang, 2 rendah) |
| `postcss` | 8.5.31 (dan 8.4.31 bersarang) | 8.5.32 | 4 advisory → 0 |

`postcss` hanya dipakai di jalur build. Diperiksa dengan:

```
grep -rln "require('postcss')" node_modules/next/dist/server   → tidak ada
```

Pemakaiannya hanya di `dist/build/**` (loader CSS, plugin minimizer). Karena itu
`npm audit --omit=dev` tidak lagi melaporkannya, dan menaikkan versinya tidak berisiko
mengubah perilaku runtime. Kenaikan dicapai lewat `overrides` agar salinan `postcss`
bersarang di dalam `next` ikut tertambal.

### Angka advisory yang benar (diukur ulang pada verifikasi akhir)

`npm audit` menggabungkan **semua** advisory `next` menjadi satu entri paket, sehingga ringkasan
`npm audit --omit=dev` menunjukkan `1 critical severity vulnerability` — itu adalah **jumlah paket**,
bukan jumlah advisory. Hitungan per-advisory diperoleh dengan memfilter setiap `range` terhadap
versi terpasang (`14.2.35`):

```
node -e "console.log(require('next/package.json').version)"   → 14.2.35
total advisory terdaftar (entri 'next')                      → 25
advisory yang rentangnya mencakup 14.2.35                    → 25
sebaran severity                                           → 3 kritis, 9 tinggi, 11 sedang, 2 rendah
metadata npm audit --omit=dev                              → { critical: 1, total: 1 }
```

> **Koreksi.** Draf audit sebelumnya menulis "4 advisory sisa". Angka itu **salah** — berasal dari
> membaca daftar advisory yang terpotong. Angka yang benar adalah **25**. Rentang per-advisory
> dicatat di bawah, dan status kelayakan tetap bergantung pada analisis keterjangkauan, bukan pada
> angka mentahnya.

### Sisa 25 advisory dan alasan tidak dapat dijangkau

`next@14.2.35` masih berada di dalam rentang 25 advisory. Semuanya menempel pada paket, tetapi
**kondisi pemicunya tidak ada di kode aplikasi**:

| Advisory (contoh kunci) | Pemicu | Kondisi di Seismos | Dapat dijangkau? |
|---|---|---|---|
| `GHSA-2xp9-vwfh-vxw4` (RCE AVIF) | Image Optimization | `images.unoptimized: true`; `/_next/image` → **404** (diuji) | Tidak |
| `GHSA-2464-fhr4-w9xw` (RCE SVG, kritis) | Image Optimization | idem; tidak ada `images.remotePatterns` | Tidak |
| `GHSA-9g9p-9gw9-jx7f` (DoS optimizer `remotePatterns`) | Image Optimization | idem; `remotePatterns` → **0 hasil** | Tidak |
| `GHSA-3x4c-7xq6-9pq8` (cache disk optimizer) | Image Optimization | idem | Tidak |
| `GHSA-p293-qw3h-jr36` (RCE Windows) | Server Windows | Target deploy Linux | Tidak |
| `GHSA-p3m5-59mp-jv5r` (DoS Server Actions) | Server Actions | `grep -rn "'use server'" src/` → **0 hasil** | Tidak |
| `GHSA-h25m-26qc-wcjf`, `GHSA-q4gf-8mx6-v5v3`, `GHSA-8h8q-6873-q5fj` (DoS RSC) | RSC berbahaya | Tidak ada permukaan RSC kustom; aplikasi halaman klien + route handler | Tidak (risiko sisa: DoS generik, lihat catatan) |
| `GHSA-ggv3-7p47-pfv8` (smuggling di `rewrites`) | `rewrites` | `rewrites`/`redirects`/`i18n` → **0 hasil** di config | Tidak |
| `GHSA-3g8h-86w9-wvmq`, `GHSA-*` cache poisoning middleware | `middleware.ts` | tidak ada `middleware.ts` | Tidak |
| `GHSA-*` XSS CSP nonce / `beforeInteractive` | nonce / `next/script` | tidak ada nonce (hanya komentar), `beforeInteractive` → **0 hasil** | Tidak |

Catatan jujur: sebagian advisory DoS pada React Server Components tidak sepenuhnya bergantung pada
kode aplikasi — permintaan HTTP apa pun yang diproses runtime Next tetap dapat memicunya. Untuk
kategori ini tidak ada mitigasi kode yang bisa ditambahkan tanpa menaikkan versi. Karena itu risiko
yang tersisa adalah **ketersediaan (DoS), bukan eksekusi kode atau kebocoran data**, dan statusnya
tetap tercatat sebagai risiko diterima hingga **OI-01** (Next 16) dikerjakan.

Bukti pendukung: tidak ada `middleware.ts`, tidak ada `rewrites`/`redirects`/`i18n`, 0 `'use server'`,
tidak ada custom server, 0 handler `upgrade` WebSocket, 0 `beforeInteractive`, 0 `images.remotePatterns`.

Penutupan penuh hanya tersedia di `next@16.x`, yang merupakan **perubahan besar**
(React 18 → 19, konfigurasi dan perilaku App Router berubah). Ini melewati batas wewenang
audit ini, jadi diajukan sebagai **OI-01** untuk keputusan Anda, bukan dikerjakan sepihak.

---

## F-04 (P2) — Pesan galat internal bocor ke klien

**Kategori:** Keamanan · **Status:** Diperbaiki · **Label: PASS**

### Bukti

`grep` menemukan **33 lokasi** di `src/app/api/**` yang mengirim `error.message` mentah ke
klien. Kebocoran ini bukan teoretis — dibuktikan dengan menjalankan server dengan URL sumber
yang sengaja dirusak:

```
$ BMKG_BASE_URL=https://127.0.0.1:9/tidak-ada  curl /api/earthquakes
  terbaru  | error: fetch failed
  m5       | error: fetch failed
  dirasakan| error: fetch failed
```

`fetch failed` adalah pesan runtime Node yang membuka jalan ke detail jaringan internal
(`getaddrinfo ENOTFOUND …`, `ECONNREFUSED 10.0.0.5:443`, path berkas `.data/…`).

### Perbaikan

Helper baru `src/lib/public-error.ts`:

```ts
export function publicErrorMessage(error: unknown, fallback: string): string
```

Perilakunya **daftar-tolak**: pesan hanya diteruskan bila berbentuk kalimat yang ditulis
lapisan layanan sendiri ("Sumber data membalas HTTP 503", "Waktu tunggu 8000 ms habis"). Pesan
yang mengandung pola teknis diganti kalimat umum berbahasa Indonesia. Pola yang ditolak:

- `fetch failed`, `getaddrinfo`, `ETIMEDOUT`, `ECONNREFUSED`, `ENOENT: open '…'`
- jejak stack (`at fungsi (`), path server (`/srv/`, `/home/`, `node_modules`, `C:\`)
- alamat IP dan `localhost`, pesan kosong, pesan > 200 karakter, pesan multi-baris

Diterapkan pada:

- **33 situs** di `src/app/api/**` (dari 27 berkas rute)
- `src/lib/cache.ts` — `SourceStatus.error` yang ikut tampil di UI
- `src/services/bmkg/index.ts` — status per sumber BMKG
- `src/services/bmkg/weather.ts` — galat citra satelit
- `src/services/magma/index.ts` — galat daftar gunung api

### Verifikasi

Dijalankan ulang dengan URL sumber rusak:

```
events: 194
  terbaru   | 'Sumber data tidak dapat dihubungi'
  m5        | 'Sumber data tidak dapat dihubungi'
  dirasakan | 'Sumber data tidak dapat dihubungi'
grep -c "fetch failed" /tmp/deg2.json  →  0
```

Kebocoran tertutup, data dari sumber yang sehat tetap tersaji. Gangguan sumber **tidak**
dijadikan alasan menampilkan data kosong seolah sukses: status per sumber tetap tampil
sebagai galat.

### Tes regresi

`scripts/test-public-error.ts` (4 tes) mengunci perilaku:

- 5 pesan layanan yang sah diteruskan apa adanya
- 8 pesan teknis (`fetch failed`, `ENOTFOUND`, `ECONNREFUSED 10.1.2.3:443`,
  `ENOENT: open '/srv/seismos/.data/…'`, path `node_modules`, jejak stack,
  `http://127.0.0.1:3000/internal`, `C:\seismos\…`) diganti kalimat umum
- nilai non-`Error` dan pesan kosong memakai kalimat umum
- pesan sangat panjang dipotong

---

## F-05 (P2) — Tidak ada pembatas laju pada endpoint tulis

**Kategori:** Keamanan · **Status:** Diperbaiki · **Label: PASS**

### Bukti

`grep -rln "rateLimit\|throttle" src/` pada baseline → **tidak ada hasil**. Enam endpoint
tulis terbuka tanpa batas:

```
/api/volcano/monitor        POST   (memicu pemeriksaan + notifikasi)
/api/tsunami/monitor        POST
/api/volcano/push/subscribe POST + DELETE  (menulis penyimpanan langganan)
/api/tsunami/push/subscribe POST + DELETE
/api/volcano/push/test      POST   (memicu kiriman push)
/api/tsunami/push/test      POST
```

Dua endpoint `monitor` memang memakai pembanding rahasia berwaktu-konstan (`sameSecret`),
tetapi empat endpoint push tidak berautentikasi — sesuai desain Web Push, karena endpoint
langganan itu sendiri adalah rahasia tak tertebak. Yang kurang bukan autentikasi, melainkan
pembatasan laju.

### Perbaikan

`src/lib/rate-limit.ts` — penghitung jendela bergulir di memori proses:

| Endpoint | Batas | Jendela |
|---|---|---|
| `push/subscribe` (POST+DELETE, per kanal) | 30 | 10 menit |
| `push/test` (per kanal) | 5 | 10 menit |
| `monitor` (per kanal) | 20 | 5 menit |

Respons `429` menyertakan `Retry-After`. Peta penghitung dibatasi 5.000 kunci dan dibersihkan
berkala, supaya pembatas itu sendiri tidak bisa dipakai menghabiskan memori.

Pemilihan kunci klien sengaja konservatif: `x-forwarded-for` **hanya** dipercaya bila
`TRUST_PROXY_HEADERS=1` disetel. Tanpa itu, seluruh lalu lintas memakai kunci tunggal
`'anon'` — lebih membatasi, tetapi tidak bisa dipalsukan klien § salah satu trade-off yang
didokumentasikan, bukan disembunyikan.

### Verifikasi (server produksi nyata)

```
req1..req5: 502 {"error":"Langganan push tidak ditemukan; …"}
req6:       429 {"error":"Terlalu banyak permintaan. Tunggu sebentar lalu coba lagi."}
header:     HTTP/1.1 429 Too Many Requests / retry-after: 596
```

### Tes regresi

`scripts/test-rate-limit.ts` (4 tes): lolos di bawah batas dan `429` + `Retry-After` saat
melewati; jatah terpisah per nama pembatas; jendela kedaluwarsa mengembalikan jatah;
`x-forwarded-for` hanya dipercaya saat `TRUST_PROXY_HEADERS=1`.

---

## F-06 (P2) — Tidak ada batas ukuran body permintaan

**Kategori:** Keamanan · **Status:** Diperbaiki · **Label: PASS**

### Bukti

Handler memanggil `await request.json()` tanpa memeriksa `content-length`. Siapa pun dapat
mengirim body berukuran besar ke endpoint tulis, memaksa server mem-parse JSON besar —
pengerahan sumber daya yang murah bagi penyerang.

### Perbaikan

Keenam endpoint tulis kini menolak permintaan dengan `content-length` melebihi batas
(4.000 B untuk push, 8.000 B untuk monitor) **sebelum** body dibaca:

```ts
const declaredLength = Number(request.headers.get('content-length'));
if (Number.isFinite(declaredLength) && declaredLength > 4000) {
  return NextResponse.json({ error: 'Body permintaan terlalu besar' }, { status: 413, … });
}
```

Batas dipilih dari bentuk payload sebenarnya: langganan push terbesar (endpoint 2.048 +
`p256dh` 512 + `auth` 256 + kategori) jauh di bawah 4.000 B.

### Verifikasi

```
POST /api/volcano/push/subscribe  body 5.011 B  →  413 {"error":"Body permintaan terlalu besar"}
POST /api/volcano/push/subscribe  body normal    →  400 {"error":"Langganan push tidak valid"}
```

Catatan jujur: pemeriksaan ini berbasis header `content-length`. Body `chunked` tanpa header
tersebut tetap akan dibaca. Batas keras untuk kasus itu perlu konfigurasi di lapisan reverse
proxy (mis. `client_max_body_size` pada nginx) — tercatat di
[RELEASE_CHECKLIST.md](./RELEASE_CHECKLIST.md).

---

## F-07 (P2) — `/api/volcano/status` membalas 500 tanpa body

**Kategori:** Keandalan · **Status:** Diperbaiki · **Label: PASS**

### Bukti

Ditemukan saat menguji degradasi dengan `MAGMA_BASE_URL` dirusak:

```
HTTP/1.1 500 Internal Server Error
content-type: (kosong)
body: (kosong)
```

`getStatuses()` memanggil `getVolcanoStatuses()` yang **melempar** ketika sumber gagal dan
tidak ada cache sebelumnya. Rute `status` adalah satu-satunya rute halaman-data yang
memanggil layanan tanpa `try/catch`, sehingga galat merambat menjadi 500 kosong. Klien
menerima respons yang tidak bisa di-parse maupun ditampilkan.

### Perbaikan

`src/app/api/volcano/status/route.ts` kini menangkap galat dan membalas `502` berisi **JSON
dengan bentuk yang sama seperti sukses** (`volcanoes`, `summary` lengkap, `error`):

```
{"volcanoes":[],"summary":{"total":0,"byLevel":{"1":0,"2":0,"3":0,"4":0},
 "stale":false,"error":"Status gunung api MAGMA tidak dapat dimuat.","updatedAt":null,
 "source":{…}},"updatedAt":null,"stale":false,
 "error":"Status gunung api MAGMA tidak dapat dimuat."}
```

Bentuk payload dipertahankan (bukan `summary: null`) karena komponen pembaca mengakses
`summary.updatedAt` tanpa pemeriksaan null; mengirim `null` akan memindahkan galat 500 server
menjadi galat render di klien. Ini sengaja dipilih setelah membaca
`src/components/volcano/VolcanoStatusTable.tsx:56` dan `VolcanoOverview.tsx:81`.

### Verifikasi

| Uji | Hasil |
|---|---|
| `/api/volcano/status` dengan MAGMA mati | `502` + JSON lengkap (bukan 500 kosong) |
| `/gunung-berapi` dengan MAGMA mati | `200` |
| `/gunung-berapi/status` dengan MAGMA mati | `200` |

Rute GET lain yang tidak memakai `try/catch` (`/api/earthquakes`, `/api/weather/satelit`,
`/api/volcano/health`) diperiksa satu per satu dan dinyatakan aman berdasarkan pembacaan
kode, bukan asumsi: normalizer BMKG mengembalikan `null` dan tidak pernah melempar;
`getSatelliteFrame` menangkap galatnya sendiri; `health` sudah memakai `.catch()` per sumber.

---

## F-08 (P2) — `eslint-disable` melanggar aturan proyek

**Kategori:** Kepatuhan · **Status:** Diperbaiki · **Label: PASS**

### Bukti

`AGENTS.md` baris 58: *"Jangan menonaktifkan aturan ESLint (`eslint-disable`); perbaiki
penyebabnya."* Repositori memuat **7 penonaktifan** `@next/next/no-img-element` di 5 berkas —
termasuk 3 yang saya tambahkan pada pekerjaan fitur sebelumnya.

### Perbaikan

Penyebabnya diperbaiki, bukan komentarnya ditambah. Ketujuh `<img>` memakai gambar yang
memang tidak boleh lewat optimizer Next: berkas yang diproksi server (`/api/seismograms/…`,
`/api/volcano/image?…`), shakemap BMKG lintas-origin, dan thumbnail YouTube. Karena
optimizer sudah dimatikan menyeluruh (F-01), aturan itu tidak lagi relevan — jadi dimatikan
**satu kali secara terpusat** disertai alasan:

```json
{ "extends": "next/core-web-vitals", "rules": { "@next/next/no-img-element": "off" } }
```

Ketujuh komentar inline dihapus.

### Verifikasi

- `grep -rn "eslint-disable" src/` → **0 hasil**
- `npm run lint` → `✔ No ESLint warnings or errors`
- Aturan lain terbukti **tetap aktif**: probe buatan sendiri dengan `useEffect` tanpa
  dependency memunculkan `react-hooks/exhaustive-deps` (lalu berkas probe dihapus)

Kompromi ini dicatat terbuka: mematikan satu aturan gaya lebih baik daripada menyebar tujuh
penonaktifan, dan alasannya tertulis di berkas konfigurasi.

---

## F-09 (P3) — `src/app/page.tsx.bak` tertinggal

**Kategori:** Kebersihan · **Status:** Diperbaiki · **Label: PASS**

`src/app/page.tsx.bak` (6.430 B) adalah cadangan halaman beranda versi lama, tetap terlacak
Git, dan tidak dirujuk kode mana pun (`grep`). Isinya berbeda dari `page.tsx` aktif. Dihapus
dengan `git rm`. Tidak ada artefak `.bak`/`.orig`/`.rej` lain di repositori.

---

## F-10 (P3) — Endpoint langganan push menerima host apa pun

**Kategori:** Keamanan · **Status:** Diperbaiki (OI-02) · **Label: PASS**

`isValidPushSubscription` (`src/lib/volcano/push.ts:93`) memeriksa protokol `https:` dan
panjang kunci, tetapi **tidak membatasi** hostname: host mana pun diterima.

Yang perlu dicatat secara jujur: saya memeriksa apakah ini relay terbuka dan hasilnya
**tidak**. `sendTestPush` hanya mengirim ke langganan yang **sudah tersimpan**
(`loadSubscriptions().find(...)`), ditambah cooldown per endpoint dan pembatas laju baru
(F-05). Jadi endpoint ini tidak bisa dipakai membanjiri host sembarang.

Sisa risikonya kecil: penyimpanan langganan dapat diisi entri dengan host arbitrer, yang
kemudian ikut diproses saat pengiriman massal. Perbaikan yang mungkin adalah allowlist host
push (FCM, Mozilla, WNS, Apple). Tidak dikerjakan karena dapat memblokir peramban sah bila
daftar host tidak lengkap — keputusan produk, sehingga diajukan untuk persetujuan Anda.

### Penyelesaian (OI-02, sudah diimplementasikan)

Allowlist host dipindahkan ke modul bersama `src/lib/push-endpoint.ts` dan dipakai kedua
jalur push (gunung api & tsunami). Diuji langsung terhadap server:

| Endpoint | Hasil |
|---|---|
| `https://fcm.googleapis.com/…` | `200` diterima |
| `https://updates.push.services.mozilla.com/…` | `200` diterima |
| `https://web.push.apple.com/…` | `200` diterima |
| `https://wns2-abc.notify.windows.com/…` | `200` diterima |
| `https://localhost:3000/…` | `200` diterima (pengembangan) |
| `https://evil.example/x` | `400` ditolak |
| `https://fcm.googleapis.com.evil.example/x` | `400` ditolak |
| `http://fcm.googleapis.com/x` | `400` ditolak |

Host yang ditolak dicatat ke log server (`console.warn`) agar entri baru mudah ditambahkan.
11 tes regresi di `scripts/test-push-endpoint.ts`.

---

## F-11 (P3) — Pembatas laju hanya per proses

**Kategori:** Keandalan · **Status:** Diterima, tercatat · **Label: risiko diterima**

Penghitung F-05 tersimpan di memori proses. Bila aplikasi dijalankan di beberapa instance,
batas efektif berlipat sebanyak jumlah instance, dan penghitung hilang saat restart. Untuk
satu proses Next.js tanpa layanan bersama, ini memadai untuk tujuan mencegah satu klien
membanjiri endpoint. Bila nanti dijalankan multi-instance, ini perlu penyimpanan bersama
(tercatat sebagai OI-08).

---

## F-12 (P3) — CSP memakai `'unsafe-inline'` untuk script

**Kategori:** Keamanan · **Status:** Diterima, tercatat · **Label: risiko diterima**

Next.js 14 menyisipkan skrip bootstrap inline, dan aplikasi menaruh skrip tema inline statis
(`src/app/layout.tsx:42`, konstanta — tidak berasal dari input pengguna, jadi tidak dapat
dijadikan sarana injeksi). Karena itu `script-src` memuat `'unsafe-inline'`.

Konsekuensinya harus dinyatakan terang: **CSP ini tidak mencegah XSS pihak pertama.** Nilai
sesungguhnya terletak pada `object-src 'none'`, `base-uri 'self'`, `frame-ancestors 'self'`,
dan `connect-src`/`frame-src` yang tertutup — jalur injeksi eksternal tertutup. Nonce-based
CSP baru praktis di Next 15+, sehingga tercatat sebagai bagian dari OI-01.

---

## F-13 (P3) — Uji push nyata di perangkat belum dapat dijalankan

**Kategori:** Keandalan · **Status:** Tidak dapat diuji di lingkungan ini · **Label: BLOCKED**

Tidak ada perangkat, peramban, maupun kredensial staging. Alur push end-to-end (daftar
langganan → kirim → notifikasi muncul saat aplikasi di latar belakang) **tidak** terverifikasi.
Yang terverifikasi hanya logikanya di sumber (pemangkasan `404`/`410`, redaksi galat, batas
laju) dan penolakan payload tidak sah (`400`). Prosedur uji ada di
[RELEASE_CHECKLIST.md §2.10](./RELEASE_CHECKLIST.md).

---

## F-14 (P3) — Kunci VAPID tidak sah lolos pemeriksaan panjang

**Kategori:** Keandalan · **Status:** Diperbaiki (OI-13) · **Label: PASS**

### Bukti

`src/lib/volcano/push.ts:39-47` memeriksa kunci env **hanya dari panjang**:

```
if (publicKey.length < 80 || privateKey.length < 40) { … return null; }
```

Kunci yang panjangnya memadai tetapi **tidak sah secara kriptografis** karena itu diterima.
Diuji dengan `VAPID_PUBLIC_KEY="A"×87` dan `VAPID_PRIVATE_KEY="B"×43`:

```
GET /api/volcano/push/config
→ 200 {"publicKey":"AAAA…","enabled":true}
```

`web-push` sendiri juga tidak memvalidasi saat `setVapidDetails` (diuji terpisah: tidak melempar
galat). Kegagalan baru muncul di `sendNotification`, yang menghasilkan promise rejection
**tertangkap** (bukan crash) — jadi tidak ada dampak ketersediaan.

### Dampak

Terbatas pada salah-konfigurasi operator: server mengiklankan kunci yang tidak dapat
memvalidasi langganan, sehingga pengguna mendaftar lalu tidak pernah menerima notifikasi, tanpa
peringatan di `/push/config`. Konfigurasi yang benar (`web-push generate-vapid-keys`) tidak
terdampak. Bukan regresi dari perbaikan audit ini, dan bukan penghalang rilis.

### Perbaikan yang diajukan (belum dikerjakan)

Validasi 65-byte (publik) dan 32-byte (privat) setelah decode base64url, atau panggil
`webpush.generateRequestDetails` sebagai uji asap saat startup dan laporkan di `/api/health`.
Diajukan sebagai **OI-13**, menunggu persetujuan.

**Catatan koreksi terkait.** Draf audit sebelumnya menyatakan `/push/config` membalas `503`
tanpa env VAPID. Itu **keliru**: tanpa env, kunci **digenerate otomatis** ke `.data/` dan
responsnya `200`. Sudah dikoreksi di [TEST_RESULTS.md](./TEST_RESULTS.md),
[RELEASE_CHECKLIST.md](./RELEASE_CHECKLIST.md), dan
[FINAL_AUDIT_REPORT.md §15f](./FINAL_AUDIT_REPORT.md).

### Penyelesaian (OI-13, sudah diimplementasikan)

`validateVapidKeys()` di `src/lib/push-endpoint.ts` kini memeriksa:

1. base64url yang sah;
2. kunci publik **65 byte** dan byte pertama `0x04` (titik P-256 tanpa kompresi);
3. kunci privat **32 byte**.

Dipanggil dari `envKeys()` pada kedua jalur push. Kunci yang tidak sah **tidak dipakai**
dan tidak diganti diam-diam dengan kunci tersimpan — sebagai gantinya galat dicatat di
log dan `/api/volcano/push/config` membalas `503` dengan alasan yang jelas.

Diuji langsung terhadap server dengan kunci `"A"×87` / `"B"×43` (kasus yang dulu lolos):

```
GET /api/volcano/push/config
→ 503 {"enabled":false,"error":"kunci publik VAPID bukan titik P-256 tanpa kompresi"}
log: [volcano] kunci publik VAPID bukan titik P-256 tanpa kompresi; periksa VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY.
berkas .data/*/vapid.json terbentuk: 0 (kunci salah tidak dipakai)
```

Tanpa env VAPID sama sekali, perilaku lama dipertahankan: kunci digenerate otomatis dan
`/push/config` membalas `200`. 11 tes regresi di `scripts/test-push-endpoint.ts`.
