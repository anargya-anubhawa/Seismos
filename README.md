# Seismos Indonesia

Pemantauan gempa bumi Indonesia dan peringatan tsunami resmi BMKG/InaTEWS, peta episenter dengan lokasi pengguna, notifikasi dan alarm per wilayah, push tsunami, mitigasi, serta seismogram live gunung api dari MAGMA Indonesia (PVMBG). **Versi 2.0.0** — rilis 25 Oktober 2026.

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

Butuh Node.js 18.17+ dan akses internet: server memanggil BMKG dan MAGMA, peta memakai tile OpenStreetMap, serta font diambil dari Google Fonts saat build. Tidak ada database; push tsunami memakai layanan push milik browser/OS dan penyimpanan JSON di server.

## Fitur

| Halaman | Isi |
|---|---|
| Dashboard | Ringkasan 24 jam, gempa terbesar/terbaru, peta episenter dengan penanda gempa terbaru, ringkasan notifikasi & alarm, pintasan mitigasi, status tiap sumber |
| Peta Gempa | Leaflet, marker sesuai koordinat BMKG, ukuran/warna menurut magnitudo, pulse + outline pada gempa terbaru, tombol “Lokasi saya”, titik GPS dan lingkaran akurasi, jarak ke episenter, filter magnitudo & kedalaman, sinkron dengan daftar |
| Riwayat Gempa | Filter lokasi, tanggal (WIB), magnitudo, kedalaman, dirasakan; urutan; paginasi; ekspor CSV hasil filter; tabel (desktop) dan kartu (mobile) |
| Peringatan Tsunami | Status resmi BMKG/InaTEWS: aktif, tidak ada peringatan, atau status tidak dapat dipastikan; gempa pemicu, wilayah pesisir per tingkat (Awas/Siaga/Waspada), pembaruan PD-1…PD-4, pengamatan muka laut, peta resmi, dan ETA hanya bila dicantumkan BMKG. Detail per peringatan menampilkan linimasa pembaruan dan sumber resmi |
| Gunung Berapi | Menu berisi 12 tab: **Ringkasan** (hitungan per tingkat resmi, laporan, letusan, VONA), **Peta** persebaran di Leaflet, **Status Aktivitas** (Level I Normal–IV Awas), **Laporan Harian**, **Laporan Aktivitas** beserta rekomendasi utuh, **Riwayat Erupsi** (VEN resmi), **CCTV** (gambar snapshot berlabel waktu), **Live Seismogram**, **Peta KRB** (berkas resmi), **Gallery**, **VONA**, dan **Notifikasi**. Tersedia halaman detail per gunung api dengan sub-rute laporan/CCTV/seismogram/KRB. Kenaikan tingkat tidak pernah ditampilkan sebagai erupsi |
| Detail kejadian | Data BMKG vs yang dihitung aplikasi, peta episenter, keterangan dirasakan, shakemap BMKG bila ada, salin tautan |
| Statistik | Per hari, distribusi magnitudo dan kedalaman, magnitudo terbesar; rentang 24 jam/7/30 hari/semua |
| Seismograf Perangkat | DeviceMotion dengan feature detection dan izin (iOS), Mulai/Jeda/Lanjutkan/Berhenti/Reset, grafik canvas X/Y/Z dan resultan (m/s²), rentang waktu dan skala, laju sampling terukur, penilaian kualitas indikatif, **suara sensor yang makin cepat dan keras mengikuti amplitudo**, kontrol suara/volume, ekspor CSV, simpan hingga 5 sesi di browser, DATA DEMO berlabel bila sensor tak tersedia |
| Seismogram Gunung Api | **Pilih gunung api lebih dahulu**, baru stasiun live MAGMA untuk gunung itu ditampilkan (167 stasiun, ±57 gunung api saat pengujian), pencarian gunung, thumbnail, pratinjau penuh, pembaruan otomatis 5 menit, atribusi sumber |
| Mitigasi | Tindakan sebelum/saat/setelah gempa, panduan tsunami, tas siaga, kontak darurat, tabel MMI, tautan resmi BMKG. Tetap dapat dibuka lewat tautan di Pengaturan |
| Pengaturan | Izin notifikasi gempa, cakupan peringatan, **area seluruh Indonesia atau provinsi sekitar lokasi**, pilihan bunyi dan volume alarm, tes suara, **push tsunami terpisah**, **tautan pengaturan push gunung api**, tema terang/gelap/ikuti sistem, hapus sesi sensor, tautan panduan |
| Notifikasi & alarm | Notifikasi Web + alarm audio untuk gempa saat halaman terbuka dan data BMKG memuat gempa baru. Pilihan bunyi tiga nada, lonceng, sirine, atau denyut; volume dapat diatur. Cakupan “gempa penting” (M≥5,0 atau dirasakan) sebagai bawaan, atau semua gempa. Filter provinsi opsional; ini bukan push latar belakang untuk gempa (push tsunami memakai jalur terpisah) |
| Tentang | Tujuan dan cakupan aplikasi, sumber data terintegrasi vs tautan referensi, perilaku privasi, versi `2.0.0`, tanggal rilis 25 Oktober 2026, pengembang, repositori publik, kontak Instagram, dan lisensi MIT |
| PWA | Manifest, ikon 192/512/maskable, apple-touch-icon, service worker di produksi (cache shell; **tidak** menyimpan `/api`), penerima push tsunami dan gunung api, dan pembukaan detail dari klik notifikasi |

