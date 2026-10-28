import type { VolcanoLevel } from '@/types/volcano';

/**
 * Siaran langsung YouTube resmi untuk pemantauan gunung api.
 *
 * Daftar ini sengaja disimpan di aplikasi, bukan diambil dari API: kanal
 * penyedia belum tentu menyediakan endpoint publik, dan ID video harus tetap
 * dapat diperiksa manusia. Setiap entri menunjuk satu kanal resmi (Badan
 * Geologi/PVMBG atau komunitas pemantau) — bukan siaran yang dikarang.
 *
 * Catatan: ID video bisa berhenti berlaku bila penyedia memulai ulang siaran.
 * Bila itu terjadi, ganti `videoId` saja; sisanya (judul, gunung, deskripsi)
 * tetap relevan.
 */
export interface VolcanoLiveStream {
  /** ID video YouTube (bagian setelah `/live/` atau `watch?v=`). */
  videoId: string;
  /** Nama gunung api yang dipantau siaran ini. */
  volcano: string;
  title: string;
  /** Kanal penyedia siaran. */
  channel: string;
  /** Tingkat aktivitas gunung saat data ini ditulis, bila diketahui. */
  level: VolcanoLevel | null;
  /** Letak administratif gunung. */
  location: string;
  /**
   * Penjelasan singkat gunung api: karakter letusan, riwayat penting, dan apa
   * yang terlihat pada kamera. Ditulis dari fakta PVMBG yang terbuka untuk
   * umum, tanpa menambahkan prediksi.
   */
  description: string;
  /** Hal yang perlu diperhatikan saat menonton siaran. */
  watchingTips: string;
  /** Halaman resmi yang bisa dipakai memeriksa status terbaru. */
  statusUrl: string;
}

const PVMBG_STATUS = 'https://magma.esdm.go.id/v1/gunung-api/tingkat-aktivitas';

