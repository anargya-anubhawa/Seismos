# USULAN PENINGKATAN OPSIONAL — SEISMOS

Semua butir di bawah **belum dikerjakan**. Tidak satu pun akan diimplementasikan sampai Anda
menyetujuinya.

Cara menjawab:

```
APPROVE OI-01, OI-03
REJECT OI-02
DEFER OI-04
DETAIL OI-05
IMPLEMENT APPROVED
```

Skala usaha: **S** (jam), **M** (1–2 hari), **L** (3–5 hari), **XL** (>1 minggu).

---

## Status implementasi

Delapan usulan yang disetujui pengguna **sudah diimplementasikan** pada rilis ini:

| ID | Hasil |
|---|---|
| OI-02 | Allowlist host push di `src/lib/push-endpoint.ts`, dipakai kedua jalur. 8 kasus diuji langsung terhadap server. |
| OI-03 | Komponen `DataFreshness` di beranda & riwayat: waktu ambil, umur data, lencana "data lama", status per sumber. |
| OI-04 | `/api/health` (8 sumber, 4 grup) + halaman `/status-sumber` dengan tombol periksa ulang. |
| OI-05 | `.github/workflows/ci.yml`: lint, typecheck, test, build; `npm audit` sebagai laporan. |
| OI-06 | Halaman `/privasi`, diturunkan dari kode (lokasi tidak disimpan, tanpa analitik, cara berhenti berlangganan). |
| OI-07 | `docs/RELEASE_NOTES.md` dan `docs/RUNBOOK.md`. |
| OI-09 | Playwright: 22 rute × 2 viewport + gulir horizontal + fokus + halaman baru. **64 uji lulus, 0 pelanggaran CSP.** |
| OI-13 | `validateVapidKeys()`: 65/32 byte + byte `0x04`. Kunci salah → `503` dengan alasan jelas. |

Belum dikerjakan (sesuai keputusan): OI-01, OI-08, OI-10, OI-11 (ditunda), OI-12 (ditolak).

Tes unit naik dari **110 → 121** (11 tes baru untuk OI-02 & OI-13). Rute naik dari **74 → 77**
(`/privasi`, `/status-sumber`, `/api/health`).

---

## Ringkasan

| ID | Nama | Usaha | Risiko | Sebelum rilis? | Rekomendasi | Status |
|---|---|---|---|---|---|---|
| OI-01 | Naik ke Next.js 16 (menutup 25 advisory sisa) | XL | Tinggi | Tidak | **Tunda** ke rilis berikutnya |
| OI-02 | Allowlist host langganan push | S | Rendah | Tidak | **Setujui** — murah, menutup F-10 | **SELESAI** |
| OI-03 | Indikator kesegaran & atribusi data | S | Rendah | Tidak | **Setujui** | **SELESAI** |
| OI-04 | Halaman status kesehatan sumber | S | Rendah | Tidak | **Setujui** | **SELESAI** |
| OI-05 | CI yang menjalankan keempat pemeriksaan | S | Rendah | **Ya** | **Setujui** — prioritas tertinggi | **SELESAI** |
| OI-06 | Halaman kebijakan privasi | S | Rendah | Tidak | **Setujui** | **SELESAI** |
| OI-07 | Catatan rilis + runbook operasional | S | Rendah | Tidak | **Setujui** | **SELESAI** |
| OI-08 | Pembatas laju berbasis penyimpanan bersama | M | Sedang | Tidak | **Tunda** sampai multi-instance |
| OI-09 | Uji E2E Playwright | M | Rendah | Tidak | **Setujui** | **SELESAI** |
| OI-10 | Pemberitahuan pembaruan PWA | M | Sedang | Tidak | **Tunda** |
| OI-11 | Pemantauan galat yang menghormati privasi | M | Sedang | Tidak | **Tunda** |
| OI-12 | Ukuran citra proxy MAGMA | M | Sedang | Tidak | **Tolak** (lihat alasan) |
| OI-13 | Validasi kriptografis kunci VAPID (65/32 byte + uji asap) | S | Rendah | Tidak | **Setujui** — menutup F-14 | **SELESAI** |