Tema, status koneksi, waktu pengambilan, serta atribusi sumber ada di halaman terkait. Navigasi desktop memakai sidebar; navigasi mobile memakai lima menu utama (Beranda, Peta, Riwayat, **Tsunami**, **Gunung Berapi**) + “Lainnya”. Menu **Pengaturan** dan **Tentang Seismos Indonesia** tersedia di sidebar dan menu “Lainnya”.

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

## Peringatan tsunami dan push

Halaman **Peringatan Tsunami** memakai dua sumber resmi BMKG dan **tidak** menyimpulkan tsunami dari magnitudo gempa:

- `https://cdn.bmkg.go.id/datagempa.json` — feed WRS terbaru. Bila info bukan peringatan/potensi tsunami, feed tetap dianggap sehat tetapi tidak menghasilkan alert.
- `https://www.bmkg.go.id/gempabumi/berpotensi-tsunami` — 30 pembaruan peringatan tsunami terbaru (termasuk PD-4/berakhir). Halaman ini memakai payload `__NUXT_DATA__`, sehingga server mendekode referensi Nuxt sebelum membaca `info`.

Server memeriksa feed WRS setiap 60 detik dan riwayat setiap 300 detik (dapat diubah lewat env), ditambah pemeriksaan saat API dibuka dan endpoint cron. Data disimpan sebagai JSON atomik di `TSUNAMI_DATA_DIR` (default `.data/tsunami`, tanpa database):

- ID peringatan dibuat deterministik dari waktu gempa awal + koordinat, sehingga revisi koordinat/magnitudo BMKG tidak membuat duplikat. Pembaruan dicocokkan lewat `eventid` atau waktu gempa (±3 menit), jarak episenter (≤100 km), dan selisih magnitudo (≤1,5). Gempa susulan yang berbeda tidak digabung.
- Pembaruan yang lebih baru menggantikan data lama; PD-4 atau teks “dinyatakan berakhir” menandai peringatan berakhir. Wilayah dan pengamatan terakhir dipertahankan bila pembaruan penutup tidak merinci ulang.
- Notifikasi push hanya dibuat untuk peringatan tsunami baru, pembaruan resmi yang isinya berubah, atau pernyataan berakhir. Backlog riwayat lama yang sudah berakhir tidak memicu push; peringatan yang masih aktif saat pertama kali diimpor dapat memicu satu notifikasi.
- Antrean notifikasi disimpan di server dan dicoba ulang maksimal lima kali. Push yang ditolak permanen (`404`/`410`) menghapus langganan mati.

Push tsunami **terpisah** dari notifikasi gempa lokal di atas. Keduanya memakai Service Worker yang sama, tetapi push tsunami dikirim server dan dapat muncul saat halaman tertutup bila browser/OS mengizinkan. Notifikasi memuat subjek resmi, status/fase, waktu terbit, ringkasan gempa, wilayah per provinsi/tingkat, ringkasan resmi, dan tautan detail. Klik notifikasi membuka `/tsunami/{id}` yang sesuai.

