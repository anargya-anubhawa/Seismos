import { distanceKm, type LatLon } from './geo';

export interface Province extends LatLon {
  id: string;
  name: string;
}

/**
 * Titik pusat perkiraan untuk 38 provinsi Indonesia. Data ini dipakai untuk
 * menebak provinsi terdekat dari sebuah koordinat, bukan untuk menggambar
 * batas administratif resmi. Gempa di laut atau dekat perbatasan dapat
 * tergolong ke provinsi tetangga.
 */
export const PROVINCES: Province[] = [
  { id: 'aceh', name: 'Aceh', latitude: 4.3, longitude: 96.6 },
  { id: 'sumatera-utara', name: 'Sumatera Utara', latitude: 2.5, longitude: 99.0 },
  { id: 'sumatera-barat', name: 'Sumatera Barat', latitude: -0.8, longitude: 100.5 },
  { id: 'riau', name: 'Riau', latitude: 0.7, longitude: 101.8 },
  { id: 'kepulauan-riau', name: 'Kepulauan Riau', latitude: 3.2, longitude: 104.5 },
  { id: 'jambi', name: 'Jambi', latitude: -1.7, longitude: 102.7 },
  { id: 'bengkulu', name: 'Bengkulu', latitude: -3.7, longitude: 102.3 },
  { id: 'sumatera-selatan', name: 'Sumatera Selatan', latitude: -3.2, longitude: 104.2 },
  { id: 'kepulauan-bangka-belitung', name: 'Kepulauan Bangka Belitung', latitude: -2.1, longitude: 106.1 },
  { id: 'lampung', name: 'Lampung', latitude: -4.8, longitude: 105.0 },
  { id: 'banten', name: 'Banten', latitude: -6.5, longitude: 106.1 },
  { id: 'dki-jakarta', name: 'DKI Jakarta', latitude: -6.2, longitude: 106.85 },
  { id: 'jawa-barat', name: 'Jawa Barat', latitude: -6.9, longitude: 107.6 },
  { id: 'jawa-tengah', name: 'Jawa Tengah', latitude: -7.2, longitude: 110.0 },
  { id: 'di-yogyakarta', name: 'DI Yogyakarta', latitude: -7.8, longitude: 110.4 },
  { id: 'jawa-timur', name: 'Jawa Timur', latitude: -7.5, longitude: 112.5 },
  { id: 'bali', name: 'Bali', latitude: -8.4, longitude: 115.2 },
  { id: 'nusa-tenggara-barat', name: 'Nusa Tenggara Barat', latitude: -8.6, longitude: 116.8 },
  { id: 'nusa-tenggara-timur', name: 'Nusa Tenggara Timur', latitude: -8.7, longitude: 121.0 },
  { id: 'kalimantan-barat', name: 'Kalimantan Barat', latitude: -0.2, longitude: 109.5 },
  { id: 'kalimantan-tengah', name: 'Kalimantan Tengah', latitude: -1.7, longitude: 113.5 },
  { id: 'kalimantan-selatan', name: 'Kalimantan Selatan', latitude: -3.0, longitude: 115.0 },
  { id: 'kalimantan-timur', name: 'Kalimantan Timur', latitude: 0.5, longitude: 116.5 },
  { id: 'kalimantan-utara', name: 'Kalimantan Utara', latitude: 2.5, longitude: 116.5 },
  { id: 'sulawesi-utara', name: 'Sulawesi Utara', latitude: 1.0, longitude: 124.5 },
  { id: 'gorontalo', name: 'Gorontalo', latitude: 0.7, longitude: 122.5 },
  { id: 'sulawesi-tengah', name: 'Sulawesi Tengah', latitude: -1.5, longitude: 121.0 },
  { id: 'sulawesi-barat', name: 'Sulawesi Barat', latitude: -2.5, longitude: 119.3 },
  { id: 'sulawesi-selatan', name: 'Sulawesi Selatan', latitude: -4.0, longitude: 120.0 },
  { id: 'sulawesi-tenggara', name: 'Sulawesi Tenggara', latitude: -3.5, longitude: 122.0 },
  { id: 'maluku', name: 'Maluku', latitude: -3.0, longitude: 129.0 },
  { id: 'maluku-utara', name: 'Maluku Utara', latitude: 1.0, longitude: 127.5 },
  { id: 'papua', name: 'Papua', latitude: -4.5, longitude: 138.5 },
  { id: 'papua-barat', name: 'Papua Barat', latitude: -2.0, longitude: 133.5 },
  { id: 'papua-barat-daya', name: 'Papua Barat Daya', latitude: -0.9, longitude: 131.3 },
  { id: 'papua-tengah', name: 'Papua Tengah', latitude: -4.0, longitude: 136.0 },
  { id: 'papua-pegunungan', name: 'Papua Pegunungan', latitude: -4.0, longitude: 139.0 },
  { id: 'papua-selatan', name: 'Papua Selatan', latitude: -7.5, longitude: 139.5 },
];

export interface NearestProvince {
  province: Province;
  distanceKm: number;
}

/** Provinsi dengan titik pusat terdekat dari koordinat yang diberikan. */
export function nearestProvince(point: LatLon): NearestProvince {
  let best = PROVINCES[0];
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const province of PROVINCES) {
    const distance = distanceKm(point, province);
    if (distance < bestDistance) {
      best = province;
      bestDistance = distance;
    }
  }
  return { province: best, distanceKm: bestDistance };
}

export function provinceForPoint(latitude: number, longitude: number): Province {
  return nearestProvince({ latitude, longitude }).province;
}

export function provinceById(id: string | null | undefined): Province | undefined {
  if (!id) return undefined;
  return PROVINCES.find((province) => province.id === id);
}