---

## OI-01 — Naik ke Next.js 16

**Masalah yang diselesaikan.** 25 advisory `next` yang rentangnya mencakup `14.2.35` (3 kritis,
9 tinggi, 11 sedang, 2 rendah; termasuk `GHSA-2xp9-vwfh-vxw4`, `GHSA-2464-fhr4-w9xw`,
`GHSA-p293-qw3h-jr36`, `GHSA-p3m5-59mp-jv5r`) hanya tertambal di 15.5.x/16.x.
Saat ini kondisi pemicunya tidak ada di kode (optimizer mati, server Linux, tanpa Server Actions),
tetapi advisory tetap muncul di setiap `npm audit` dan menutupi advisory baru yang mungkin
lebih penting.

**Manfaat pengguna.** Tidak langsung. Manfaatnya operasional: `npm audit` kembali menjadi
sinyal yang bersih, dan nonce-based CSP (pertahanan XSS sejati) menjadi mungkin.

**Implementasi.** Naikkan `next` 14 → 16, `react`/`react-dom` 18 → 19, `eslint-config-next`
ikut naik. Sesuaikan: `experimental.instrumentationHook` (stabil di 15+), `experimental.serverComponentsExternalPackages`
→ `serverExternalPackages` (pindah ke root), perilaku `params`/`searchParams` yang kini
`Promise`, dan stub Edge untuk monitor. Jalankan ulang seluruh verifikasi.

**Usaha.** XL. **Risiko.** Tinggi — perubahan besar yang menyentuh hampir setiap halaman, dua
monitor latar belakang, dan konfigurasi Edge. Butuh uji regresi penuh di staging.

**Ketergantungan.** OI-09 (uji E2E) sebaiknya ada lebih dulu; tanpa itu, keyakinan bahwa
tidak ada regresi sangat rendah.

**Rekomendasi: TUNDA.** Manfaat keamanannya nol selama kondisi pemicu tidak dapat dijangkau,
sementara risiko regresinya besar. Kerjakan sebagai pekerjaan tersendiri dengan waktu khusus,
bukan disisipkan ke rilis ini.

---

## OI-02 — Allowlist hostname langganan push

**Masalah yang diselesaikan.** F-10: `/push/subscribe` menerima endpoint dengan host apa pun,
sehingga penyimpanan langganan dapat diisi entri yang menunjuk host sembarang. Endpoint
`push/test` tidak bisa dipakai sebagai relay (hanya mengirim ke langganan tersimpan), jadi
ini risiko kecil — tetapi murah ditutup.

**Manfaat pengguna.** Tidak terasa langsung. Mengurangi permukaan penyalahgunaan penyimpanan
dan pengiriman massal.

**Implementasi.** Di `isValidPushSubscription`, batasi `url.hostname` ke akhiran milik layanan
push yang sah:

```
fcm.googleapis.com           (Chrome/Edge/Android)
updates.push.services.mozilla.com   (Firefox)
*.notify.windows.com         (Windows)
web.push.apple.com           (Safari/iOS 16.4+)
```

Tambahkan tes untuk host sah dan host ditolak.

**Usaha.** S. **Risiko.** Rendah, tetapi **nyata**: host yang belum tercantum akan menolak
pengguna sah. Mitigasi: tetap izinkan `http://localhost`/`127.0.0.1` untuk pengembangan, dan
log host yang ditolak agar mudah menambah entri.

**Bergantung pada:** tidak ada. **Menutup:** F-10.

**Rekomendasi: SETUJUI.**

---

## OI-03 — Indikator kesegaran & atribusi data

**Masalah yang diselesaikan.** Respons API sudah membawa `updatedAt`, `stale`, dan per-sumber
`error`/`fetchedAt`, tetapi tidak semuanya ditampilkan konsisten. Untuk aplikasi kebencanaan,
"kapan data ini diambil" adalah informasi keselamatan, bukan hiasan.

**Manfaat pengguna.** Pengguna dapat menilai sendiri apakah data masih layak dipercaya —
terutama saat satu sumber lambat sementara sumber lain segar.

