# TEMUAN AUDIT PRA-RILIS — SEISMOS

Dokumen ini mencatat temuan audit yang **terverifikasi** beserta buktinya. Setiap temuan
yang ditandai *Diperbaiki* sudah punya perubahan kode di repositori dan sudah diuji ulang.

- Tanggal audit: lint/typecheck/tes/build dijalankan pada sesi ini.
- Basis kode: `main` @ `8ee6d84`.
- Lingkungan: Node v24.22.0, npm 11.19.1, Linux.

Klasifikasi prioritas:

| Prioritas | Arti |
|---|---|
| P0 | Celah keamanan berat terkonfirmasi, risiko kehilangan data, atau kegagalan yang memblokir rilis |
| P1 | Fungsi utama rusak, masalah keamanan berarti, atau gangguan keandalan berat |
| P2 | Masalah performa, kegunaan, pemeliharaan, atau kompatibilitas yang nyata |
| P3 | Perapian kecil atau peningkatan opsional |

Dokumen rinci: [SECURITY_AUDIT.md](./SECURITY_AUDIT.md) ·
[TEST_RESULTS.md](./TEST_RESULTS.md) · [PERFORMANCE_AUDIT.md](./PERFORMANCE_AUDIT.md) ·
[RELEASE_CHECKLIST.md](./RELEASE_CHECKLIST.md) · [OPTIONAL_IMPROVEMENTS.md](./OPTIONAL_IMPROVEMENTS.md)

---

## Ringkasan temuan

| ID | Prioritas | Kategori | Status |
|---|---|---|---|
| F-01 | P0 | Keamanan — RCE Image Optimization (`next@14.2.15`) | **Diperbaiki** |
| F-02 | P1 | Keamanan — Tidak ada Content-Security-Policy / HSTS | **Diperbaiki** |
| F-03 | P1 | Keamanan — `next` & `postcss` versi rentan | **Sebagian diperbaiki** (sisa advisory tidak dapat dijangkau) |
| F-04 | P2 | Keamanan — Pesan galat internal bocor ke klien | **Diperbaiki** |
| F-05 | P2 | Keamanan — Tidak ada pembatas laju pada endpoint tulis | **Diperbaiki** |
| F-06 | P2 | Keamanan — Tidak ada batas ukuran body permintaan | **Diperbaiki** |
| F-07 | P2 | Keandalan — `/api/volcano/status` membalas 500 tanpa body | **Diperbaiki** |
| F-08 | P2 | Kepatuhan — 7 `eslint-disable` melanggar aturan AGENTS.md | **Diperbaiki** |
| F-09 | P3 | Kebersihan — `src/app/page.tsx.bak` tertinggal di repositori | **Diperbaiki** |
| F-10 | P3 | Keamanan — Endpoint langganan push menerima host apa pun | **Terbuka (OI-02)** |
| F-11 | P3 | Keandalan — Pembatas laju hanya per proses (in-memory) | Diterima, tercatat |
| F-12 | P3 | Keamanan — CSP memakai `'unsafe-inline'` untuk script | Diterima, tercatat |

---

## F-01 (P0) — RCE Image Optimization pada `next@14.2.15`

**Kategori:** Keamanan · **Status:** Diperbaiki

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

**Kategori:** Keamanan · **Status:** Diperbaiki

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

**Kategori:** Keamanan · **Status:** Sebagian diperbaiki

### Bukti & penanganan

| Paket | Sebelum | Sesudah | Ausdin |
|---|---|---|---|
| `next` | 14.2.15 | 14.2.35 | 33 advisory → 4 |
| `postcss` | 8.5.31 (dan 8.4.31 bersarang) | 8.5.32 | 4 advisory → 0 |

`postcss` hanya dipakai di jalur build. Diperiksa dengan:

```
grep -rln "require('postcss')" node_modules/next/dist/server   → tidak ada
```

Pemakaiannya hanya di `dist/build/**` (loader CSS, plugin minimizer). Karena itu
`npm audit --omit=dev` tidak lagi melaporkannya, dan menaikkan versinya tidak berisiko
mengubah perilaku runtime. Kenaikan dicapai lewat `overrides` agar salinan `postcss`
bersarang di dalam `next` ikut tertambal.

