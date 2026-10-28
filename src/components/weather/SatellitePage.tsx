'use client';

import { useEffect, useMemo, useState } from 'react';
import { ExternalLink, RefreshCw, Satellite } from 'lucide-react';
import { PageTitle, Panel, Skeleton, StateBox } from '@/components/ui/common';
import { CopyLinkButton, ShareMenu } from '@/components/share/ShareActions';
import { DeferredImage } from '@/components/volcano/DeferredImage';
import { LoadMoreButton, useProgressiveList } from '@/components/volcano/progressive';
import { fmtAgo } from '@/lib/formatting';
import { SATELLITE_GROUP_LABEL } from '@/lib/weather/parse';
import { SOURCE_BMKG_WEATHER, creditLines } from '@/lib/share/report-text';
import type { SatelliteFrame, SatelliteProduct } from '@/types/weather';

interface CataloguePayload {
  products: SatelliteProduct[];
  frames: SatelliteFrame[];
  note?: string;
  error?: string;
}

/**
 * Halaman menu Satelit.
 *
 * Sumber citra sama dengan halaman BMKG `cuaca/satelit`: berkas PNG di
 * `inderaja.bmkg.go.id`. Citra diteruskan server Seismos (tidak dibuka langsung
 * oleh peramban) supaya situs BMKG tidak dibebani alamat IP tiap pengguna.
 *
 * Gambar berukuran 1600–2000 piksel dan bisa beberapa MB, jadi setiap produk
 * hanya diunduh setelah pengguna membuka panelnya (`DeferredImage`).
 */
export function SatellitePage() {
  const [payload, setPayload] = useState<CataloguePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/weather/satelit', { cache: 'no-store' });
      const data = await res.json() as CataloguePayload;
      if (!res.ok) throw new Error(data.error ?? `Server membalas HTTP ${res.status}`);
      setPayload(data);
      setError(data.error ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Katalog satelit tidak dapat dimuat');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const frames = useMemo(() => {
    const map = new Map<string, SatelliteFrame>();
    for (const frame of payload?.frames ?? []) map.set(frame.product.id, frame);
    return map;
  }, [payload]);

  const groups = useMemo(() => {
    const order: SatelliteProduct['group'][] = ['himawari', 'gk2a', 'gsmap', 'lingkungan'];
    return order
      .map((group) => ({ group, products: (payload?.products ?? []).filter((p) => p.group === group) }))
      .filter((entry) => entry.products.length > 0);
  }, [payload]);

  return (
    <>
      <PageTitle
        title="Satelit"
        hint="Citra satelit cuaca resmi BMKG (Himawari-9, GEO-KOMPSAT-2A, GSMaP, dan produk lingkungan). Gambar dibuka satu per satu agar tidak memberatkan koneksi."
      />

      {loading && !payload && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-40" />)}
        </div>
      )}

      {!loading && !payload && (
        <StateBox kind="error" title="Katalog satelit tidak dapat dimuat">
          {error ?? 'Server tidak mengembalikan daftar produk.'}
          <div className="mt-3">
            <button type="button" onClick={() => void load()} className="rounded-md border border-line px-3 py-1.5 text-sm font-medium hover:bg-line/40">
              Coba lagi
            </button>
          </div>
        </StateBox>
      )}

      {payload && (
        <>
          <Panel className="mb-4">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <p className="flex items-center gap-2 text-sm">
                <Satellite size={16} aria-hidden className="text-accent" />
                <strong className="font-semibold">{payload.products.length}</strong> produk citra resmi BMKG
              </p>
              <button
                type="button"
                onClick={() => void load()}
                className="ml-auto inline-flex min-h-9 items-center gap-1.5 rounded-md border border-line px-3 text-sm font-medium hover:bg-line/40"
              >
                <RefreshCw size={14} aria-hidden className={loading ? 'animate-spin' : ''} />
                Periksa pembaruan citra
              </button>
            </div>
            {payload.note && <p className="mt-2 text-[11px] text-muted">{payload.note}</p>}
            {error && <p className="mt-2 text-xs text-danger">{error}</p>}
          </Panel>

          {groups.map(({ group, products }) => (
            <SatelliteGroup
              key={group}
              label={SATELLITE_GROUP_LABEL[group]}
              group={group}
              products={products}
              frames={frames}
            />
          ))}

          <p className="mt-6 text-xs text-muted">
            Sumber: <a className="underline" href="https://www.bmkg.go.id/cuaca/satelit" target="_blank" rel="noopener noreferrer">BMKG — Satelit</a>{' '}
            (citra INDERAJA BMKG). Waktu citra diambil dari keterangan berkas sumber, bukan waktu halaman dibuka.
          </p>
        </>
      )}
    </>
  );
}

function SatelliteGroup({
  label, group, products, frames,
}: {
  label: string;
  group: SatelliteProduct['group'];
  products: SatelliteProduct[];
  frames: Map<string, SatelliteFrame>;
}) {
  const list = useProgressiveList(products, { resetKey: group });
  return (
    <section className="mb-6" aria-label={label}>
      <h2 className="mb-2 text-sm font-semibold">{label}</h2>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {list.visible.map((product) => {
          const frame = frames.get(product.id) ?? null;
          return (
            <DeferredImage
              key={product.id}
              title={product.name}
              meta={frame?.capturedAt ? `citra ${fmtAgo(frame.capturedAt)}` : undefined}
              alt={`Citra satelit ${product.name} BMKG`}
              src={`${product.imagePath}?v=${frame?.capturedAt ? encodeURIComponent(frame.capturedAt) : '0'}`}
              buttonLabel="Tampilkan citra"
              actions={
                <>
                  <CopyLinkButton
                    label="Salin tautan"
                    path={`/cuaca/satelit#${product.id}`}
                  />
                  <ShareMenu
                    compact
                    title={`Citra satelit ${product.name}`}
                    text={[
                      `CITRA SATELIT BMKG — ${product.name.toUpperCase()}`,
                      product.description,
                      frame?.capturedAt
                        ? `Waktu citra (UTC): ${new Date(frame.capturedAt).toISOString().slice(0, 16).replace('T', ' ')}`
                        : 'Waktu citra tidak tercantum pada sumber.',
                      `Citra asli: ${product.sourceUrl}`,
                      '',
                      creditLines('Seismos Indonesia', SOURCE_BMKG_WEATHER),
                    ].join('\n')}
                  />
                </>
              }
              footer={
                <div className="space-y-1.5">
                  <p className="text-xs text-muted">{product.description}</p>
                  {frame?.capturedAt ? (
                    <p className="text-[11px] text-muted">
                      Citra dinyatakan sumber pada {new Date(frame.capturedAt).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB.
                    </p>
                  ) : (
                    <p className="text-[11px] text-muted">Waktu citra tidak tercantum pada sumber.</p>
                  )}
                  <a
                    href={product.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] underline"
                  >
                    Buka citra asli di INDERAJA BMKG <ExternalLink size={10} aria-hidden />
                  </a>
                </div>
              }
            />
          );
        })}
      </div>
      <LoadMoreButton
        hasMore={list.hasMore}
        nextCount={list.nextCount}
        shown={list.shown}
        total={products.length}
        onLoadMore={list.showMore}
        label="produk"
        className="mt-2"
      />
    </section>
  );
}
