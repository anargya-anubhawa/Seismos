# LAPORAN AUDIT AKHIR PRA-RILIS — SEISMOS

**Aplikasi:** Seismos Indonesia — pemantauan gempa bumi, tsunami, gunung api, dan cuaca dari
data terbuka BMKG, InaTEWS, dan MAGMA/PVMBG.

**Basis kode:** `main` @ `8ee6d84` (sebelum audit), ditambah perubahan audit yang dijelaskan
di bawah.

**Lingkungan audit:** Linux, Node v24.22.0, npm 11.19.1. Tidak ada peramban, perangkat
Android, kunci VAPID, maupun kredensial staging.

**Rekomendasi rilis: `READY WITH CAVEATS`** — rincian dan alasannya di §14.

---

## 1. Ringkasan eksekutif

Aplikasi lulus seluruh pemeriksaan otomatis yang tersedia: lint bersih, tipe bersih,
**110/110 tes lulus**, build produksi berhasil dengan 74 rute, dan 22 rute halaman merespons
`200`.

Audit menemukan **dua masalah serius** dan memperbaikinya:

1. **RCE Image Optimization (P0).** `next@14.2.15` memuat advisory RCE kritis pada endpoint
   `/_next/image`, dan endpoint itu memang aktif karena aplikasi memakai `next/image`
   (dikonfirmasi satu pemakaian). Seluruh keluarga 14.x **tidak akan pernah** menerima
   tambalan untuk advisory ini. Diperbaiki dengan mematikan optimizer (`/_next/image` kini
   `404`, terverifikasi) **dan** menaikkan `next` ke 14.2.35.
2. **Kebocoran informasi lewat pesan galat (P2).** 33 titik mengirim `error.message` mentah.
   Kebocoran dibuktikan pada server nyata — klien menerima `fetch failed` — lalu ditutup, dan
   verifikasi ulang menunjukkan **0 kemunculan**.

Selain itu ditutup: header CSP/HSTS yang sebelumnya tidak ada, tidak adanya pembatas laju
dan batas ukuran body pada endpoint tulis, `500` tanpa body pada `/api/volcano/status`, tujuh
penonaktifan ESLint yang melanggar `AGENTS.md`, dan satu berkas cadangan tertinggal.

Yang **belum** dapat dibuktikan dan karenanya tidak diklaim lulus: tampilan visual, interaksi
peramban, kinerja lapangan (Lighthouse/Core Web Vitals), dan pengiriman push nyata. Enam belas
butir uji peramban terdaftar sebagai BLOCKED di [RELEASE_CHECKLIST.md](./RELEASE_CHECKLIST.md) §2.

---

## 2. Inventaris repositori dan arsitektur

| Aspek | Kenyataan (diperiksa, bukan diasumsikan) |
|---|---|
| Framework | Next.js **14.2.35** (sebelum audit 14.2.15), App Router |
| React | 18.3.1 |
| Bahasa | TypeScript 5.9.3, 187 berkas `.ts`/`.tsx` |
| Gaya | Tailwind CSS 3.4.19, CSS variabel untuk tema gelap/terang |
| Peta | Leaflet 1.9.4 (tile OpenStreetMap + ArcGIS) |
| Grafik | recharts 2.15.4 (hanya pada rute statistik) |
| Push | `web-push` 3.6.7, VAPID |
| Ikon | lucide-react (48 berkas) |
| Manajer paket | npm, `package-lock.json` (241.745 B) |
| Rute | **74** (halaman + API) |
| Middleware | **Tidak ada** |
| Server Actions | **Tidak ada** |
| Autentikasi | **Tidak ada** (aplikasi tanpa akun) |
| Basis data | **Tidak ada** — status di berkas `.data/` |
| Tes | `node:test` + `sucrase`, 12 suite, 110 tes |
| CI/CD | **Tidak ada** |

### Struktur yang tidak terlihat dari nama berkas

- `src/instrumentation.ts` memulai dua monitor latar belakang (tsunami + gunung api) sekali per
  proses Node.
- Kedua monitor punya stub Edge (`src/lib/*/monitor.edge.ts`) yang wajib didaftarkan di
  `next.config.mjs`; `web-push` dieksternalkan agar modul `node:*` tidak masuk bundel Edge.
- Seluruh panggilan BMKG/MAGMA dilakukan di server; komponen klien tidak pernah memanggil
  sumber data langsung.

---

## 3. Fitur yang diaudit dan cakupan verifikasi

