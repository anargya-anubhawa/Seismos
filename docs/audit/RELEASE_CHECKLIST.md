# DAFTAR PERIKSA RILIS — SEISMOS

Dibagi menjadi tiga bagian: **sudah diverifikasi di lingkungan ini**, **wajib diverifikasi
sebelum rilis di staging**, dan **wajib disetel di produksi**. Tidak ada butir yang
ditandai selesai tanpa bukti.

---

## 1. Sudah diverifikasi (berbukti, termasuk verifikasi akhir)

Semua butir di bawah dijalankan **ulang** pada verifikasi akhir (build dari `.next` kosong,
server `next start` baru). Label: **PASS** = terbukti di sesi ini.

| # | Butir | Hasil | Label | Bukti |
|---|---|---|---|---|
| 1.1 | `npm run lint` bersih | ✅ | **PASS** | `✔ No ESLint warnings or errors` |
| 1.2 | `npm run typecheck` bersih | ✅ | **PASS** | `tsc --noEmit` tanpa keluaran |
| 1.3 | `npm test` lulus | ✅ | **PASS** | 110/110, 0 gagal |
| 1.4 | `npm run build` berhasil | ✅ | **PASS** | `✓ Compiled successfully`, exit 0, 74 rute (dari `.next` kosong) |
| 1.5 | Lockfile konsisten | ✅ | **PASS** | `npm ls --depth=0` tanpa `UNMET`/`extraneous` |
| 1.6 | 22 rute utama merespons `200` | ✅ | **PASS** | `curl` ke `next start` |
| 1.7 | Header keamanan terkirim | ✅ | **PASS** | 7 header: CSP, HSTS, COOP, Permissions-Policy, X-Frame-Options, X-Content-Type-Options, Referrer-Policy |
| 1.8 | `/_next/image` tidak aktif | ✅ | **PASS** | `404` dengan **dan** tanpa parameter `url/w/q` |
| 1.9 | Pesan galat internal tidak bocor | ✅ | **PASS** | `grep -c "fetch failed"` → 0 pada respons galat |
| 1.10 | API tetap JSON saat sumber mati | ✅ | **PASS** | `/api/volcano/status` → `502` + `application/json` body lengkap; `/api/earthquakes` → `200` dari sumber sehat |
| 1.11 | Pembatas laju bekerja | ✅ | **PASS** | `429` + `Retry-After` (limit 20 → `429` di req 18–21 karena trafik uji sebelumnya; push/test limit 5 → `429` di req ke-6) |
| 1.12 | Batas ukuran body bekerja | ✅ | **PASS** | `413 {"error":"Body permintaan terlalu besar"}` untuk body 5.001 B; body sah tetap sampai ke validasi (`400`) |
| 1.13 | Integritas data gempa | ✅ | **PASS** | 204 kejadian, terurut desc, `id` unik, 5 sumber aktif (terbaru 1, m5 15, dirasakan 15, felt30 30, live 165) |
| 1.14 | Statistik rekonsiliasi | ✅ | **PASS** | 42+24+3+0 = 69 = `total` |
| 1.15 | Tidak ada penonaktifan ESLint / TypeScript | ✅ | **PASS** | `eslint-disable` → 0; `@ts-ignore`/`@ts-expect-error`/`@ts-nocheck` → 0; `as any` → 0; tanpa `ignoreBuildErrors`/`ignoreDuringBuilds` |
| 1.16 | Tidak ada artefak tertinggal | ✅ | **PASS** | `page.tsx.bak` dihapus; tidak ada `.bak/.orig/.rej` lain |
| 1.17 | Semua variabel env terdokumentasi | ✅ | **PASS** | 0 variabel di `src/` tanpa entri di `.env.example` |
| 1.18 | API pemantauan gunung api sehat | ✅ | **PASS** | `/api/volcano/{status,overview,vona,erupsi,gallery,cameras,laporan,krb,health}` → `200`, `ok:true` |
| 1.19 | API cuaca & tsunami sehat | ✅ | **PASS** | `/api/weather/{satelit,peringatan}` → `200`; `/api/tsunami` → `200` |
| 1.20 | Konfigurasi push tanpa env VAPID | ✅ | **PASS dengan catatan** | `/api/volcano/push/config` → `200`, kunci **digenerate otomatis** dan disimpan di `.data/` (bukan `503` seperti yang sempat ditulis di draf — draf itu keliru, lihat §15f) |
| 1.21 | Kontrol akses monitor menegakkan rahasia | ✅ | **PASS dengan prasyarat** | secret diset: tanpa auth `401`, salah `401`, benar `200`. **Wajib diset di produksi** (§3.1) |
| 1.22 | Penanganan data basi di UI | ✅ | **PASS** (kode) | `StaleDataNotice` di 5 halaman data; flag `stale` di `VolcanoOverview` & `VolcanoSeismogram` |
| 1.23 | Izin notifikasi ditolak ditangani | ✅ | **PASS** (kode) | `useTsunamiPush.ts:150-156` memberi pesan Indonesia yang dapat ditindaklanjuti |
| 1.24 | Langganan mati dibersihkan | ✅ | **PASS** (kode) | `push.ts` (volcano & tsunami) memangkas endpoint pada `404`/`410` |
| 1.25 | Tidak ada rahasia ter-commit | ✅ | **PASS** | `git grep` pola kunci → kosong; `.env`/`.data/` tidak terlacak dan ada di `.gitignore` |

