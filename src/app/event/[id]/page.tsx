'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { useEarthquakes } from '@/hooks/useEarthquakes';
import { fmtAgo, fmtTime } from '@/lib/formatting';
import { BMKG_SHAKEMAP_BASE } from '@/lib/constants';
import { SOURCE_BMKG, earthquakeReportText } from '@/lib/share/report-text';
import {
  Attribution, LoadingNotice, MagBadge, MmiBadge, PageTitle, Panel, Skeleton, StaleDataNotice, StateBox,
} from '@/components/ui/common';
import { ShareActions } from '@/components/share/ShareActions';
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

  const rows: [string, string][] = [
    ['Waktu kejadian', fmtTime(q.originTime)],
    ['Kedalaman', `${q.depthKm} km`],
    ['Koordinat', `${q.latitude.toFixed(2)}, ${q.longitude.toFixed(2)}`],
    ['Lokasi', q.region],
  ];
  const feltReports = q.feltReports ?? [];

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
            {q.maxMmi ? (
              <div className="flex gap-3 border-b border-line py-2">
                <dt className="w-32 shrink-0 text-muted">MMI dilaporkan</dt>
                <dd className="flex flex-wrap items-center gap-2">
                  <MmiBadge mmi={q.maxMmi} />
                  <span className="text-xs text-muted">
                    dari {feltReports.length || 1} lokasi
                  </span>
                </dd>
              </div>
            ) : null}
            <div className="flex gap-3 py-2">
              <dt className="w-32 shrink-0 text-muted">Dirasakan</dt>
              <dd>{q.felt ?? 'Tidak ada keterangan di data ini'}</dd>
            </div>
          </dl>
          {feltReports.length > 0 && (
            <div className="border-t border-line px-4 py-3">
              <p className="text-sm font-medium">Rincian intensitas MMI</p>
              <p className="mt-1 text-xs text-muted">
                Diurutkan dari intensitas tertinggi. Nilai diurai dari teks
                “Dirasakan” BMKG, bukan estimasi seluruh wilayah.
              </p>
              <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                {feltReports.map((report) => (
                  <li
                    key={`${report.place}-${report.mmiMin}-${report.mmiMax}`}
                    className="flex min-w-0 items-start gap-2 rounded-md border border-line px-2.5 py-2"
                  >
                    <MmiBadge
                      mmi={report.mmiMax}
                      label={report.mmiLabel}
                      compact
                    />
                    <span className="min-w-0 break-words text-sm">
                      {report.place}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-muted">
                Aplikasi tidak menghitung estimasi MMI sendiri. Intensitas di
                lokasi lain dapat berbeda dan tidak ditampilkan tanpa laporan
                resmi.
              </p>
            </div>
          )}
          <div className="space-y-1 border-t border-line px-4 py-3 text-xs text-muted">
            <p>Dihitung aplikasi (bukan dari BMKG): konversi waktu ke WIB dan selisih “{fmtAgo(q.originTime)}”.</p>
            <p>Muncul di daftar BMKG: {q.sources.map((s) => SOURCE_LABEL[s]).join(', ')}.</p>
            <p>Dampak, kerusakan, atau korban tidak ditampilkan karena data terbuka BMKG ini tidak memuatnya.</p>
          </div>
          <div className="border-t border-line px-4 py-3">
            <ShareActions
              source={SOURCE_BMKG}
              reportText={earthquakeReportText(q, { pageUrl: typeof window !== 'undefined' ? window.location.href : undefined })}
              shareTitle={`Info Gempa M ${q.magnitude.toFixed(1)} — ${q.region}`}
              attachments={q.shakemapFile ? [{
                fileName: `shakemap-${q.id.replace(/[^a-z0-9]+/gi, '-')}.png`,
                url: `${BMKG_SHAKEMAP_BASE}${encodeURIComponent(q.shakemapFile)}`,
                type: 'image/png',
                label: `Shakemap BMKG (M ${q.magnitude.toFixed(1)})`,
              }] : []}
            />
          </div>
        </Panel>

        <div className="space-y-4 lg:col-span-3">
          <Panel title="Lokasi episenter" className="overflow-hidden">
            <div className="h-72"><QuakeMapLazy events={[q]} selectedId={q.id} highlightLatest={false} /></div>
          </Panel>
          {q.shakemapFile && (
            <Panel title="Shakemap resmi BMKG">
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
