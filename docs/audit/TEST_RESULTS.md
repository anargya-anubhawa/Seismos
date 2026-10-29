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
| 6 | Audit dependensi | `npm audit` | **PASS dengan catatan** | 4 advisory sisa, tidak dapat dijangkau (F-03) |
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
| `/api/volcano/push/config` | `503` | pesan jelas: kunci VAPID belum disetel (perilaku benar tanpa rahasia) |

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
