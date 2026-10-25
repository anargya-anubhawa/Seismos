export type SourceTag = 'terbaru' | 'm5' | 'dirasakan' | 'felt30' | 'live';

/** Satu lokasi pada field "Dirasakan" BMKG, sudah dipisahkan dari teks bebas. */
export interface FeltReport {
  /** Intensitas terendah yang dilaporkan untuk lokasi ini (skala MMI). */
  mmiMin: number;
  /** Intensitas tertinggi yang dilaporkan untuk lokasi ini (skala MMI). */
  mmiMax: number;
  /** Label seperti "III" atau "II–III", mengikuti penulisan BMKG. */
  mmiLabel: string;
  /** Nama wilayah apa adanya dari BMKG. */
  place: string;
}

export interface Earthquake {
  /** Dibentuk aplikasi dari waktu + koordinat; BMKG tidak menyediakan ID di endpoint ini. */
  id: string;
  /** ISO 8601 UTC, dari field DateTime BMKG */
  originTime: string;
  latitude: number;
  longitude: number;
  magnitude: number;
  depthKm: number;
  region: string;
  /** Teks field "Potensi" apa adanya dari BMKG */
  tsunamiNote?: string;
  /** Teks field "Dirasakan" apa adanya dari BMKG */
  felt?: string;
  /** Lokasi dan intensitas MMI yang diurai dari field "Dirasakan" BMKG. */
  feltReports?: FeltReport[];
  /** Intensitas MMI tertinggi yang dilaporkan untuk kejadian ini. */
  maxMmi?: number;
  /** Nama berkas shakemap BMKG (hanya tersedia untuk gempa terbaru) */
  shakemapFile?: string;
  /** Daftar BMKG tempat kejadian ini muncul */
  sources: SourceTag[];
}

export interface SourceStatus {
  id: SourceTag;
  label: string;
  url: string;
  fetchedAt: string | null;
  stale: boolean;
  error: string | null;
  count: number;
}

export interface EarthquakeResponse {
  events: Earthquake[];
  sources: SourceStatus[];
  /** Waktu pengambilan terbaru di server di antara semua sumber */
  updatedAt: string | null;
}