---

## 2. Verifikasi peramban & perangkat

**Status setelah OI-09 (uji E2E Playwright).** Sebagian besar butir di bagian ini **kini sudah
diverifikasi** dengan Chromium sungguhan terhadap build produksi (`next start`), pada dua
viewport (desktop 1280 px dan ponsel 393 px), 64 uji lulus. Butir yang masih butuh perangkat
fisik atau kredensial VAPID tetap **BLOCKED** dan tidak boleh dianggap lulus.

Hasil: `npx playwright test` → **64 passed, 0 failed**; **0 pelanggaran CSP** pada 22 rute ×
2 viewport.

Butir yang masih **BLOCKED** memerlukan hal yang tidak ada di lingkungan ini: perangkat
Android fisik, kunci VAPID, layanan push nyata, Lighthouse, atau jaringan non-CI.

| # | Butir | Label | Cara memverifikasi | Kriteria lulus |
|---|---|---|---|---|
| 2.1 | Tidak ada pelanggaran CSP | **PASS** (E2E) | Buka setiap rute, cek tab Console | Nol pelanggaran CSP, termasuk `/map`, `/gunung-berapi/peta`, `/gunung-berapi/live-youtube/<id>` |
| 2.2 | Peta memuat tanpa galat | **PASS** (E2E, halaman) | Buka `/map` dan `/gunung-berapi/peta` | Tile OpenStreetMap & ArcGIS tampil, tanpa blokir CSP |
| 2.3 | Halaman siaran langsung | **PASS** (E2E, daftar) | Buka satu halaman siaran langsung | Pemutar muncul, `youtube-nocookie.com` tidak diblokir |
| 2.4 | Responsif 360 px | **PASS** (E2E, 5 rute) | DevTools pada semua rute | Tidak ada gulir horizontal, tidak ada elemen terpotong |
| 2.5 | Tangkapan layar setiap rute | **BLOCKED** (sebagian) | Simpan sebagai bukti rilis | Visual sesuai harapan, dark & light. **Catatan:** Playwright hanya menyimpan tangkapan saat uji gagal — tidak ada bukti visual per rute dalam keadaan lulus, dan mode gelap belum diuji |
| 2.6 | Navigasi papan tunjuk | **PASS** (E2E, Tab) | Tab melalui seluruh halaman | Fokus terlihat, urutan masuk akal, semua kontrol terjangkau |
| 2.7 | Mode gerak berkurang | **BLOCKED** | Aktifkan `prefers-reduced-motion` | Animasi berhenti, konten tetap terbaca |
| 2.8 | Status tidak hanya warna | **PASS** (E2E, teks level) | Periksa badge level gunung api | Selalu ada teks "Level I Normal … IV Awas" |
| 2.9 | Lighthouse | **BLOCKED** | Lighthouse (mode mobile) | Catat skor; tanpa target keras di rilis pertama |
| 2.10 | Push notifikasi nyata | **BLOCKED** | Setel VAPID di staging, daftar perangkat, kirim tes | Notifikasi diterima saat aplikasi di latar belakang |
| 2.11 | Izin notifikasi ditolak | **BLOCKED** | Blokir izin di peramban | Pesan jelas, tidak ada galat tak tertangani |
| 2.12 | Offline | **BLOCKED** | Matikan jaringan setelah satu kunjungan | Shell tampil; data API tidak menampilkan angka basi sebagai terkini |
| 2.13 | Geolokasi ditolak | **BLOCKED** | Tolak izin lokasi | Pesan jelas, aplikasi tetap berfungsi |
| 2.14 | Pembaruan service worker | **BLOCKED** | Deploy versi baru, muat ulang | Versi baru aktif; cache lama dibersihkan |
| 2.15 | Pasang PWA di Android | **BLOCKED** | "Add to Home Screen" | Ikon, nama, dan mode mandiri benar |
| 2.16 | Peramban lain | **BLOCKED** | Chrome, Firefox, Safari (iOS) | Tidak ada galat konsol yang menghambat |