Mengaktifkan push memerlukan HTTPS (atau `localhost`), izin Notification, dan browser yang mendukung Push API. Kunci VAPID diambil dari `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`; bila kosong, server membuat pasangan kunci sekali dan menyimpannya di `TSUNAMI_DATA_DIR`. Hanya kunci publik yang dikirim ke browser. Gunakan `TSUNAMI_MONITOR_SECRET` untuk melindungi endpoint cron, dan arahkan cron eksternal ke `POST /api/tsunami/monitor` bila proses server tidak hidup terus-menerus.

Status halaman dibedakan dengan sengaja: **aktif** bila BMKG mencantumkan peringatan aktif; **tidak ada** hanya bila riwayat BMKG baru saja berhasil diperiksa dan tidak memuat peringatan aktif; **tidak dapat dipastikan** bila sumber gagal/tertunda. Kegagalan sumber tidak pernah ditampilkan sebagai “aman”. ETA per wilayah hanya ditampilkan bila BMKG menyediakannya; `ttmap` adalah peta waktu tempuh resmi, bukan ETA per daerah.

## Gunung berapi (MAGMA / PVMBG)

Menu **Gunung Berapi** menampilkan data pemantauan gunung api resmi dari MAGMA Indonesia (PVMBG, Badan Geologi, KESDM). Setiap halaman menyatakan sumbernya dan tidak menambahkan prakiraan sendiri.

Tab yang tersedia (semua didukung data MAGMA yang terverifikasi):

| Tab | Sumber | Catatan |
| --- | --- | --- |
| Ringkasan | `/home/maps`, `/var/list`, `/ven/list`, `/vona/list` | Hitungan per tingkat, laporan, letusan, VONA terbaru |
| Peta | `/home/maps` | Leaflet + ubin OSM, koordinat resmi |
| Status Aktivitas | `/home/maps` | Nomenklatur resmi Level I–IV |
| Laporan Harian | `/volcano/latest-daily-var`, `/volcano/daily-var?date=` | Laporan harian per gunung api |
| Laporan Aktivitas | `/var/list`, `/var/{id}/detail` | VAR per periode, rekomendasi utuh |
| Riwayat Erupsi | `/ven/list`, `/ven/{id}/detail` | Hanya informasi letusan resmi |
| CCTV | `/cctv/list` | **Gambar snapshot**, bukan video |
| Live Seismogram | `/seismometer/list` | Halaman lama `/volcano-seismogram` tetap berfungsi |
| Peta KRB | `/volcano/krb` | Berkas gambar resmi; poligon tidak tersedia |
| Gallery | `/volcano/gallery?search=` | Dokumentasi visual resmi |
| VONA | `/vona/list` | Kode warna ICAO |
| Notifikasi | push server | Perubahan tingkat, letusan, VONA |

Status aktivitas memakai nomenklatur resmi dan selalu disertai teks — tidak mengandalkan warna saja: **Level I Normal**, **Level II Waspada**, **Level III Siaga**, **Level IV Awas**. **Kenaikan tingkat aktivitas bukan bukti erupsi**; notifikasi erupsi hanya dibuat dari informasi letusan (VEN) resmi atau VONA baru.

### Sinkronisasi dan sumber

Server mengambil data dari `MAGMA_BASE_URL` (default `https://magma.esdm.go.id/_api`) dengan cache singkat di memori (`MAGMA_CACHE_TTL_SECONDS`), lalu menandai data lama bila pengambilan gagal. Endpoint yang dipakai:

- `/home/maps` — 69 gunung api dengan `status` 1–4, `status_label`, koordinat, `has_vona`/`has_ven`
- `/var/list`, `/var/{id}/detail` — laporan aktivitas (total >200.000)
- `/volcano/latest-daily-var`, `/volcano/daily-var?date=YYYY-MM-DD` — laporan harian
- `/ven/list`, `/ven/{id}/detail` — informasi letusan
- `/vona/list` — VONA
- `/cctv/list?size=200` — 102 kamera
- `/volcano/krb?size=100` — 69 berkas peta
- `/volcano/gallery?search=` — gallery (hanya mendukung pencarian teks)
- `/volcano-activity/histories-by-volcano?volcano_id=` — riwayat perubahan tingkat
- `/seismometer/list` — stasiun seismograf