| Fitur | Berkas utama | Verifikasi | Status |
|---|---|---|---|
| Gempa terbaru (5 sumber BMKG) | `src/services/bmkg/*`, `src/app/api/earthquakes` | API nyata: 204 kejadian, terurut, unik | Terverifikasi |
| Riwayat & pencarian gempa | `src/app/history`, `src/lib/stats.ts` | Rute `200`, tes unit lulus | Sebagian (tanpa peramban) |
| Peta episenter & KRB | `src/components/map/*`, `src/lib/map/basemap.ts` | Pemindaian origin untuk CSP | Sebagian |
| Statistik | `src/app/statistics`, `src/components/charts/*` | First Load JS 200 kB, terpisah dari beranda | Sebagian |
| Tsunami/InaTEWS | `src/lib/tsunami/*`, `src/app/api/tsunami/*` | 21 tes unit lulus, API `200` | Sebagian |
| Status gunung api | `src/lib/volcano/*`, `src/app/api/volcano/status` | API `200`: 69 gunung api, level rekonsiliasi | Terverifikasi |
| Laporan/erupsi/VONA/KRB/CCTV | `src/app/api/volcano/*` | Rute `200`, galat disaring | Sebagian |
| Galeri visual | `src/components/volcano/parts.tsx` | `<img loading="lazy">` tanpa tombol muat | Terverifikasi (kode) |
| Live YouTube | `src/lib/volcano/live.ts` | 5 thumbnail, **0 iframe** di daftar | Terverifikasi |
| Cuaca (prakiraan/peringatan/satelit) | `src/services/bmkg/weather.ts` | Rute `200`, 20 tes unit | Sebagian |
| Seismograf perangkat | `src/app/seismograph` | Rute `200`, pembersihan sensor dibaca | Sebagian |
| Notifikasi push | `src/lib/*/push.ts`, `public/sw.js` | Pembatas laju & batas body diuji | **Tidak teruji end-to-end** |
| PWA / service worker | `public/sw.js`, `src/components/pwa/*` | `/sw.js` `200`, API tidak di-cache | Sebagian |
| Halaman about/mitigasi | `src/app/about`, `src/app/mitigasi` | Rute `200` | Terverifikasi |

---

## 4. Temuan menurut prioritas

Rincian lengkap beserta bukti: [FINDINGS.md](./FINDINGS.md).

| ID | P | Kategori | Temuan | Status |
|---|---|---|---|---|
| F-01 | **P0** | Keamanan | RCE Image Optimization pada `next@14.2.15`; `/_next/image` aktif | **Diperbaiki** |
| F-02 | **P1** | Keamanan | Tidak ada CSP/HSTS/COOP/Permissions-Policy | **Diperbaiki** |
| F-03 | **P1** | Keamanan | `next` & `postcss` versi rentan | **Sebagian** — sisa advisory tidak dapat dijangkau |
| F-04 | P2 | Keamanan | Pesan galat internal bocor ke klien (33 titik) | **Diperbaiki** |
| F-05 | P2 | Keamanan | Tidak ada pembatas laju pada 6 endpoint tulis | **Diperbaiki** |
| F-06 | P2 | Keamanan | Tidak ada batas ukuran body | **Diperbaiki** |
| F-07 | P2 | Keandalan | `/api/volcano/status` → `500` tanpa body | **Diperbaiki** |
| F-08 | P2 | Kepatuhan | 7 `eslint-disable` melanggar `AGENTS.md` | **Diperbaiki** |
| F-09 | P3 | Kebersihan | `src/app/page.tsx.bak` tertinggal | **Diperbaiki** |
| F-10 | P3 | Keamanan | Endpoint push menerima host apa pun | Terbuka → OI-02 |
| F-11 | P3 | Keandalan | Pembatas laju per proses | Diterima, tercatat |
| F-12 | P3 | Keamanan | CSP memakai `'unsafe-inline'` | Diterima, tercatat |
| F-13 | P3 | Dokumentasi | 7 variabel env dipakai kode tetapi tidak ada di `.env.example` | **Diperbaiki** |

### Temuan yang diperiksa dan dinyatakan sehat (bukan lupa diperiksa)

Agar jelas apa yang **tidak** menjadi masalah:

- **SSRF** — kedua proxy gambar dibatasi allowlist host, hanya `https`, dan (pada proxy MAGMA)
  host akhir dicek ulang setelah redirect. Tidak dapat dijangkau.
- **XSS lewat `dangerouslySetInnerHTML`** — hanya satu pemakaian, isinya konstanta statis.
  Tidak dapat dijadikan sarana injeksi.
- **Perbandingan rahasia** — memakai XOR akumulatif (waktu-konstan).
- **`push/test` sebagai relay terbuka** — **tidak**: hanya mengirim ke langganan yang sudah
  tersimpan, dengan cooldown dan pembatas laju.
- **`DELETE` langganan tanpa autentikasi** — dapat diterima: endpoint Web Push adalah rahasia
  kapabilitas tak tertebak.