**Implementasi.** Komponen `DataFreshness` yang menampilkan waktu ambil, lencana "data lama"
bila `stale`, dan nama sumber + tautan. Pakai ulang `VolcanoPage`/`Panel` yang sudah ada.
Tidak mengubah cara pengambilan data.

**Usaha.** S. **Risiko.** Rendah (presentasional). **Ketergantungan.** Tidak ada.

**Rekomendasi: SETUJUI.**

---

## OI-04 — Halaman status kesehatan sumber

**Masalah yang diselesaikan.** `/api/volcano/health` sudah ada dan siap pakai, tetapi tidak
ada halaman yang menampilkannya untuk pengguna maupun operator. Saat sumber bermasalah,
pengguna hanya melihat galat tanpa konteks.

**Manfaat pengguna.** Kejelasan saat terjadi gangguan: sumber mana yang gagal, kapan terakhir
berhasil.

**Implementasi.** Rute `/status-sumber` yang membaca `/api/volcano/health` + status BMKG,
menampilkan tabel per sumber dengan `count`, `error`, dan waktu pemeriksaan. Tanpa panel
admin dan tanpa rahasia.

**Usaha.** S. **Risiko.** Rendah. **Ketergantungan.** Sebaiknya setelah OI-03 agar gayanya
konsisten.

**Rekomendasi: SETUJUI.**

---

## OI-05 — CI menjalankan keempat pemeriksaan wajib

**Masalah yang diselesaikan.** Tidak ada CI. `AGENTS.md` mewajibkan `lint`, `typecheck`,
`test`, `build`, tetapi semuanya hanya berjalan bila seseorang menjalankannya. Audit ini
menemukan beberapa kesalahan sintaks sementara yang **hanya tertangkap** karena saya
menjalankan `tsc` berulang kali; tanpa CI, kesalahan seperti itu mudah masuk ke `main`.

**Manfaat pengguna.** Mencegah rilis yang tidak dapat di-build atau gagal tipe.

**Implementasi.** `.github/workflows/ci.yml`: Node 24, `npm ci`, lalu empat perintah wajib.
Tambahkan `npm audit --omit=dev` sebagai laporan (bukan penggagal, karena 25 advisory sisa
tidak dapat dijangkau). Jalankan pada `push` dan `pull_request`.

**Usaha.** S. **Risiko.** Sangat rendah. **Biaya.** Menit GitHub Actions gratis untuk
repositori publik.

**Rekomendasi: SETUJUI — ini yang paling saya sarankan lebih dulu.** Memperkuat semua
pekerjaan lain di daftar ini.

---

## OI-06 — Halaman kebijakan privasi

**Masalah yang diselesaikan.** Aplikasi meminta geolokasi dan menyimpan langganan push, tetapi
tidak ada pernyataan tertulis tentang apa yang disimpan dan apa yang tidak. Untuk aplikasi
publik, ini ekspektasi dasar.

**Manfaat pengguna.** Kejelasan dan kepercayaan: lokasi tidak dikirim ke server, tidak ada
analitik pihak ketiga, langganan tersimpan tanpa identitas.

**Implementasi.** Rute `/privasi` berisi: data yang diproses, dasar penyimpanan, retensi,
tidak adanya pelacakan, dan cara berhenti berlangganan. Tautkan dari footer/about.

**Usaha.** S. **Risiko.** Rendah. **Ketergantungan.** Tidak ada.

**Rekomendasi: SETUJUI.** Isinya harus ditinjau manusia — jangan menyatakan hal yang tidak
sesuai kode.

---

## OI-07 — Catatan rilis + runbook operasional

**Masalah yang diselesaikan.** Tidak ada catatan rilis pengguna maupun runbook untuk operator
(apa yang harus dilakukan saat monitor berhenti, bagaimana memutar ulang langganan, apa yang
dipantau).

**Manfaat pengguna.** Pengguna tahu apa yang berubah; operator tahu apa yang harus dilakukan
saat 3 pagi.

**Implementasi.** `docs/RELEASE_NOTES.md` (per versi) dan `docs/RUNBOOK.md` (pemantauan,
pencadangan `.data/`, pemulihan, rotasi kunci VAPID, mematikan monitor lewat
`*_MONITOR_DISABLED`).