### Sisa 4 advisory dan alasan tidak dapat dijangkau

Setelah kenaikan, `npm audit` masih melaporkan 4 advisory untuk `next`. Advisory itu menempel
pada paket, tetapi **kondisi pemicunya tidak ada di kode aplikasi**:

| Advisory | Pemicu | Kondisi di Seismos | Dapat dijangkau? |
|---|---|---|---|
| `GHSA-2xp9-vwfh-vxw4` (RCE AVIF) | Image Optimization | `images.unoptimized: true`; `/_next/image` → **404** (diuji) | Tidak |
| `GHSA-2464-fhr4-w9xw` (RCE SVG) | Image Optimization | idem; tidak ada `images.remotePatterns` | Tidak |
| `GHSA-p293-qw3h-jr36` (RCE Windows) | Server Windows | Target deploy Linux | Tidak |
| `GHSA-p3m5-59mp-jv5r` (DoS Server Actions) | Server Actions | `grep -rn "'use server'" src/` → **0 hasil** | Tidak |

Bukti pendukung untuk advisory lain yang sudah tertutup oleh 14.2.35: tidak ada
`middleware.ts` (bypass middleware N/A), tidak ada `rewrites`/`redirects`/`i18n`
(SSRF rewrites, cache poisoning, smuggling N/A), tidak ada `next/script` `beforeInteractive`
(XSS beforeInteractive N/A).

Penutupan penuh hanya tersedia di `next@16.x`, yang merupakan **perubahan besar**
(React 18 → 19, konfigurasi dan perilaku App Router berubah). Ini melewati batas wewenang
audit ini, jadi diajukan sebagai **OI-01** untuk keputusan Anda, bukan dikerjakan sepihak.

---

## F-04 (P2) — Pesan galat internal bocor ke klien

**Kategori:** Keamanan · **Status:** Diperbaiki

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

**Kategori:** Keamanan · **Status:** Diperbaiki

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

**Kategori:** Keamanan · **Status:** Diperbaiki

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

**Kategori:** Keandalan · **Status:** Diperbaiki

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

**Kategori:** Kepatuhan · **Status:** Diperbaiki

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

**Kategori:** Kebersihan · **Status:** Diperbaiki

`src/app/page.tsx.bak` (6.430 B) adalah cadangan halaman beranda versi lama, tetap terlacak
Git, dan tidak dirujuk kode mana pun (`grep`). Isinya berbeda dari `page.tsx` aktif. Dihapus
dengan `git rm`. Tidak ada artefak `.bak`/`.orig`/`.rej` lain di repositori.

---

## F-10 (P3) — Endpoint langganan push menerima host apa pun

**Kategori:** Keamanan · **Status:** Terbuka — diajukan sebagai OI-02

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

---

## F-11 (P3) — Pembatas laju hanya per proses

**Kategori:** Keandalan · **Status:** Diterima, tercatat

Penghitung F-05 tersimpan di memori proses. Bila aplikasi dijalankan di beberapa instance,
batas efektif berlipat sebanyak jumlah instance, dan penghitung hilang saat restart. Untuk
satu proses Next.js tanpa layanan bersama, ini memadai untuk tujuan mencegah satu klien
membanjiri endpoint. Bila nanti dijalankan multi-instance, ini perlu penyimpanan bersama
(tercatat sebagai OI-08).

---

## F-12 (P3) — CSP memakai `'unsafe-inline'` untuk script

**Kategori:** Keamanan · **Status:** Diterima, tercatat

Next.js 14 menyisipkan skrip bootstrap inline, dan aplikasi menaruh skrip tema inline statis
(`src/app/layout.tsx:42`, konstanta — tidak berasal dari input pengguna, jadi tidak dapat
dijadikan sarana injeksi). Karena itu `script-src` memuat `'unsafe-inline'`.

Konsekuensinya harus dinyatakan terang: **CSP ini tidak mencegah XSS pihak pertama.** Nilai
sesungguhnya terletak pada `object-src 'none'`, `base-uri 'self'`, `frame-ancestors 'self'`,
dan `connect-src`/`frame-src` yang tertutup — jalur injeksi eksternal tertutup. Nonce-based
CSP baru praktis di Next 15+, sehingga tercatat sebagai bagian dari OI-01.
