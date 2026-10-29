# HASIL PENGUJIAN — SEISMOS

Semua hasil di bawah berasal dari eksekusi nyata pada sesi ini. Yang tidak dapat dijalankan
ditandai **BLOCKED** beserta alasannya, bukan dianggap lulus.

- Lingkungan: Linux, Node v24.22.0, npm 11.19.1
- Basis kode: `main` @ `8ee6d84` + perubahan audit (lihat [FINAL_AUDIT_REPORT.md](./FINAL_AUDIT_REPORT.md))
- Perintah mengikuti `AGENTS.md`:

  ```bash
  export PATH="$HOME/.nvm/versions/node/v24.22.0/bin:$PATH"
  npm run lint && npm run typecheck && npm test && npm run build
  ```

---

## 1. Ringkasan status

| # | Pemeriksaan | Perintah | Status | Bukti |
|---|---|---|---|---|
| 1 | Konsistensi dependensi & lockfile | `npm ls --depth=0` | **PASS** | 19 paket, tanpa `UNMET`/`extraneous`; `package-lock.json` ada (241.745 B) |
| 2 | Lint | `npm run lint` | **PASS** | `✔ No ESLint warnings or errors` |
| 3 | Pemeriksaan tipe | `npm run typecheck` | **PASS** | `tsc --noEmit` tanpa keluaran |
| 4 | Unit test | `npm test` | **PASS** | **110 tes, 110 lulus, 0 gagal** |
| 5 | Build produksi | `npm run build` | **PASS** | `✓ Compiled successfully`, exit 0, 74 rute |
| 6 | Audit dependensi | `npm audit` | **PASS dengan catatan** | 25 advisory pada `next@14.2.35`, kondisi pemicunya tidak ada di kode; sisa risiko DoS RSC (F-03) |
| 7 | Uji asap rute (22 halaman) | `curl` ke `next start` | **PASS** | seluruhnya `200` |
| 8 | Uji API | `curl` | **PASS** | lihat §5 |
| 9 | Degradasi sumber eksternal | server + URL sumber dirusak | **PASS** | lihat §6 |
| 10 | Pembatas laju & batas body | `curl` | **PASS** | `429`/`413` nyata |
| 11 | Integritas data | analisis respons API | **PASS** | lihat §7 |
| 12 | Uji E2E peramban | — | **BLOCKED** | tidak ada peramban headless / Playwright |
| 13 | Uji visual responsif | — | **BLOCKED** | tidak ada kemampuan tangkapan layar |
| 14 | Lighthouse / Core Web Vitals lapangan | — | **BLOCKED** | tidak ada Chrome/Lighthouse |
| 15 | Uji perangkat Android / push asli | — | **BLOCKED** | tidak ada perangkat maupun kunci VAPID |

---

## 2. Lint & tipe

```
$ npm run lint
▲ Next.js 14.2.35
✔ No ESLint warnings or errors

$ npm run typecheck
> tsc --noEmit          (tanpa keluaran = bersih)
```

Selain "tidak ada peringatan", aturan lain dibuktikan **masih bekerja**: berkas probe dengan
`useEffect` tanpa dependency disisipkan sementara, dan lint memunculkannya:

```
./src/__probe.tsx
4:41  Warning: React Hook useEffect has a missing dependency: 'n'.  react-hooks/exhaustive-deps
```

Berkas probe kemudian dihapus. Ini membuktikan konfigurasi lint tidak sekadar "dimatikan".

---

## 3. Unit test — 110 tes, semuanya lulus

```
tests: 110  pass: 110  fail: 0
```

| Suite | Tes | Hasil |
|---|---|---|
| `test-alerts.ts` | 3 | lulus |
| `test-audio.ts` | 3 | lulus |
| `test-felt.ts` | 4 | lulus |
| `test-live.ts` | 4 | lulus |
| `test-provinces.ts` | 5 | lulus |
| `test-public-error.ts` | 4 | lulus — **baru** |
| `test-rate-limit.ts` | 4 | lulus — **baru** |
| `test-share.ts` | 14 | lulus |
| `test-sources.ts` | 2 | lulus |
| `test-tsunami.ts` | 21 | lulus |
| `test-volcano.ts` | 26 | lulus |
| `test-weather.ts` | 20 | lulus |

