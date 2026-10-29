# RUNBOOK OPERASIONAL — SEISMOS INDONESIA

Panduan singkat untuk operator: apa yang dipantau, apa yang dilakukan bila monitor
berhenti, cara mencadangkan data, dan cara memutar kunci VAPID.

Semua perintah mengasumsikan aplikasi berjalan sebagai satu proses Next.js dengan
direktori kerja di akar repositori. Sesuaikan bila Anda memakai container.

Dokumen terkait: [RELEASE_NOTES.md](./RELEASE_NOTES.md) ·
[audit/RELEASE_CHECKLIST.md](./audit/RELEASE_CHECKLIST.md) §3 (konfigurasi produksi).

---

## 1. Yang perlu dipantau

| Yang dipantau | Cara memeriksa | Ambang waspada |
|---|---|---|
| Aplikasi hidup | `curl -f -s -o /dev/null http://127.0.0.1:3000/` | Gagal 2× berturut-turut |
| Kesehatan sumber | `GET /api/health` → `failedCount` | `failedCount > 0` lebih dari 15 menit |
| Monitor gunung api | `GET /api/volcano/monitor` → `lastCheckAt` | Tidak bertambah lebih dari 10 menit |
| Monitor tsunami | Lihat status di `GET /api/tsunami` → `checkedAt` | Tidak bertambah lebih dari 10 menit |
| Ruang disk | `df -h` pada direktori data | < 20% tersisa |
| Kunci VAPID | `GET /api/volcano/push/config` → `enabled` | `enabled:false` |

`/api/health` adalah endpoint publik tanpa rahasia dan aman dipanggil monitoring.

### Arti kode status

| Kode | Arti | Tindakan |
|---|---|---|
| `200` | Normal | — |
| `207` | Sebagian sumber gagal (`/api/volcano/health`) | Periksa sumber yang `error` tidak null; biasanya sementara |
| `429` | Kena pembatas laju | Normal bila memang banyak permintaan; bila bukan, naikkan batas atau tambahkan `TRUST_PROXY_HEADERS` |
| `502` | Sumber hulu gagal | Tunggu; bila menetap, cek status layanan BMKG/MAGMA |
| `503` | Konfigurasi belum lengkap (mis. kunci VAPID tidak dapat dibuat) | Lihat bagian 5 |

---

## 2. Bila monitor berhenti

### 2.1 Memeriksa

```
# Apakah monitor masih berjalan?
curl -s -H "authorization: Bearer $VOLCANO_MONITOR_SECRET" \
  http://127.0.0.1:3000/api/volcano/monitor | head -c 400
```

Lihat `lastCheckAt` dan `errors`. Bila `errors` tidak kosong, bagian itu menyebut sumber
yang gagal.

### 2.2 Memicu pemeriksaan manual

```
curl -s -X POST -H "authorization: Bearer $VOLCANO_MONITOR_SECRET" \
  http://127.0.0.1:3000/api/volcano/monitor
```

Pemicu manual tunduk pada pembatas laju (20 permintaan/menit) — jangan mengulang cepat.

### 2.3 Mematikan monitor sementara

Berguna saat sumber hulu sedang bermasalah dan Anda tidak ingin log penuh galat:

```
VOLCANO_MONITOR_DISABLED=1
TSUNAMI_MONITOR_DISABLED=1
```

Setel ke `1` lalu mulai ulang proses. Setel kembali ke `0` setelah selesai — **jangan
dibiarkan mati**, karena notifikasi berhenti tanpa peringatan.

### 2.4 Bila rahasia monitor belum disetel

`VOLCANO_MONITOR_SECRET` dan `TSUNAMI_MONITOR_SECRET` **wajib** disetel di produksi.
Tanpa keduanya, `POST` pada kedua endpoint monitor **terbuka** — siapa pun dapat memicu
pemeriksaan. Ini perilaku lama yang belum diubah; lihat
[audit/SECURITY_AUDIT.md](./audit/SECURITY_AUDIT.md) §2.

```
# Buat rahasia acak yang panjang
openssl rand -hex 32
```

---

## 3. Data yang disimpan, dan pencadangan

| Lokasi | Isi | Boleh hilang? |
|---|---|---|
| `$TSUNAMI_DATA_DIR` (bawaan `.data/tsunami`) | `state.json`, `subscriptions.json`, `vapid.json` | `vapid.json` **tidak** — kehilangannya membuat semua langganan tidak berlaku |
| `$VOLCANO_DATA_DIR` (bawaan `.data/volcano`) | `state.json`, `subscriptions.json` | Ya, tetapi pengguna harus berlangganan ulang |

### 3.1 Mencadangkan