Pagination memakai `page` sebagai pengali offset (`offset = page × size`); parameter filter lain diabaikan API sumber, sehingga penyaringan gunung api/tanggal dilakukan di server setelah pengambilan. Gambar (visual, gallery, CCTV, KRB) diproksi lewat `/api/volcano/image` dan `/api/volcano/krb/{id}/file` karena host gambar MAGMA menolak permintaan tanpa User-Agent/Referer wajar; proxy membatasi host ke domain MAGMA dan ukuran berkas (`MAGMA_IMAGE_MAX_BYTES`, default 40 MB).

### Notifikasi push gunung api

Push gunung api memakai **infrastruktur yang sama** dengan push tsunami: Service Worker (`public/sw.js`), kunci VAPID, dan satu langganan browser. Beda hanya topiknya (`levelChange`, `eruption`, `vona`, `recommendation`). Karena tidak ada feed push/CAP publik dari MAGMA, server memeriksa sumber resmi secara berkala (`VOLCANO_POLL_SECONDS`, default 300 detik) dan:

- **Pemeriksaan pertama hanya menyediakan dasar** — backlog lama tidak dikirim sebagai notifikasi.
- Perubahan tingkat dibandingkan dengan status terakhir yang diproses; ID sumber yang sudah diproses dicatat agar tidak terkirim ganda.
- Letusan hanya dari VEN yang belum pernah diproses; perubahan tingkat tidak pernah diklasifikasikan sebagai erupsi.
- Antrean disimpan di server dan dicoba ulang hingga lima kali; langganan mati (`404`/`410`) dihapus otomatis.
- Kategori dihormati saat disimpan: mematikan kategori tidak akan diam-diam diaktifkan kembali.

Kunci VAPID dipakai bersama file `.data/tsunami/vapid.json` (atau `$TSUNAMI_DATA_DIR/vapid.json`), sehingga satu langganan browser melayani notifikasi tsunami dan gunung api.

### Batasan yang disengaja

- **CCTV adalah gambar statis.** MAGMA tidak menerbitkan stream video publik. Pada pengujian, median gambar berumur ±61 jam (maksimum ratusan hari), jadi waktu pengambilan selalu ditampilkan dan tersedia filter “hanya ≤24 jam”. Gambar dimuat saat terlihat (IntersectionObserver) agar tidak mengunduh puluhan gambar sekaligus.
- **Peta KRB hanya berkas gambar.** Layanan fitur ArcGIS KRB milik MAGMA membalas `Token Required`, sehingga poligon tidak dapat dipakai publik. Aplikasi menampilkan peta resmi apa adanya beserta tautan/unduhan sumber, dan **tidak** menggambar batas zona sendiri. Berkas KRB bisa puluhan MB, jadi pratinjau diambil lewat server.
- **Gallery tidak punya metadata kaya.** API hanya mendukung `search=`; keterangan/lokasi foto tidak diterbitkan sehingga tidak dikarang. Tanggal diambil dari nama berkas sumber.
- **Riwayat erupsi dibatasi** pada informasi letusan terbaru dari API publik, bukan arsip geologi penuh.
- **Beberapa gunung api tidak punya kamera/stasiun.** Mis. Merapi tidak muncul pada daftar CCTV maupun seismometer MAGMA; halaman detail menampilkan keadaan kosong yang jelas beserta tautan sumber, bukan data pengganti.

## Sumber data

### BMKG

Endpoint terbuka yang dipakai:

- `https://data.bmkg.go.id/DataMKG/TEWS/autogempa.json` — gempa terbaru
- `https://data.bmkg.go.id/DataMKG/TEWS/gempaterkini.json` — 15 gempa M 5,0+
- `https://data.bmkg.go.id/DataMKG/TEWS/gempadirasakan.json` — 15 gempa dirasakan, termasuk ringkasan MMI
- `https://cdn.bmkg.go.id/live30event.xml` — feed live InaTEWS berisi 151 kejadian terbaru pada pengujian ini
- `https://cdn.bmkg.go.id/last30feltevent.xml` — 30 gempa dirasakan terbaru dalam format CAP, dipakai untuk memperkaya keterangan dirasakan pada detail kejadian dan penanda gempa penting
- `https://cdn.bmkg.go.id/datagempa.json` — feed WRS terbaru untuk peringatan/potensi tsunami (`info.subject`, `potential`, `wzarea`, `obsarea`, peta resmi)
- `https://www.bmkg.go.id/gempabumi/berpotensi-tsunami` — 30 pembaruan peringatan tsunami terbaru, termasuk PD-4/berakhir

