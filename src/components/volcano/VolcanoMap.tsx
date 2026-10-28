'use client';

import { useEffect, useMemo, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { addBasemap } from '@/lib/map/basemap';
import type { VolcanoLevel } from '@/types/volcano';

const INDONESIA: L.LatLngBoundsExpression = [[-11.5, 94], [6.5, 141.5]];

export const VOLCANO_COLOR: Record<VolcanoLevel, string> = {
  1: '#1E8E5A',
  2: '#C9A227',
  3: '#C2711A',
  4: '#C0362C',
};

export interface MapVolcano {
  code: string;
  name: string;
  province: string;
  latitude: number;
  longitude: number;
  level: VolcanoLevel;
  levelLabel: string;
}

interface Props {
  volcanoes: MapVolcano[];
  selectedCode: string | null;
  onSelect: (code: string) => void;
}

/**
 * Peta persebaran gunung api memakai Leaflet (library yang sudah dipakai peta
 * gempa). Koordinat berasal langsung dari MAGMA; tidak ada titik yang dibuat
 * sendiri oleh aplikasi.
 */
export default function VolcanoMap({ volcanoes, selectedCode, onSelect }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const group = useRef<L.LayerGroup | null>(null);
  const markers = useRef(new Map<string, L.Marker>());
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  const selected = useMemo(
    () => volcanoes.find((volcano) => volcano.code === selectedCode) ?? null,
    [volcanoes, selectedCode],
  );

  useEffect(() => {
    if (!host.current || map.current) return;
    const m = L.map(host.current, { minZoom: 3 }).fitBounds(INDONESIA);
    addBasemap(m, { satellite: true });
    group.current = L.layerGroup().addTo(m);
    map.current = m;
    const store = markers.current;
    return () => {
      m.remove();
      map.current = null;
      group.current = null;
      store.clear();
    };
  }, []);

  useEffect(() => {
    const g = group.current;
    if (!g) return;
    g.clearLayers();
    markers.current.clear();
    for (const volcano of volcanoes) {
      // Ikon gunung api (bukan titik lingkaran) agar cepat dikenali di peta.
      // Warna puncak mengikuti tingkat aktivitas resmi; ukuran sedikit lebih
      // besar pada tingkat tinggi supaya perhatian tertuju ke sana.
      const size = volcano.level >= 3 ? 30 : 26;
      const marker = L.marker([volcano.latitude, volcano.longitude], {
        icon: L.divIcon({
          className: 'volcano-marker',
          html: `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true" focusable="false">`
            + '<path d="M8.5 3.2 12 8.3 14.2 6l7.3 14.5H2.5z" fill="none" stroke="#0B1A2E" stroke-width="1.4" stroke-linejoin="round"/>'
            + `<path d="M17.1 14.2h3.9L23 20.5H1L3.3 14.2h3.4a3.2 3.2 0 0 0 6.4 0h0a3.2 3.2 0 0 0 4 0z" fill="${VOLCANO_COLOR[volcano.level]}" stroke="#0B1A2E" stroke-width="1.2" stroke-linejoin="round"/>`
            + '<path d="M12 4.6 13.1 6.6 12.3 7.6 11.2 6.8z" fill="#ffffff" stroke="#0B1A2E" stroke-width="0.8"/>'
            + '</svg>',
          iconSize: [size, size],
          iconAnchor: [size / 2, size],
          popupAnchor: [0, -size],
        }),
        keyboard: true,
        title: `Gunung ${volcano.name}`,
        alt: `Gunung ${volcano.name}`,
      });
      // Popup dibangun dengan textContent agar teks sumber tidak menyisipkan markup.
      const popup = document.createElement('div');
      const title = document.createElement('strong');
      title.textContent = volcano.name;
      const status = document.createElement('div');
      status.textContent = volcano.levelLabel;
      const province = document.createElement('div');
      province.textContent = volcano.province;
      popup.append(title, status, province);
      marker.bindPopup(popup);
      marker.on('click', () => onSelectRef.current(volcano.code));
      marker.addTo(g);
      markers.current.set(volcano.code, marker);
    }
  }, [volcanoes]);

  useEffect(() => {
    markers.current.forEach((marker, code) => {
      const isSelected = code === selectedCode;
      const element = marker.getElement();
      if (element) {
        element.classList.toggle('volcano-marker-selected', isSelected);
        element.style.filter = isSelected ? 'drop-shadow(0 0 4px rgba(255,255,255,0.95))' : '';
        element.style.zIndex = isSelected ? '1000' : '';
      }
      if (isSelected) marker.setZIndexOffset(1000);
      else marker.setZIndexOffset(0);
    });
  }, [selectedCode, volcanoes]);

  // Pilihan dari daftar/pencarian memusatkan peta pada gunung api tersebut.
  useEffect(() => {
    if (!selected || !map.current) return;
    map.current.setView([selected.latitude, selected.longitude], Math.max(map.current.getZoom(), 7), {
      animate: true,
    });
    markers.current.get(selected.code)?.openPopup();
  }, [selected]);

  return <div ref={host} className="h-[min(60vh,520px)] min-h-[280px] w-full rounded-lg border border-line" role="application" aria-label="Peta persebaran gunung api Indonesia" />;
}