- **Data aman di service worker** — `/api/*` tidak pernah di-cache; navigasi *network-first*.
- **Integritas data gempa** — 204 kejadian semuanya terurut, `id` unik, koordinat dalam batas
  Indonesia, magnitudo ada, kedalaman tidak negatif.
- **Statistik gunung api** — 42+24+3+0 = 69 = `total`. Rekonsiliasi.

---

## 5. Perbaikan yang benar-benar diimplementasikan

1. **Optimizer gambar dimatikan** (`next.config.mjs`) → `/_next/image` `404`.
2. **`next` 14.2.15 → 14.2.35**, **`postcss` 8.5.32** (+ `overrides`).
3. **Header keamanan** ditambahkan: CSP, HSTS, COOP, Permissions-Policy. Origin `img-src`
   ditentukan dari pemindaian kode (termasuk tile peta, yang sempat terlewat lalu ditambahkan
   sebelum dinyatakan selesai).
4. **`src/lib/public-error.ts`** — penyaring pesan galat; diterapkan pada 33 titik API + 4
   titik layanan yang ikut tampil di UI.
5. **`src/lib/rate-limit.ts`** — pembatas laju jendela bergulir + `Retry-After`, diterapkan
   pada 6 endpoint tulis.
6. **Batas ukuran body** (`413`) pada 6 endpoint tulis.
7. **`/api/volcano/status`** kini membalas `502` + JSON berbentuk sama seperti sukses.
8. **Penonaktifan ESLint**: penyebabnya diperbaiki; aturan dimatikan **terpusat** satu kali
   dengan alasan; 7 komentar inline dihapus.
9. **`src/app/page.tsx.bak`** dihapus.
10. **`.env.example`** dilengkapi 7 variabel (5 kode + `TRUST_PROXY_HEADERS` + alias VAPID).
11. **Dua suite tes baru** (8 tes) untuk memperbaiki kebocoran galat dan pembatas laju.

---

## 6. Berkas yang diubah dan alasannya

**Konfigurasi**

| Berkas | Alasan |
|---|---|
| `next.config.mjs` | Optimizer gambar dimatikan (F-01); header CSP/HSTS/COOP/Permissions-Policy (F-02) |
| `package.json` | `next` 14.2.35, `postcss` 8.5.32, `overrides`, 2 suite tes baru |
| `package-lock.json` | Hasil `npm install` |
| `.eslintrc.json` | `no-img-element` dimatikan terpusat + alasan (F-08) |
| `.env.example` | 7 variabel terdokumentasi (F-13) |

**Berkas baru**

| Berkas | Alasan |
|---|---|
| `src/lib/public-error.ts` | Penyaring pesan galat (F-04) |
| `src/lib/rate-limit.ts` | Pembatas laju (F-05) |
| `scripts/test-public-error.ts` | Tes regresi F-04 (4 tes) |
| `scripts/test-rate-limit.ts` | Tes regresi F-05 (4 tes) |
| `docs/audit/*.md` (6 berkas) | Dokumen audit |

**Rute API disaring galatnya (27 berkas)**

`api/volcano/{cameras,push/config,push/test,push/topics,push/subscribe,volcano/[code],` `laporan,
laporan/[id],krb,krb/[id]/file,image,monitor,erupsi,erupsi/[id],health,overview,vona,gallery,status}`,
`api/weather/{prakiraan,peringatan,satelit/[id]/image}`,
`api/tsunami/{,tsunami/[id],monitor,push/config,push/test,push/subscribe}` — F-04, F-05, F-06,
F-07.

**Layanan/pustaka**

| Berkas | Alasan |
|---|---|
| `src/lib/cache.ts` | `SourceStatus.error` disaring (ikut tampil di UI) |
| `src/services/bmkg/index.ts` | Status per sumber BMKG disaring |
| `src/services/bmkg/weather.ts` | Galat citra satelit disaring |
| `src/services/magma/index.ts` | Galat daftar gunung api disaring |
| `src/app/api/volcano/status/route.ts` | `try/catch` + payload bentuk-sama (F-07) |

**Berkas yang dihapus:** `src/app/page.tsx.bak` (F-09).

**Berkas yang hanya dirapikan:** 5 berkas komponen yang komentar `eslint-disable`-nya dihapus
(`event/[id]/page.tsx`, `volcano/{DeferredImage,VolcanoLiveList,VolcanoSeismogram,parts}.tsx`).

---

## 7. Tes yang dijalankan dan hasil sebenarnya