Baseline sebelum audit: 102 tes. Setelah audit: **110 (+8)** dari dua suite baru untuk
memperbaiki F-04 dan F-05. Keduanya dirangkai ke skrip `test` di `package.json` sesuai
ketentuan `AGENTS.md`.

### Tidak ada tes yang dihapus atau dilemahkan

Tidak ada asersi yang dilonggarkan, tidak ada tes yang dilewati, tidak ada pengecualian yang
ditambahkan hanya agar lulus. Dua suite baru dibuat untuk *menangkap* bug yang diperbaiki.

---

## 4. Build produksi

```
$ npm run build
✓ Compiled successfully
Route (app)                     Size     First Load JS
┌ ○ /                            6.74 kB  126 kB
…
+ First Load JS shared by all            88 kB
```

- 74 rute (halaman + API) terbentuk, exit code **0**.
- Tidak ada error tipe maupun lint yang diabaikan saat build.
- Rute `/gunung-berapi/live-youtube` dan `/gunung-berapi/live-youtube/[videoId]` ikut terbangun.

---

## 5. Uji asap terhadap server produksi (`next start`)

Server dijalankan dari hasil build (`./node_modules/.bin/next start`), lalu diperiksa dengan `curl`.

### Halaman — 22 rute, semuanya `200`

```
/                            200     /gunung-berapi/peta        200
/history                     200     /gunung-berapi/cctv        200
/map                         200     /gunung-berapi/live-youtube 200
/statistics                  200     /gunung-berapi/gallery     200
/cuaca                       200     /gunung-berapi/seismogram  200
/cuaca/peringatan-dini       200     /gunung-berapi/status      200
/cuaca/satelit               200     /gunung-berapi/vona        200
/cuaca/satelit/himawari-9    200     /gunung-berapi/krb         200
/gunung-berapi               200     /gunung-berapi/mer         200
/gunung-berapi/mer/laporan   200     /gunung-berapi/mer/seismogram 200
/tsunami                     200     /gunung-berapi/mer/krb     200
/about                       200     /event/gempa-terbaru       200
/mitigasi                    200     /settings                  200
/seismograph                 200     /volcano-seismogram        200
/gunung-berapi/live-youtube/hc3m__hH5PY   200
```

Catatan metodelogi: halaman-halaman ini di-render di klien. Status `200` membuktikan rute,
build, dan header benar — **bukan** bukti isi terhidrasi di peramban. Verifikasi isi
dilakukan lewat pembacaan markup ter-render dan pengujian logika komponen, dan hal itu
dinyatakan apa adanya.

### API

| Endpoint | Status | Isi |
|---|---|---|
| `/api/earthquakes` | `200` | 204 kejadian, 5 sumber |
| `/api/volcano/status` | `200` | 69 gunung api |
| `/api/volcano/overview` | `200` | ringkasan konsisten dengan jumlah per level |
| `/api/weather/satelit` | `200` | katalog produk |
| `/api/volcano/push/config` | `200` | kunci publik tersedia — **termasuk** saat env VAPID kosong (kunci digenerate & disimpan otomatis di `.data/`) |

### Header keamanan (terverifikasi pada respons nyata)

```
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; …;
  img-src 'self' data: blob: https://i.ytimg.com
    https://tile.openstreetmap.org https://server.arcgisonline.com; …;
  frame-src https://www.youtube-nocookie.com https://www.youtube.com; object-src 'none';
  base-uri 'self'; form-action 'self'; frame-ancestors 'self'
Strict-Transport-Security: max-age=31536000; includeSubDomains
Cross-Origin-Opener-Policy: same-origin
Permissions-Policy: geolocation=(self), camera=(), microphone=(), payment=()
```

