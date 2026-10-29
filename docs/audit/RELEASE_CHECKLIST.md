# DAFTAR PERIKSA RILIS — SEISMOS

Dibagi menjadi tiga bagian: **sudah diverifikasi di lingkungan ini**, **wajib diverifikasi
sebelum rilis di staging**, dan **wajib disetel di produksi**. Tidak ada butir yang
ditandai selesai tanpa bukti.

---

## 1. Sudah diverifikasi (berbukti di sesi audit)

| # | Butir | Hasil | Bukti |
|---|---|---|---|
| 1.1 | `npm run lint` bersih | ✅ | `✔ No ESLint warnings or errors` |
| 1.2 | `npm run typecheck` bersih | ✅ | `tsc --noEmit` tanpa keluaran |
| 1.3 | `npm test` lulus | ✅ | 110/110, 0 gagal |
| 1.4 | `npm run build` berhasil | ✅ | `✓ Compiled successfully`, exit 0, 74 rute |
| 1.5 | Lockfile konsisten | ✅ | `npm ls --depth=0` tanpa `UNMET`/`extraneous` |
| 1.6 | 22 rute utama merespons `200` | ✅ | `curl` ke `next start` |
| 1.7 | Header keamanan terkirim | ✅ | CSP, HSTS, COOP, Permissions-Policy terlihat di `curl -I` |
| 1.8 | `/_next/image` tidak aktif | ✅ | `404` (optimizer mati) |
| 1.9 | Pesan galat internal tidak bocor | ✅ | `grep -c "fetch failed"` → 0 pada respons galat |
| 1.10 | API tetap JSON saat sumber mati | ✅ | `502` + JSON lengkap, bukan `500` kosong |
| 1.11 | Pembatas laju bekerja | ✅ | `429` + `Retry-After` pada permintaan ke-6 |
| 1.12 | Batas ukuran body bekerja | ✅ | `413` untuk body 5.011 B pada endpoint push |
| 1.13 | Integritas data gempa | ✅ | 204 kejadian, terurut, unik, koordinat valid |
| 1.14 | Statistik rekonsiliasi | ✅ | 42+24+3+0 = 69 = `total` |
| 1.15 | Tidak ada penonaktifan ESLint | ✅ | `grep -rn "eslint-disable" src/` → 0 |
| 1.16 | Tidak ada artefak tertinggal | ✅ | `page.tsx.bak` dihapus; tidak ada `.bak/.orig/.rej` lain |
| 1.17 | Semua variabel env terdokumentasi | ✅ | 0 variabel di `src/` tanpa entri di `.env.example` |

---

## 2. Wajib diverifikasi di staging sebelum rilis (BELUM diuji)

Butir-butir ini **tidak dapat dijalankan** di lingkungan audit (tidak ada peramban, perangkat,
maupun kunci VAPID). Jangan dianggap lulus.

| # | Butir | Cara memverifikasi | Kriteria lulus |
|---|---|---|---|
| 2.1 | Tidak ada pelanggaran CSP | Buka setiap rute, cek tab Console | Nol pelanggaran CSP, termasuk `/map`, `/gunung-berapi/peta`, `/gunung-berapi/live-youtube/<id>` |
| 2.2 | Peta Leaflet memuat tile | Buka `/map` dan `/gunung-berapi/peta` | Tile OpenStreetMap & ArcGIS tampil, tanpa blokir CSP |
| 2.3 | Iframe YouTube tampil | Buka satu halaman siaran langsung | Pemutar muncul, `youtube-nocookie.com` tidak diblokir |
| 2.4 | Responsif 360/768/1440 px | DevTools pada semua rute | Tidak ada gulir horizontal, tidak ada elemen terpotong |
| 2.5 | Tangkapan layar setiap rute | Simpan sebagai bukti rilis | Visual sesuai harapan, dark & light |
| 2.6 | Navigasi papan tunjuk | Tab melalui seluruh halaman | Fokus terlihat, urutan masuk akal, semua kontrol terjangkau |
| 2.7 | Mode gerak berkurang | Aktifkan `prefers-reduced-motion` | Animasi berhenti, konten tetap terbaca |
| 2.8 | Status tidak hanya warna | Periksa badge level gunung api | Selalu ada teks "Level I Normal … IV Awas" |
| 2.9 | Lighthouse | Lighthouse (mode mobile) | Catat skor; tanpa target keras di rilis pertama |
| 2.10 | Push notifikasi nyata | Setel VAPID di staging, daftar perangkat, kirim tes | Notifikasi diterima saat aplikasi di latar belakang |
| 2.11 | Izin notifikasi ditolak | Blokir izin di peramban | Pesan jelas, tidak ada galat tak tertangani |
| 2.12 | Offline | Matikan jaringan setelah satu kunjungan | Shell tampil; data API tidak menampilkan angka basi sebagai terkini |
| 2.13 | Geolokasi ditolak | Tolak izin lokasi | Pesan jelas, aplikasi tetap berfungsi |
| 2.14 | Pembaruan service worker | Deploy versi baru, muat ulang | Versi baru aktif; cache lama dibersihkan |
| 2.15 | Pasang PWA di Android | "Add to Home Screen" | Ikon, nama, dan mode mandiri benar |
| 2.16 | Peramban lain | Chrome, Firefox, Safari (iOS) | Tidak ada galat konsol yang menghambat |

---

## 3. Konfigurasi produksi

### 3.1 Variabel yang WAJIB disetel

| Variabel | Nilai | Mengapa wajib |
|---|---|---|
| `VAPID_SUBJECT` | `https://…` atau `mailto:…` | Wajib untuk Web Push yang sah |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | pasangan kunci | Tanpa ini notifikasi mati (`/push/config` → 503) |
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

- **Dapat diverifikasi dan lulus:** seluruh butir bagian 1 (17 butir).
- **Belum terverifikasi:** seluruh butir bagian 2 (16 butir) — butuh staging, peramban,
  perangkat, dan kunci VAPID.
- **Prasyarat produksi:** bagian 3, terutama dua rahasia monitor dan volume persisten.

Rilis **tidak** boleh dinyatakan selesai sebelum bagian 2 dijalankan di staging. Bagian 1
lulus, tetapi bagian 1 bukan pengganti uji peramban.
