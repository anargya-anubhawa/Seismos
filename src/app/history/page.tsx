'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Download } from 'lucide-react';
import { useEarthquakes } from '@/hooks/useEarthquakes';
import { earthquakesToCsv, downloadText } from '@/lib/csv';
import { fmtTime, wibDate } from '@/lib/formatting';
import {
  Attribution, EventRow, LoadingNotice, MagBadge, PageTitle, Skeleton, StaleDataNotice, StateBox,
} from '@/components/ui/common';

type Sort = 'time-desc' | 'time-asc' | 'mag-desc' | 'depth-desc' | 'depth-asc';
const PAGE = 10;
const inputCls = 'w-full rounded-md border border-line bg-surface px-2.5 py-1.5 text-sm';

interface Filters {
  q: string; from: string; to: string;
  magMin: string; magMax: string; depthMin: string; depthMax: string;
  feltOnly: boolean; sort: Sort;
}
const EMPTY: Filters = { q: '', from: '', to: '', magMin: '', magMax: '', depthMin: '', depthMax: '', feltOnly: false, sort: 'time-desc' };

function HistoryLoading() {
  return (
    <>
      <PageTitle title="Riwayat Gempa" />
      <LoadingNotice>Mengambil data gempa…</LoadingNotice>
      <Skeleton className="h-96" />
    </>
  );
}

