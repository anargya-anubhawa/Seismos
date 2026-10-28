'use client';

import { useEffect, useMemo, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Home, Loader2, LocateFixed } from 'lucide-react';
import type { Earthquake } from '@/types/earthquake';
import { MAG_CLASSES, fmtTime, magColor } from '@/lib/formatting';
import { distanceKm, formatDistanceKm } from '@/lib/geo';
import { mmiRoman } from '@/lib/felt';
import { useGeolocation } from '@/hooks/useGeolocation';

const INDONESIA: L.LatLngBoundsExpression = [[-11.5, 94], [6.5, 141.5]];

interface Props {
  events: Earthquake[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  /** Tampilkan pulse dan outline pada gempa terbaru di daftar yang ditampilkan. */
  highlightLatest?: boolean;
}

export default function QuakeMap({ events, selectedId, onSelect, highlightLatest = true }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const group = useRef<L.LayerGroup | null>(null);
  const locationGroup = useRef<L.LayerGroup | null>(null);
  const distanceGroup = useRef<L.LayerGroup | null>(null);
  const markers = useRef(new Map<string, L.CircleMarker>());
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const { location, status, error, request } = useGeolocation();

  const latest = useMemo(
    () => events.reduce<Earthquake | null>(
      (best, event) => (!best || event.originTime > best.originTime ? event : best),
      null,
    ),
    [events],
  );
  const target = useMemo(
    () => (selectedId ? events.find((event) => event.id === selectedId) ?? null : latest),
    [events, latest, selectedId],
  );
  const targetDistance = location && target ? distanceKm(location, target) : null;

  useEffect(() => {
    if (!host.current || map.current) return;
    const m = L.map(host.current, { minZoom: 3 }).fitBounds(INDONESIA);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '&copy; kontributor OpenStreetMap',
    }).addTo(m);
    group.current = L.layerGroup().addTo(m);
    locationGroup.current = L.layerGroup().addTo(m);
    distanceGroup.current = L.layerGroup().addTo(m);
    map.current = m;
    const store = markers.current;
    return () => {
      m.remove();
      map.current = null;
      group.current = null;
      locationGroup.current = null;
      distanceGroup.current = null;
      store.clear();
    };
  }, []);

  // Marker memakai koordinat apa adanya dari BMKG.
  useEffect(() => {
    const g = group.current;
    if (!g) return;
    g.clearLayers();
    markers.current.clear();
    for (const q of events) {
      const mk = L.circleMarker([q.latitude, q.longitude], {
        radius: 4 + q.magnitude * 2,
        color: '#0B1A2E',
        weight: 1,
        fillColor: magColor(q.magnitude),
        fillOpacity: 0.8,
      });
      // Popup dibangun dengan textContent (bukan HTML) agar teks dari sumber tidak dapat menyisipkan markup.
      const pop = document.createElement('div');
      const title = document.createElement('strong');
      title.textContent = `M ${q.magnitude.toFixed(1)} · ${q.depthKm} km`;
      const place = document.createElement('div');
      place.textContent = q.region;
      const when = document.createElement('div');
      when.textContent = fmtTime(q.originTime);
      pop.append(title, place, when);
      if (q.maxMmi) {
        const mmi = document.createElement('div');
        mmi.textContent = `Dirasakan hingga MMI ${mmiRoman(q.maxMmi)}`;
        pop.append(mmi);
      }
      if (location) {
        const distance = document.createElement('div');
        distance.className = 'font-semibold';
        distance.textContent = `≈ ${formatDistanceKm(distanceKm(location, q))} dari lokasi Anda`;
        pop.append(distance);
      }
      mk.bindPopup(pop);
      mk.on('click', () => onSelectRef.current?.(q.id));
      mk.addTo(g);
      markers.current.set(q.id, mk);
    }

    if (highlightLatest && latest) {
      const latlng: L.LatLngExpression = [latest.latitude, latest.longitude];
      L.circleMarker(latlng, {
        radius: 18,
        color: '#F2A93B',
        weight: 2,
        opacity: 0.95,
        fill: false,
        interactive: false,
        className: 'quake-latest-outline',
      }).addTo(g);
      L.marker(latlng, {
        icon: L.divIcon({
          className: 'quake-latest-pulse',
          html: '<span></span>',
          iconSize: [44, 44],
          iconAnchor: [22, 22],
        }),
        interactive: false,
        keyboard: false,
        zIndexOffset: 1000,
      }).addTo(g);
      markers.current.get(latest.id)?.bringToFront();
    }
  }, [events, highlightLatest, latest, location]);

  useEffect(() => {
    markers.current.forEach((mk, id) => {
      const sel = id === selectedId;
      mk.setStyle({ weight: sel ? 3 : 1, color: sel ? '#ffffff' : '#0B1A2E' });
      if (sel) {
        mk.bringToFront();
        map.current?.panTo(mk.getLatLng());
        mk.openPopup();
      }
    });
  }, [selectedId, events, location]);

  useEffect(() => {
    const g = locationGroup.current;
    if (!g) return;
    g.clearLayers();
    if (!location) return;
    const latlng = L.latLng(location.latitude, location.longitude);
    L.circle(latlng, {
      radius: Math.max(10, location.accuracy),
      color: '#1E66F5',
      weight: 1,
      opacity: 0.45,
      fillColor: '#1E66F5',
      fillOpacity: 0.08,
      interactive: false,
    }).addTo(g);
    const dot = L.circleMarker(latlng, {
      radius: 7,
      color: '#ffffff',
      weight: 2,
      fillColor: '#1E66F5',
      fillOpacity: 1,
      className: 'quake-user-dot',
    }).addTo(g);
    const pop = document.createElement('div');
    const title = document.createElement('strong');
    title.textContent = 'Lokasi Anda';
    const accuracy = document.createElement('div');
    accuracy.textContent = `Akurasi perkiraan ± ${Math.round(location.accuracy)} m`;
    const note = document.createElement('div');
    note.textContent = 'Koordinat hanya diproses di browser ini.';
    pop.append(title, accuracy, note);
    dot.bindPopup(pop);
    map.current?.setView(latlng, Math.max(map.current.getZoom(), 9));
  }, [location]);

  useEffect(() => {
    const g = distanceGroup.current;
    if (!g) return;
    g.clearLayers();
    if (!location || !target) return;
    const from = L.latLng(location.latitude, location.longitude);
    const to = L.latLng(target.latitude, target.longitude);
    L.polyline([from, to], {
      color: '#1E66F5',
      weight: 1.5,
      dashArray: '5 6',
      opacity: 0.8,
      interactive: false,
    }).addTo(g);
    L.tooltip({
      permanent: true,
      direction: 'center',
      className: 'quake-distance-label',
      opacity: 1,
    })
      .setLatLng(L.latLng((from.lat + to.lat) / 2, (from.lng + to.lng) / 2))
      .setContent(formatDistanceKm(distanceKm(location, target)))
      .addTo(g);
  }, [location, target]);

  const locationLabel = location ? 'Perbarui lokasi saya' : 'Tampilkan lokasi saya';

  return (
    <div className="relative z-0 h-full w-full">
      <div ref={host} className="h-full w-full" role="application" aria-label="Peta persebaran episenter gempa" />

      <div className="absolute right-2 top-2 z-[500] flex max-w-[calc(100%-1rem)] flex-col items-end gap-2">
        <button
          type="button"
          onClick={() => map.current?.fitBounds(INDONESIA)}
          className="flex items-center gap-1.5 rounded border border-line bg-surface px-2.5 py-1.5 text-xs font-medium shadow"
        >
          <Home size={14} aria-hidden /> <span className="hidden sm:inline">Seluruh Indonesia</span>
          <span className="sr-only sm:hidden">Seluruh Indonesia</span>
        </button>
        <button
          type="button"
          onClick={request}
          disabled={status === 'requesting'}
          aria-pressed={Boolean(location)}
          aria-label={locationLabel}
          title={locationLabel}
          className="flex items-center gap-1.5 rounded border border-line bg-surface px-2.5 py-1.5 text-xs font-medium shadow disabled:opacity-60"
        >
          {status === 'requesting'
            ? <Loader2 size={14} className="animate-spin" aria-hidden />
            : <LocateFixed size={14} aria-hidden />}
          <span className="hidden sm:inline">{location ? 'Perbarui lokasi' : 'Lokasi saya'}</span>
          <span className="sr-only sm:hidden">{location ? 'Perbarui lokasi' : 'Lokasi saya'}</span>
        </button>
        {location && (
          <span className="rounded border border-line bg-surface/95 px-2 py-1 text-[11px] text-muted shadow">
            Akurasi ± {Math.round(location.accuracy)} m
          </span>
        )}
        {error && (
          <p role="alert" className="max-w-60 rounded border border-danger/40 bg-surface/95 px-2 py-1 text-[11px] text-danger shadow">
            {error}
          </p>
        )}
      </div>

      {location && (
        <div className="absolute bottom-2 right-2 z-[500] max-w-[calc(100%-1rem)] rounded border border-line bg-surface/95 px-2.5 py-2 text-xs shadow">
          <p className="font-semibold">Jarak ke {selectedId && target ? 'gempa dipilih' : 'gempa terbaru'}</p>
          {targetDistance !== null ? (
            <p className="mt-0.5 text-base font-semibold">{formatDistanceKm(targetDistance)}</p>
          ) : (
            <p className="mt-0.5 text-muted">Belum ada gempa yang ditampilkan.</p>
          )}
          {target && <p className="mt-0.5 max-w-52 truncate text-muted" title={target.region}>{target.region}</p>}
        </div>
      )}

      <div className="absolute bottom-6 left-2 z-[500] rounded border border-line bg-surface/95 px-2.5 py-2 text-xs shadow">
        <p className="mb-1 font-semibold">Magnitudo</p>
        {[...MAG_CLASSES].reverse().map((c) => (
          <p key={c.label} className="flex items-center gap-1.5">
            <span aria-hidden className="inline-block h-3 w-3 rounded-full border border-[#0B1A2E]" style={{ background: c.color }} />
            {c.label}
          </p>
        ))}
        {highlightLatest && (
          <p className="mt-1.5 border-t border-line pt-1.5 text-[11px] text-muted">Pulse kuning = gempa terbaru</p>
        )}
      </div>
    </div>
  );
}
