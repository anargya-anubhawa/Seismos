# AGENTS.md

Next.js 14 App Router app (single package, no monorepo). Monitoring data gempa/tsunami/gunung api Indonesia. Bahasa produk dan komentar: Indonesia. `README.md` memuat detail fitur, endpoint, dan batasan — jangan duplikasi di sini.

## Verifikasi wajib

```bash
export PATH="$HOME/.nvm/versions/node/v24.22.0/bin:$PATH"   # Node tidak ada di PATH default shell
npm run lint && npm run typecheck && npm test && npm run build
```

- Jangan klaim selesai tanpa menjalankan keempatnya. `next.config.mjs` tidak mengabaikan error TypeScript/ESLint, jadi `npm run build` ikut gagal bila ada masalah tipe.
- `npm run build` gagal/basi bila `next dev`/`next start` sedang memakai `.next`. Hentikan server dulu; bila chunk hilang, hapus `.next` lalu build ulang.

## Tes

- Tidak ada Jest/Vitest. Tes = `node:test` + `node:assert/strict` di `scripts/test-*.ts`, dijalankan `sucrase-node` tanpa type-check.
- Satu suite: `npx sucrase-node scripts/test-volcano.ts`. Menambah suite baru **harus** ikut dirangkai di skrip `test` pada `package.json` (dirangkai manual dengan `&&`); kalau tidak, suite itu tidak pernah jalan.
- `sucrase-node` tidak me-resolve alias `@/*`. File tes wajib memakai impor relatif (`../src/lib/...`), bukan `@/lib/...` (gagal `Cannot find module '@/lib/...'`).
- Tes mengimpor modul murni (parser/normalisasi). Kode yang menyentuh filesystem store atau jaringan tidak dites.

## State runtime dan env

- Tidak ada database. Status monitor, antrean notifikasi, langganan push, dan lock disimpan sebagai JSON di `TSUNAMI_DATA_DIR` (default `.data/tsunami`) dan `VOLCANO_DATA_DIR` (default `.data/volcano`); keduanya di-gitignore.
- **Hosting serverless (Vercel) tidak punya sistem berkas tulis.** Kode berjalan dari `/var/task` yang baca-saja, jadi `mkdir` gagal. Jangan mengembalikan `ensureDataDir()` menjadi `mkdir` langsung: kedua store memakai `src/lib/storage.ts` (`createStorageProbe` + `createMemoryStore`) yang menangani `EROFS`/`ENOENT`/`EACCES` dengan beralih ke memori, mencatat satu baris `[storage]`, dan mengekspos `storageWarning()` untuk ditampilkan di UI. Tanpa ini halaman tsunami menampilkan "status tidak dapat dipastikan" dan push config membalas 503 berisi error `mkdir` mentah — persis bug yang pernah terjadi.
- `src/lib/**` diimpor oleh skrip tes lewat `sucrase-node`, jadi modul di dalam `src/lib/` sebaiknya memakai impor relatif (mis. `../storage`), bukan `@/lib/...`, agar tes tetap bisa me-load-nya secara transitif.
- Kunci VAPID dipakai bersama: file tunggal `TSUNAMI_DATA_DIR/vapid.json`. Push volcano **memakai ulang** sistem VAPID/service worker tsunami — jangan buat sistem push atau service worker kedua.
- Setelah tes/manual yang menyentuh store, kembalikan berkas uji (mis. `.data/volcano/subscriptions.json`) ke state kosong agar tidak terbawa ke commit.
- Daftar env lengkap: `.env.example`. Variabel penting: `*_MONITOR_DISABLED`, `*_MONITOR_SECRET`, `*_POLL_SECONDS`, `MAGMA_IMAGE_MAX_BYTES`.

## Arsitektur yang tidak terlihat dari nama file

- `src/instrumentation.ts` memulai monitor tsunami + gunung api sekali per proses Node. Monitor = polling sumber resmi + dedupe, bukan feed push.
- Next 14 juga mengompilasi `instrumentation.ts` untuk runtime Edge. Karena itu tiap monitor punya pasangan stub `src/lib/<tipe>/monitor.edge.ts` yang **wajib** didaftarkan sebagai `NormalModuleReplacementPlugin` di `next.config.mjs`, dan `web-push` dieksternalkan. Tambah monitor baru tanpa stub Edge → build gagal karena modul `node:*`.
- Semua panggilan BMKG/MAGMA dilakukan dari server (`src/services/*`, route `src/app/api/*`). Komponen client tidak boleh memanggil sumber data langsung; gambar MAGMA lewat proxy `/api/volcano/krb` / proxy gambar.
- Seismogram gunung api punya satu komponen bersama `VolcanoSeismogramView`, dipakai `/gunung-berapi/seismogram` dan rute lama `/volcano-seismogram` (jangan hapus rute lama).
- Service worker `public/sw.js` menangani cache shell (`seismos-shell-vN`) + push untuk semua kanal lewat field `channel`. Naikkan versi cache saat mengubah precache.

## Aturan data (permintaan produk, bukan preferensi)

- Jangan mengarang data apa pun: koordinat, status, laporan, riwayat letusan, batas KRB, stream CCTV, ETA/forecast abu, metadata galeri. Bila sumber tidak menyediakan, tampilkan "tidak tersedia" + tautan sumber.
- Nomenklatur level resmi selalu sebagai teks: Level I Normal, II Waspada, III Siaga, IV Awas. Warna tidak boleh jadi satu-satunya pembeda.
- Kenaikan level **bukan** letusan. Notifikasi letusan hanya dari VEN/persetujuan laporan resmi.
- Status data yang tidak pasti ditampilkan sebagai "tidak dapat dipastikan", bukan sebagai "aman".
- Setiap halaman butuh state loading, error, dan kosong/offline.

## Sumber data MAGMA

- Basis `https://magma.esdm.go.id/_api`. Endpoint `/v1` dan `/data/api/public/...` di host itu mengembalikan HTML — jangan dipakai.
- Paginasi memakai `page` sebagai pengali offset (`offset = page * size`); parameter tak dikenal diabaikan diam-diam, jadi filter harus di sisi server.
- KRB hanya tersedia sebagai raster; ArcGIS FeatureServer KRB menolak tanpa token (`Token Required`) sehingga poligon tidak mungkin diambil.
- HTTP 400 pada `/{id}/detail` berarti ID tidak valid → petakan ke 404, bukan 502.

## Konvensi UI

- Dark/light mode + layout responsif adalah syarat; jaga tanpa overflow horizontal. Jangan memuat banyak video/gambar sekaligus (CCTV = snapshot JPEG, lazy-load via IntersectionObserver).
- Daftar panjang di `/gunung-berapi/**` (status, laporan, erupsi, CCTV, KRB, gallery, VONA, notifikasi, ringkasan) menampilkan **maksimal 10 entri** dulu, lalu tombol "Muat N … lagi". Jangan mengganti `.map()` dengan `.slice(0, N)` hardcoded: pakai `useProgressiveList` + `LoadMoreButton` + `divided` dari `src/components/volcano/progressive.tsx`, dengan `resetKey` berisi kata kunci/tanggal filter agar hitungan kembali ke 10 saat filter berubah. Logika murninya ada di `src/lib/volcano/paging.ts` (diuji di `scripts/test-volcano.ts`), sengaja dipisah dari `.tsx` karena `sucrase-node` tidak bisa mengimpor JSX.
- Jangan menonaktifkan aturan ESLint (`eslint-disable`); perbaiki penyebabnya (mis. `react-hooks/exhaustive-deps` → `useMemo`).
