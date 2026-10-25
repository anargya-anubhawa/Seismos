'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle, ArrowLeft, ChevronRight, Clock, ExternalLink, MapPin, Maximize2, Mountain, Radio, RefreshCw,
  Search, X,
} from 'lucide-react';
import { LoadingNotice, PageTitle, Panel, Skeleton, StateBox } from '@/components/ui/common';
import { fmtClock } from '@/lib/formatting';
import type { SeismogramResponse, SeismogramStation } from '@/types/seismogram';

const POLL_MS = 5 * 60 * 1000;
const inputCls = 'w-full rounded-md border border-line bg-surface px-2.5 py-1.5 text-sm';

function LiveImage({
  src,
  alt,
  className,
  eager = false,
}: {
  src: string;
  alt: string;
  className?: string;
  eager?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);

  if (failed) {
    return (
      <div className={`flex aspect-[5/3] w-full flex-col items-center justify-center gap-1 bg-bg p-3 text-center text-xs text-muted ${className ?? ''}`}>
        <AlertTriangle size={18} aria-hidden />
        <span>Gambar sedang tidak tersedia dari sumber.</span>
      </div>
    );
  }

  return (
    // Gambar diproksi lewat /api/seismograms/[id]/image agar tidak diblokir iframe/CORS.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={className}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}

function SeismogramDialog({ station, stamp, onClose }: { station: SeismogramStation; stamp: number; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 sm:p-6"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Seismogram ${station.volcanoName}, stasiun ${station.scnl}`}
        className="max-h-full w-full max-w-5xl overflow-auto rounded-lg border border-line bg-surface shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-line px-4 py-3">
          <div>
            <h2 className="text-base font-semibold">{station.volcanoName}</h2>
            <p className="mt-0.5 text-xs text-muted">
              Stasiun {station.scnl}
              {station.station ? ` · ${station.station}` : ''}
              {station.channel ? ` · kanal ${station.channel}` : ''}
            </p>
          </div>
          <button
            autoFocus
            onClick={onClose}
            aria-label="Tutup pratinjau seismogram"
            className="rounded p-2 text-muted hover:bg-line/50 hover:text-ink"
          >
            <X size={20} aria-hidden />
          </button>
        </div>
        <div className="bg-white p-2 sm:p-3">
          <LiveImage
            eager
            src={`/api/seismograms/${station.id}/image?size=full${stamp ? `&v=${stamp}` : ''}`}
            alt={`Seismogram penuh stasiun ${station.scnl} di ${station.volcanoName} dari MAGMA Indonesia`}
            className="mx-auto block aspect-[5/3] h-auto w-full object-contain"
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-3 text-xs">
          <p className="text-muted">
            Gambar sumber dapat tertunda beberapa menit. Waktu rekaman tercetak pada gambar, bukan waktu unduhan.
          </p>
          <a
            href={station.pageUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-medium underline"
          >
            Buka di MAGMA <ExternalLink size={13} aria-hidden />
          </a>
        </div>
      </div>
    </div>
  );
}

function SourcePanel() {
  return (
    <Panel title="Sumber dan cara membaca">
      <div className="space-y-2 px-4 py-3 text-sm text-muted">
        <p>
          Gambar seismogram berasal dari <strong className="text-ink">MAGMA Indonesia</strong> — PVMBG, Badan Geologi,
          Kementerian ESDM — pada kanal Live Seismograf. Ini <strong className="text-ink">bukan data BMKG</strong>.
          Daftar stasiun dan gambar diambil langsung dari layanan publik sumber, lalu diteruskan oleh server aplikasi
          karena sumber memblokir penyematan iframe.
        </p>
        <p>
          Seismogram menunjukkan getaran tanah secara menerus. Lonjakan dapat berasal dari gempa lokal, gempa jauh,
          aktivitas gunung api, atau gangguan alat. Hanya petugas PVMBG yang dapat menafsirkan status gunung api.
          Untuk status resmi, buka <a className="underline" href="https://magma.esdm.go.id/" target="_blank" rel="noopener noreferrer">magma.esdm.go.id</a>{' '}
          dan ikuti rekomendasi PVMBG/BNPB.
        </p>
        <p className="flex flex-wrap gap-3">
          <a
            className="inline-flex items-center gap-1 font-medium underline"
            href="https://magma.esdm.go.id/volcano/live-seismograf"
            target="_blank"
            rel="noopener noreferrer"
          >
            Live Seismograf MAGMA <ExternalLink size={13} aria-hidden />
          </a>
          <a
            className="inline-flex items-center gap-1 font-medium underline"
            href="https://magma.esdm.go.id/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Beranda MAGMA <ExternalLink size={13} aria-hidden />
          </a>
        </p>
      </div>
    </Panel>
  );
}

export default function VolcanoSeismogramPage() {
  const [data, setData] = useState<SeismogramResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [selectedVolcano, setSelectedVolcano] = useState<string | null>(null);
  const [stamp, setStamp] = useState(0);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const inFlight = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      abortRef.current?.abort();
    };
  }, []);

  const load = useCallback(async (mode: 'initial' | 'refresh') => {
    if (inFlight.current) return;
    inFlight.current = true;
    if (mode === 'refresh') setRefreshing(true);
    abortRef.current?.abort();
    const ctl = new AbortController();
    abortRef.current = ctl;
    const timer = setTimeout(() => ctl.abort(), 20_000);

    try {
      const res = await fetch('/api/seismograms', { cache: 'no-store', signal: ctl.signal });
      const json = (await res.json().catch(() => null)) as (SeismogramResponse & { error?: string }) | null;
      if (!res.ok) throw new Error(json?.error ?? `Server membalas HTTP ${res.status}`);
      if (!json || !Array.isArray(json.stations)) throw new Error('Bentuk respons daftar seismogram tidak dikenali.');
      if (!mounted.current) return;
      setData(json);
      setStamp(Date.now());
      setError(null);
    } catch (e) {
      if (!mounted.current) return;
      const message = e instanceof Error && e.name !== 'AbortError'
        ? e.message
        : e instanceof Error && e.name === 'AbortError'
          ? 'Waktu tunggu habis saat menghubungi server.'
          : 'Sumber MAGMA tidak dapat diakses.';
      setError(message);
    } finally {
      clearTimeout(timer);
      inFlight.current = false;
      if (mounted.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => { void load('initial'); }, [load]);

  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') void load('refresh');
    }, POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  const volcanoGroups = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of data?.stations ?? []) {
      counts.set(s.volcanoName, (counts.get(s.volcanoName) ?? 0) + 1);
    }
    const metadata = new Map((data?.volcanoes ?? []).map((v) => [v.name, v]));
    return Array.from(counts, ([name, count]) => {
      const info = metadata.get(name);
      return { name, count, code: info?.code, province: info?.province };
    }).sort((a, b) => a.name.localeCompare(b.name, 'id'));
  }, [data]);

  const filteredVolcanoes = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return volcanoGroups;
    return volcanoGroups.filter((v) =>
      v.name.toLowerCase().includes(needle) ||
      (v.code ?? '').toLowerCase().includes(needle) ||
      (v.province ?? '').toLowerCase().includes(needle),
    );
  }, [volcanoGroups, q]);

  const selectedGroup = volcanoGroups.find((v) => v.name === selectedVolcano) ?? null;
  const selectedStations = useMemo(
    () => (data?.stations ?? [])
      .filter((s) => s.volcanoName === selectedVolcano)
      .sort((a, b) => a.scnl.localeCompare(b.scnl)),
    [data, selectedVolcano],
  );
  const selected = data?.stations.find((s) => s.id === selectedId) ?? null;

  useEffect(() => {
    // Bila daftar sumber berubah dan gunung yang dipilih hilang, kembali ke daftar pilihan.
    if (selectedVolcano && data && !data.stations.some((s) => s.volcanoName === selectedVolcano)) {
      setSelectedVolcano(null);
    }
  }, [data, selectedVolcano]);

  const choose = (name: string) => {
    setSelectedVolcano(name);
    setSelectedId(null);
    setQ('');
    window.scrollTo(0, 0);
  };
  const back = () => {
    setSelectedVolcano(null);
    setSelectedId(null);
    window.scrollTo(0, 0);
  };

  if (loading && !data) {
    return (
      <>
        <PageTitle title="Seismogram Gunung Api" />
        <LoadingNotice>Mengambil daftar stasiun MAGMA…</LoadingNotice>
        <Skeleton className="h-96" />
      </>
    );
  }

  if (!data) {
    return (
      <>
        <PageTitle title="Seismogram Gunung Api" hint="Seismogram live dari MAGMA Indonesia (PVMBG, Badan Geologi, Kementerian ESDM)." />
        <StateBox kind="error" title="Daftar seismogram tidak dapat dimuat">
          {error ?? 'Sumber MAGMA tidak merespons.'} Aplikasi tidak menampilkan grafik pengganti; gunakan tautan ke sumber resmi di bawah.
        </StateBox>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={() => { setLoading(true); void load('refresh'); }}
            className="flex min-h-11 items-center gap-1.5 rounded-md bg-accent px-4 text-sm font-medium text-accent-ink"
          >
            <RefreshCw size={15} aria-hidden /> Coba lagi
          </button>
          <a
            href="https://magma.esdm.go.id/volcano/live-seismograf"
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-11 items-center gap-1.5 rounded-md border border-line px-4 text-sm font-medium"
          >
            Buka Live Seismograf MAGMA <ExternalLink size={15} aria-hidden />
          </a>
        </div>
      </>
    );
  }

  return (
    <>
      <PageTitle
        title="Seismogram Gunung Api"
        hint="Pilih gunung api untuk memuat seismogram stasiunnya. Daftar dan gambar berasal dari MAGMA Indonesia (PVMBG, Badan Geologi, Kementerian ESDM)."
      />

      {(error || data.stale) && (
        <div role="alert" className="mb-4 flex gap-3 rounded-lg border border-danger/50 bg-surface px-4 py-3 text-sm">
          <AlertTriangle size={19} aria-hidden className="mt-0.5 shrink-0 text-danger" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{error ? 'Pembaruan daftar stasiun gagal' : 'Daftar stasiun memakai data lama'}</p>
            <p className="mt-0.5 text-muted">
              {error ?? data.error ?? 'Sumber MAGMA tidak merespons.'} Daftar di bawah tetap ditampilkan, tetapi bisa sudah tidak mutakhir.
            </p>
          </div>
          <button
            onClick={() => void load('refresh')}
            disabled={refreshing}
            className="flex shrink-0 items-center gap-1 self-start rounded-md border border-line px-2.5 py-1.5 text-xs font-medium disabled:opacity-40"
          >
            <RefreshCw size={13} aria-hidden /> {refreshing ? 'Memuat…' : 'Muat ulang'}
          </button>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Panel className="p-4">
          <p className="flex items-center gap-1.5 text-sm text-muted"><Radio size={15} aria-hidden /> Stasiun seismograf</p>
          <p className="mt-1 text-3xl font-semibold">{data.total}</p>
          <p className="mt-1 text-xs text-muted">gambar live dari sumber</p>
        </Panel>
        <Panel className="p-4">
          <p className="flex items-center gap-1.5 text-sm text-muted"><Mountain size={15} aria-hidden /> Gunung api</p>
          <p className="mt-1 text-3xl font-semibold">{volcanoGroups.length}</p>
          <p className="mt-1 text-xs text-muted">memiliki stasiun di daftar sumber</p>
        </Panel>
        <Panel className="p-4">
          <p className="flex items-center gap-1.5 text-sm text-muted"><Clock size={15} aria-hidden /> Daftar diperbarui</p>
          <p className="mt-1 text-lg font-semibold">{fmtClock(data.updatedAt)}</p>
          <p className="mt-1 text-xs text-muted">diperiksa ulang tiap 5 menit</p>
        </Panel>
        <Panel className="p-4">
          <p className="text-sm text-muted">Status sumber</p>
          <p className={`mt-1 text-lg font-semibold ${data.stale || error ? 'text-danger' : 'text-ok'}`}>
            {data.stale || error ? 'Tertunda' : 'Terhubung'}
          </p>
          <p className="mt-1 text-xs text-muted">MAGMA / PVMBG, bukan BMKG</p>
        </Panel>
      </div>

      {!selectedVolcano ? (
        <>
          <Panel title="Pilih gunung api" className="mt-4 overflow-hidden">
            <div className="border-b border-line px-4 py-3">
              <label className="block text-sm">
                <span className="mb-1 block text-muted">Cari nama gunung, kode, atau provinsi</span>
                <span className="relative block max-w-xl">
                  <Search size={15} aria-hidden className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
                  <input
                    className={`${inputCls} pl-8`}
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    aria-label="Cari gunung api"
                    type="search"
                    placeholder="mis. Bromo, Marapi, Jawa Timur"
                  />
                </span>
              </label>
              <p className="mt-2 text-xs text-muted">
                {filteredVolcanoes.length} dari {volcanoGroups.length} gunung api. Gambar seismogram baru dimuat setelah gunung dipilih.
              </p>
            </div>

            {filteredVolcanoes.length === 0 ? (
              <div className="p-4">
                <StateBox kind="empty" title="Gunung api tidak ditemukan">
                  Coba kata kunci lain, atau hapus pencarian untuk melihat semua gunung.
                </StateBox>
              </div>
            ) : (
              <ul className="grid gap-2 p-3 sm:grid-cols-2 xl:grid-cols-3">
                {filteredVolcanoes.map((v) => (
                  <li key={v.name}>
                    <button
                      onClick={() => choose(v.name)}
                      className="group flex w-full items-center gap-3 rounded-lg border border-line bg-bg px-3 py-3 text-left hover:border-accent hover:bg-accent/5"
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
                        <Mountain size={18} aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{v.name}</span>
                        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted">
                          {v.province && (
                            <span className="inline-flex items-center gap-1"><MapPin size={11} aria-hidden /> {v.province}</span>
                          )}
                          <span>{v.count} stasiun</span>
                        </span>
                      </span>
                      <ChevronRight size={16} aria-hidden className="shrink-0 text-muted group-hover:text-accent" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <div className="mt-4">
            <SourcePanel />
          </div>
        </>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <button
                onClick={back}
                aria-label="Kembali ke daftar gunung api"
                className="rounded-md border border-line p-2 text-muted hover:bg-line/40 hover:text-ink"
              >
                <ArrowLeft size={18} aria-hidden />
              </button>
              <div>
                <h2 className="text-lg font-semibold">{selectedGroup?.name ?? selectedVolcano}</h2>
                <p className="mt-0.5 text-sm text-muted">
                  {selectedGroup?.province ? `${selectedGroup.province} · ` : ''}
                  {selectedStations.length} stasiun seismograf live
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => void load('refresh')}
                disabled={refreshing}
                className="flex min-h-9 items-center gap-1.5 rounded-md border border-line px-3 text-sm disabled:opacity-40"
              >
                <RefreshCw size={14} aria-hidden /> {refreshing ? 'Memuat…' : 'Muat ulang'}
              </button>
              <button onClick={back} className="flex min-h-9 items-center gap-1.5 rounded-md border border-line px-3 text-sm">
                <Mountain size={14} aria-hidden /> Pilih gunung lain
              </button>
            </div>
          </div>

          <p className="my-3 text-sm text-muted" aria-live="polite">
            Menampilkan {selectedStations.length} seismogram stasiun di {selectedGroup?.name ?? selectedVolcano}.
            Gambar sumber dapat tertunda beberapa menit.
          </p>

          {selectedStations.length === 0 ? (
            <StateBox kind="empty" title="Tidak ada stasiun untuk gunung ini">
              Daftar sumber sedang tidak memuat stasiun untuk gunung yang dipilih. Coba pilih gunung lain atau muat ulang.
            </StateBox>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {selectedStations.map((s) => {
                const thumb = `/api/seismograms/${s.id}/image?size=thumb${stamp ? `&v=${stamp}` : ''}`;
                return (
                  <li key={s.id} className="overflow-hidden rounded-lg border border-line bg-surface">
                    <div className="flex items-start justify-between gap-2 px-3 py-2.5">
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-semibold" title={s.volcanoName}>{s.volcanoName}</h3>
                        <p className="mt-0.5 truncate text-xs text-muted" title={s.scnl}>
                          {s.station || s.scnl}
                          {s.channel ? ` · ${s.channel}` : ''}
                          {s.volcanoCode ? ` · ${s.volcanoCode}` : ''}
                        </p>
                      </div>
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-danger/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-danger">
                        <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" /> Live
                      </span>
                    </div>
                    <button
                      onClick={() => setSelectedId(s.id)}
                      className="block w-full border-y border-line bg-white"
                    >
                      <span className="sr-only">Perbesar seismogram {s.volcanoName}, stasiun {s.scnl}. </span>
                      <LiveImage
                        src={thumb}
                        alt={`Seismogram stasiun ${s.scnl} di ${s.volcanoName} dari MAGMA Indonesia`}
                        className="block aspect-[5/3] w-full object-contain"
                      />
                    </button>
                    <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                      <span className="font-mono text-[11px] text-muted" title="Kode stasiun-kanal-jaringan-lokasi">{s.scnl}</span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setSelectedId(s.id)}
                          className="inline-flex min-h-8 items-center gap-1 rounded-md border border-line px-2 text-xs font-medium hover:bg-line/40"
                        >
                          <Maximize2 size={13} aria-hidden /> Perbesar
                        </button>
                        <a
                          href={s.pageUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex min-h-8 items-center gap-1 rounded-md border border-line px-2 text-xs font-medium hover:bg-line/40"
                        >
                          MAGMA <ExternalLink size={12} aria-hidden />
                        </a>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="mt-5">
            <SourcePanel />
          </div>
        </>
      )}

      <p className="mt-6 text-xs text-muted">
        Sumber: MAGMA Indonesia, PVMBG — Badan Geologi, Kementerian ESDM. Ketentuan penggunaan data ditentukan oleh pengelola sumber.
        Aplikasi ini bukan sistem peringatan dini.
      </p>

      {selected && <SeismogramDialog station={selected} stamp={stamp} onClose={() => setSelectedId(null)} />}
    </>
  );
}