**Usaha.** S. **Risiko.** Rendah. **Ketergantungan.** Sebaiknya setelah OI-05.

**Rekomendasi: SETUJUI.**

---

## OI-08 — Pembatas laju berbasis penyimpanan bersama

**Masalah yang diselesaikan.** F-11: penghitung di memori proses. Bila aplikasi dijalankan di
lebih dari satu instance, batas efektif berlipat dan reset saat restart.

**Manfaat pengguna.** Tidak langsung. Mencegah penyalahgunaan pada skala lebih besar.

**Implementasi.** Ganti isi `src/lib/rate-limit.ts` dengan penyimpanan bersama (Redis, atau
tabel di penyimpanan yang sudah ada). Antarmuka `rateLimit()` sengaja dibuat agar penggantian
ini terlokalisasi.

**Usaha.** M. **Risiko.** Sedang — menambah dependensi infrastruktur yang saat ini **tidak
ada**. **Biaya.** Layanan tambahan yang harus dioperasikan.

**Ketergantungan.** Hanya relevan setelah aplikasi terbukti perlu multi-instance.

**Rekomendasi: TUNDA.** Menambah infrastruktur untuk masalah yang belum terbukti adalah
pengeluaran yang tidak perlu.

---

## OI-09 — Uji E2E dengan Playwright

**Masalah yang diselesaikan.** Seluruh uji saat ini adalah unit test logika murni. Tidak ada
satu pun yang menjalankan peramban, sehingga 16 butir di
[RELEASE_CHECKLIST.md](./RELEASE_CHECKLIST.md) §2 hanya dapat diuji manual. Regresi visual dan
interaksi (peta, dialog, navigasi palu) tidak tertangkap.

**Manfaat pengguna.** Menjaga alur penting (lihat gempa → detail → bagikan; buka peta;
notifikasi) tetap bekerja.

**Implementasi.** `@playwright/test` sebagai devDependency, `e2e/` berisi: muat beranda,
buka detail gempa, buka peta dan pastikan tile dimuat, buka daftar & detail siaran langsung,
**gagalkan tes bila ada pelanggaran CSP atau galat konsol**. Jalankan di CI (OI-05) dengan
`webServer` bawaan Playwright.

**Usaha.** M. **Risiko.** Rendah (devDependency saja). **Biaya.** Playwright mengunduh
biner peramban (± 300 MB) di CI.

**Ketergantungan.** OI-05 sangat disarankan lebih dulu. **Prasyarat untuk:** OI-01.

**Rekomendasi: SETUJUI.** Ini satu-satunya cara membuktikan butir-butir yang kini BLOCKED.

---

## OI-10 — Pemberitahuan pembaruan PWA

**Masalah yang diselesaikan.** Service worker diperbarui otomatis tanpa memberi tahu pengguna.
Pengguna yang sudah lama membuka aplikasi dapat memakai versi lama sampai memuat ulang.

**Manfaat pengguna.** Pengguna tahu versi baru tersedia dan bisa memilih memuat ulang —
penting bila perbaikan menyangkut data kebencanaan.

**Implementasi.** Tangkap `registration.waiting` di `ServiceWorkerRegister`, tampilkan bilah
"Versi baru tersedia — Muat ulang".

**Usaha.** M. **Risiko.** Sedang: salah penanganan dapat memicu muat-ulang berulang. Butuh
uji manual yang teliti.

**Rekomendasi: TUNDA.** Nilainya nyata tetapi tidak mendesak, dan risiko regresi lebih tinggi
daripada butir S di atas.

---

## OI-11 — Pemantauan galat yang menghormati privasi

**Masalah yang diselesaikan.** Galat di produksi hanya masuk log proses. Tidak ada cara
mengetahui bahwa monitor berhenti bekerja atau sumber berubah bentuk sampai pengguna melapor.

**Manfaat pengguna.** Deteksi lebih cepat saat data berhenti mengalir — relevan untuk aplikasi
keselamatan.