| Pemeriksaan | Hasil |
|---|---|
| `npm run lint` | **PASS** — `✔ No ESLint warnings or errors` (dan aturan lain terbukti masih aktif) |
| `npm run typecheck` | **PASS** — tanpa keluaran |
| `npm test` | **PASS** — **110 tes, 110 lulus, 0 gagal** (baseline 102, +8) |
| `npm run build` | **PASS** — `✓ Compiled successfully`, exit 0, 74 rute |
| Uji asap 22 rute halaman | **PASS** — semuanya `200` |
| Uji API | **PASS** — lihat §7 dokumen tes |
| Degradasi sumber eksternal | **PASS** — data sehat tetap tersaji, galat ditandai, 0 kebocoran |
| Pembatas laju | **PASS** — permintaan ke-6 → `429` + `Retry-After: 596` |
| Batas body | **PASS** — body 5.011 B → `413`; body sah tetap diproses |
| Uji E2E peramban | **BLOCKED** — tidak ada peramban |
| Visual responsif | **BLOCKED** — tidak ada tangkapan layar |
| Lighthouse / CWV | **BLOCKED** — tidak ada Chrome |
| Push nyata | **BLOCKED** — tidak ada VAPID/perangkat |

Rincian per suite: [TEST_RESULTS.md](./TEST_RESULTS.md).

---

## 8. Pengukuran sebelum & sesudah

| Metrik | Sebelum | Sesudah | Sumber |
|---|---|---|---|
| `npm audit` produksi (ringkasan paket) | 2 paket (1 critical, 1 high) | 1 paket (`next`) | `npm audit --omit=dev` |
| Advisory yang mencakup `next` | 33 | **25** (3 kritis, 9 tinggi, 11 sedang, 2 rendah) | filter `range` vs 14.2.35 |
| `postcss` | 8.5.31 + 8.4.31 bersarang | 8.5.32 (semua) | `npm ls postcss` |
| `/_next/image` | `200` (aktif) | `404` | `curl` |
| Header keamanan | 3 | 7 | `curl -I` |
| Pesan galat internal bocor | 33 titik | 0 (`fetch failed` → 0) | `curl` + `grep` |
| Endpoint tulis tanpa pembatas laju | 6 | 0 | `curl` → `429` |
| Penonaktifan ESLint | 7 | 0 | `grep` |
| Tes | 102 | 110 | `npm test` |
| First Load JS beranda | 126 kB | 126 kB (tidak berubah) | `next build` |

