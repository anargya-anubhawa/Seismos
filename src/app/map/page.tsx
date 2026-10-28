'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useEarthquakes } from '@/hooks/useEarthquakes';
import {
  Attribution, EventRow, LoadingNotice, PageTitle, Panel, Skeleton, StaleDataNotice, StateBox,
} from '@/components/ui/common';
import { QuakeMapLazy } from '@/components/map/QuakeMapLazy';
import { MmiSummary } from '@/components/mmi/MmiSummary';

const inputCls = 'rounded-md border border-line bg-surface px-2.5 py-1.5 text-sm';

export default function MapPage() {
  const { data, loading, error } = useEarthquakes();
  const [minMag, setMinMag] = useState(0);
  const [maxDepth, setMaxDepth] = useState(1000);
  const [selected, setSelected] = useState<string | null>(null);

  const events = useMemo(
    () => (data?.events ?? []).filter((e) => e.magnitude >= minMag && e.depthKm <= maxDepth),
    [data, minMag, maxDepth],
  );
  const reset = () => { setMinMag(0); setMaxDepth(1000); setSelected(null); };

  if (loading && !data) return (
    <>
      <PageTitle title="Peta Gempa" />
      <LoadingNotice>Mengambil data gempa…</LoadingNotice>
      <Skeleton className="h-96" />
    </>
  );
  if (!data) return (
    <>
      <PageTitle title="Peta Gempa" />
      <StateBox kind="error" title="Data gempa tidak dapat dimuat">{error ?? 'Sumber BMKG tidak merespons.'}</StateBox>
    </>
  );

  const sel = events.find((e) => e.id === selected);

  return (
    <>
      <PageTitle
        title="Peta Gempa"
        hint="Episenter ditempatkan memakai koordinat dari BMKG. Ukuran lingkaran mengikuti magnitudo; gempa terbaru diberi pulse dan outline. Tekan “Lokasi saya” untuk melihat jarak dari posisi Anda."
      />
      <StaleDataNotice error={error} updatedAt={data.updatedAt} />
      <div className="mb-3 flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="mb-1 block text-muted">Magnitudo minimum</span>
          <select className={inputCls} value={minMag} onChange={(e) => setMinMag(Number(e.target.value))}>
            {[0, 3, 4, 5, 6].map((m) => <option key={m} value={m}>{m === 0 ? 'Semua' : `M ≥ ${m}`}</option>)}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-muted">Kedalaman maksimum</span>
          <select className={inputCls} value={maxDepth} onChange={(e) => setMaxDepth(Number(e.target.value))}>
            <option value={1000}>Semua</option>
            <option value={60}>≤ 60 km (dangkal)</option>
            <option value={300}>≤ 300 km</option>
          </select>
        </label>
        <button onClick={reset} className="rounded-md border border-line px-3 py-1.5 text-sm hover:bg-line/40">Reset filter</button>
        <p className="ml-auto text-sm text-muted" aria-live="polite">{events.length} dari {data.events.length} kejadian</p>
      </div>

      <div className="flex flex-col gap-4">
        <div className="order-1 grid gap-4 lg:order-2 lg:grid-cols-3">
          <Panel className="relative z-0 h-[55dvh] overflow-hidden lg:col-span-2 lg:h-[calc(100dvh-14rem)]">
            <QuakeMapLazy events={events} selectedId={selected} onSelect={setSelected} />
          </Panel>
          <Panel title="Daftar kejadian" className="lg:h-[calc(100vh-14rem)] lg:overflow-hidden">
            {sel && (
              <div className="border-b border-line bg-accent/10 px-4 py-2 text-sm">
                Dipilih: <strong>M {sel.magnitude.toFixed(1)}</strong> — {sel.region}.{' '}
                <Link className="font-medium underline" href={`/event/${encodeURIComponent(sel.id)}`}>Buka detail</Link>
              </div>
            )}
            {events.length === 0 ? (
              <p className="p-4 text-sm text-muted">Tidak ada kejadian yang cocok dengan filter. Ubah atau reset filter.</p>
            ) : (
              <ul className="max-h-96 overflow-y-auto lg:max-h-[calc(100vh-19rem)]">
                {events.map((q) => <EventRow key={q.id} q={q} active={q.id === selected} onSelect={setSelected} />)}
              </ul>
            )}
          </Panel>
        </div>

        {/* Ringkasan MMI selalu berada di bawah daftar kejadian, di desktop maupun mobile. */}
        <MmiSummary events={events} className="min-w-0" />
      </div>

      <Attribution />
    </>
  );
}