**Implementasi.** Pilihan paling ringan: kaitkan ke `/api/volcano/health` dan kirim
peringatan ke kanal operasional (email/webhook) saat `ok: false` bertahan melewati ambang.
Alternatif: Sentry dengan `beforeSend` yang membuang IP dan data lokasi.

**Usaha.** M. **Risiko.** Sedang — membuka jalur keluar data. **Biaya.** Tergantung pilihan
(email gratis, Sentry berbayar pada volume tertentu).

**Rekomendasi: TUNDA.** Mulai dari bagian pertama (peringatan berbasis health check, tanpa
dependensi baru) bila disetujui; integrasi pihak ketiga sebaiknya belakangan.

---

## OI-12 — Ukuran citra proxy MAGMA

**Masalah yang diselesaikan.** Proxy meneruskan berkas sumber apa adanya hingga 40 MB. Galeri
dan peta KRB dapat mengunduh berkas sangat besar, terutama di jaringan seluler.

**Manfaat pengguna (potensial).** Muat lebih cepat dan kuota lebih hemat.

**Implementasi.** Pemrosesan gambar di server (Sharp) untuk membuat varian kecil.

**Usaha.** M. **Risiko.** **Sedang-tinggi.**

**Alasan rekomendasi TOLAK:** ini bertabrakan langsung dengan perbaikan F-01. F-01 menutup RCE
dengan **menghapus** jalur pemrosesan gambar Sharp dari server; menambahkan kembali Sharp
sebagai jalur yang memproses gambar dari sumber eksternal menghadirkan ulang kelas risiko yang
baru saja ditutup, dengan kode yang baru ditulis sendiri dan belum teruji. Manfaatnya tidak
sepadan untuk rilis ini. Bila nanti diinginkan, kerjakan bersama OI-01 (saat Next 16 dan
penanganan gambar yang lebih baru tersedia) dan dengan sandbox pemrosesan tersendiri.

---

## Ketergantungan antar-usulan

```
OI-05 (CI) ──► OI-09 (E2E) ──► OI-01 (Next 16)
    │               
    └──► OI-07 (runbook, lebih kuat bila ada gerbang rilis)

OI-03 (kesegaran) ──► OI-04 (halaman kesehatan sumber)   [gaya konsisten]

OI-02 (allowlist push) ──► menutup F-10
OI-08 (rate limit bersama) ──► hanya bila multi-instance
OI-12 (Sharp) ──► bertentangan dengan F-01; jangan diambil sekarang
```

**Prioritas bila hanya boleh memilih tiga:** OI-05, OI-09, OI-02.

---

## OI-13 — Validasi kriptografis kunci VAPID

**Masalah yang diselesaikan.** `envKeys()` (`src/lib/volcano/push.ts:39-47`) hanya memeriksa
*panjang* kunci. Kunci yang panjangnya wajar tetapi tidak sah secara kriptografis diterima,
sehingga `/api/volcano/push/config` membalas `200` dengan kunci yang tidak akan pernah bisa
memvalidasi langganan. Kerusakan baru terlihat saat kirim (promise rejection, tertangkap).
Rincian bukti di [FINDINGS.md F-14](./FINDINGS.md).

**Manfaat pengguna.** Operator yang salah menempel kunci mendapat peringatan jelas, bukan
notifikasi yang diam-diam tidak pernah sampai.

**Implementasi.** Setelah decode base64url, pastikan kunci publik 65 byte dan privat 32 byte;
bila tidak, catat galat dan (a) jangan gunakan kunci env, atau (b) laporkan `enabled:false`
dengan pesan yang dapat ditindaklanjuti di `/api/volcano/push/config`. Opsional: uji asap
`webpush.generateRequestDetails` saat startup dan tampilkan hasilnya di `/api/volcano/health`.

**Usaha.** S. **Risiko.** Rendah — hanya menolak konfigurasi yang memang tidak akan berfungsi.
**Bergantung pada:** tidak ada.

**Membutuhkan persetujuan Anda.** Balas `APPROVE OI-13` untuk mengerjakannya. Tanpa balasan
itu, kode tidak diubah.
