export interface SeismogramStation {
  id: number;
  volcanoCode: string;
  volcanoName: string;
  /** Kode stasiun-kanal-network-lokasi, mis. GTOH_EHZ_VG_00. */
  scnl: string;
  station: string;
  channel: string;
  network: string;
  location: string;
  /** Jumlah akses gambar menurut sumber; hanya informasi tambahan. */
  hit: number;
  /** URL proxy internal untuk gambar seismogram. */
  imagePath: string;
  /** URL halaman stasiun di MAGMA. */
  pageUrl: string;
  /** URL gambar asli dari sumber. */
  sourceImageUrl: string;
}

export interface VolcanoOption {
  id: string;
  code: string;
  name: string;
  province?: string;
  latitude?: number;
  longitude?: number;
  elevation?: number;
}

export interface SeismogramResponse {
  stations: SeismogramStation[];
  volcanoes: VolcanoOption[];
  total: number;
  updatedAt: string;
  stale: boolean;
  error: string | null;
  source: {
    name: string;
    home: string;
    live: string;
  };
}
