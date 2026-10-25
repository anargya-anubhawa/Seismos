# Seismos Indonesia

Pemantauan gempa bumi Indonesia berbasis data terbuka resmi BMKG, peta episenter dengan lokasi pengguna, notifikasi dan alarm per wilayah, mitigasi, serta seismogram live gunung api dari MAGMA Indonesia (PVMBG). **Versi 1.0.0** — rilis 25 Oktober 2026.

> **Bukan sistem peringatan dini resmi.** Untuk keputusan keselamatan, rujuk BMKG (bmkg.go.id, inatews.bmkg.go.id) dan PVMBG (magma.esdm.go.id). Jangan menunggu notifikasi aplikasi.

- Repositori: [github.com/anargya-anubhawa/seismos-indonesia](https://github.com/anargya-anubhawa/seismos-indonesia)
- Kontak: [Instagram @anargya.anubhawa](https://instagram.com/anargya.anubhawa)
- Lisensi: [MIT](LICENSE)

## Menjalankan

```bash
npm install
cp .env.example .env.local
npm run dev        # http://localhost:3000
npm run typecheck && npm run lint && npm test && npm run build
```

Butuh Node.js 18.17+ dan akses internet: server memanggil BMKG dan MAGMA, peta memakai tile OpenStreetMap, serta font diambil dari Google Fonts saat build. Tidak ada database atau layanan pihak ketiga lain.

## Fitur

| Halaman | Isi |
|---|---|
| Dashboard | Ringkasan 24 jam, gempa terbesar/terbaru, peta episenter dengan penanda gempa terbaru, ringkasan notifikasi & alarm, pintasan mitigasi, status tiap sumber |
| Peta Gempa | Leaflet, marker sesuai koordinat BMKG, ukuran/warna menurut magnitudo, pulse + outline pada gempa terbaru, tombol “Lokasi saya”, titik GPS dan lingkaran akurasi, jarak ke episenter, filter magnitudo & kedalaman, sinkron dengan daftar |
| Riwayat Gempa | Filter lokasi, tanggal (WIB), magnitudo, kedalaman, dirasakan; urutan; paginasi; ekspor CSV hasil filter; tabel (desktop) dan kartu (mobile) |
| Detail kejadian | Data BMKG vs yang dihitung aplikasi, peta episenter, keterangan dirasakan, shakemap BMKG bila ada, salin tautan |
| Statistik | Per hari, distribusi magnitudo dan kedalaman, magnitudo terbesar; rentang 24 jam/7/30 hari/semua |
| Seismograf Perangkat | DeviceMotion dengan feature detection dan izin (iOS), Mulai/Jeda/Lanjutkan/Berhenti/Reset, grafik canvas X/Y/Z dan resultan (m/s²), rentang waktu dan skala, laju sampling terukur, penilaian kualitas indikatif, **suara sensor yang makin cepat dan keras mengikuti amplitudo**, kontrol suara/volume, ekspor CSV, simpan hingga 5 sesi di browser, DATA DEMO berlabel bila sensor tak tersedia |
| Seismogram Gunung Api | **Pilih gunung api lebih dahulu**, baru stasiun live MAGMA untuk gunung itu ditampilkan (167 stasiun, ±57 gunung api saat pengujian), pencarian gunung, thumbnail, pratinjau penuh, pembaruan otomatis 5 menit, atribusi sumber |
| Mitigasi | Tindakan sebelum/saat/setelah gempa, panduan tsunami, tas siaga, kontak darurat, tabel MMI, tautan resmi BMKG. Tetap dapat dibuka lewat tautan di Pengaturan |
| Pengaturan | Izin notifikasi, cakupan peringatan, **area seluruh Indonesia atau provinsi sekitar lokasi**, pilihan bunyi dan volume alarm, tes suara, tema terang/gelap/ikuti sistem, hapus sesi sensor, tautan panduan |
| Notifikasi & alarm | Notifikasi Web + alarm audio saat halaman terbuka dan data BMKG memuat gempa baru. Pilihan bunyi tiga nada, lonceng, sirine, atau denyut; volume dapat diatur. Cakupan “gempa penting” (M≥5,0 atau dirasakan) sebagai bawaan, atau semua gempa. Filter provinsi opsional; bukan push notification latar belakang |
| Tentang | Tujuan dan cakupan aplikasi, sumber data terintegrasi vs tautan referensi, perilaku privasi, versi `1.0.0`, tanggal rilis 25 Oktober 2026, pengembang, repositori publik, kontak Instagram, dan lisensi MIT |
| PWA | Manifest, ikon 192/512/maskable, apple-touch-icon, service worker di produksi (cache shell; **tidak** menyimpan `/api`) |

Tema, status koneksi, waktu pengambilan, serta atribusi sumber ada di halaman terkait. Navigasi desktop memakai sidebar; navigasi mobile memakai lima menu utama + “Lainnya”. Menu **Pengaturan** dan **Tentang Seismos Indonesia** tersedia di sidebar dan menu “Lainnya”.

## Lokasi, jarak, dan filter provinsi

- Lokasi **tidak** diminta saat halaman dibuka. Pengguna harus menekan **“Lokasi saya”** di peta atau **“Gunakan lokasi saya”** di Pengaturan. Ini memenuhi kebijakan izin browser dan menghindari permintaan lokasi yang tidak perlu.
- Titik pengguna ditampilkan sebagai marker biru beserta lingkaran akurasi. Garis putus-putus dan label jarak menghubungkan lokasi pengguna ke gempa terbaru (atau gempa yang dipilih). Setiap popup gempa juga menampilkan perkiraan jarak dari lokasi pengguna.
- Jarak dihitung dengan rumus great-circle (Haversine) dari koordinat episenter BMKG, bukan jarak jalan. Nilai akurasi berasal dari browser dan bisa lebih besar di dalam ruangan.
- Filter provinsi memakai **titik pusat perkiraan 38 provinsi** di `src/lib/provinces.ts`. Provinsi terdekat dari lokasi pengguna disimpan di `localStorage`; gempa difilter dengan provinsi terdekat dari koordinat episenter. Ini heuristik, **bukan batas administratif resmi**. Gempa di laut atau dekat perbatasan dapat masuk ke provinsi tetangga.
- Koordinat pengguna hanya diproses di browser dan tidak dikirim ke server aplikasi. Tidak ada riwayat lokasi. Penyedia geolokasi browser/OS dapat memproses data sesuai kebijakan masing-masing.

## Suara sensor

Halaman seismograf dapat mengeluarkan bunyi pendek saat grafik berubah. Bunyi dihasilkan secara lokal dengan Web Audio API:

- Amplitudo diambil dari nilai resultan `√(x² + y² + z²)` pada jendela 300 ms terakhir.
- Semakin besar amplitudo, interval bunyi semakin rapat (sekitar 650 ms saat tenang hingga 70 ms saat kuat) dan gain semakin besar.
- Suara hanya aktif saat sensor langsung berjalan dan tombol **Suara sensor** menyala. Volume dapat diatur. Data demo tidak membunyikan suara.
- Suara ini adalah umpan balik audio dari grafik, **bukan alarm gempa**, bukan analisis seismik, dan tidak menentukan magnitudo.

## Notifikasi dan alarm gempa

Notifikasi dan alarm memakai data yang sama dari `/api/earthquakes`. Setelah pengguna menekan **Aktifkan notifikasi & alarm**, aplikasi meminta izin Notification, menyimpan preferensi di `localStorage`, dan menyiapkan audio Web Audio API. Saat data baru masuk:

- Pilihan bawaan **Gempa penting** hanya memperingatkan gempa M≥5,0 atau gempa yang memiliki keterangan dirasakan/MMI. Pilihan **Semua gempa baru** tersedia bagi yang ingin mengikuti feed mentah.
- **Area peringatan** dapat diatur ke seluruh Indonesia atau hanya provinsi sekitar lokasi pengguna. Jika memilih provinsi, pengguna dapat mendeteksi provinsi dari lokasi atau memilihnya manual. Filter berlaku untuk notifikasi dan alarm.
- Jika area provinsi dipilih tetapi provinsi belum ditentukan, notifikasi wilayah tidak berjalan. Pengaturan menampilkan peringatan agar pengguna memilih provinsi.
- Alarm tiga nada hanya berbunyi untuk gempa penting yang masih baru (≤15 menit), bukan untuk setiap getaran kecil. Getaran kecil tetap dapat muncul sebagai notifikasi jika pengguna memilih “Semua gempa baru”.
- Notifikasi penting memakai `requireInteraction` agar tidak cepat hilang. Klik notifikasi membuka halaman detail kejadian.
- ID kejadian penting yang sudah dilihat disimpan, sehingga pemutakhiran data BMKG yang menambahkan keterangan “dirasakan” pada gempa yang sama dapat memicu peringatan tanpa mengulang alarm untuk kejadian yang sama.
- Getaran (vibration) dicoba pada perangkat yang mendukung. Tidak ada klaim bahwa ini sirine evakuasi resmi InaTEWS.

Batas penting: notifikasi dan alarm hanya berjalan **selama halaman aplikasi terbuka** dan tidak menggunakan push service. Browser dapat menunda polling pada tab latar belakang. Setelah halaman dimuat ulang, browser biasanya memblokir suara sampai ada interaksi pengguna; klik halaman atau tombol **Tes notifikasi & alarm** sekali untuk membuka izin audio. Ini bukan pengganti peringatan resmi BMKG/InaTEWS.

## Sumber data

### BMKG

Endpoint terbuka yang dipakai:

- `https://data.bmkg.go.id/DataMKG/TEWS/autogempa.json` — gempa terbaru
- `https://data.bmkg.go.id/DataMKG/TEWS/gempaterkini.json` — 15 gempa M 5,0+
- `https://data.bmkg.go.id/DataMKG/TEWS/gempadirasakan.json` — 15 gempa dirasakan, termasuk ringkasan MMI
- `https://cdn.bmkg.go.id/live30event.xml` — feed live InaTEWS berisi 151 kejadian terbaru pada pengujian ini
- `https://cdn.bmkg.go.id/last30feltevent.xml` — 30 gempa dirasakan terbaru dalam format CAP, dipakai untuk memperkaya keterangan dirasakan pada detail kejadian dan penanda gempa penting

Basis URL TEWS dapat diganti lewat `BMKG_BASE_URL`; host CDN live lewat `BMKG_CDN_URL`. Shakemap dimuat dari `https://static.bmkg.go.id/`.

Feed live menjadi sumber utama untuk kebaruan data karena JSON TEWS dapat tertinggal dari feed live. Feed live memuat kejadian dunia; aplikasi menyaringnya ke wilayah Indonesia (lat −12…7,5, lon 92,5…143) agar sesuai cakupan peta.

Alur: browser → `/api/earthquakes` (satu-satunya pemanggil, tiap 60 detik saat tab terlihat, dan segera setelah tab kembali aktif atau jaringan pulih) → service BMKG (timeout, 2× retry, cache memori server) → normalisasi, validasi, deduplikasi berdasarkan waktu + koordinat. Bila salah satu sumber gagal, sumber lain tetap dipakai; cache terakhir sumber tersebut **ditandai “data lama”**. Bila tidak ada cache sama sekali, UI menampilkan galat, bukan data pengganti.

Keterangan `Dirasakan` dari BMKG diurai menjadi entri MMI per wilayah di `src/lib/felt.ts` untuk metadata kejadian dan penanda gempa penting.

### MAGMA / PVMBG

Variabel lingkungan ada di `.env.example` (`MAGMA_BASE_URL`, `MAGMA_IMAGE_BASE`, `MAGMA_SITE_URL`, timeout, TTL). Endpoint ini adalah layanan publik yang dipakai situs MAGMA, bukan API dengan kontrak stabil; bentuk respons dapat berubah sewaktu-waktu. Atribusi dan ketentuan penggunaan data tetap milik PVMBG.

## Keterbatasan (jujur)

1. **Cakupan gempa bukan arsip penuh.** Feed live InaTEWS memuat 151 kejadian terbaru pada pengujian ini, ditambah 15 gempa M5+ dan 15 gempa dirasakan dari JSON TEWS. Setelah digabung dan dideduplikasi, aplikasi memuat 193 kejadian pada pengujian terakhir. “Riwayat” dan “statistik” hanya untuk jendela data itu, bukan seluruh katalog gempa Indonesia; arsip lengkap belum diintegrasikan.
2. **Keterangan dirasakan adalah ringkasan BMKG, bukan laporan mentah.** Sumbernya `gempadirasakan.json` dan 30 gempa dirasakan terbaru dari `last30feltevent.xml`. Parsing teks `Dirasakan` bersifat heuristik; format BMKG yang berubah dapat menghasilkan entri yang salah atau kosong. Tidak ada data korban/kerusakan karena sumber tidak menyediakannya.
3. **Filter provinsi adalah perkiraan.** Aplikasi memakai titik pusat provinsi terdekat, bukan poligon batas wilayah. Gempa di laut, dekat perbatasan, atau di wilayah kepulauan dapat tergolong ke provinsi tetangga. Untuk peringatan resmi, gunakan kanal BMKG.
4. **Lokasi bergantung pada izin dan kualitas GPS.** Jika izin ditolak, peta tetap berfungsi tanpa titik pengguna. Akurasi di dalam ruangan atau saat GPS lemah dapat menurun. Aplikasi tidak melacak lokasi di latar belakang.
5. **Seismogram MAGMA bergantung pada layanan sumber.** Endpoint dapat berubah/diblokir, sebagian stasiun dapat kosong, dan gambar dapat terlambat. Aplikasi tidak menafsirkan status gunung api dan bukan sistem peringatan dini.
6. **Notifikasi dan alarm hanya saat halaman terbuka.** Notification API dan Web Audio tidak berjalan di latar belakang seperti push service; browser dapat menunda polling tab latar belakang dan memblokir audio sampai ada interaksi pengguna. Izin serta perilaku berbeda antar browser. Untuk peringatan resmi 24 jam, gunakan kanal BMKG/PVMBG.
7. **PWA tidak sepenuhnya offline.** Service worker menyimpan shell dan halaman yang pernah dibuka, tetapi tidak menyimpan respons `/api`; tanpa internet data gempa dan seismogram tidak tersedia.
8. **Seismograf perangkat** hanya dapat diuji pada perangkat nyata lewat HTTPS/localhost. Perilaku DeviceMotion berbeda antar browser/perangkat; ambang kualitas (50/20 Hz, 20% tidak valid) adalah heuristik, bukan standar. Suara sensor juga bukan alarm gempa.
9. **Peta** membutuhkan internet untuk tile OpenStreetMap. Clustering marker, layer batas wilayah/lempeng, dan perbandingan periode belum ada.
10. **Belum diuji pada ponsel fisik** dalam lingkungan ini; tata letak mobile, izin sensor, lokasi, notifikasi, dan suara speaker perlu dicek di perangkat nyata.

## Pengujian yang dijalankan

- `npm run typecheck` — lolos tanpa error.
- `npm run lint` — lolos tanpa warning/error.
- `npm test` — 17 uji: parser MMI, parser XML feed InaTEWS, klasifikasi gempa penting/alarm, geometri/provinsi, dan pemetaan amplitudo ke interval/gain suara sensor.
- `npm run build` — lolos; seluruh halaman dan tiga route API ter-generate.
- Uji runtime produksi:
  - `GET /api/earthquakes` → HTTP 200, 193 kejadian gabungan dari kelima sumber.
  - `GET /api/seismograms` → HTTP 200, 167 stasiun. Route mengembalikan HTTP 502 dengan pesan error bila MAGMA tidak dapat dijangkau; kondisi ini sempat terjadi saat pengujian lalu pulih.
  - `GET /api/seismograms/{id}/image?size=thumb` → HTTP 200, PNG 400×240.
  - `/map` diperiksa di browser: gempa terbaru memiliki pulse/outline, tombol lokasi tersedia, marker pengguna, lingkaran akurasi, garis putus-putus, label jarak, dan jarak di popup muncul setelah lokasi diizinkan; filter tetap berfungsi.
  - `/seismograph` diperiksa di browser: kontrol suara/volume tersedia, status sensor dan tombol DATA DEMO tampil, tidak ada error console; audio speaker nyata belum dapat diverifikasi di lingkungan uji.
  - `/settings` diperiksa di browser: pilihan area provinsi, pemilihan provinsi manual, dan nilai area/provinsi tersimpan setelah muat ulang; izin lokasi/Notification ditolak di browser uji.
  - `/about` diperiksa di browser: tidak ada bagian metodologi/teknologi, informasi privasi baru, versi 1.0.0, tanggal rilis, repositori, kontak, dan lisensi tampil.
  - `/reports` → HTTP 404 (halaman sudah dihapus).
  - Lighthouse tidak dijalankan ulang pada verifikasi ini; skor aksesibilitas perlu dicek ulang setelah perubahan UI.
- **Belum dijalankan:** uji pada ponsel fisik, notifikasi OS/suara speaker nyata (izin Notification ditolak di browser uji), uji sensor DeviceMotion nyata, dan uji beban.

Angka runtime di atas berasal dari data sumber saat pengujian dan dapat berubah.

## Struktur

```text
src/app/                    halaman + api/earthquakes, api/seismograms
src/components/             navigation, map, charts, seismograph, notifications, pwa, ui
src/services/bmkg/          client (timeout/retry) + service (gabung/dedup)
src/services/magma/         daftar stasiun, opsi gunung api, proxy gambar
src/lib/                    validation, felt, geo, provinces, cache, csv, formatting, stats, seismograph/
src/hooks/                  EarthquakeProvider, NotificationProvider, useDeviceSeismograph, useGeolocation, useSeismicAudio
src/types/                  earthquake, seismogram
public/                     manifest, ikon PWA, service worker
scripts/                    uji parser MMI, XML feed BMKG/InaTEWS, klasifikasi alarm, dan provinsi
```

## Catatan pengembangan

- Tidak ada database. Sesi seismograf disimpan di `localStorage`; preferensi notifikasi, area/provinsi, alarm, tema, dan ID gempa penting yang sudah dilihat juga disimpan di `localStorage`.
- Semua panggilan data BMKG/MAGMA dilakukan dari server. Shakemap BMKG dan tile peta dimuat langsung oleh browser dari sumber publik.
- Format CSV menetralkan sel yang dimulai `=`, `+`, `-`, `@` untuk mencegah formula injection.
- Untuk integrasi lebih dalam, konfirmasi syarat penggunaan data ke BMKG dan PVMBG.
- Jalankan `npm run build` saat server `next start`/`next dev` tidak sedang memakai `.next`. Jika build terlihat berhasil tetapi chunk halaman hilang, hentikan server, hapus `.next`, lalu build ulang. Menjalankan server dari build yang belum lengkap dapat memicu error chunk atau hydration.
- Lisensi proyek: MIT. Data dan gambar dari BMKG, PVMBG/MAGMA, dan OpenStreetMap tetap mengikuti ketentuan sumber masing-masing.
