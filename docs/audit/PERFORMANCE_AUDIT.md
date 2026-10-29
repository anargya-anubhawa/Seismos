# AUDIT PERFORMA — SEISMOS

Prinsip yang dipakai: **ukur dulu, baru optimasi**, dan bedakan tegas antara angka yang
**diukur** dan yang **diperkirakan**. Tidak ada skor Lighthouse di dokumen ini karena
Lighthouse tidak dapat dijalankan di lingkungan ini.

- Basis kode: `main` @ `8ee6d84` + perubahan audit.
- Ukuran diambil dari artefak build produksi (`npm run build` → `.next/static`).

---

## 1. Apa yang diukur, dan apa yang tidak

| Metrik | Status |
|---|---|
| Ukuran bundel per rute (First Load JS) | **Diukur** — keluaran `next build` |
| Ukuran total JavaScript klien (mentah & gzip) | **Diukur** — `du`, `gzip -9` |
| Pemisahan kode (recharts/leaflet tidak di beranda) | **Diukur** — analisis aset yang dimuat |
| Jumlah rute / kompilasi | **Diukur** — 74 rute |
| Core Web Vitals lapangan (LCP, INP, CLS) | **Tidak diukur** — butuh peramban |
| Skor Lighthouse | **Tidak diukur** — butuh Chrome |
| Kinerja di Android kelas bawah | **Tidak diukur** — butuh perangkat |
| Beban CPU/memori server saat beban | **Tidak diukur** — butuh alat beban |

Angka di bawah **bukan** hasil Lighthouse. Jangan dibaca sebagai skor kinerja lapangan.

---

## 2. Ukuran bundel

### 2a. Total JavaScript klien

```
.next/static/chunks  →  2,4 MB mentah, 82 berkas
estimasi gzip        →  533,3 kB  (gzip -9 atas seluruh chunk)
```

Total ini mencakup **semua** chunk, termasuk chunk milik rute yang tidak dikunjungi.
Yang menentukan waktu muat halaman adalah paket per rute, di bawah ini.

### 2b. First Load JS per rute (dari `next build`)

| Rute | Halaman | First Load JS |
|---|---|---|
| `/` (beranda) | 6,74 kB | **126 kB** |
| `/history` | 5,21 kB | **110 kB** |
| `/map` | 6,42 kB | **103 kB** |
| `/cuaca` | 4,47 kB | **120 kB** |
| `/cuaca/peringatan-dini` | 5,67 kB | **111 kB** |
| `/cuaca/satelit` | 4,81 kB | **111 kB** |
| `/gunung-berapi` | 6,50 kB | **119 kB** |
| `/gunung-berapi/status` | 7,59 kB | **117 kB** |
| `/gunung-berapi/krb` | 8,82 kB | **118 kB** |
| `/gunung-berapi/notifikasi` | 9,08 kB | **114 kB** |
| `/gunung-berapi/live-youtube` | 190 B | **117 kB** |
| `/tsunami` | 3,65 kB | **117 kB** |
| `/about` | 180 B | **96,9 kB** |
| `/seismograph` | 12,5 kB | **109 kB** |
| `/statistics` | 104 kB | **200 kB** |
| Bagian bersama semua rute | — | **88 kB** |

Bacaan: hampir seluruh rute berada di kisaran **96–126 kB** First Load JS. Ini wajar untuk
aplikasi Next.js yang memuat React + router.

### 2c. Pemisahan kode — diperiksa, bukan diasumsikan

Chunk terbesar adalah `5031-*.js` sebesar **370,9 kB**, yang berisi `recharts` (pustaka grafik).

Pertanyaan penting: apakah pustaka itu ikut di beranda? Diperiksa dengan membandingkan chunk
yang benar-benar dirujuk HTML beranda:

```
$ curl / | grep -oE "/_next/static/chunks/[^\"]*\.js"    → 12 chunk
$ grep -c "5031"                                          → 0
```

**recharts (370,9 kB) tidak dimuat di beranda.** Ia hanya muncul di rute yang memakai grafik
(`/statistics`, First Load JS 200 kB). Pemisahan kode bekerja sebagaimana mestinya; saya
tidak menemukan alasan untuk mengubahnya.

### 2d. Chunk yang dimuat beranda

| Berkas | Ukuran |
|---|---|
| `fd9d1056-*.js` (React + framework) | 172,8 kB |
| `2117-*.js` | 124,7 kB |
| `polyfills-*.js` | 112,6 kB |
| `5136-*.js` | 37,7 kB |
| `app/layout-*.js` | 30,3 kB |
| `2972-*.js` | 26,1 kB |
| `app/page-*.js` | 23,1 kB |
| `8732-*.js` | 17,0 kB |
| `9874-*.js` | 10,3 kB |
| `webpack-*.js` | 5,1 kB |

Catatan: `polyfills` 112,6 kB adalah bawaan Next.js untuk peramban lama. Menghapusnya akan
memutus dukungan peramban lama, jadi tidak disentuh.