**Koreksi angka.** Draf pertama bab ini menulis "4 advisory sisa". Angka itu **salah** dan sudah
diperbaiki setelah diukur ulang: `npm audit` mendaftarkan **25** advisory pada entri `next`, dan
**25** di antaranya rentangnya mencakup `14.2.35`. Ringkasan `npm audit --omit=dev` (`1 critical`)
adalah jumlah **paket**, bukan jumlah advisory. Rincian per-advisory dan alasan masing-masing tidak
dapat dijangkau ada di [FINDINGS.md F-03](./FINDINGS.md#f-03-p1--dependensi-versi-rentan-sisa-advisory-tidak-dapat-dijangkau).

Yang berubah antara `14.2.15` dan `14.2.35` bukan angka advisory, melainkan **keterjangkauan**:
penambalan 14.2.34/14.2.35 menutup advisory yang memang aktif, dan untuk sisanya kondisi pemicu
(RCE pada Image Optimization, `rewrites`, `middleware`, Server Actions, Windows) tidak ada di kode
ini. Risiko sisa yang jujur harus disebut: beberapa advisory **DoS pada React Server Components**
tidak sepenuhnya dapat dimatikan dari kode aplikasi — itu risiko ketersediaan, bukan RCE atau
kebocoran data, dan menjadi alasan **OI-01** (Next 16) tetap diajukan.

Ukuran performa lengkap: [PERFORMANCE_AUDIT.md](./PERFORMANCE_AUDIT.md).

---

## 9. Temuan keamanan dan privasi

Ringkasan; rincian dan bukti di [SECURITY_AUDIT.md](./SECURITY_AUDIT.md).

**Ditutup:** RCE optimizer gambar; tidak adanya CSP/HSTS; kebocoran pesan galat; tidak adanya
pembatas laju dan batas body.

**Diterima dengan alasan tertulis:** `DELETE` langganan push tanpa autentikasi (endpoint =
rahasia kapabilitas); `push/test` bukan relay terbuka (hanya mengirim ke langganan tersimpan);
CSP dengan `'unsafe-inline'` untuk script (keterbatasan Next 14, dicatat terbuka).

**Terbuka (OI-02):** endpoint push menerima hostname apa pun.

**Privasi:** tidak ada analitik pihak ketiga, tidak ada cookie pelacak (pemutar memakai
`youtube-nocookie.com` dan hanya di halaman detail), langganan push disimpan tanpa nama/email/IP,
geolokasi hanya diminta saat pengguna memintanya.

**Tidak ditemukan** kredensial atau kunci privat yang ter-commit.

**Peringatan operasional penting:** `authorized()` pada route monitor mengembalikan `true` bila
`*_MONITOR_SECRET` kosong. Ini perilaku kode yang sudah ada, bukan bug baru audit ini, tetapi
**lupa mengisi variabel itu membuat `POST` monitor terbuka**. Dicatat sebagai butir wajib di
[RELEASE_CHECKLIST.md](./RELEASE_CHECKLIST.md) §3.1.

---

## 10. Keterbatasan yang diketahui dan pemeriksaan yang terblokir

1. **Tidak ada peramban.** Semua rute diverifikasi lewat `curl` ke server produksi. Halaman
   di-render di klien, jadi `200` membuktikan rute/build/header benar — **bukan** isi terhidrasi.
2. **Tidak ada tangkapan layar.** Klaim visual apa pun tidak dibuat. Responsif, overflow, dan
   kontras belum diverifikasi secara visual.
3. **Tidak ada Lighthouse.** Skor performa lapangan tidak diketahui.
4. **Tidak ada kunci VAPID/perangkat.** Alur push end-to-end tidak teruji; hanya logika
   validasi, pembatas laju, dan batas body yang teruji.
5. **Pembatas laju per proses** — batas efektif berlipat bila aplikasi dijalankan multi-instance.
6. **Batas body berbasis `content-length`** — body *chunked* tanpa header belum tertahan;
   perlu batas keras di reverse proxy.
7. **CSP bukan pertahanan XSS pihak pertama** karena `'unsafe-inline'`.
8. **Tidak ada CI** — keempat pemeriksaan wajib hanya berjalan manual.
9. **Tanpa staging** — konfigurasi produksi (reverse proxy, TLS, volume) tidak diuji.

---

## 11. Penghalang rilis yang masih terbuka

**Tidak ada penghalang kritis yang tersisa** dalam lingkup yang dapat diuji. Yang tersisa:

| # | Hal | Sifat | Tindakan |
|---|---|---|---|
| 1 | 25 advisory `next` yang rentangnya mencakup 14.2.35, kondisi pemicunya tidak ada di kode | Risiko diterima (RCE/rewrites/middleware N/A; sisa DoS RSC) | Keputusan Anda: **OI-01** (Next 16) |
| 2 | 16 butir uji peramban belum dijalankan | **Celah verifikasi** | Wajib di staging sebelum rilis |
| 3 | F-10 hostname push | Risiko kecil | **OI-02** (S) menutupnya |
| 4 | Tidak ada CI | Risiko proses | **OI-05** (S) |
| 5 | `*_MONITOR_SECRET` wajib disetel | **Prasyarat produksi** | Isi sebelum go-live |

Butir 2 adalah alasan utama rekomendasi di §14 bukan `READY` penuh.

---

## 12. Peningkatan opsional yang memerlukan persetujuan

12 usulan, **belum satu pun dikerjakan**. Rincian lengkap:
[OPTIONAL_IMPROVEMENTS.md](./OPTIONAL_IMPROVEMENTS.md).

| ID | Nama | Usaha | Rekomendasi |
|---|---|---|---|
| OI-01 | Naik ke Next.js 16 | XL | Tunda |
| OI-02 | Allowlist host push (menutup F-10) | S | **Setujui** |
| OI-03 | Indikator kesegaran & atribusi data | S | **Setujui** |
| OI-04 | Halaman status kesehatan sumber | S | **Setujui** |
| OI-05 | CI untuk 4 pemeriksaan wajib | S | **Setujui** (prioritas 1) |
| OI-06 | Halaman kebijakan privasi | S | **Setujui** |
| OI-07 | Catatan rilis + runbook | S | **Setujui** |
| OI-08 | Pembatas laju penyimpanan bersama | M | Tunda |
| OI-09 | Uji E2E Playwright | M | **Setujui** |
| OI-10 | Pemberitahuan pembaruan PWA | M | Tunda |
| OI-11 | Pemantauan galat ramah privasi | M | Tunda |
| OI-12 | Ukuran citra proxy MAGMA | M | Tolak (bertentangan dengan F-01) |

---

## 13. Ringkasan diff Git

```
Staged:    1 berkas dihapus   (src/app/page.tsx.bak)
Modified:  41 berkas          (konfigurasi + rute API + layanan)
Untracked:  4 berkas baru     (2 pustaka + 2 suite tes) + docs/audit/
```

Perubahan belum di-commit. Rincian per berkas di §6. Pemeriksaan akhir: seluruh verifikasi
dijalankan ulang setelah perubahan terakhir, dan diff diperiksa sebelum menyusun laporan ini.

---

## 14. Rekomendasi rilis

### `READY WITH CAVEATS`

**Alasan.**

Tidak ada penghalang kritis yang tersisa dalam lingkup yang **dapat** diuji. Dua masalah
serius yang ditemukan — RCE optimizer gambar dan kebocoran pesan galat — sudah diperbaiki
dengan perubahan kode yang nyata dan diverifikasi ulang lewat permintaan ke server produksi.
Seluruh pemeriksaan otomatis lulus: 110/110 tes, lint dan tipe bersih, build berhasil, 22 rute
merespons `200`, header keamanan terkirim, pembatas laju dan batas body bekerja, dan data
gempa lolos pemeriksaan integritas.

**Tetapi** rekomendasi ini **bukan** `READY`. Enam belas butir uji peramban — tampilan visual,
responsif, navigasi papan tunjuk, pelanggaran CSP di konsol nyata, offline, penolakan izin,
dan push end-to-end — **belum dijalankan** karena lingkungan ini tidak memiliki peramban,
perangkat, maupun kunci VAPID. Menyatakan aplikasi `READY` berarti menyatakan area-area itu
lulus, dan itu tidak benar.

25 advisory `next` yang rentangnya mencakup 14.2.35 tidak dapat dijangkau di kode ini; risiko itu diterima
secara sadar dan terdokumentasi, dengan penutupan penuh menunggu OI-01.

### Prasyarat sebelum go-live

1. Jalankan [RELEASE_CHECKLIST.md](./RELEASE_CHECKLIST.md) §2 di staging (16 butir).
2. Setel `VOLCANO_MONITOR_SECRET` dan `TSUNAMI_MONITOR_SECRET` (jika tidak, endpoint POST
   monitor terbuka), plus kunci VAPID dan volume persisten.
3. Setel `client_max_body_size` dan batas laju di reverse proxy.
4. Bila bisa, kerjakan **OI-05** (CI) dan **OI-09** (E2E) agar celah verifikasi ini tidak
   berulang pada rilis berikutnya.

Bila keempat prasyarat terpenuhi dan §2 lulus, rekomendasi naik menjadi `READY`.

---

## 15. Verifikasi akhir (pemeriksaan ulang independen)

Bab ini ditambahkan setelah seluruh perbaikan dikomit (`ea4314a`). Semua pemeriksaan di bawah
dijalankan **ulang dari nol**: `.next` dan `.data` dihapus, `npm run build` baru, lalu
`next start` baru. Tujuannya membuktikan bahwa perbaikan bertahan dan tidak ada kemunduran.

### 15a. Diff

| Pemeriksaan | Label | Hasil |
|---|---|---|
| Seluruh diff `8ee6d84..ea4314a` ditinjau | **PASS** | 54 berkas, +2.723/−278 |
| Perubahan tak sengaja | **PASS** | Tidak ada; config hanya memuat perbaikan yang dideklarasikan |
| Kontrol akses tidak melemah | **PASS** | `authorized()` tetap berjalan setelah `rateLimit()` dan pemeriksaan body pada kedua route monitor |

### 15b. Semua pemeriksaan otomatis diulang

| Pemeriksaan | Label | Hasil |
|---|---|---|
| `npm ls --depth=0` | **PASS** | 0 masalah |
| `npm run lint` | **PASS** | `✔ No ESLint warnings or errors` |
| `npm run typecheck` | **PASS** | Tanpa keluaran |
| `npm test` | **PASS** | **110/110 lulus, 0 gagal** |
| `npm run build` (dari `.next` kosong) | **PASS** | Exit 0, `✓ Compiled successfully`, 74 rute |

### 15c. Perbaikan diverifikasi terhadap sumber, bukan klaim

| Temuan | Label | Bukti di sumber/perilaku |
|---|---|---|
| F-01 optimizer mati | **PASS** | `next.config.mjs:16` `unoptimized: true`; `/_next/image` → **404** tanpa **dan** dengan parameter |
| F-02 header keamanan | **PASS** | 7 header terkirim (`curl -I`) |
| F-04 redaksi galat | **PASS** | 0 `error.message` mentah di `src/app/api`; uji sumber rusak → `fetch failed` = **0** |
| F-05 pembatas laju | **PASS** | `429` + `Retry-After` terukur (monitor limit 20, push/test limit 5) |
| F-06 batas body | **PASS** | `413` pada 5.001 B; body sah tetap `400` (sampai validasi) |
| F-07 status 502 JSON | **PASS** | MAGMA dirusak → `502` + `application/json` payload lengkap |
| F-08 tanpa `eslint-disable` | **PASS** | 0 di `src/` dan `scripts/` |
| F-09 `page.tsx.bak` | **PASS** | Berkas tidak ada di repositori |

### 15d. Fitur pemantauan tetap utuh

Gempa (`204` kejadian, terurut, `id` unik, 5 sumber aktif), gunung api (9 endpoint `200`,
`ok:true`), cuaca (`satelit`, `peringatan` `200`), tsunami (`200`). Semua **PASS**.

### 15e. Degradasi, izin, dan data basi

Sumber BMKG/MAGMA dirusak: `/api/earthquakes` tetap `200` dengan 194 kejadian dari sumber
sehat dan pesan `'Sumber data tidak dapat dihubungi'`; `/api/volcano/status` `502` JSON;
enam halaman utama tetap `200`. Tanpa env VAPID, `/api/volcano/push/config` → `200` dengan kunci
yang digenerate otomatis ke `.data/` (draf awal keliru menulis `503`; lihat §15f). Payload
langganan tidak sah → `400`. Monitor dengan rahasia diset → `401/401/200`.
`StaleDataNotice` dipakai di 5 halaman data. Izin notifikasi ditolak dan langganan kedaluwarsa
ditangani di kode. Semua **PASS** (atau **PASS (kode)** bila hanya dapat diperiksa di sumber,
bukan di peramban).

### 15f. Koreksi yang ditemukan pada verifikasi akhir

Dua koreksi dokumentasi dilakukan, **tanpa perubahan kode**:

1. **Jumlah advisory `next`.** Draf sebelumnya menulis 4. Angka yang benar: **25** advisory
   mencakup `14.2.35` (3 kritis, 9 tinggi, 11 sedang, 2 rendah). Ringkasan
   `npm audit --omit=dev` (`1 critical`) adalah jumlah **paket**, bukan advisory. Diperbaiki
   di §8, [FINDINGS.md F-03](./FINDINGS.md), [SECURITY_AUDIT.md](./SECURITY_AUDIT.md),
   [OPTIONAL_IMPROVEMENTS.md](./OPTIONAL_IMPROVEMENTS.md), dan [TEST_RESULTS.md](./TEST_RESULTS.md).
   Konsekuensi jujur: sebagian advisory **DoS RSC** tidak sepenuhnya dapat dimatikan dari kode;
   itu risiko ketersediaan, bukan RCE, dan alasan **OI-01** tetap relevan.
2. **Label status.** Kelima dokumen kini memakai kosakata seragam **PASS / FAIL / BLOCKED /
   NOT RUN** (§11, §2, §11 [Security], §1 & §6 [Performance], §1 & §2 [Release checklist]).
   Butir yang tidak diuji ditandai **BLOCKED**, bukan dianggap lulus.

3. **Perilaku push tanpa env VAPID — salah dilaporkan.** Draf awal menulis
   `/api/volcano/push/config` → `503` bila `VAPID_*` tidak disetel. Itu **keliru**. Sumber
   (`src/lib/volcano/push.ts:39-68`) menunjukkan bila env tidak ada, server **menggenerate
   pasangan kunci dan menyimpannya** di `.data/<app>/vapid.json`. Diukur ulang dalam lingkungan
   VAPID benar-benar bersih dengan `.data/` kosong: respons `200` + kunci publik, dan
   `.data/tsunami/vapid.json` terbentuk. `503` hanya muncul bila pembuatan/persistensi kunci
   gagal (mis. volume tidak dapat ditulis). Teks `"Vapid public key should be 65 bytes long
   when decoded"` yang membuat saya menyimpulkan `503` berasal dari kegagalan saat startup,
   bukan alur normal. Semua dokumen sudah dikoreksi.

**Temuan baru dari koreksi ini (F-14, P3).** Kunci VAPID yang **panjangnya wajar tetapi tidak sah
secara kriptografis** (mis. `"A"×87` / `"B"×43`) lolos `envKeys()` — pemeriksaannya hanya panjang
(`push.ts:43`) — lalu `web-push` menerimanya di `setVapidDetails` (diuji: tidak melempar galat).
Akibatnya `/api/volcano/push/config` membalas `200` dengan kunci yang **tidak akan pernah bisa
memvalidasi** langganan; kerusakan baru terlihat di `sendNotification` (reject, ditangkap, bukan
crash). Ini bukan regresi rilis: konfigurasi yang benar (`web-push generate-vapid-keys`) tidak
terdampak, dan risiko sisa adalah salah-konfigurasi operator. **Tidak diperbaiki** karena di luar
lingkup verifikasi (perbaikan = tambahan validasi), diajukan sebagai OI-13.

### 15g. Kesimpulan verifikasi akhir

**Tidak ada penghalang rilis baru yang ditemukan, dan tidak ada perbaikan yang kemunduran.**
Rekomendasi di §14 tetap berlaku: **READY WITH CAVEATS** — bukan `READY`, karena 16 butir uji
peramban/perangkat/push masih **BLOCKED** dan belum dapat dijalankan di lingkungan ini.

---

## 16. Implementasi usulan yang disetujui (OI-02, 03, 04, 05, 06, 07, 09, 13)

Delapan usulan yang disetujui pengguna dikerjakan **setelah** verifikasi akhir selesai.
Bab ini mencatat apa yang berubah dan buktinya. Usulan yang ditunda (OI-01, 08, 10, 11) dan
yang ditolak (OI-12) **tidak** dikerjakan.

### 16a. Perubahan kode

| OI | Berkas | Sifat |
|---|---|---|
| OI-02 | `src/lib/push-endpoint.ts` (baru), `src/lib/{volcano,tsunami}/push.ts` | Allowlist host endpoint push; log host ditolak |
| OI-13 | `src/lib/push-endpoint.ts` (baru), `src/lib/{volcano,tsunami}/push.ts` | Validasi kriptografis kunci VAPID (65/32 byte, byte `0x04`) |
| OI-03 | `src/components/ui/DataFreshness.tsx` (baru), `src/app/page.tsx`, `src/app/history/page.tsx` | Indikator kesegaran & per sumber |
| OI-04 | `src/app/api/health/route.ts` (baru), `src/app/status-sumber/page.tsx` (baru), `src/components/ui/SourceHealth.tsx` (baru) | Halaman status kesehatan sumber |
| OI-06 | `src/app/privasi/page.tsx` (baru) | Kebijakan privasi, diturunkan dari kode |
| OI-05 | `.github/workflows/ci.yml` (baru) | CI: lint, typecheck, test, build |
| OI-09 | `playwright.config.ts`, `e2e/core.spec.ts` (baru) | Uji E2E Chromium |
| OI-07 | `docs/RELEASE_NOTES.md`, `docs/RUNBOOK.md` (baru) | Catatan rilis + runbook |
| lain | `src/components/navigation/Shell.tsx` | Menu `/status-sumber` dan `/privasi` |
| **perbaikan** | `src/components/volcano/VolcanoLiveList.tsx` | **Ditambah `PageTitle`** — halaman ini sebelumnya tidak punya `h1` (cacat aksesibilitas yang ditemukan oleh E2E) |

### 16b. Hasil pemeriksaan setelah implementasi

| Pemeriksaan | Sebelum | Sesudah | Label |
|---|---|---|---|
| `npm test` | 110 lulus | **121 lulus, 0 gagal** | **PASS** |
| `npm run build` | 74 rute | **77 rute** | **PASS** |
| `npm run lint` | bersih | bersih | **PASS** |
| `npm run typecheck` | bersih | bersih | **PASS** |
| Uji peramban | **tidak ada** | **64 uji E2E lulus** (22 rute × 2 viewport) | **PASS** |
| Pelanggaran CSP di peramban | tidak diketahui | **0** pada 22 rute | **PASS** |
| Gulir horizontal 360 px | tidak diketahui | **0 px** pada 5 rute | **PASS** |
| Allowlist host push (8 kasus) | tidak ada | 8/8 sesuai harapan | **PASS** |
| Kunci VAPID tidak sah | diterima (`200`) | ditolak (`503` + alasan) | **PASS** |

### 16c. Bukti langsung yang dijalankan

```
npx playwright test            → 64 passed (3.4m), 0 failed
npm test                       → 121 tests, 121 pass, 0 fail
npm run build                  → exit 0, ✓ Compiled successfully, 77 rute
```

Allowlist push diuji terhadap server hidup:

| Endpoint | Hasil |
|---|---|
| `fcm.googleapis.com`, `updates.push.services.mozilla.com`, `web.push.apple.com`, `*.notify.windows.com` | `200` |
| `https://evil.example/x`, `https://fcm.googleapis.com.evil.example/x`, `http://fcm.googleapis.com/x` | `400` |
| `http://localhost:3000/push` (pengembangan) | `200` |

Kunci VAPID tidak sah (`"A"×87` / `"B"×43`):

```
GET /api/volcano/push/config → 503 {"enabled":false,"error":"kunci publik VAPID bukan titik P-256 tanpa kompresi"}
```

### 16d. Dampak pada rekomendasi rilis

Alasan utama rekomendasi sebelumnya **bukan** `READY` adalah tidak adanya uji peramban sama
sekali: 16 butir dinyatakan BLOCKED. Setelah OI-09, **6 dari 16 butir itu kini lulus dengan
Chromium sungguhan** (CSP, peta, halaman siaran, responsif 360 px, fokus Tab, status bukan
hanya warna).

**Sepuluh butir tetap BLOCKED** dan tidak boleh dianggap lulus: bukti visual per rute + mode
gelap, `prefers-reduced-motion`, Lighthouse, push nyata ke perangkat, izin notifikasi ditolak
di peramban, offline, geolokasi ditolak, pembaruan service worker, pemasangan PWA di Android,
dan peramban lain (Firefox/Safari).

Rekomendasi di §14 **tidak berubah**: **READY WITH CAVEATS**. Kemajuan ini memperkecil risiko
secara nyata, tetapi belum cukup untuk `READY` penuh — dan menyebutnya `READY` berarti
mengklaim butir yang masih belum diuji.