function HistoryInner() {
  const { data, loading, error } = useEarthquakes();
  const params = useSearchParams();
  const [f, setF] = useState<Filters>({ ...EMPTY, q: params.get('q') ?? '' });
  const [page, setPage] = useState(1);

  // Pencarian dari header (?q=) memperbarui filter lokasi.
  const urlQ = params.get('q') ?? '';
  useEffect(() => { setF((p) => ({ ...p, q: urlQ })); setPage(1); }, [urlQ]);

  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => { setF((p) => ({ ...p, [k]: v })); setPage(1); };

  const rows = useMemo(() => {
    const num = (s: string) => (s.trim() === '' ? null : Number(s));
    const [magMin, magMax, dMin, dMax] = [num(f.magMin), num(f.magMax), num(f.depthMin), num(f.depthMax)];
    const q = f.q.trim().toLowerCase();
    const out = (data?.events ?? []).filter((e) => {
      if (q && !e.region.toLowerCase().includes(q)) return false;
      const d = wibDate(e.originTime);
      if (f.from && d < f.from) return false;
      if (f.to && d > f.to) return false;
      if (magMin !== null && e.magnitude < magMin) return false;
      if (magMax !== null && e.magnitude > magMax) return false;
      if (dMin !== null && e.depthKm < dMin) return false;
      if (dMax !== null && e.depthKm > dMax) return false;
      if (f.feltOnly && !e.felt) return false;
      return true;
    });
    const cmp: Record<Sort, (a: typeof out[number], b: typeof out[number]) => number> = {
      'time-desc': (a, b) => b.originTime.localeCompare(a.originTime),
      'time-asc': (a, b) => a.originTime.localeCompare(b.originTime),
      'mag-desc': (a, b) => b.magnitude - a.magnitude,
      'depth-desc': (a, b) => b.depthKm - a.depthKm,
      'depth-asc': (a, b) => a.depthKm - b.depthKm,
    };
    return out.sort(cmp[f.sort]);
  }, [data, f]);

  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const cur = Math.min(page, pages);
  const slice = rows.slice((cur - 1) * PAGE, cur * PAGE);

  if (loading && !data) return <HistoryLoading />;
  if (!data) {
    return (
      <>
        <PageTitle title="Riwayat Gempa" />
        <StateBox kind="error" title="Data gempa tidak dapat dimuat">
          {error ?? 'Sumber BMKG tidak merespons.'}
        </StateBox>
      </>
    );
  }

  return (
    <>
      <PageTitle
        title="Riwayat Gempa"
        hint="Gabungan feed InaTEWS dan data terbuka BMKG saat ini; bukan arsip jangka panjang. Tanggal mengikuti WIB."
      />
      <StaleDataNotice error={error} updatedAt={data.updatedAt} />

      <div className="grid gap-3 rounded-lg border border-line bg-surface p-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-sm lg:col-span-2"><span className="mb-1 block text-muted">Lokasi</span>
          <input className={inputCls} value={f.q} onChange={(e) => set('q', e.target.value)} placeholder="mis. Bengkulu" /></label>
        <label className="text-sm"><span className="mb-1 block text-muted">Tanggal mulai</span>
          <input type="date" className={inputCls} value={f.from} onChange={(e) => set('from', e.target.value)} /></label>
        <label className="text-sm"><span className="mb-1 block text-muted">Tanggal akhir</span>
          <input type="date" className={inputCls} value={f.to} onChange={(e) => set('to', e.target.value)} /></label>
        <label className="text-sm"><span className="mb-1 block text-muted">Magnitudo min</span>
          <input type="number" step="0.1" min="0" max="10" className={inputCls} value={f.magMin} onChange={(e) => set('magMin', e.target.value)} /></label>
        <label className="text-sm"><span className="mb-1 block text-muted">Magnitudo maks</span>
          <input type="number" step="0.1" min="0" max="10" className={inputCls} value={f.magMax} onChange={(e) => set('magMax', e.target.value)} /></label>
        <label className="text-sm"><span className="mb-1 block text-muted">Kedalaman min (km)</span>
          <input type="number" min="0" className={inputCls} value={f.depthMin} onChange={(e) => set('depthMin', e.target.value)} /></label>
        <label className="text-sm"><span className="mb-1 block text-muted">Kedalaman maks (km)</span>
          <input type="number" min="0" className={inputCls} value={f.depthMax} onChange={(e) => set('depthMax', e.target.value)} /></label>
        <label className="text-sm"><span className="mb-1 block text-muted">Urutkan</span>
          <select className={inputCls} value={f.sort} onChange={(e) => set('sort', e.target.value as Sort)}>
            <option value="time-desc">Terbaru</option>
            <option value="time-asc">Terlama</option>
            <option value="mag-desc">Magnitudo terbesar</option>
            <option value="depth-desc">Terdalam</option>
            <option value="depth-asc">Terdangkal</option>
          </select></label>
        <label className="flex items-center gap-2 self-end pb-1.5 text-sm">
          <input type="checkbox" checked={f.feltOnly} onChange={(e) => set('feltOnly', e.target.checked)} className="h-4 w-4" />
          Hanya yang ada keterangan dirasakan
        </label>
        <div className="flex items-end gap-2 sm:col-span-2">
          <button onClick={() => { setF(EMPTY); setPage(1); }} className="rounded-md border border-line px-3 py-1.5 text-sm hover:bg-line/40">Reset filter</button>
          <button
            onClick={() => downloadText(`seismos-gempa-${wibDate(new Date().toISOString())}.csv`, earthquakesToCsv(rows))}
            disabled={rows.length === 0}
            className="flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-ink disabled:opacity-40"
          >
            <Download size={15} aria-hidden /> Ekspor CSV ({rows.length})
          </button>
        </div>
      </div>

      <p className="my-3 text-sm text-muted" aria-live="polite">{rows.length} kejadian ditemukan dari {data.events.length}.</p>

      {rows.length === 0 ? (
        <StateBox kind="empty" title="Tidak ada kejadian yang cocok">Longgarkan filter atau tekan Reset filter.</StateBox>
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-lg border border-line bg-surface md:block">
            <table className="w-full text-sm">
              <thead className="border-b border-line text-left text-muted">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Waktu</th>
                  <th className="px-2 py-2.5 font-medium">Mag.</th>
                  <th className="px-2 py-2.5 font-medium">Kedalaman</th>
                  <th className="px-2 py-2.5 font-medium">Lokasi</th>
                  <th className="px-2 py-2.5 font-medium">Koordinat</th>
                  <th className="px-2 py-2.5 font-medium">Dirasakan</th>
                  <th className="px-4 py-2.5"><span className="sr-only">Aksi</span></th>
                </tr>
              </thead>
              <tbody>
                {slice.map((q) => (
                  <tr key={q.id} className="border-b border-line last:border-0">
                    <td className="whitespace-nowrap px-4 py-2.5">{fmtTime(q.originTime)}</td>
                    <td className="px-2 py-2.5"><MagBadge m={q.magnitude} /></td>
                    <td className="whitespace-nowrap px-2 py-2.5">{q.depthKm} km</td>
                    <td className="px-2 py-2.5">{q.region}</td>
                    <td className="whitespace-nowrap px-2 py-2.5 text-muted">{q.latitude.toFixed(2)}, {q.longitude.toFixed(2)}</td>
                    <td className="px-2 py-2.5">{q.felt ? 'Ya' : '—'}</td>
                    <td className="px-4 py-2.5"><Link className="font-medium underline" href={`/event/${encodeURIComponent(q.id)}`}>Detail</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="rounded-lg border border-line bg-surface md:hidden">
            {slice.map((q) => <EventRow key={q.id} q={q} />)}
          </ul>

          <div className="mt-3 flex items-center justify-between text-sm">
            <button disabled={cur <= 1} onClick={() => setPage(cur - 1)} className="rounded-md border border-line px-3 py-1.5 disabled:opacity-40">Sebelumnya</button>
            <span>Halaman {cur} dari {pages}</span>
            <button disabled={cur >= pages} onClick={() => setPage(cur + 1)} className="rounded-md border border-line px-3 py-1.5 disabled:opacity-40">Berikutnya</button>
          </div>
        </>
      )}
      <Attribution />
    </>
  );
}

export default function HistoryPage() {
  return (
    <Suspense fallback={<HistoryLoading />}>
      <HistoryInner />
    </Suspense>
  );
}