Basis URL TEWS dapat diganti lewat `BMKG_BASE_URL`; host CDN live lewat `BMKG_CDN_URL`. Shakemap dimuat dari `https://static.bmkg.go.id/`. URL kedua sumber tsunami dapat diganti lewat `TSUNAMI_DATAGEMPA_URL` dan `TSUNAMI_HISTORY_URL`.

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
6. **Notifikasi dan alarm gempa hanya saat halaman terbuka.** Notification API dan Web Audio untuk gempa tidak berjalan di latar belakang seperti push service; browser dapat menunda polling tab latar belakang dan memblokir audio sampai ada interaksi pengguna. Push tsunami memakai jalur server yang berbeda dan dapat bekerja saat halaman tertutup, tetapi tetap bergantung pada izin, browser, OS, dan koneksi. Izin serta perilaku berbeda antar browser. Untuk peringatan resmi 24 jam, gunakan kanal BMKG/PVMBG.
7. **PWA tidak sepenuhnya offline.** Service worker menyimpan shell dan halaman yang pernah dibuka, tetapi tidak menyimpan respons `/api`; tanpa internet data gempa, tsunami, dan seismogram tidak tersedia. Push juga memerlukan koneksi data.
8. **Seismograf perangkat** hanya dapat diuji pada perangkat nyata lewat HTTPS/localhost. Perilaku DeviceMotion berbeda antar browser/perangkat; ambang kualitas (50/20 Hz, 20% tidak valid) adalah heuristik, bukan standar. Suara sensor juga bukan alarm gempa.
9. **Peta** membutuhkan internet untuk tile OpenStreetMap. Clustering marker, layer batas wilayah/lempeng, dan perbandingan periode belum ada.
10. **Belum diuji pada ponsel fisik** dalam lingkungan ini; tata letak mobile, izin sensor, lokasi, notifikasi, dan suara speaker perlu dicek di perangkat nyata.
11. **Riwayat tsunami bukan arsip penuh.** Halaman BMKG memuat 30 pembaruan terbaru; aplikasi menyimpan peringatan aktif dan peringatan berakhir hingga `TSUNAMI_RETENTION_DAYS` (default 90 hari). Peringatan yang lebih lama dapat hilang dari tampilan.
12. **ETA dan wilayah mengikuti apa yang ditulis BMKG.** Tidak ada perhitungan ETA atau tinggi gelombang oleh aplikasi. `ttmap` adalah peta waktu tempuh resmi, bukan ETA per wilayah. Bila BMKG tidak merinci ulang wilayah pada PD-4, aplikasi menampilkan wilayah resmi terakhir beserta waktunya.
13. **Push tsunami belum diuji sampai layar OS nyata di lingkungan ini.** Pengujian di sini mencakup API, penyimpanan langganan, payload, dan UI; pengiriman ke perangkat memerlukan langganan browser nyata, HTTPS, serta izin Notification. Penyimpanan `.data/tsunami` juga harus persisten; pada serverless tanpa volume, dedupe, antrean, dan langganan dapat hilang saat instance berganti.
14. **Push gunung api juga belum diuji sampai layar OS nyata.** Yang terverifikasi adalah konfigurasi VAPID bersama, validasi langganan, penyaringan kategori (idempoten), penyimpanan topik, dan penolakan endpoint palsu oleh penyedia push. Pengiriman nyata memerlukan HTTPS + langganan browser asli.
15. **CCTV MAGMA adalah snapshot, bukan video langsung.** Median kebaruan gambar pada pengujian ±61 jam. Kamera yang tidak aktif akan menampilkan gambar lama; UI menampilkan waktunya dan menyediakan tautan sumber, bukan menyimpulkan kondisi terkini.
16. **Peta KRB tidak berupa poligon.** Batas zona hanya tersedia sebagai berkas gambar/PDF resmi; layanan fitur KRB MAGMA memerlukan token. Aplikasi tidak menggambar ulang batas dan tidak melakukan analisis spasial.
17. **Riwayat erupsi dan gallery tidak lengkap.** VEN hanya memuat informasi letusan terbaru, dan gallery hanya dapat dicari lewat teks tanpa metadata keterangan. Seismos tidak mengarang entri untuk menutupi kekosongan ini.
18. **Sebagian gunung api tidak memiliki kamera/stasiun seismograf di MAGMA** (mis. Merapi). Data yang tidak diterbitkan sumber ditampilkan sebagai keadaan kosong, bukan ditebak.

