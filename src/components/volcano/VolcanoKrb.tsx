'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Download, ExternalLink, Maximize2, Search, X } from 'lucide-react';
import { LoadingNotice, Panel, Skeleton } from '@/components/ui/common';
import { fmtTime } from '@/lib/formatting';
import { useVolcanoQuery } from '@/hooks/useVolcano';
import type { KrbMap } from '@/types/volcano';
import type { VolcanoKrbPayload } from '@/types/volcano-ui';
import { DeferredImage } from './DeferredImage';
import { LoadMoreButton, useProgressiveList } from './progressive';
import { krbDetailHref } from './links';
import { CopyMiniReport } from '@/components/share/CopyMiniReport';
import { ShareMenu } from '@/components/share/ShareActions';
import { krbText } from '@/lib/share/report-text';
import { SourceImage } from './parts';
import { Disclaimer, OfflineNotice, VolcanoEmpty, VolcanoErrorBox, VolcanoPage } from './layout';

function KrbViewer({ map, onClose }: { map: KrbMap; onClose: () => void }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-2 sm:p-6" role="presentation" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Peta KRB Gunung ${map.volcanoName}`}
        className="flex max-h-full w-full max-w-6xl flex-col overflow-hidden rounded-lg border border-line bg-surface"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-line px-4 py-3">
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold">Peta KRB Gunung {map.volcanoName}</h2>
            <p className="mt-0.5 text-xs text-muted">
              {map.year ? `Peta tahun ${map.year}` : 'Tahun peta tidak tercantum'}
              {map.fileSize ? ` · ${(map.fileSize / 1_000_000).toFixed(1)} MB` : ''}
            </p>
          </div>
          <button autoFocus onClick={onClose} aria-label="Tutup peta KRB" className="rounded p-2 text-muted hover:bg-line/50 hover:text-ink">
            <X size={20} aria-hidden />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto bg-white p-1 sm:p-2">
          <SourceImage
            eager
            src={map.imagePath}
            alt={`Peta Kawasan Rawan Bencana Gunung ${map.volcanoName} dari PVMBG`}
            className="mx-auto block w-full max-w-full object-contain"
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-2 text-xs">
          <span className="text-muted">Gambar peta resmi PVMBG melalui MAGMA. Legenda ada pada gambar sumber.</span>
          <div className="flex flex-wrap gap-2">
            <a href={map.downloadPath} className="inline-flex min-h-8 items-center gap-1 rounded-md border border-line px-2 font-medium">
              <Download size={12} aria-hidden /> Unduh berkas
            </a>
            <a href={map.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-8 items-center gap-1 rounded-md border border-line px-2 font-medium">
              Berkas sumber <ExternalLink size={11} aria-hidden />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Peta Kawasan Rawan Bencana. MAGMA hanya menerbitkan berkas gambar peta;
 * poligon KRB memerlukan token layanan sehingga tidak digambar ulang di sini.
 */
export function VolcanoKrb() {
  const query = useVolcanoQuery<VolcanoKrbPayload>('/api/volcano/krb', { pollMs: 3_600_000 });
  const [search, setSearch] = useState('');
  const [term, setTerm] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);

  const maps = useMemo(() => query.data?.maps ?? [], [query.data]);
  const filtered = useMemo(() => {
    const needle = term.trim().toLowerCase();
    return maps
      .filter((map) => !needle || map.volcanoName.toLowerCase().includes(needle))
      .sort((a, b) => a.volcanoName.localeCompare(b.volcanoName, 'id'));
  }, [maps, term]);
  const open = maps.find((map) => map.id === openId) ?? null;
  const list = useProgressiveList(filtered, { resetKey: term.trim().toLowerCase() });

  if (query.loading && !query.data) {
    return (
      <VolcanoPage title="Peta KRB" hint="Peta Kawasan Rawan Bencana resmi PVMBG yang diterbitkan melalui MAGMA.">
        <LoadingNotice>Mengambil daftar peta KRB dari MAGMA…</LoadingNotice>
        <Skeleton className="h-72 w-full" />
      </VolcanoPage>
    );
  }

  if (!query.data) {
    return (
      <VolcanoPage title="Peta KRB">
        <OfflineNotice offline={query.offline} />
        <VolcanoErrorBox message={query.error ?? 'Daftar peta KRB tidak tersedia.'} retry={() => void query.refresh()} />
      </VolcanoPage>
    );
  }

  return (
    <VolcanoPage
      title="Peta Kawasan Rawan Bencana (KRB)"
      hint="Berkas peta resmi PVMBG. Batas zona pada peta mengikuti dokumen sumber; Seismos tidak menggambar batas sendiri."
      updatedAt={query.data.updatedAt}
      errors={query.data.error ? [query.data.error] : []}
    >
      <OfflineNotice offline={query.offline} />

      <p className="mb-3 rounded-lg border border-line bg-surface px-3 py-2 text-xs text-muted">
        {query.data.note} Legenda zona (KRB I, II, III) tercantum pada masing-masing gambar peta resmi. Zona KRB bukan
        prakiraan bahwa erupsi pasti terjadi dan bukan jalur evakuasi resmi.
      </p>

      <form
        className="mb-3 flex flex-wrap items-center gap-2"
        onSubmit={(event) => { event.preventDefault(); setTerm(search); }}
      >
        <label className="relative flex min-h-10 flex-1 items-center sm:max-w-xs">
          <Search size={15} aria-hidden className="pointer-events-none absolute left-2.5 text-muted" />
          <span className="sr-only">Cari gunung api yang memiliki peta KRB</span>
          <input
            value={search}
            onChange={(event) => { setSearch(event.target.value); setTerm(event.target.value); }}
            placeholder="Cari gunung api"
            className="min-h-10 w-full rounded-md border border-line bg-surface pl-8 pr-2 text-sm"
          />
        </label>
        <span className="text-xs text-muted">{filtered.length} gunung api memiliki peta</span>
      </form>

      {filtered.length === 0 ? (
        <VolcanoEmpty title="Tidak ada peta KRB yang cocok">
          MAGMA tidak menyertakan gunung api ini pada daftar peta KRB, atau pencarian tidak menemukan hasil.
        </VolcanoEmpty>
      ) : (
        <>
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {list.visible.map((map) => (
            <li key={map.id}>
              <DeferredImage
                title={`Gunung ${map.volcanoName}`}
                meta={[
                  map.year ? `Peta ${map.year}` : 'Tahun tidak tercantum',
                  map.fileSize ? `${(map.fileSize / 1_000_000).toFixed(1)} MB` : null,
                ].filter(Boolean).join(' · ')}
                alt={`Peta Kawasan Rawan Bencana Gunung ${map.volcanoName} dari PVMBG`}
                src={map.imagePath}
                buttonLabel="Buka peta"
                imageClassName="mx-auto block max-h-[80vh] w-full object-contain"
                actions={(
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Link href={krbDetailHref(map)} className="font-medium text-accent underline">
                        Detail gunung api
                      </Link>
                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => setOpenId(map.id)} className="inline-flex min-h-8 items-center gap-1 rounded-md border border-line px-2 font-medium">
                          <Maximize2 size={12} aria-hidden /> Layar penuh
                        </button>
                        <a href={map.downloadPath} className="inline-flex min-h-8 items-center gap-1 rounded-md border border-line px-2 font-medium">
                          <Download size={12} aria-hidden /> Unduh
                        </a>
                      </div>
                    </div>
                    {/* Peta KRB adalah dokumen utamanya, jadi ikut bisa disalin/dibagikan. */}
                    <div className="flex flex-wrap items-center gap-2 border-t border-line pt-2">
                      <CopyMiniReport text={krbText(map)} label={`Salin info peta KRB Gunung ${map.volcanoName}`} />
                      <ShareMenu
                        title={`Peta KRB Gunung ${map.volcanoName} — Seismos Indonesia`}
                        text={krbText(map)}
                        label="Kirim ke…"
                        compact
                        attachments={[{
                          fileName: `krb-${(map.volcanoCode || map.volcanoName).toLowerCase()}.jpg`,
                          url: map.imagePath,
                          type: 'image/jpeg',
                          label: 'Berkas peta KRB (gambar)',
                        }]}
                      />
                    </div>
                  </div>
                )}
              />
            </li>
          ))}
        </ul>
          <LoadMoreButton
            hasMore={list.hasMore}
            nextCount={list.nextCount}
            shown={list.shown}
            total={filtered.length}
            onLoadMore={list.showMore}
            label="peta"
            className="mt-3 rounded-lg border border-line bg-surface"
          />
        </>
      )}

      <p className="mt-3 text-xs text-muted">
        Diambil {fmtTime(query.data.updatedAt)}. Berkas KRB dapat berukuran puluhan MB; pratinjau diambil melalui
        server Seismos agar tidak membebani koneksi langsung ke MAGMA.
      </p>

      <Disclaimer>
        Interpretasi peta KRB harus mengikuti dokumen resmi dan arahan Badan Geologi/PVMBG serta pemerintah daerah.
        Peta ini bukan pernyataan bahwa erupsi akan terjadi.
      </Disclaimer>

      {open && <KrbViewer map={open} onClose={() => setOpenId(null)} />}
    </VolcanoPage>
  );
}
