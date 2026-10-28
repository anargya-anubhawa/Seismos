'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  CircleCheck, CircleHelp, ExternalLink, Loader2, RefreshCw, ShieldCheck, TriangleAlert, Waves,
} from 'lucide-react';
import { useTsunami } from '@/hooks/useTsunami';
import { fmtTime } from '@/lib/formatting';
import type { TsunamiFeed } from '@/types/tsunami';
import { PageTitle, Panel, Skeleton, StateBox } from '@/components/ui/common';
import { CopyLinkButton } from '@/components/share/ShareActions';
import {
  TsunamiAlertCard, TsunamiSafetyGuidance, TsunamiSourceStatusList,
} from '@/components/tsunami/parts';
import { TsunamiPushSettings } from '@/components/tsunami/TsunamiPushSettings';

function StatusBanner({ feed }: { feed: TsunamiFeed }) {
  const checked = feed.checkedAt ? fmtTime(feed.checkedAt) : 'belum pernah';
  if (feed.state === 'active') {
    return (
      <div role="alert" className="mb-4 rounded-lg border border-danger/60 bg-danger/10 p-4">
        <div className="flex items-start gap-3">
          <TriangleAlert size={22} aria-hidden className="mt-0.5 shrink-0 text-danger" />
          <div>
            <p className="font-semibold text-danger">
              Peringatan tsunami aktif{feed.activeAlerts.length > 1 ? ` (${feed.activeAlerts.length})` : ''}
            </p>
            <p className="mt-1 text-sm">
              BMKG mencantumkan peringatan tsunami yang masih aktif. Ikuti instruksi resmi dan segera menjauhi pantai
              bila berada di wilayah berisiko.
            </p>
            <p className="mt-1 text-xs text-muted">
              Terakhir diperiksa {checked}. Status dapat berubah sewaktu-waktu; rujuk kanal resmi BMKG.
            </p>
            {feed.message && <p className="mt-2 rounded border border-danger/40 bg-surface/60 px-2.5 py-1.5 text-xs text-danger">{feed.message}</p>}
          </div>
        </div>
      </div>
    );
  }

  if (feed.state === 'none') {
    return (
      <div role="status" className="mb-4 rounded-lg border border-ok/50 bg-ok/5 p-4">
        <div className="flex items-start gap-3">
          <CircleCheck size={22} aria-hidden className="mt-0.5 shrink-0 text-ok" />
          <div>
            <p className="font-semibold text-ok">Tidak ada peringatan tsunami aktif yang tercatat</p>
            <p className="mt-1 text-sm">
              Sumber riwayat BMKG berhasil diperiksa {checked} dan tidak memuat peringatan tsunami aktif. Ini bukan
              jaminan situasi aman: gempa dapat terjadi kapan saja dan peringatan dapat diterbitkan setelah pemeriksaan ini.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div role="alert" className="mb-4 rounded-lg border border-danger/60 bg-danger/10 p-4">
      <div className="flex items-start gap-3">
        <CircleHelp size={22} aria-hidden className="mt-0.5 shrink-0 text-danger" />
        <div>
          <p className="font-semibold text-danger">Status tsunami tidak dapat dipastikan</p>
          <p className="mt-1 text-sm">
            {feed.message ?? 'Pembaruan BMKG belum berhasil dimuat. Jangan menganggap situasi aman.'}
          </p>
          <p className="mt-1 text-xs text-muted">
            Pemeriksaan terakhir: {checked}. Ikuti kanal resmi BMKG, BNPB, dan pemerintah daerah.
          </p>
        </div>
      </div>
    </div>
  );
}

export function TsunamiContent() {
  const { data, loading, error, refresh } = useTsunami();
  const [refreshing, setRefreshing] = useState(false);

  const refreshNow = async () => {
    setRefreshing(true);
    try { await refresh(); } finally { setRefreshing(false); }
  };

  if (loading && !data) {
    return (
      <>
        <PageTitle title="Peringatan Tsunami" hint="Memeriksa peringatan resmi BMKG…" />
        <Skeleton className="mb-4 h-28" />
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-72 lg:col-span-2" />
          <Skeleton className="h-72" />
        </div>
      </>
    );
  }

  if (!data) {
    return (
      <>
        <PageTitle title="Peringatan Tsunami" />
        <StateBox kind="error" title="Status tsunami tidak dapat dimuat">
          {error ?? 'Server tidak mengembalikan status tsunami.'}
          <div className="mt-3">
            <button type="button" onClick={() => void refreshNow()} className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-line px-3 text-sm font-medium">
              <RefreshCw size={15} aria-hidden /> Coba lagi
            </button>
          </div>
        </StateBox>
      </>
    );
  }

  const ended = data.alerts.filter((alert) => alert.status === 'ended');

  return (
    <>
      <PageTitle
        title="Peringatan Tsunami"
        hint="Status peringatan tsunami resmi BMKG/InaTEWS, wilayah pesisir, pembaruan, dan pernyataan berakhir. Halaman ini bukan pengganti kanal resmi."
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted">
          {data.checkedAt ? `Diperiksa ${fmtTime(data.checkedAt)}` : 'Belum ada pemeriksaan yang berhasil'}
          {data.updatedAt ? ` · data sumber ${fmtTime(data.updatedAt)}` : ''}
        </p>
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <CopyLinkButton />
          <button
            type="button"
            onClick={() => void refreshNow()}
            disabled={refreshing}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-line px-3 text-sm font-medium disabled:opacity-50"
          >
            {refreshing ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <RefreshCw size={15} aria-hidden />}
            {refreshing ? 'Memeriksa…' : 'Periksa sekarang'}
          </button>
        </div>
      </div>

      <StatusBanner feed={data} />

      {error && (
        <div role="alert" className="mb-4 rounded-lg border border-danger/50 bg-surface px-4 py-2.5 text-sm text-danger">
          Pembaruan terakhir gagal: {error}. Status di atas memakai data terakhir yang tersimpan dan bisa sudah tidak mutakhir.
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {data.activeAlerts.length > 0 ? (
            <section aria-labelledby="tsunami-active-heading" className="space-y-3">
              <h2 id="tsunami-active-heading" className="text-base font-semibold">Peringatan aktif</h2>
              {data.activeAlerts.map((alert) => <TsunamiAlertCard key={alert.id} alert={alert} />)}
            </section>
          ) : (
            <Panel title="Peringatan aktif">
              <div className="px-4 py-4 text-sm">
                <p className="flex items-start gap-2">
                  <Waves size={17} aria-hidden className="mt-0.5 shrink-0 text-muted" />
                  {data.state === 'none'
                    ? 'Tidak ada peringatan tsunami aktif pada data BMKG yang berhasil diperiksa.'
                    : 'Status peringatan aktif tidak dapat dipastikan karena pembaruan BMKG tertunda. Jangan menganggap situasi aman.'}
                </p>
              </div>
            </Panel>
          )}

          {ended.length > 0 && (
            <section aria-labelledby="tsunami-ended-heading" className="space-y-3">
              <h2 id="tsunami-ended-heading" className="text-base font-semibold">Peringatan terakhir yang berakhir</h2>
              <p className="text-xs text-muted">
                Ditampilkan untuk konteks. Peringatan berstatus berakhir sudah tidak berlaku, tetapi gelombang susulan
                dan risiko pantai dapat tetap ada. Ikuti instruksi resmi setempat.
              </p>
              {ended.map((alert) => <TsunamiAlertCard key={alert.id} alert={alert} compact />)}
            </section>
          )}

          <Panel title="Panduan keselamatan tsunami">
            <TsunamiSafetyGuidance />
            <div className="border-t border-line px-4 py-3 text-sm">
              <Link href="/mitigasi" className="inline-flex items-center gap-1.5 font-medium text-accent underline">
                <ShieldCheck size={15} aria-hidden /> Panduan mitigasi gempa & tsunami
              </Link>
            </div>
          </Panel>
        </div>

        <aside className="space-y-4">
          <Panel title="Notifikasi push tsunami">
            <div className="px-4 py-3">
              <TsunamiPushSettings compact />
            </div>
          </Panel>

          <Panel title="Status sumber BMKG">
            <TsunamiSourceStatusList sources={data.sources} />
          </Panel>

          <Panel title="Tentang data ini">
            <div className="space-y-2 px-4 py-3 text-xs text-muted">
              <p>
                Server memeriksa feed WRS BMKG dan halaman riwayat peringatan tsunami BMKG secara berkala. Peringatan
                hanya dibuat dari teks resmi BMKG; aplikasi tidak mengarang status, wilayah, atau ETA.
              </p>
              <p>
                ETA per wilayah hanya ditampilkan bila BMKG menyediakannya. Data ini dapat berubah setelah pemutakhiran.
              </p>
              <div className="flex flex-wrap gap-3 pt-1">
                <a href="https://www.bmkg.go.id/gempabumi/berpotensi-tsunami" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-accent underline">
                  Halaman tsunami BMKG <ExternalLink size={11} aria-hidden />
                </a>
                <a href="https://inatews.bmkg.go.id/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-accent underline">
                  InaTEWS <ExternalLink size={11} aria-hidden />
                </a>
              </div>
            </div>
          </Panel>
        </aside>
      </div>
    </>
  );
}
