# CATATAN RILIS — SEISMOS INDONESIA

Catatan perubahan yang terlihat pengguna, ditulis per versi. Entri terbaru di atas.

Dokumen terkait: [RUNBOOK.md](./RUNBOOK.md) (operasional) ·
[audit/RELEASE_CHECKLIST.md](./audit/RELEASE_CHECKLIST.md) (prasyarat rilis).

---

## 2.0.0 — belum dirilis

Fokus rilis ini: keamanan, keandalan, dan kejelasan data. Tidak ada perubahan besar pada
tampilan utama.

### Keamanan

- **Image Optimizer Next.js dimatikan.** Sebelumnya endpoint `/_next/image` terbuka dan
  membawa advisory eksekusi kode jarak jauh (RCE). Sekarang endpoint itu membalas `404`;
  tidak ada pemrosesan gambar di server.
- **Pesan galat tidak lagi membocorkan detail internal.** Sebelumnya pesan seperti
  `fetch failed` atau `getaddrinfo ENOTFOUND …` dikirim ke peramban. Sekarang diganti
  kalimat umum berbahasa Indonesia.
- **Pembatas laju dan batas ukuran body** ditambahkan pada seluruh endpoint tulis
  (langganan push, kirim tes, pemicu monitor). Permintaan berlebih dibalas `429`
  (dengan `Retry-After`), body kebesaran dibalas `413`.
- **Header keamanan lengkap:** Content-Security-Policy, Strict-Transport-Security,
  Cross-Origin-Opener-Policy, Permissions-Policy, X-Frame-Options,
  X-Content-Type-Options, Referrer-Policy.
- **Endpoint langganan push kini dibatasi** ke layanan push sah (Google/FCM, Mozilla,
  Apple, Microsoft WNS). Host sembarang ditolak. `localhost` tetap diizinkan untuk
  pengembangan.
- **Kunci VAPID divalidasi secara kriptografis**, bukan hanya panjangnya. Kunci yang
  salah kini ditolak disertai pesan galat yang jelas, bukan diterima diam-diam sehingga
  notifikasi tidak pernah sampai.
- `next` dinaikkan ke 14.2.35, `postcss` ke 8.5.32.

### Keandalan

- `/api/volcano/status` kini membalas `502` dengan JSON berbentuk lengkap ketika sumber
  MAGMA gagal, bukan `500` tanpa isi.
- Data basi ditandai jelas: pengguna melihat kapan data terakhir berhasil diambil dan
  bahwa data itu mungkin sudah tidak mutakhir.
- Langganan push yang sudah tidak berlaku (`404`/`410`) dihapus otomatis.

### Baru

- **Indikator kesegaran data** di beranda dan riwayat gempa: waktu ambil, umur data,
  lencana "data lama", serta status per sumber (berhasil/gagal beserta jumlah entri).
- **Halaman Status Sumber Data** (`/status-sumber`): tabel kesehatan seluruh sumber
  BMKG dan MAGMA/PVMBG, dengan tombol periksa ulang.
- **Halaman Kebijakan Privasi** (`/privasi`): apa yang diproses, apa yang tersimpan di
  perangkat, apa yang tersimpan di server, dan cara berhenti berlangganan notifikasi.
- **Daftar Live YouTube kini punya judul halaman** (`h1`) seperti halaman lain —
  sebelumnya pembaca layar tidak menemukan heading utama.

### Diperbaiki

- Halaman `/gunung-berapi/live-youtube` tidak memiliki `h1`; kini memakai `PageTitle`
  yang sama dengan halaman lain.

### Catatan penting

- Aplikasi ini **bukan** sistem peringatan dini resmi. Selalu rujuk kanal resmi BMKG dan
  PVMBG untuk keputusan keselamatan.
- Notifikasi push bersifat opsional dan **belum diuji pada perangkat sungguhan** dalam
  rilis ini. Lihat [audit/RELEASE_CHECKLIST.md](./audit/RELEASE_CHECKLIST.md) §2.10.
- 25 advisory `next` masih tercatat di `npm audit`; kondisi pemicunya tidak ada di kode
  ini (lihat [audit/FINDINGS.md](./audit/FINDINGS.md) F-03). Penutupan penuh menunggu
  kenaikan ke Next 16.

---

## 1.x — sebelumnya

Rilis 1.x memperkenalkan dashboard gempa BMKG (5 sumber), peta, statistik, riwayat,
seismograf perangkat, prakiraan cuaca, citra satelit, peringatan dini cuaca ekstrem,
status gunung api, VONA, CCTV, galeri, peta KRB, seismogram live, live YouTube, dan
peringatan tsunami. Catatan rinci per versi 1.x tidak dipertahankan dalam repositori ini.