```
# Saatkan dulu (salinan berkas saat ditulis bisa rusak)
tar -czf seismos-data-$(date +%F).tar.gz .data/tsunami .data/volcano
```

Simpan salinan di luar server. `vapid.json` adalah kunci privat perangkat notifikasi:
perlakukan sebagai rahasia.

### 3.2 Memulihkan

```
systemctl stop seismos            # atau hentikan proses apa pun yang menjalankannya
tar -xzf seismos-data-2026-01-01.tar.gz
systemctl start seismos
```

Pastikan pemilik berkas sesuai pengguna proses aplikasi. Setelah pulih, periksa
`/api/volcano/monitor` dan `/api/health`.

### 3.3 Volume persisten

Bila memakai container, `.data/` **wajib** berada di volume persisten. Tanpa itu,
setiap pembuatan ulang container menghapus seluruh langganan push dan kunci VAPID.

---

## 4. Memutar ulang langganan pengguna

Langganan terikat pada endpoint peramban. Bila pengguna melaporkan "tidak menerima
notifikasi":

1. Minta pengguna membuka halaman Notifikasi dan memeriksa izin peramban.
2. Bila izin dicabut, aktifkan ulang — langganan baru akan dibuat.
3. Bila server mengganti kunci VAPID, **semua** langganan lama tidak berlaku dan setiap
   pengguna harus mengaktifkan ulang. Karena itu jangan memutar kunci tanpa alasan.

Membersihkan seluruh langganan (tindakan destruktif — minta konfirmasi tertulis lebih
dulu):

```
# Hentikan aplikasi, lalu:
rm -f .data/volcano/subscriptions.json .data/tsunami/subscriptions.json
# Mulai ulang. Semua pengguna perlu berlangganan ulang.
```

---

## 5. Kunci VAPID

### 5.1 Membuat kunci baru

```
npx web-push generate-vapid-keys
```

Setel `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, dan `VAPID_SUBJECT` (URL atau
`mailto:`) di lingkungan produksi.

### 5.2 Bila tidak disetel

Server **menggenerate** pasangan kunci dan menyimpannya di `.data/tsunami/vapid.json`.
Push tetap berfungsi, tetapi kunci itu hilang bila data dir tidak persisten, dan tidak
dapat dipulihkan. Untuk produksi, setel kunci lewat env.

### 5.3 Kunci tidak sah

Sejak validasi kriptografis ditambahkan, kunci yang salah bentuk **ditolak** dengan pesan
di log dan `/api/volcano/push/config` membalas `503 {"enabled":false,…}`. Periksa bahwa
kunci disalin utuh (publik 65 byte, privat 32 byte setelah decode).

### 5.4 Memutar kunci (mengharuskan langganan ulang)

1. Buat pasangan baru.
2. Setel env, mulai ulang.
3. Hapus `subscriptions.json` pada kedua data dir (lihat §4).
4. Umumkan ke pengguna bahwa mereka perlu mengaktifkan notifikasi lagi.

---

## 6. Reverse proxy

Aplikasi memakai pembatas laju in-memory. Untuk perlindungan penuh, batasi juga di proxy:

```
# nginx — contoh
client_max_body_size 64k;
limit_req_zone $binary_remote_addr zone=seismos:10m rate=30r/s;
```

Setel `TRUST_PROXY_HEADERS=1` **hanya** bila aplikasi benar-benar berada di belakang
proxy tepercaya. Bila `1` tanpa proxy, `x-forwarded-for` dapat dipalsukan dan pembatas
laju dilewati.

---

## 7. Saat 3 pagi: urutan pemeriksaan cepat

1. `curl -f http://127.0.0.1:3000/` — aplikasi hidup?
2. `curl -s /api/health | grep failedCount` — sumber mana yang gagal?
3. `df -h` — disk penuh?
4. Cek log proses: galat berulang atau satu kali?
5. Bila sumber hulu (BMKG/MAGMA) bermasalah: tidak ada yang perlu diperbaiki di sisi kita;
   data basi akan ditandai di antarmuka. Catat dan pantau.
6. Bila aplikasi mati: mulai ulang, lalu pastikan `/api/volcano/monitor` kembali bertambah.

---

## 8. Yang tidak dicakup runbook ini

- Uji perangkat dan push nyata (lihat [audit/RELEASE_CHECKLIST.md](./audit/RELEASE_CHECKLIST.md) §2).
- Pemulihan bencana lintas wilayah.
- Rotasi rahasia otomatis.

Dokumen ini tidak menggantikan pemantauan eksternal. Bila tidak ada yang memeriksa
aplikasi ini, gangguan akan diketahui dari pengguna, bukan dari sistem.