export const LIVE_STREAMS: VolcanoLiveStream[] = [
  {
    videoId: 'hc3m__hH5PY',
    volcano: 'Merapi',
    title: 'Gunung Merapi Activity Live Streaming Badan Geologi',
    channel: 'Badan Geologi',
    level: 3,
    location: 'Perbatasan Daerah Istimewa Yogyakarta dan Jawa Tengah',
    description:
      'Merapi adalah gunung api teraktif di Indonesia dengan letusan efusif yang membentuk kubah lava di puncak '
      + 'sejak 2020. Ketika kubah lava tumbuh, material yang tidak stabil bisa runtuh menjadi guguran lava pijar dan '
      + 'awan panas ke arah barat daya (Kali Bebeng, Krasak, Boyong) maupun barat (Kali Sat, Senowo). Pemantauan '
      + 'visual memakai kamera pos pengamatan untuk melihat pertumbuhan kubah, guguran, dan tinggi kolom asap.',
    watchingTips:
      'Guguran lava pijar biasanya terlihat jelas pada malam hari. Kondisi malam yang berkabut dapat menutupi '
      + 'puncak, sedangkan siang hari dengan langit cerah lebih baik untuk melihat bentuk kubah lava.',
    statusUrl: PVMBG_STATUS,
  },
  {
    videoId: '8X7gHBhD1Tw',
    volcano: 'Merapi',
    title: 'LIVE: Merapi (Sleman, Magelang, Boyolali, Klaten, D.I.Yogyakarta dan Jawa Tengah)',
    channel: 'Induk Frekom_86',
    level: 3,
    location: 'Perbatasan Daerah Istimewa Yogyakarta dan Jawa Tengah',
    description:
      'Siaran alternatif Gunung Merapi dari komunitas pemantau. Bermanfaat sebagai sudut pandang tambahan: '
      + 'bila kamera resmi sedang kabur atau bergeser, siaran komunitas dari arah Sleman–Magelang dapat '
      + 'memperlihatkan puncak dari sisi lain. Status resmi tetap mengikuti PVMBG, bukan siaran ini.',
    watchingTips:
      'Karena dikelola perorangan, jadwal siaran bisa terputus tanpa pemberitahuan. Gunakan sebagai pelengkap, '
      + 'bukan pengganti kanal resmi Badan Geologi.',
    statusUrl: PVMBG_STATUS,
  },
  {
    videoId: 'CwsDCVlxi28',
    volcano: 'Bromo',
    title: 'Bromo Activity Live Streaming Badan Geologi',
    channel: 'Badan Geologi',
    level: 2,
    location: 'Kabupaten Probolinggo, Pasuruan, dan Malang, Jawa Timur',
    description:
      'Bromo adalah gunung api bertipe strato dengan kawah berukuran lebar dan sering mengeluarkan asap putih '
      + 'tipis, kadang berwarna kelabu. Letusan Bromo umumnya eksplosif kecil dengan lontaran material pijar di '
      + 'sekitar kawah dan abu yang terbawa angin. Kamera resmi mengarah ke kawah, sehingga perubahan warna dan '
      + 'tinggi asap dapat diamati langsung.',
    watchingTips:
      'Perhatikan warna dan tinggi asap: asap putih tipis lazim, sedangkan asap pekat kelabu atau hitam disertai '
      + 'lontaran material perlu dicocokkan dengan keterangan resmi PVMBG.',
    statusUrl: PVMBG_STATUS,
  },
  {
    videoId: 'ZLf_mo0vG7g',
    volcano: 'Sinabung',
    title: 'Gunung Sinabung Activity Live Streaming Badan Geologi',
    channel: 'Badan Geologi',
    level: 2,
    location: 'Kabupaten Karo, Sumatra Utara',
    description:
      'Sinabung kembali aktif sejak 2010 setelah lama tertidur, dan sejak itu kerap menerbitkan guguran lava '
      + 'serta awan panas ke arah selatan dan tenggara. Ketidakstabilan kubah lava menjadi sumber bahaya utama, '
      + 'bukan hanya letusan eksplosif. Siaran kamera resmi membantu melihat kubah, guguran, dan asap dari '
      + 'pos pengamatan.',
    watchingTips:
      'Awan panas bergerak cepat dan mengikuti lembah; rekaman siaran tidak menunjukkan aliran terus-menerus. '
      + 'Ikuti radius aman resmi PVMBG, bukan tampilan kamera.',
    statusUrl: PVMBG_STATUS,
  },
  {
    videoId: 'NaPEkk9IoB8',
    volcano: 'Tangkuban Parahu',
    title: 'Tangkuban Parahu Activity Live Streaming Badan Geologi',
    channel: 'Badan Geologi',
    level: 1,
    location: 'Kabupaten Bandung Barat, Jawa Barat',
    description:
      'Tangkuban Parahu adalah gunung api berbentuk perahu terbalik dengan beberapa kawah aktif, di antaranya '
      + 'Kawah Ratu, Kawah Upas, dan Kawah Domas. Letusannya umumnya freatik — dipicu uap air bawah permukaan, '
      + 'berlangsung singkat, dengan lontaran abu dan lumpur di sekitar kawah. Karena lokasinya dekat kawasan '
      + 'wisata, pemantauan visual harian penting meski status normal.',
    watchingTips:
      'Saat status normal kawah tetap dapat mengeluarkan uap belerang. Bau gas yang menyengat sebaiknya tidak '
      + 'didekati; pantau keterangan resmi sebelum berkunjung.',
    statusUrl: PVMBG_STATUS,
  },
];

/** URL siaran live YouTube untuk satu video. */
export function liveStreamUrl(videoId: string): string {
  return `https://www.youtube.com/live/${videoId}`;
}

/** URL embed ringan (dipakai iframe di halaman detail). */
export function liveStreamEmbedUrl(videoId: string): string {
  return `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1`;
}

/** URL thumbnail YouTube; `maxresdefault` bisa kosong, jadi sertakan cadangan. */
export function liveStreamThumbnail(videoId: string, maxres = true): string {
  return `https://i.ytimg.com/vi/${videoId}/${maxres ? 'maxresdefault' : 'hqdefault'}.jpg`;
}

export function findLiveStream(videoId: string): VolcanoLiveStream | null {
  return LIVE_STREAMS.find((stream) => stream.videoId === videoId) ?? null;
}