Header yang sama juga dikirim pada respons API (`/api/volcano/status`).

### Endpoint optimizer gambar sudah mati

```
GET /_next/image                                        → 404
GET /_next/image?url=%2Ficon-192.png&w=64&q=75          → 404
GET /icon-192.png                                       → 200 (5.264 B)
```

### Service worker & manifest

```
GET /sw.js                 → 200  application/javascript
GET /manifest.webmanifest  → 200
```

---

## 6. Degradasi: sumber eksternal mati

Uji dilakukan dengan menjalankan server memakai URL sumber yang sengaja tidak dapat
dihubungi (`https://127.0.0.1:9/...`), tanpa cache sebelumnya (`.data/` dihapus).

### 6a. Sebelum perbaikan — kebocoran terkonfirmasi

```
$ curl /api/earthquakes
  terbaru   | error: fetch failed     ← kebocoran internal (F-04)
  m5        | error: fetch failed
  dirasakan | error: fetch failed

$ curl /api/volcano/status
HTTP/1.1 500 Internal Server Error
content-type: (kosong)
body: (kosong)                        ← F-07
```

### 6b. Sesudah perbaikan

```
$ curl /api/earthquakes
events: 194
  terbaru   | 'Sumber data tidak dapat dihubungi'
  m5        | 'Sumber data tidak dapat dihubungi'
  dirasakan | 'Sumber data tidak dapat dihubungi'
  felt30    | (normal)
  live      | (normal)

$ grep -c "fetch failed"  →  0

$ curl /api/volcano/status
HTTP/1.1 502 Bad Gateway
content-type: application/json
{"volcanoes":[],"summary":{"total":0,"byLevel":{"1":0,"2":0,"3":0,"4":0},…,
 "error":"Status gunung api MAGMA tidak dapat dimuat.",…}}
```

Halaman tetap tersedia saat sumber mati: `/`, `/history`, `/statistics`,
`/gunung-berapi`, `/gunung-berapi/status` semuanya `200`.

Kesimpulan yang dapat ditarik: aplikasi **tidak** menampilkan data kosong seolah sukses; ia
menyajikan data dari sumber yang sehat dan menandai sumber yang gagal secara eksplisit.

---

## 7. Integritas data (pemeriksaan nyata atas respons)

Terhadap 204 kejadian dari `/api/earthquakes`:

| Pemeriksaan | Hasil |
|---|---|
| Terurut menurun berdasarkan `originTime` | **Ya** |
| `id` unik | **Ya** (204/204) |
| Koordinat dalam batas Indonesia (lat −11…6, lon 94…141) | **Ya** (0 pelanggaran) |
| Magnitudo selalu ada dan numerik | **Ya** (0 kosong) |
| Kedalaman tidak negatif | **Ya** (0 negatif) |
| Rentang waktu | 2026-10-03 s.d. 2026-10-28 |

Terhadap `/api/volcano/overview`:

```
total: 69   byLevel: {1: 42, 2: 24, 3: 3, 4: 0}   stale: false   error: none
jumlah per level == total → Ya (42+24+3+0 = 69)
```

Statistik rekonsiliasi dengan data yang dipakai menghitungnya.

---

## 8. Pembatas laju & batas ukuran body (server nyata)

### Pembatas laju — `POST /api/volcano/push/test` (batas 5 / 10 menit)

```
req1: 502 {"error":"Langganan push tidak ditemukan; aktifkan ulang notifikasi gunung api"}
req2: 502 …   req3: 502 …   req4: 502 …   req5: 502 …
req6: 429 {"error":"Terlalu banyak permintaan. Tunggu sebentar lalu coba lagi."}
header: retry-after: 596
```

### Batas ukuran body — `POST /api/volcano/push/subscribe`

```
body 5.011 B  → 413 {"error":"Body permintaan terlalu besar"}
body normal   → 400 {"error":"Langganan push tidak valid"}   ← validasi normal tetap jalan
```

Pastikan pembatas tidak merusak fungsi: permintaan sah di bawah batas tetap diproses.

