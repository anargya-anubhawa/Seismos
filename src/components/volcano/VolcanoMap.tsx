'use client';

import { useEffect, useMemo, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
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
  const markers = useRef(new Map<string, L.CircleMarker>());
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  const selected = useMemo(
    () => volcanoes.find((volcano) => volcano.code === selectedCode) ?? null,
    [volcanoes, selectedCode],
  );

  useEffect(() => {
    if (!host.current || map.current) return;
    const m = L.map(host.current, { minZoom: 3 }).fitBounds(INDONESIA);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '&copy; kontributor OpenStreetMap',
    }).addTo(m);
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
      const marker = L.circleMarker([volcano.latitude, volcano.longitude], {
        radius: volcano.level >= 3 ? 8 : 6,
        color: '#0B1A2E',
        weight: 1,
        fillColor: VOLCANO_COLOR[volcano.level],
        fillOpacity: 0.85,
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
      marker.setStyle({ weight: isSelected ? 3 : 1, color: isSelected ? '#ffffff' : '#0B1A2E' });
      if (isSelected) marker.bringToFront();
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