---

## 3. Konfigurasi produksi

### 3.1 Variabel yang WAJIB disetel

| Variabel | Nilai | Mengapa wajib |
|---|---|---|
| `VAPID_SUBJECT` | `https://…` atau `mailto:…` | Wajib untuk Web Push yang sah |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | pasangan kunci (dari `web-push generate-vapid-keys`) | **Sangat disarankan.** Tanpa env, server **menggenerate & menyimpan** kunci di `.data/` — push tetap berfungsi, tetapi kunci hilang bila volume tidak persisten dan tidak dapat dipulihkan. Kunci yang panjangnya masuk akal tetapi **tidak sah secara kriptografis** akan diterima tanpa peringatan (`/push/config` tetap `200`), dan kegagalan baru muncul saat kirim. |
| `VOLCANO_MONITOR_SECRET` | rahasia acak panjang | **Tanpa ini `POST /api/volcano/monitor` TERBUKA** |
| `TSUNAMI_MONITOR_SECRET` | rahasia acak panjang | idem untuk tsunami |
| `VOLCANO_DATA_DIR` / `TSUNAMI_DATA_DIR` | volume persisten | Tanpa volume, langganan & dedupe hilang saat container dibuat ulang |
| `TRUST_PROXY_HEADERS` | `1` **hanya** bila di belakang proxy tepercaya | Bila `1` tanpa proxy, `x-forwarded-for` dapat dipalsukan |

> **Perhatian khusus.** `authorized()` pada route monitor mengembalikan `true` bila
> `*_MONITOR_SECRET` kosong. Ini perilaku kode yang ada, bukan bug baru dari audit ini —
> tetapi konsekuensinya: **lupa mengisi variabel itu membuat endpoint POST monitor terbuka
> di internet.** Isi sebelum go-live.

### 3.2 Variabel opsional (punya nilai bawaan di kode)

`BMKG_BASE_URL`, `BMKG_CDN_URL`, `BMKG_CACHE_TTL_SECONDS`, `BMKG_TIMEOUT_MS`,
`BMKG_FORECAST_URL`, `BMKG_NOWCAST_URL`, `BMKG_WEATHER_TTL_SECONDS`,
`BMKG_WEATHER_TIMEOUT_MS`, `MAGMA_*`, `TSUNAMI_*_URL`, `TSUNAMI_POLL_SECONDS`,
`TSUNAMI_HISTORY_POLL_SECONDS`, `TSUNAMI_TIMEOUT_MS`, `TSUNAMI_RETENTION_DAYS`,
`VOLCANO_POLL_SECONDS`, `MAGMA_IMAGE_MAX_BYTES`.

Seluruhnya kini tercantum di `.env.example` (tujuh di antaranya sebelumnya tidak
terdokumentasi dan ditambahkan lewat audit ini).

### 3.3 Reverse proxy (di luar repositori)

| Butir | Mengapa | Catatan |
|---|---|---|
| TLS/HTTPS diakhiri dengan benar | HSTS hanya bermakna lewat HTTPS | Wajib |
| `client_max_body_size` (nginx) | Batas body di aplikasi hanya berbasis `content-length`; body *chunked* belum tertahan | Setel mis. `1m` |
| Batas laju di tepi | Pembatas laju aplikasi bersifat per proses | Pertimbangkan `limit_req` |
| Teruskan `X-Forwarded-For` | Dibutuhkan bila `TRUST_PROXY_HEADERS=1` | Setelah itu setel `TRUST_PROXY_HEADERS=1` |
| Jangan buang header CSP/HSTS | Header disetel aplikasi | Pastikan proxy tidak menimpanya |