---

## 9. Pemeriksaan yang BLOCKED

Dinyatakan gagal-verifikasi, bukan lulus.

| Pemeriksaan | Alasan | Prosedur verifikasi yang disarankan |
|---|---|---|
| E2E peramban (Playwright/Cypress) | Tidak tersedia di lingkungan | Tambahkan Playwright; uji alur gempa → detail, notifikasi, peta |
| Tangkapan layar responsif | Tidak ada peramban/headless | Uji manual 360/768/1440 px pada semua rute |
| Lighthouse / Core Web Vitals | Tidak ada Chrome | Jalankan Lighthouse di staging HTTPS |
| Push notifikasi nyata | Tidak ada kunci VAPID & perangkat | Setel VAPID di staging, daftarkan perangkat, kirim uji |
| Pelanggaran CSP di peramban | Butuh konsol peramban | Buka setiap rute, termasuk peta dan iframe YouTube, cek tab Console |
| Uji perangkat Android | Tidak ada perangkat | Uji "Add to Home Screen" + push latar |

Rencana lengkap ada di [RELEASE_CHECKLIST.md](./RELEASE_CHECKLIST.md).

---

## 10. Catatan tentang cakupan

Build dan seluruh tes unit lulus, tetapi itu **bukan** bukti bahwa setiap fitur bekerja di
peramban. Yang benar-benar terbukti di sesi ini:

- kode bertipe benar dan lolos lint tanpa penonaktifan aturan;
- 110 tes unit untuk logika murni lulus;
- build produksi berhasil dan seluruh rute utama merespons `200`;
- header keamanan, pembatas laju, batas body, penanganan galat, dan integritas data
  terverifikasi lewat permintaan nyata.

Yang belum terbukti: tampilan visual, interaksi peramban, pengiriman push nyata, dan
kinerja lapangan. Hal-hal itu terdaftar sebagai BLOCKED di atas.

---

## 11. Verifikasi akhir (sesi terpisah, ulang dari nol)

Bagian ini mencatat pemeriksaan **ulang** setelah semua perbaikan dikomit (`ea4314a`). Semua
perintah dijalankan lagi dari kondisi bersih: `.next` dan `.data` dihapus lebih dulu, lalu
`next build` dan `next start` baru. Tujuannya adalah membuktikan perbaikan bertahan, bukan
hanya terlihat sekali.

### 11a. Diff dan cakupan perubahan

| Pemeriksaan | Label | Hasil |
|---|---|---|
| Diff `8ee6d84..ea4314a` ditinjau seluruhnya | **PASS** | 54 berkas, +2.723/−278; tidak ada perubahan di luar yang dideklarasikan |
| Diff `next.config.mjs` sesuai klaim | **PASS** | `images.unoptimized: true` + blok `headers()` (CSP/HSTS/COOP/Permissions-Policy) |
| Diff `.eslintrc.json` sesuai klaim | **PASS** | `no-img-element` dimatikan terpusat dengan alasan tertulis |
| Diff `package.json` sesuai klaim | **PASS** | `next` 14.2.35, `postcss` 8.5.32 + `overrides`, skrip tes baru |
| Perubahan tak sengaja | **PASS** | Tidak ditemukan |

### 11b. Pemeriksaan ulang dari nol

| # | Pemeriksaan | Label | Hasil |
|---|---|---|---|
| 11.1 | `npm ls --depth=0` | **PASS** | 0 `UNMET`/`extraneous`/`invalid` |
| 11.2 | `npm run lint` | **PASS** | `✔ No ESLint warnings or errors` |
| 11.3 | `npm run typecheck` | **PASS** | Tanpa keluaran |
| 11.4 | `npm test` | **PASS** | **110/110 lulus, 0 gagal** |
| 11.5 | `npm run build` dari `.next` kosong | **PASS** | `✓ Compiled successfully`, exit 0, **74 rute** |
| 11.6 | `/_next/image` tanpa parameter | **PASS** | `404` |
| 11.7 | `/_next/image?url=…&w=64&q=75` | **PASS** | `404` (tidak ada jalur optimizer yang tersisa) |
| 11.8 | Header keamanan | **PASS** | 7 header terkirim: CSP, HSTS (`max-age=31536000; includeSubDomains`), COOP `same-origin`, Permissions-Policy, X-Frame-Options, X-Content-Type-Options, Referrer-Policy |
| 11.9 | Aset PWA | **PASS** | `/sw.js` 200, `/manifest.webmanifest` 200, `/icon-192.png` 200 |

