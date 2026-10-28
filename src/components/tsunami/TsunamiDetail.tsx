'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft, Check, Clock, ExternalLink, MapPin, Share2, TriangleAlert, Waves,
} from 'lucide-react';
import { fmtTime } from '@/lib/formatting';
import type { TsunamiAlert, TsunamiSourceStatus } from '@/types/tsunami';
import { PageTitle, Panel, Skeleton, StateBox } from '@/components/ui/common';
import {
  TsunamiAlertHeader, TsunamiEtaNotice, TsunamiObservationList, TsunamiRegionList,
  TsunamiSafetyGuidance, TsunamiSourceStatusList, TsunamiUpdateTimeline,
} from '@/components/tsunami/parts';

interface DetailResponse {
  alert: TsunamiAlert;
  checkedAt: string | null;
  stale: boolean;
  sources: TsunamiSourceStatus[];
}

function MapLinks({ alert }: { alert: TsunamiAlert }) {
  const links: { url: string | null; label: string }[] = [
    { url: alert.maps.travelTime, label: 'Peta waktu tempuh tsunami' },
    { url: alert.maps.coastalThreat, label: 'Peta ancaman pesisir' },
    { url: alert.maps.seaLevel, label: 'Peta tinggi muka laut' },
    { url: alert.maps.shakemap, label: 'Shakemap gempa' },
  ];
  const available = links.filter((link): link is { url: string; label: string } => Boolean(link.url));
  if (available.length === 0) return <p className="text-sm text-muted">Tidak ada peta yang dicantumkan BMKG pada data ini.</p>;
  return (
    <ul className="space-y-1.5 text-sm">
      {available.map((link) => (
        <li key={link.url}>
          <a href={link.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 font-medium text-accent underline">
            <ExternalLink size={13} aria-hidden /> {link.label}
          </a>
        </li>
      ))}
    </ul>
  );
}

export function TsunamiDetail({ id }: { id: string }) {
  const [detail, setDetail] = useState<DetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const response = await fetch(`/api/tsunami/${encodeURIComponent(id)}`, { cache: 'no-store' });
      if (response.status === 404) {
        setNotFound(true);
        setDetail(null);
        setError(null);
        return;
      }
      const payload = await response.json().catch(() => null) as DetailResponse & { error?: string } | null;
      if (!response.ok || !payload?.alert) {
        throw new Error(payload?.error ?? `Server membalas HTTP ${response.status}`);
      }
      setDetail(payload);
      setNotFound(false);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Tidak dapat memuat detail peringatan.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load(false);
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load(true);
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [load]);

  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2_000);
    } catch {
      setCopied(false);
    }
  };

  const back = (
    <Link href="/tsunami" className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium underline">
      <ArrowLeft size={15} aria-hidden /> Kembali ke status tsunami
    </Link>
  );

  if (loading && !detail && !notFound) {
    return (
      <>
        {back}
        <PageTitle title="Detail peringatan tsunami" hint="Memuat data resmi BMKG…" />
        <Skeleton className="h-96" />
      </>
    );
  }

  if (notFound) {
    return (
      <>
        {back}
        <StateBox kind="empty" title="Peringatan tsunami tidak ditemukan">
          Data peringatan lama dapat sudah dipangkas dari penyimpanan server. Buka halaman status tsunami untuk melihat
          peringatan terbaru, atau rujuk kanal resmi BMKG.
        </StateBox>
      </>
    );
  }

  if (!detail) {
    return (
      <>
        {back}
        <StateBox kind="error" title="Detail peringatan tidak dapat dimuat">
          {error ?? 'Server tidak mengembalikan data peringatan.'}
        </StateBox>
      </>
    );
  }

  const { alert } = detail;
  const active = alert.status === 'active';
  const potentialDiffers = alert.potential && alert.potential !== alert.headline && alert.potential !== alert.description;

  return (
    <>
      {back}
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <PageTitle
          title={active ? 'Peringatan tsunami aktif' : 'Peringatan tsunami berakhir'}
          hint={`${alert.subject} · ${alert.sourceName}`}
        />
        <div className="flex gap-2">
          <button type="button" onClick={() => void share()} className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-line px-3 text-sm font-medium">
            {copied ? <Check size={15} aria-hidden /> : <Share2 size={15} aria-hidden />}
            {copied ? 'Tautan disalin' : 'Salin tautan'}
          </button>
          <a href={alert.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-line px-3 text-sm font-medium">
            <ExternalLink size={15} aria-hidden /> Sumber BMKG
          </a>
        </div>
      </div>

      {detail.stale && (
        <div role="alert" className="mb-4 rounded-lg border border-danger/50 bg-surface px-4 py-2.5 text-sm text-danger">
          Pembaruan BMKG sedang tertunda. Data ini adalah data terakhir yang tersimpan dan bisa sudah tidak mutakhir.
          Jangan menganggap status berakhir atau tidak ada peringatan sebagai jaminan aman.
        </div>
      )}

      <div className={`mb-4 rounded-lg border p-4 ${active ? 'border-danger/60 bg-danger/10' : 'border-line bg-surface'}`}>
        <div className="flex items-start gap-3">
          {active
            ? <TriangleAlert size={22} aria-hidden className="mt-0.5 shrink-0 text-danger" />
            : <Waves size={22} aria-hidden className="mt-0.5 shrink-0 text-muted" />}
          <div className="min-w-0">
            <TsunamiAlertHeader alert={alert} />
            <h1 className="mt-2 text-lg font-semibold">{alert.headline}</h1>
            {alert.description && alert.description !== alert.headline && (
              <p className="mt-1 text-sm text-muted">{alert.description}</p>
            )}
            {potentialDiffers && <p className="mt-1 text-xs text-muted">Potensi resmi: {alert.potential}</p>}
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Panel title="Data gempa pemicu">
            <dl className="grid gap-x-4 gap-y-2 px-4 py-3 text-sm sm:grid-cols-2">
              <div className="flex items-center gap-1.5">
                <dt className="text-muted">Magnitudo</dt>
                <dd className="font-semibold">{alert.magnitude !== null ? `M ${alert.magnitude.toFixed(1)}` : 'Tidak tercantum'}</dd>
              </div>
              <div className="flex items-center gap-1.5">
                <dt className="text-muted">Kedalaman</dt>
                <dd>{alert.depthKm !== null ? `${alert.depthKm} km` : 'Tidak tercantum'}</dd>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock size={14} aria-hidden className="text-muted" />
                <dt className="text-muted">Waktu gempa</dt>
                <dd>{alert.originTime ? fmtTime(alert.originTime) : 'Tidak tercantum'}</dd>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock size={14} aria-hidden className="text-muted" />
                <dt className="text-muted">Terbit pembaruan</dt>
                <dd>{fmtTime(alert.issueTime)}</dd>
              </div>
              <div className="flex items-start gap-1.5 sm:col-span-2">
                <MapPin size={14} aria-hidden className="mt-0.5 text-muted" />
                <dt className="text-muted">Lokasi</dt>
                <dd>{alert.region}</dd>
              </div>
              {alert.latitude !== null && alert.longitude !== null && (
                <div className="flex items-center gap-1.5 sm:col-span-2">
                  <dt className="text-muted">Koordinat</dt>
                  <dd>{alert.latitude.toFixed(2)}, {alert.longitude.toFixed(2)}</dd>
                </div>
              )}
              {alert.endedAt && (
                <div className="flex items-center gap-1.5 sm:col-span-2">
                  <dt className="text-muted">Dinyatakan berakhir</dt>
                  <dd>{fmtTime(alert.endedAt)}</dd>
                </div>
              )}
            </dl>
          </Panel>

          <Panel title="Wilayah pesisir terdampak">
            <div className="px-4 py-3">
              <TsunamiRegionList alert={alert} />
            </div>
          </Panel>

          <Panel title="Pengamatan muka laut">
            <div className="px-4 py-3">
              <TsunamiObservationList observations={alert.observations} />
            </div>
          </Panel>

          <Panel title="ETA & peta resmi">
            <div className="space-y-3 px-4 py-3">
              <TsunamiEtaNotice alert={alert} />
              <MapLinks alert={alert} />
            </div>
          </Panel>

          <Panel title="Instruksi resmi BMKG">
            <div className="px-4 py-3 text-sm">
              {alert.instructions.length > 0 ? (
                <ul className="list-disc space-y-1.5 pl-5">
                  {alert.instructions.map((instruction) => <li key={instruction}>{instruction}</li>)}
                </ul>
              ) : (
                <p className="text-muted">BMKG tidak mencantumkan instruksi rinci pada pembaruan ini. Ikuti arahan pemerintah daerah dan kanal resmi BMKG.</p>
              )}
            </div>
          </Panel>

          <Panel title="Riwayat pembaruan & status">
            <div className="px-4 py-3">
              <TsunamiUpdateTimeline updates={alert.updates} />
            </div>
          </Panel>
        </div>

        <aside className="space-y-4">
          <Panel title="Ringkasan status">
            <dl className="px-4 py-3 text-sm">
              <div className="flex justify-between gap-3 border-b border-line py-2">
                <dt className="text-muted">Status</dt>
                <dd className={`font-semibold ${active ? 'text-danger' : 'text-muted'}`}>{active ? 'AKTIF' : 'BERAKHIR'}</dd>
              </div>
              <div className="flex justify-between gap-3 border-b border-line py-2">
                <dt className="text-muted">Fase BMKG</dt>
                <dd>{alert.phase ?? 'Tidak tercantum'}</dd>
              </div>
              <div className="flex justify-between gap-3 border-b border-line py-2">
                <dt className="text-muted">Wilayah dirinci</dt>
                <dd>{alert.regions.length}</dd>
              </div>
              <div className="flex justify-between gap-3 border-b border-line py-2">
                <dt className="text-muted">Pengamatan</dt>
                <dd>{alert.observations.length}</dd>
              </div>
              <div className="flex justify-between gap-3 py-2">
                <dt className="text-muted">Diperiksa</dt>
                <dd>{detail.checkedAt ? fmtTime(detail.checkedAt) : 'Belum pernah'}</dd>
              </div>
            </dl>
          </Panel>

          <Panel title="Panduan keselamatan">
            <TsunamiSafetyGuidance />
          </Panel>

          <Panel title="Status sumber">
            <TsunamiSourceStatusList sources={detail.sources} />
          </Panel>
        </aside>
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded border border-danger/50 bg-surface px-3 py-2 text-sm text-danger">
          Pembaruan detail gagal: {error}. Menampilkan data terakhir yang tersimpan.
        </p>
      )}

      <p className="mt-6 text-xs text-muted">
        Sumber: BMKG/InaTEWS. Informasi dapat berubah setelah pemutakhiran resmi. Aplikasi ini bukan sistem peringatan
        dini resmi dan tidak menggantikan arahan BMKG, BNPB, BPBD, atau pemerintah daerah.
      </p>
    </>
  );
}