## Pengujian yang dijalankan

- `npm run typecheck` — lolos tanpa error.
- `npm run lint` — lolos tanpa warning/error (termasuk seluruh komponen Gunung Berapi).
- `npm test` — 53 uji: parser MMI, parser XML feed InaTEWS, klasifikasi gempa penting/alarm, geometri/provinsi, pemetaan amplitudo ke interval/gain suara sensor, 13 uji tsunami, dan 23 uji gunung api (parsing tingkat 1–4 & label resmi, normalisasi status/VAR/VEN/VONA/CCTV/KRB/gallery, riwayat perubahan tingkat, dedupe + klasifikasi notifikasi, deteksi perubahan tingkat tanpa erupsi palsu, pencocokan stasiun seismograf, dan penyaringan kategori push yang idempoten).
- `npm run build` — lolos; seluruh halaman dan route API ter-generate, termasuk 17 route `/api/volcano/*` dan seluruh halaman `/gunung-berapi/*`.
- Uji runtime produksi (data sumber saat pengujian; angka dapat berubah):
  - `GET /api/volcano/status` → HTTP 200, 69 gunung api (42 Normal, 24 Waspada, 3 Siaga, 0 Awas), koordinat resmi, tidak stale.
  - `GET /api/volcano/overview` → HTTP 200, 12 laporan aktivitas, 10 informasi letusan, 8 VONA, 0 error.
  - `GET /api/volcano/volcano/{code}` → HTTP 200; jumlah kamera/stasiun/riwayat per gunung api cocok dengan daftar global (Semeru 7 kamera/3 stasiun/7 riwayat; Anak Krakatau 5/5/12; Ibu 4/5/9). Kode tidak dikenal → 404.
  - `GET /api/volcano/cameras` → 102 kamera (38 gunung api); `GET /api/volcano/krb` → 69 peta; `GET /api/volcano/gallery` → foto resmi; `GET /api/volcano/vona` → VONA (mis. Semeru/ORANGE); `GET /api/volcano/erupsi` → VEN resmi.
  - `GET /api/volcano/laporan` (aktivitas & `kind=harian`) → 200 dengan laporan terkini; detail laporan/VEN → 200; ID tidak ada → **404** (bukan 502), karena MAGMA membalas HTTP 400 untuk ID tak dikenal dan itu dipetakan ke “tidak ditemukan”.
  - Proxy gambar: URL non-MAGMA → 400, skema `http:` → 400, gambar MAGMA asli → 200 `image/png`; berkas KRB 1,9 MB → 200 `image/jpeg` dengan `Content-Disposition: attachment`.
  - `POST /api/volcano/monitor` tanpa/secret salah → 401; dengan `Authorization: Bearer` maupun header `x-volcano-secret` → 200. Dijalankan dua kali berturut-turut: `changed: 0`, tanpa duplikat.
  - Baseline notifikasi: setelah pemeriksaan pertama, 69 tingkat tercatat (`seeded`) dan **0 notifikasi** — backlog tidak dikirim.
  - `GET /api/volcano/push/config` → kunci publik **sama persis** dengan kunci VAPID tsunami (satu langganan untuk dua topik).
  - `POST /api/volcano/push/subscribe` → 200 dengan topik tersimpan apa adanya dan dibaca balik identik; body tidak valid → 400; endpoint palsu ditolak penyedia push (502) tanpa crash.
  - Seluruh halaman `/gunung-berapi` (+ `/peta`, `/status`, `/laporan`, `/laporan-harian`, `/erupsi`, `/cctv`, `/seismogram`, `/krb`, `/gallery`, `/vona`, `/notifikasi`, `/[kode]` dan sub-rutenya) serta `/volcano-seismogram` → HTTP 200. Halaman gempa, tsunami, seismograf, pengaturan, statistik, dan mitigasi tetap 200.
