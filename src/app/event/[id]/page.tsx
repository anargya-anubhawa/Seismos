'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ArrowLeft, Share2 } from 'lucide-react';
import { useEarthquakes } from '@/hooks/useEarthquakes';
import { fmtAgo, fmtTime } from '@/lib/formatting';
import { BMKG_SHAKEMAP_BASE } from '@/lib/constants';
import {
  Attribution, LoadingNotice, MagBadge, PageTitle, Panel, Skeleton, StaleDataNotice, StateBox,
} from '@/components/ui/common';
import { QuakeMapLazy } from '@/components/map/QuakeMapLazy';

const SOURCE_LABEL = {
  terbaru: 'Gempa terbaru',
  m5: '15 gempa M 5,0+',
  dirasakan: '15 gempa dirasakan',
  felt30: 'Gempa dirasakan InaTEWS (30 terbaru)',
  live: 'Gempa terkini InaTEWS',
} as const;

export default function EventPage({ params }: { params: { id: string } }) {
  const { data, loading, error } = useEarthquakes();
  const [copied, setCopied] = useState<'ok' | 'fail' | null>(null);
  let id = params.id;
  try { id = decodeURIComponent(params.id); } catch { /* pakai apa adanya */ }

  const back = (
    <Link href="/history" className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium underline">
      <ArrowLeft size={15} aria-hidden /> Kembali ke riwayat
    </Link>
  );

  if (loading && !data) {
    return (
      <>
        {back}
        <LoadingNotice>Mengambil data kejadian…</LoadingNotice>
        <Skeleton className="h-96" />
      </>
    );
  }
  if (!data) {
    return (
      <>
        {back}
        <StateBox kind="error" title="Data gempa tidak dapat dimuat">
          {error ?? 'Sumber BMKG tidak merespons.'}
        </StateBox>
      </>
    );
  }

  const q = data.events.find((e) => e.id === id);
  if (!q) {
    return (
      <>
        {back}
        <StateBox kind="empty" title="Kejadian tidak ditemukan">
          BMKG hanya menyediakan beberapa kejadian terbaru, sehingga kejadian lama bisa sudah tidak ada di daftar.
        </StateBox>
      </>
    );
  }

  const share = async () => {
    try { await navigator.clipboard.writeText(window.location.href); setCopied('ok'); }
    catch { setCopied('fail'); }
  };

  const rows: [string, string][] = [
    ['Waktu kejadian', fmtTime(q.originTime)],
    ['Kedalaman', `${q.depthKm} km`],
    ['Koordinat', `${q.latitude.toFixed(2)}, ${q.longitude.toFixed(2)}`],
    ['Lokasi', q.region],
  ];

  return (
    <>
      {back}
      <PageTitle title={`Gempa M ${q.magnitude.toFixed(1)}`} hint="Informasi sementara dari BMKG; dapat dimutakhirkan." />
      <StaleDataNotice error={error} updatedAt={data.updatedAt} />
      <div className="grid gap-4 lg:grid-cols-5">
        <Panel title="Data dari BMKG" className="lg:col-span-2">
          <div className="flex items-center gap-3 px-4 pt-4">
            <MagBadge m={q.magnitude} large />
            <p className="text-sm text-muted">Magnitudo (skala yang dilaporkan BMKG)</p>
          </div>
          <dl className="px-4 py-3 text-sm">
            {rows.map(([k, v]) => (
              <div key={k} className="flex gap-3 border-b border-line py-2 last:border-0">
                <dt className="w-32 shrink-0 text-muted">{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
            <div className="flex gap-3 border-b border-line py-2">
              <dt className="w-32 shrink-0 text-muted">Potensi tsunami</dt>
              <dd>{q.tsunamiNote ?? 'Tidak ada pernyataan di data ini'}</dd>
            </div>
            <div className="flex gap-3 py-2">
              <dt className="w-32 shrink-0 text-muted">Dirasakan</dt>
              <dd>{q.felt ?? 'Tidak ada keterangan di data ini'}</dd>
            </div>
          </dl>
          <div className="space-y-1 border-t border-line px-4 py-3 text-xs text-muted">
            <p>Dihitung aplikasi (bukan dari BMKG): konversi waktu ke WIB dan selisih “{fmtAgo(q.originTime)}”.</p>
            <p>Muncul di daftar BMKG: {q.sources.map((s) => SOURCE_LABEL[s]).join(', ')}.</p>
            <p>Dampak, kerusakan, atau korban tidak ditampilkan karena data terbuka BMKG ini tidak memuatnya.</p>
          </div>
          <div className="flex items-center gap-3 border-t border-line px-4 py-3">
            <button onClick={share} className="flex items-center gap-1.5 rounded-md border border-line px-3 py-1.5 text-sm hover:bg-line/40">
              <Share2 size={15} aria-hidden /> Salin tautan
            </button>
            <span className="text-sm" aria-live="polite">
              {copied === 'ok' && 'Tautan disalin.'}
              {copied === 'fail' && 'Tidak dapat menyalin. Salin dari bilah alamat.'}
            </span>
          </div>
        </Panel>

        <div className="space-y-4 lg:col-span-3">
          <Panel title="Lokasi episenter" className="overflow-hidden">
            <div className="h-72"><QuakeMapLazy events={[q]} selectedId={q.id} highlightLatest={false} /></div>
          </Panel>
          {q.shakemapFile && (
            <Panel title="Shakemap resmi BMKG">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`${BMKG_SHAKEMAP_BASE}${encodeURIComponent(q.shakemapFile)}`} alt={`Peta guncangan (shakemap) BMKG untuk gempa M ${q.magnitude.toFixed(1)} di ${q.region}`} className="w-full" loading="lazy" />
              <p className="px-4 py-2 text-xs text-muted">Gambar dimuat langsung dari server BMKG. Jika tidak tampil, berkas mungkin belum tersedia.</p>
            </Panel>
          )}
        </div>
      </div>
      <Attribution />
    </>
  );
}
