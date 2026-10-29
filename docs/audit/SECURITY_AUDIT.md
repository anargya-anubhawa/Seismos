# AUDIT KEAMANAN & PRIVASI — SEISMOS

Audit defensif atas arsitektur yang **benar-benar ada** di repositori. Setiap pernyataan
disertai berkas dan perintah pemeriksa. Tidak ada klaim "aman" yang berdiri hanya karena
build lolos.

- Basis kode: `main` @ `8ee6d84`, audit pada sesi ini.
- Lingkup: Next.js 14 App Router (satu paket), tanpa database eksternal, tanpa layanan
  autentikasi pengguna.

---

## 1. Arsitektur keamanan yang berlaku

| Aspek | Kenyataan di repositori | Bukti |
|---|---|---|
| Model autentikasi | **Tidak ada akun pengguna.** Tidak ada login, sesi, atau peran. | `find src -name "*.ts*" \| xargs grep -ln "next-auth\|firebase\|supabase"` → kosong |
| Basis data | Tidak ada. Status disimpan di berkas `.data/` di disk server. | `src/lib/volcano/push.ts`, `src/lib/tsunami/*` |
| Middleware | Tidak ada. | `find . -name middleware.ts` → kosong |
| Server Actions | Tidak ada. | `grep -rn "'use server'" src/` → 0 |
| Rahasia sisi server | `VAPID_PRIVATE_KEY`, `*_MONITOR_SECRET` — tidak pernah dikirim ke klien. | `src/lib/*/push.ts` |
| Variabel publik | Hanya `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (kunci publik, memang boleh terbuka). | `.env.example` |

Karena tidak ada akun, tidak ada permukaan "otorisasi per pengguna" yang bisa salah
konfigurasi. Permukaan keamanan yang nyata adalah: endpoint tulis, proxy gambar, dan
penyimpanan langganan push.

---

## 2. Endpoint tulis — kontrol akses

| Endpoint | Metode | Kontrol | Penilaian |
|---|---|---|---|
| `/api/volcano/monitor` | POST | `sameSecret` (perbandingan waktu-konstan) terhadap `VOLCANO_MONITOR_SECRET` | **Baik** |
| `/api/tsunami/monitor` | POST | idem | **Baik** |
| `/*/push/subscribe` | POST/DELETE | Tanpa autentikasi (desain Web Push) + pembatas laju | **Dapat diterima** |
| `/*/push/test` | POST | Tanpa autentikasi + pembatas laju | **Dapat diterima** |

`src/app/api/volcano/monitor/route.ts:10-14` memakai XOR akumulatif untuk membandingkan
rahasia — tidak bocor lewat waktu eksekusi:

```ts
let diff = 0;
for (let i = 0; i < left.length; i++) diff |= left.charCodeAt(i) ^ right.charCodeAt(i);
return diff === 0;
```

Catatan penting dan jujur: `authorized()` mengembalikan `true` bila
`VOLCANO_MONITOR_SECRET` **tidak disetel**. Artinya endpoint POST monitor menjadi terbuka
bila variabel itu lupa dipasang di produksi. Ini bukan temuan baru dari audit ini, tetapi
konsekuensinya harus disadari operator dan dicatat di
[RELEASE_CHECKLIST.md](./RELEASE_CHECKLIST.md) sebagai variabel wajib.

Endpoint GET `/monitor` sengaja tanpa autentikasi dan hanya mengembalikan status
pemrosesan tanpa rahasia.

### Kenapa DELETE tanpa autentikasi dapat diterima

`DELETE /push/subscribe` menghapus berdasarkan `endpoint`. Pada Web Push, endpoint adalah
URL kapabilitas sepanjang ratusan karakter yang dihasilkan peramban dan tidak dapat ditebak
— berperan sebagai rahasia. Pola hapus-berdasarkan-endpoint adalah praktik umum, dan tanpa
endpoint yang tepat baris lain tidak tersentuh. Diukur: panjang endpoint riil jauh melampaui
ruang tebak praktis.

---

## 3. SSRF pada proxy gambar

Dua rute meneruskan URL ke server. Keduanya diperiksa ketat.

### `/api/volcano/image?url=…` → `src/services/magma/image.ts`

| Pemeriksaan | Kode | Bukti |
|---|---|---|
| Wajib `https:` | `if (url.protocol !== 'https:') return null;` | baris 21 |
| Allowlist host persis | `if (!MAGMA_HOSTS.has(url.hostname)) return null;` | baris 22 |
| Host akhir dicek ulang setelah redirect | `const finalHost = new URL(response.url).hostname;` | baris 49-50 |
| Hanya `image/*` | `if (!contentType.startsWith('image/'))` | baris 52 |
| Batas ukuran | `MAX_BYTES` (40 MB, header + body) | baris 56-61 |
| Batas waktu | `AbortController` 25 detik | baris 34 |

Allowlist: `vsi.esdm.go.id`, `magma.vsi.esdm.go.id`, `magma.esdm.go.id`.

Pemeriksaan ulang host **setelah** redirect adalah bagian penting: tanpa itu, host MAGMA
yang membalas redirect ke alamat internal akan lolos. Di kode ini tidak.

### `/api/weather/satelit/[id]/image` → `src/services/bmkg/weather.ts:247`

```ts
if (parsed.protocol !== 'https:') return null;
if (parsed.hostname !== SATELLITE_HOST) return null;
if (!/^\/IMAGE\/|^\/Trajektori\//.test(parsed.pathname)) return null;
```

Host tunggal + batas prefiks path. SSRF tidak dapat dijangkau.

**Tidak ada rute lain** yang menerima URL dari pengguna: `grep -rln "searchParams.get('url')"
src/app/api` hanya menghasilkan satu berkas (di atas).

---

## 4. XSS dan injeksi HTML

`dangerouslySetInnerHTML` muncul **tepat satu kali**, di
`src/app/layout.tsx:48`, dengan isi konstanta statis:

```ts
const themeScript = `try{var t=localStorage.getItem('seismos-theme');…}`;
```

Tidak ada data pengguna maupun data sumber yang masuk ke situ — tidak dapat dipakai untuk
injeksi. `grep "eval(\|new Function"` → kosong.

React meng-escape seluruh teks dari API secara bawaan; tidak ditemukan `innerHTML` lain.

---

## 5. Kebocoran informasi melalui pesan galat

**Temuan nyata (F-04), sudah diperbaiki.** 33 titik mengirim `error.message` mentah. Bukti
kebocoran diambil dari server nyata dengan sumber yang sengaja dirusak; klien menerima
`fetch failed`.

Diperbaiki dengan `publicErrorMessage()` (daftar-tolak) yang diterapkan pada 33 titik API
ditambah 4 titik layanan yang ikut tampil di UI (`cache.ts`, `bmkg/index.ts`,
`bmkg/weather.ts`, `magma/index.ts`). Diverifikasi ulang: `grep -c "fetch failed"` → **0**.

Rincian lengkap: [FINDINGS.md F-04](./FINDINGS.md#f-04-p2--pesan-galat-internal-bocor-ke-klien).

### Log server

`console.error` pada `src/lib/*/push.ts` mencatat status dan pesan galat pengiriman push.
Ini di log server, bukan respons — wajar untuk operasi, dan tidak memuat kunci langganan.
Kebijakan retensi log adalah urusan infrastruktur.

---

## 6. Header keamanan, CSP, dan transport

**Sebelum:** hanya `nosniff`, `Referrer-Policy`, `X-Frame-Options`. Tanpa CSP dan tanpa HSTS.
**Sesudah:** ditambah `Content-Security-Policy`, `Strict-Transport-Security`,
`Cross-Origin-Opener-Policy`, `Permissions-Policy` (F-02).

Keterbatasan yang dinyatakan terbuka:

- `script-src 'self' 'unsafe-inline'` — Next 14 menyisipkan skrip inline; nonce-CSP praktis
  baru tersedia di Next 15+. Karena itu **CSP ini bukan pertahanan terhadap XSS pihak
  pertama.** Nilainya ada pada penutupan jalur eksternal (`object-src 'none'`,
  `frame-ancestors 'self'`, `connect-src 'self'`, `frame-src` terbatas YouTube).
- HSTS berlaku di sisi peramban setelah kunjungan pertama lewat HTTPS. Pastikan TLS
  diakhiri dengan benar di reverse proxy.

---

## 7. Kerentanan dependensi

Ringkasan; rincian di [FINDINGS.md F-03](./FINDINGS.md#f-03-p1--dependensi-versi-rentan-sisa-advisory-tidak-dapat-dijangkau).

| Tahap | `npm audit` (produksi) | Keterangan |
|---|---|---|
| Baseline | 2 (1 critical, 1 high) | `next@14.2.15`, `postcss@8.5.31` |
| Setelah audit | 4 advisory pada `next@14.2.35` | `postcss` bersih |

Perlu dinyatakan jujur: **jumlah advisory naik** setelah kenaikan versi. Penyebabnya
`npm audit` SemVer-aware — `14.2.15` mengumpulkan seluruh advisory sebagai satu entri,
sedangkan `14.2.35` menyisakan empat advisory yang **hanya tertambal di 15.5.x/16.x**.
Empat yang tersisa tidak dapat dijangkau di aplikasi ini (bukti per advisory di F-03), dan
penutupan penuhnya menuntut lompatan ke `next@16` yang bersifat *breaking* — diajukan
sebagai OI-01.

---

## 8. Privasi dan minimalisasi data

| Aspek | Keadaan | Penilaian |
|---|---|---|
| Geolokasi | Diminta hanya saat pengguna menekan "lokasi saya"; tidak dikirim ke server tanpa aksi pengguna | Baik |
| Penyimpanan geolokasi | Peramban lokal; tidak ada profil pengguna di server | Baik |
| Langganan push | Disimpan sebagai `{endpoint, keys, topics, createdAt}` — tanpa nama, email, atau IP | Baik |
| Pelacakan/analitik | Tidak ada skrip analitik pihak ketiga | Baik |
| Cookie pihak ketiga | Pemutar memakai `youtube-nocookie.com`; iframe hanya di halaman detail siaran | Baik |
| Data pribadi di laporan publik | Laporan "dirasakan" berasal dari BMKG, bukan unggahan pengguna | Baik |
| IP klien | Tidak dicatat ke penyimpanan. (Pembatas laju F-05 memakai IP di memori, tidak dipersistensi) | Baik |

Belum ada pernyataan privasi tertulis di aplikasi. Disarankan sebagai OI-06, bukan
penghalang rilis.

---

## 9. Service worker dan push

`public/sw.js`:

- Cache bernama berversi (`seismos-shell-v4`), cache lama dihapus saat `activate`.
- Navigasi memakai *network-first*; **`/api/*` tidak pernah di-cache** (baris 45) sehingga
  data gempa/tsunami tidak pernah basi karena cache.
- Cakupan `/` konsisten dengan `register(url, { scope: '/' })`.
- `pushsubscriptionchange` ditangani (baris 182) sehingga langganan dapat diperbarui.

Diverifikasi di server: `curl -I /sw.js` → `200`, `Content-Type: application/javascript`;
`/manifest.webmanifest` → `200`. CSP memuat `worker-src 'self'`, jadi pendaftaran SW tidak
terblokir.

---

## 10. Pembatas laju dan pengerahan sumber daya

**Sebelum:** tidak ada pembatas laju dan tidak ada batas ukuran body di enam endpoint tulis.
**Sesudah:** keduanya diterapkan dan diuji pada server produksi (`429` + `Retry-After`,
`413`). Rincian: F-05, F-06.

Keterbatasan yang disadari dan dicatat:

- Penghitung per proses (bukan lintas instance) — F-11.
- Pemeriksaan ukuran berbasis `content-length`; body `chunked` tanpa header tidak tertangkap.
  Batas keras perlu di reverse proxy.

---

## 11. Yang belum diuji dan tidak boleh dianggap lulus

Dinyatakan terang agar tidak terbaca sebagai "aman":

| Area | Alasan | Prosedur verifikasi yang disarankan |
|---|---|---|
| Uji penetrasi menyeluruh | Tidak ada alat pentest di lingkungan ini | Jalankan ZAP/`nuclei` terhadap staging |
| Perilaku CSP di peramban nyata | Tidak ada peramban headless | Buka DevTools → Console di staging, cari pelanggaran CSP pada semua rute + peta + iframe YouTube |
| Pemindaian dependensi berkelanjutan | Tidak ada CI | Aktifkan Dependabot / `npm audit` di CI |
| Ketahanan reverse proxy | Di luar repositori | Uji `client_max_body_size`, batas laju, dan TLS di staging |
| Rotasi rahasia | Tidak ada rahasia yang ditemukan ter-commit, jadi tidak ada yang perlu dirotasi | — |

Tidak ditemukan kredensial atau kunci privat yang ter-commit. `.env.example` hanya memuat
nama variabel dan nilai contoh yang tidak sensitif.
