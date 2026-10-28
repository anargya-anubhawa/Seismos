'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowLeft, ExternalLink, Info, RefreshCw } from 'lucide-react';
import { PageTitle, Panel, Skeleton, StateBox } from '@/components/ui/common';
import { CopyLinkButton, ShareMenu } from '@/components/share/ShareActions';
import { DeferredImage } from '@/components/volcano/DeferredImage';
import { SATELLITE_GROUP_LABEL } from '@/lib/weather/parse';
import { SOURCE_BMKG_WEATHER, creditLines } from '@/lib/share/report-text';
import { fmtAgo } from '@/lib/formatting';
import type { SatelliteFrame, SatelliteProduct } from '@/types/weather';

interface CataloguePayload {
  products: SatelliteProduct[];
  frames: SatelliteFrame[];
  error?: string;
}

/**
 * Halaman detail satu produk satelit (`/cuaca/satelit/<kode>`).
 *
 * Halaman ini membuat tautan "salin tautan" pada galeri menunjuk alamat yang
 * benar-benar bisa dibuka penerima, sekaligus menyediakan penjelasan resmi
 * BMKG tanpa harus membuka situs BMKG lebih dulu.
 */
export function SatelliteDetailPage({ id }: { id: string }) {
  const [payload, setPayload] = useState<CataloguePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch('/api/weather/satelit', { cache: 'no-store' });
        const data = await res.json() as CataloguePayload;
        if (!alive) return;
        if (!res.ok) throw new Error(data.error ?? `Server membalas HTTP ${res.status}`);
        setPayload(data);
      } catch (err) {
        if (alive) setError(err instanceof Error ? err.message : 'Katalog satelit tidak dapat dimuat');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const product = payload?.products.find((item) => item.id === id) ?? null;
  const frame = payload?.frames.find((item) => item.product.id === id) ?? null;
  const siblings = (payload?.products ?? []).filter((item) => item.id !== id && item.group === product?.group).slice(0, 4);

  if (loading && !payload) {
    return (
      <>
        <PageTitle title="Detail Satelit" hint="Memuat keterangan produk satelit BMKG…" />
        <Skeleton className="h-64" />
      </>
    );
  }

  if (!product) {
    return (
      <>
        <PageTitle title="Detail Satelit" />
        <StateBox kind="error" title="Produk satelit tidak ditemukan">
          Kode <code className="font-mono">{id}</code> tidak ada pada katalog BMKG yang dipakai aplikasi.
          {error ? ` (${error})` : ''}
          <div className="mt-3">
            <Link href="/cuaca/satelit" className="font-medium text-accent underline">Kembali ke galeri satelit</Link>
          </div>
        </StateBox>
      </>
    );
  }

  return (
    <>
      <Link
        href="/cuaca/satelit"
        className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink"
      >
        <ArrowLeft size={14} aria-hidden />
        Semua produk satelit
      </Link>

      <PageTitle
        title={product.name}
        hint={`${SATELLITE_GROUP_LABEL[product.group]} · citra resmi BMKG (INDERAJA)`}
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <Panel className="min-w-0" title="Citra">
          <div className="p-3">
            <DeferredImage
              title={product.name}
              meta={frame?.capturedAt ? `citra ${fmtAgo(frame.capturedAt)}` : undefined}
              alt={`Citra satelit ${product.name} BMKG`}
              src={`${product.imagePath}?v=${frame?.capturedAt ? encodeURIComponent(frame.capturedAt) : '0'}`}
              buttonLabel="Tampilkan citra"
              imageClassName="block w-full rounded-md object-contain"
            />
          </div>
        </Panel>

        <div className="min-w-0 space-y-4">
          <Panel className="min-w-0" title="Penjelasan produk (BMKG)">
            <div className="space-y-3 p-4">
              <p className="flex items-start gap-1.5 text-[11px] text-muted">
                <Info size={12} aria-hidden className="mt-0.5 shrink-0" />
                <span>Keterangan di bawah dikutip dari halaman resmi BMKG, tidak diubah aplikasi.</span>
              </p>
              <p className="text-sm leading-relaxed [overflow-wrap:anywhere]">{product.description}</p>
              <dl className="space-y-1.5 border-t border-line pt-3 text-xs">
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="shrink-0 text-muted">Kode produk</dt>
                  <dd className="min-w-0 truncate text-right font-mono text-[11px]">{product.id}</dd>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="shrink-0 text-muted">Ukuran citra</dt>
                  <dd className="tabular-nums">{product.width} × {product.height} piksel</dd>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="shrink-0 text-muted">Pembaruan citra</dt>
                  <dd className="min-w-0 text-right">
                    {frame?.capturedAt
                      ? new Date(frame.capturedAt).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }) + ' WIB'
                      : 'tidak tercantum'}
                  </dd>
                </div>
              </dl>
            </div>
          </Panel>

          <Panel className="min-w-0" title="Bagikan">
            <div className="space-y-3 p-4">
              <div className="flex flex-wrap gap-2">
                <CopyLinkButton label="Salin tautan" />
                <a
                  href={product.detailUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-line px-3 text-sm font-medium hover:bg-line/40"
                >
                  Halaman BMKG <ExternalLink size={13} aria-hidden />
                </a>
                <ShareMenu
                  title={`Citra satelit ${product.name}`}
                  text={[
                    `CITRA SATELIT BMKG — ${product.name.toUpperCase()}`,
                    product.description,
                    frame?.capturedAt
                      ? `Waktu citra (WIB): ${new Date(frame.capturedAt).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}`
                      : 'Waktu citra tidak tercantum pada sumber.',
                    `Detail resmi: ${product.detailUrl}`,
                    '',
                    creditLines('Seismos Indonesia', SOURCE_BMKG_WEATHER),
                  ].join('\n')}
                />
              </div>
              <p className="text-[11px] leading-relaxed text-muted">
                Setiap penggunaan citra satelit wajib mencantumkan BMKG sebagai sumber dan tidak boleh dipotong
                tanpa menyertakan sumber serta logo BMKG.
              </p>
            </div>
          </Panel>
        </div>
      </div>

      {siblings.length > 0 && (
        <Panel className="mt-4 min-w-0" title={`Produk lain di ${SATELLITE_GROUP_LABEL[product.group]}`}>
          <ul className="grid gap-2 p-3 sm:grid-cols-2">
            {siblings.map((item) => (
              <li key={item.id} className="min-w-0">
                <Link
                  href={`/cuaca/satelit/${item.id}`}
                  className="flex min-h-10 items-center justify-between gap-2 rounded-md border border-line px-3 py-2 text-sm hover:bg-line/40"
                >
                  <span className="min-w-0 truncate">{item.name}</span>
                  <RefreshCw size={12} aria-hidden className="shrink-0 text-muted" />
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </>
  );
}