---

## 3. Pola pemuatan data dan pembaruan

Diperiksa dari kode hook dan komponen:

| Aspek | Keadaan | Penilaian |
|---|---|---|
| Cache API di service worker | `/api/*` **tidak pernah** di-cache (`public/sw.js:45`) | Benar — data aman tidak boleh basi |
| Navigasi saat offline | *network-first* dengan cadangan cache | Benar |
| Aset statis | *cache-first* dengan nama cache berversi | Benar |
| Polling beranda | `useEarthquakes` dengan interval; `cache: 'no-store'` | Wajar |
| Pembatalan permintaan | Memakai `AbortController` dan nomor urut (`sequence.current`) untuk mengabaikan respons usang | Baik — mencegah balapan |
| Prefetch gambar galeri | `<img loading="lazy">` — hanya gambar dekat layar | Baik |
| Daftar panjang | `useProgressiveList` (10 entri awal + "Muat N lagi") | Baik |
| CCTV | Snapshot JPEG *lazy* via `IntersectionObserver` | Baik |
| Thumbnail YouTube | `<img>`; **nol `<iframe>`** di halaman daftar (terverifikasi) | Baik |

Bukti "nol iframe" pada halaman daftar siaran:

```
$ curl /gunung-berapi/live-youtube | grep -c "<iframe"   →  0
$ curl /gunung-berapi/live-youtube | grep -o "i.ytimg.com/vi/[A-Za-z0-9_-]*" | sort -u
i.ytimg.com/vi/8X7gHBhD1Tw
i.ytimg.com/vi/CwsDCVlxi28
i.ytimg.com/vi/hc3m__hH5PY
i.ytimg.com/vi/NaPEkk9IoB8
i.ytimg.com/vi/ZLf_mo0vG7g
```

Artinya membuka menu Live YouTube tidak memuat pemutar atau skrip YouTube sama sekali —
pemutar baru dimuat di halaman detail.

---

## 4. Perbaikan performa yang dilakukan

Tidak ada optimasi performa khusus yang dikerjakan, dan itu keputusan sadar: pengukuran
tidak menunjukkan masalah yang layak diperbaiki.

Satu perubahan audit yang berdampak pada performa dan keamanan sekaligus:

**Optimizer gambar dimatikan** (`images.unoptimized: true`). Efeknya:

- rute `/_next/image` tidak lagi ada (404, terverifikasi), sehingga permintaan tidak lagi
  melewati pipeline Sharp;
- paket `sharp` tidak dimuat server sama sekali;
- gambar statis disajikan langsung oleh handler statis Next.js.

Biaya: gambar tidak lagi dikonversi otomatis ke format modern. Dampaknya kecil di sini karena
hampir semua gambar sudah melewati proxy sendiri yang meneruskan berkas sumber apa adanya,
sementara ikon BMKG hanya berukuran puluhan piksel.

---

## 5. Peluang yang teridentifikasi (belum dikerjakan)

Disajikan sebagai usulan, bukan sebagai fakta yang sudah diperbaiki.

| Peluang | Perkiraan dampak | Kerja | Catatan |
|---|---|---|---|
| Ukuran gambar dari proxy MAGMA (bukan sekadar meneruskan berkas 40 MB) | Sedang — galeri dan KRB dapat memuat berkas sangat besar | S | Butuh pemrosesan gambar server → bertentangan dengan keputusan mematikan optimizer; perlu pustaka terpisah |
| `polyfills` 112,6 kB | Sedang untuk peramban modern | S | Memutus peramban lama — keputusan produk |
| Muat awal `recharts` di `/statistics` (200 kB) | Kecil — hanya satu rute | S | Bisa di-`dynamic()`; rute ini memang harus memuat grafik |
| Indikator kesegaran data | Bukan performa, tapi persepsi | S | Diajukan sebagai OI-03 |

Angka "perkiraan dampak" di atas adalah **estimasi**, bukan hasil pengukuran.

---

## 6. Kesimpulan performa

Secara terukur, tidak ditemukan masalah performa yang menghambat rilis dalam lingkup yang
dapat diuji:

- seluruh rute utama berada pada First Load JS 96–126 kB, kecuali `/statistics` (200 kB)
  yang memang memuat pustaka grafik;
- pustaka berat (recharts 370,9 kB) **terbukti** tidak dimuat di beranda;
- halaman daftar siaran langsung memuat nol iframe;
- gambar dimuat bertahap (`lazy`), daftar panjang dipotong bertahap (10 entri);
- data aman (`/api/*`) tidak pernah di-cache oleh service worker.

Yang **belum** diketahui dan tidak boleh diklaim: LCP, INP, CLS, skor Lighthouse, dan
perilaku di Android kelas bawah. Untuk itu perlu pengukuran di peramban pada lingkungan
staging — prosedurnya ada di [RELEASE_CHECKLIST.md](./RELEASE_CHECKLIST.md).