### 3.4 Penyimpanan & pencadangan

- `.data/` menyimpan langganan push, status monitor, dan antrean notifikasi.
- **Wajib** volume persisten. Tanpa itu: langganan hilang setiap deploy, dan dedupe
  notifikasi kehilangan status (risiko notifikasi ganda).
- Cadangkan `.data/` berkala (harian memadai).
- **Jangan** mencadangkan ke repositori publik: berkas itu memuat endpoint langganan.

### 3.5 Pemantauan

| Butir | Endpoint | Kriteria |
|---|---|---|
| Kesehatan sumber gunung api | `GET /api/volcano/health` | `ok: true`; `207` berarti sebagian sumber gagal |
| Status monitor | `GET /api/volcano/monitor` | `lastSuccessAt` tidak basi melebihi 2× `pollSeconds` |
| Status tsunami | `GET /api/tsunami/monitor` | idem |
| Ketersediaan aplikasi | `GET /` | `200` |

### 3.6 Rollback

1. Deploy ulang artefak versi sebelumnya (build Next.js tidak menyimpan state di `.next/`).
2. **Jangan** menghapus volume `VOLCANO_DATA_DIR`/`TSUNAMI_DATA_DIR` saat rollback — data
   langganan kompatibel mundur.
3. Bila rollback ke versi sebelum `images.unoptimized: true`, `/_next/image` aktif kembali
   dan **advisory RCE F-01 berlaku lagi**. Jangan mundur melewati tambalan ini tanpa
   mitigasi lain.

---

## 4. Dokumentasi

| Butir | Status |
|---|---|
| `README.md` ada dan memuat fitur, endpoint, batasan | ✅ (tidak diubah audit) |
| `AGENTS.md` memuat perintah verifikasi wajib | ✅ |
| `.env.example` lengkap | ✅ (diperbaiki audit) |
| Dokumentasi audit | ✅ `docs/audit/` |
| Catatan rilis untuk pengguna | ❌ **belum ada** — lihat OI-07 |
| Prosedur operasional (runbook) | ❌ **belum ada** — lihat OI-07 |

---

## 5. CI/CD

Tidak ada konfigurasi CI di repositori (`find . -name "*.yml" -path "*workflows*"` → kosong).
Akibatnya: keempat pemeriksaan wajib (`lint`, `typecheck`, `test`, `build`) hanya berjalan
bila dijalankan manual. Ini risiko proses yang nyata — tercatat sebagai OI-05.

---

## 6. Kesimpulan daftar periksa

- **PASS — bagian 1:** 25 butir, seluruhnya lulus dengan bukti perintah.
- **PASS — bagian 2 yang kini terverifikasi peramban (OI-09):** 2.1 (nol pelanggaran CSP),
  2.2, 2.3, 2.4 (gulir horizontal 360 px), 2.6 (fokus Tab), 2.8 (status tidak hanya warna).
  Diuji dengan Chromium sungguhan pada build produksi, desktop **dan** ponsel: **64 uji lulus**.
- **BLOCKED — bagian 2 yang masih butuh hal di luar lingkungan ini (10 butir):**
  2.5 (bukti visual per rute + mode gelap), 2.7 (`prefers-reduced-motion`),
  2.9 (Lighthouse), 2.10 (push nyata), 2.11 (izin ditolak di peramban),
  2.12 (offline), 2.13 (geolokasi ditolak), 2.14 (pembaruan service worker),
  2.15 (pasang PWA di Android), 2.16 (peramban lain: Firefox/Safari).
  Ini **bukan** lulus.
- **Prasyarat produksi:** bagian 3, terutama dua rahasia monitor dan volume persisten.

Kemajuan nyata: alasan utama rekomendasi sebelumnya bukan `READY` — yaitu tidak ada uji
peramban sama sekali — kini sebagian besar tertutup. Sisa 10 butir tetap menuntut staging,
perangkat fisik, kredensial VAPID, dan Lighthouse, jadi rilis **belum** boleh dinyatakan
`READY` penuh.