### 11c. Fitur pemantauan tetap utuh

| Pemeriksaan | Label | Hasil |
|---|---|---|
| `/api/earthquakes` | **PASS** | `200`, **204 kejadian**; terurut menurun (`originTime`), `id` unik |
| Sumber gempa | **PASS** | 5 sumber aktif: terbaru 1, m5 15, dirasakan 15, felt30 30, live 165 |
| `/api/volcano/status` | **PASS** | `200`, daftar gunung api terisi |
| `/api/volcano/{overview,vona,erupsi,gallery,cameras,laporan,krb,health}` | **PASS** | Semuanya `200`, `ok:true` |
| `/api/weather/{satelit,peringatan}` | **PASS** | `200` |
| `/api/tsunami` | **PASS** | `200`, `state:"none"` |

### 11d. Jalur gagal, izin, dan data basi

| Pemeriksaan | Label | Hasil |
|---|---|---|
| Sumber gempa dirusak (`BMKG_BASE_URL`/`MAGMA_BASE_URL` → `https://127.0.0.1:9/x`) | **PASS** | `/api/earthquakes` → `200` dengan **194 kejadian** dari sumber sehat; sumber gagal memberi pesan `'Sumber data tidak dapat dihubungi'` (bukan pesan internal) |
| Kebocoran `fetch failed` | **PASS** | `grep -c "fetch failed"` → **0** |
| `/api/volcano/status` saat MAGMA mati | **PASS** | `502` + `application/json` dengan payload berbentuk lengkap (bukan `500` kosong) |
| Halaman saat sumber mati | **PASS** | `/`, `/history`, `/statistics`, `/gunung-berapi`, `/gunung-berapi/status`, `/tsunami` → semuanya `200` |
| Push tanpa env VAPID | **PASS dengan catatan** | `/api/volcano/push/config` → `200` + kunci **digenerate otomatis** ke `.data/`; kunci tidak sah (panjang wajar) juga diterima `200` tanpa peringatan — kegagalan muncul saat kirim |
| Langganan push tidak sah | **PASS** | `400 {"error":"Langganan push tidak valid"}` |
| Monitor tanpa rahasia (secret **diset**) | **PASS** | Tanpa auth `401`, rahasia salah `401`, rahasia benar `200` |
| Stale data di UI | **PASS** (kode) | `StaleDataNotice` dipakai di `page.tsx`, `history`, `map`, `statistics`, `event/[id]`; flag `stale` di `VolcanoOverview.tsx:129` dan `VolcanoSeismogram.tsx:319` |
| Izin notifikasi ditolak | **PASS** (kode) | `useTsunamiPush.ts:150-156` → pesan dapat ditindaklanjuti; UI menampilkan "Izin ditolak" |
| Langganan kedaluwarsa | **PASS** (kode) | `404`/`410` → endpoint dipangkas (`volcano/push.ts:244`, `tsunami/push.ts:166`) |

**Catatan yang harus tetap tercatat:** bila `VOLCANO_MONITOR_SECRET`/`TSUNAMI_MONITOR_SECRET`
**tidak diset**, `authorized()` mengembalikan `true` — ini perilaku lama, bukan kemunduran dari
perbaikan ini, dan menjadi prasyarat wajib produksi (§3.1 RELEASE_CHECKLIST).

### 11e. Pembatas laju & batas body (diukur langsung)