- **Belum dijalankan:** uji pada ponsel fisik, pengiriman push sampai notifikasi OS/klik nyata (memerlukan langganan browser dan HTTPS), suara speaker nyata, uji sensor DeviceMotion nyata, uji beban, dan audit Lighthouse.

Angka runtime di atas berasal dari data sumber saat pengujian dan dapat berubah.

## Struktur

```text
src/app/                    halaman + api/earthquakes, api/seismograms, api/tsunami/*, api/volcano/*
src/app/gunung-berapi/      Ringkasan, peta, status, laporan (harian/aktivitas), erupsi, cctv, seismogram, krb, gallery, vona, notifikasi, [kode]
src/components/             navigation, map, charts, seismograph, notifications, pwa, tsunami, volcano, ui
src/services/bmkg/          client (timeout/retry) + service (gabung/dedup)
src/services/magma/         daftar stasiun, opsi gunung api, proxy gambar, klien volcano (cached)
src/services/tsunami/       pengambilan feed WRS + halaman riwayat BMKG
src/lib/tsunami/            parser, Nuxt decoder, identitas/dedupe, penyimpanan JSON, push, monitor
src/lib/volcano/            normalisasi MAGMA, layanan, penyimpanan JSON, push (VAPID bersama), monitor
src/lib/                    validation, felt, geo, provinces, cache, csv, formatting, stats, seismograph/
src/hooks/                  EarthquakeProvider, NotificationProvider, useTsunami, useTsunamiPush, useVolcano, useVolcanoPush, useDeviceSeismograph, useGeolocation, useSeismicAudio
src/types/                  earthquake, seismogram, tsunami, volcano, volcano-ui
src/instrumentation.ts      memulai pemantau tsunami + gunung api di runtime Node
public/                     manifest, ikon PWA, service worker (cache + push tsunami & gunung api)
scripts/                    uji parser MMI, XML feed BMKG/InaTEWS, klasifikasi alarm, provinsi, tsunami, dan gunung api
```

## Catatan pengembangan

- Tidak ada database. Sesi seismograf disimpan di `localStorage`; preferensi notifikasi, area/provinsi, alarm, tema, dan ID gempa penting yang sudah dilihat juga disimpan di `localStorage`. Status tsunami, antrean push, langganan, dan kunci VAPID disimpan sebagai JSON di `TSUNAMI_DATA_DIR` (default `.data/tsunami`) dan **tidak** masuk git.
- Semua panggilan data BMKG/MAGMA dilakukan dari server. Shakemap BMKG dan tile peta dimuat langsung oleh browser dari sumber publik.
- Next.js 14 mengompilasi `instrumentation.ts` untuk Node dan Edge. Pemantau tsunami hanya berjalan di Node; build Edge memakai stub `src/lib/tsunami/monitor.edge.ts` lewat `next.config.mjs`, dan `web-push` dieksternalkan agar modul `node:*` tidak ikut dibundel.
- Untuk produksi, set `TSUNAMI_DATA_DIR` ke volume persisten, isi `TSUNAMI_MONITOR_SECRET`, dan gunakan HTTPS. Bila memakai VAPID env, pastikan pasangan kunci valid; bila tidak, server membuat dan menyimpan kuncinya sekali. Jangan pernah mengekspos `VAPID_PRIVATE_KEY` ke browser.
- Format CSV menetralkan sel yang dimulai `=`, `+`, `-`, `@` untuk mencegah formula injection.
- Untuk integrasi lebih dalam, konfirmasi syarat penggunaan data ke BMKG dan PVMBG.
- Jalankan `npm run build` saat server `next start`/`next dev` tidak sedang memakai `.next`. Jika build terlihat berhasil tetapi chunk halaman hilang, hentikan server, hapus `.next`, lalu build ulang. Menjalankan server dari build yang belum lengkap dapat memicu error chunk atau hydration.
- Lisensi proyek: MIT. Data dan gambar dari BMKG, PVMBG/MAGMA, dan OpenStreetMap tetap mengikuti ketentuan sumber masing-masing.
