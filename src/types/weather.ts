/** Sumber resmi cuaca BMKG yang dipakai aplikasi. */
export type WeatherSourceId = 'prakiraan' | 'nowcast' | 'satelit';

/** Satu kode wilayah tingkat desa/kelurahan (adm4) yang dipakai BMKG. */
export interface WeatherArea {
  /** Kode adm4, mis. "31.71.01.1003". */
  code: string;
  /** Desa/kelurahan yang dipakai BMKG untuk kode ini. */
  village: string;
  district: string;
  regency: string;
  province: string;
  latitude: number;
  longitude: number;
}

/** Satu titik prakiraan cuaca (interval 3 jam) apa adanya dari BMKG. */
export interface WeatherPoint {
  /** Waktu ramalan menurut WIB/WITA/WIT sesuai `timezone` wilayah (ISO 8601). */
  time: string;
  /** Suhu udara (°C). */
  temperatureC: number | null;
  /** Tutupan awan (%). */
  cloudCoverPct: number | null;
  /** Curah hujan (mm) pada interval ini. */
  precipitationMm: number | null;
  /** Kode cuaca BMKG (angka) apa adanya. */
  weatherCode: number | null;
  /** Deskripsi cuaca resmi, mis. "Berawan". */
  description: string;
  /** Kelembapan relatif (%). */
  humidityPct: number | null;
  /** Kecepatan angin (km/jam). */
  windSpeedKmh: number | null;
  /** Arah angin singkatan, mis. "S" atau "SW". */
  windFrom: string | null;
  /** Arah tujuan angin singkatan, mis. "N". */
  windTo: string | null;
  /** Jarak pandang (m), bila diterbitkan. */
  visibilityM: number | null;
  /** Teks jarak pandang resmi, mis. "6-10 km". */
  visibilityText: string | null;
  /** URL ikon cuaca resmi BMKG. */
  iconUrl: string | null;
}

/** Prakiraan cuaca satu wilayah, dikelompokkan per hari. */
export interface WeatherForecast {
  area: WeatherArea;
  timezone: string;
  /** Titik prakiraan diurutkan menurut waktu. */
  points: WeatherPoint[];
  /** Waktu analisis model dari BMKG (ISO 8601 UTC), bila ada. */
  analysisAt: string | null;
  /** Waktu data diambil server Seismos (ISO 8601 UTC). */
  fetchedAt: string;
  /** Waktu data sumber terakhir berubah, bila diketahui. */
  updatedAt: string | null;
  stale: boolean;
  error: string | null;
  sourceUrl: string;
}

/** Satu peringatan dini cuaca ekstrem resmi BMKG (nowcast). */
export interface WeatherAlert {
  /** GUID CAP dari BMKG. */
  id: string;
  /** Judul resmi, mis. "Hujan Lebat disertai Petir di Bali". */
  title: string;
  /** Wilayah yang disebut pada judul. */
  region: string | null;
  /** Waktu terbit (ISO 8601 UTC). */
  issuedAt: string;
  /** Deskripsi lengkap (beberapa baris). */
  description: string;
  /** Dampak yang disebut BMKG, bila tercantum. */
  impacts: string[];
  /** Imbauan BMKG, bila tercantum. */
  advice: string | null;
  /** Waktu berakhir perkiraan menurut teks BMKG, bila dapat diurai. */
  expiresAt: string | null;
  /** Tautan dokumen CAP resmi. */
  sourceUrl: string;
}

export interface WeatherAlertFeed {
  alerts: WeatherAlert[];
  updatedAt: string | null;
  stale: boolean;
  error: string | null;
  sourceUrl: string;
}

/** Satu produk citra satelit resmi BMKG (INDERAJA). */
export interface SatelliteProduct {
  id: string;
  /** Nama produk resmi seperti pada situs BMKG. */
  name: string;
  /** Keterangan singkat fungsi produk. */
  description: string;
  /** Kelompok tampilan: himawari, gk2a, gsmap, atau lingkungan. */
  group: 'himawari' | 'gk2a' | 'gsmap' | 'lingkungan';
  /** URL citra asli BMKG. */
  sourceUrl: string;
  /** Path proxy internal agar citra selalu terkirim dari server Seismos. */
  imagePath: string;
  width: number;
  height: number;
}

export interface SatelliteFrame {
  product: SatelliteProduct;
  /** Waktu citra dinyatakan sumber (ISO 8601 UTC), dari header Last-Modified. */
  capturedAt: string | null;
  /** Waktu server Seismos memeriksa citra (ISO 8601 UTC). */
  checkedAt: string;
  stale: boolean;
  error: string | null;
}