| Pemeriksaan | Label | Hasil |
|---|---|---|
| Monitor (limit 20/menit) | **PASS** | `429` mulai permintaan ke-18 (karena trafik uji sebelumnya pada jendela yang sama) |
| `push/test` tsunami (limit 5) | **PASS** | `404` ×5 lalu `429` pada permintaan ke-6 |
| Body 5.001 B ke `push/subscribe` (batas 4.000 B) | **PASS** | `413 {"error":"Body permintaan terlalu besar"}` |
| Body sah setelah guard | **PASS** | `400` (sampai ke validasi, jadi guard tidak memblokir masukan sah) |
| Header `Retry-After` | **PASS** | Ada pada respons `429` (contoh tercatat: `retry-after: 596`) |

### 11f. Rahasia, kontrol akses, dan pemeriksaan keamanan

| Pemeriksaan | Label | Hasil |
|---|---|---|
| Pola kunci/rahasia di berkas terlacak | **PASS** | `git grep` (private key, `AKIA…`, `ghp_…`, `sk_live_…`, `xox…`) → kosong |
| `.env` / `.data/` terlacak | **PASS** | Tidak terlacak; keduanya ada di `.gitignore` |
| Pemeriksaan build dinonaktifkan | **PASS** | `ignoreBuildErrors`/`ignoreDuringBuilds` → tidak ada |
| `eslint-disable` | **PASS** | 0 |
| `@ts-ignore`/`@ts-expect-error`/`@ts-nocheck` | **PASS** | 0 |
| `as any` | **PASS** | 0 |
| `dangerouslySetInnerHTML` | **PASS** | 1 (skrip tema statis, tanpa masukan pengguna) |
| Validasi langganan push tidak dilemahkan | **PASS** | `isValidPushSubscription` sama dengan baseline (https wajib, batas panjang, pola base64url) |
| Auth monitor tidak dilewati guard baru | **PASS** | `authorized()` tetap dijalankan setelah `rateLimit()`/pemeriksaan body |

### 11g. Audit dependensi (koreksi angka)

| Pemeriksaan | Label | Hasil |
|---|---|---|
| `npm audit --omit=dev` (ringkasan) | **PASS dengan catatan** | `1 critical severity vulnerability` — ini jumlah **paket** (`next`), bukan jumlah advisory |
| Advisory yang rentangnya mencakup `14.2.35` | **PASS dengan risiko diterima** | **25** (3 kritis, 9 tinggi, 11 sedang, 2 rendah) |
| Pemicu advisory ada di kode? | **PASS** | `middleware.ts` tidak ada; `rewrites`/`redirects`/`i18n` tidak ada; `'use server'` 0; custom server tidak ada; `upgrade` 0; `beforeInteractive` 0; `remotePatterns` 0; `nonce` hanya komentar |
| Sisa risiko yang jujur | **risiko diterima** | Beberapa advisory **DoS pada RSC** tidak dapat dimatikan dari kode; risiko ketersediaan, bukan RCE. Ditutup oleh **OI-01** (Next 16) |

### 11h. Kesimpulan verifikasi akhir

Seluruh butir yang dapat diuji di lingkungan ini **PASS**. Tidak ditemukan kemunduran dari
perbaikan yang diklaim, tidak ada perubahan tak sengaja pada diff, dan tidak ada rahasia,
pemeriksaan keamanan yang dinonaktifkan, atau jalur akses yang melemah.

Satu koreksi dokumentasi ditemukan dan diperbaiki pada bagian ini: jumlah advisory `next`
bukan 4 melainkan **25** (lihat 11g). Koreksi itu tidak mengubah kode maupun status kelayakan
secara material, tetapi mengubah gambaran risiko yang wajar disampaikan.

Yang masih **BLOCKED**: 16 butir bagian 2 [RELEASE_CHECKLIST.md](./RELEASE_CHECKLIST.md)
(peramban, perangkat, push nyata, Lighthouse, CSP di konsol). Itu tetap menjadi alasan
rekomendasi akhir bukan `READY` penuh.
