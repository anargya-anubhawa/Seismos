import L from 'leaflet';

/**
 * Basemap bersama untuk semua peta Leaflet di aplikasi (gempa, gunung api, dan
 * peta di beranda) supaya tampilan konsisten dan tidak ada definisi ganda.
 *
 * Citra satelit memakai Esri World Imagery. Atribusi wajib ditampilkan karena
 * ketentuan Esri dan penyedia citra dasarnya; jangan dihapus.
 */
export const SATELLITE_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';

export const SATELLITE_ATTRIBUTION =
  'Citra satelit &copy; <a href="https://www.esri.com/">Esri</a>, Maxar, Earthstar Geographics, dan komunitas pengguna GIS';

export const STREET_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

export const STREET_ATTRIBUTION = '&copy; kontributor <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

export interface BasemapOptions {
  /** true (bawaan) = citra satelit; false = peta jalan. */
  satellite?: boolean;
  maxZoom?: number;
}

/**
 * Memasang basemap ke peta. Bila `withToggle` aktif, pengguna mendapat tombol
 * lapisan Leaflet untuk berpindah antara citra satelit dan peta jalan.
 */
export function addBasemap(
  map: L.Map,
  { satellite = true, maxZoom = 18 }: BasemapOptions = {},
  withToggle = true,
): { satelliteLayer: L.TileLayer; streetLayer: L.TileLayer | null } {
  const satelliteLayer = L.tileLayer(SATELLITE_URL, {
    maxZoom,
    maxNativeZoom: 19,
    attribution: SATELLITE_ATTRIBUTION,
  });

  if (!withToggle) {
    satelliteLayer.addTo(map);
    return { satelliteLayer, streetLayer: null };
  }

  const streetLayer = L.tileLayer(STREET_URL, {
    maxZoom,
    attribution: STREET_ATTRIBUTION,
  });

  (satellite ? satelliteLayer : streetLayer).addTo(map);
  L.control.layers(
    {
      'Citra satelit': satelliteLayer,
      'Peta jalan': streetLayer,
    },
    undefined,
    { position: 'topright' },
  ).addTo(map);

  return { satelliteLayer, streetLayer };
}
