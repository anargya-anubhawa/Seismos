'use client';

import Link from 'next/link';
import { BellOff, BellRing, Loader2, Send, ShieldAlert, TriangleAlert } from 'lucide-react';
import { LoadingNotice, Panel } from '@/components/ui/common';
import { fmtTime } from '@/lib/formatting';
import { useVolcanoPush, type VolcanoTopics } from '@/hooks/useVolcanoPush';
import { useVolcanoQuery } from '@/hooks/useVolcano';
import type { VolcanoOverviewPayload } from '@/types/volcano-ui';
import { Disclaimer, OfflineNotice, VolcanoPage } from './layout';

const TOPIC_LABEL: { key: keyof VolcanoTopics; label: string; description: string }[] = [
  {
    key: 'levelChange',
    label: 'Perubahan tingkat aktivitas',
    description: 'Dikirim ketika MAGMA/PVMBG mengubah tingkat (mis. Waspada → Siaga). Bukan pernyataan erupsi.',
  },
  {
    key: 'eruption',
    label: 'Laporan erupsi resmi (VEN)',
    description: 'Dikirim hanya ketika PVMBG menerbitkan informasi letusan resmi untuk suatu gunung api.',
  },
  {
    key: 'vona',
    label: 'VONA baru',
    description: 'Notifikasi penerbangan (kode warna) yang baru diterbitkan. Berguna bagi pengamat penerbangan.',
  },
  {
    key: 'recommendation',
    label: 'Perubahan rekomendasi',
    description: 'Dicadangkan untuk pembaruan rekomendasi resmi yang signifikan bila sumber menerbitkannya.',
  },
];

export function VolcanoNotifications() {
  const push = useVolcanoPush();
  const monitor = useVolcanoQuery<VolcanoOverviewPayload>('/api/volcano/overview', { pollMs: 300_000 });

  const toggleTopic = (key: keyof VolcanoTopics) => {
    const next = { ...push.topics, [key]: !push.topics[key] };
    void push.saveTopics(next);
  };

  const notifications = monitor.data?.monitor?.notifications ?? [];

  return (
    <VolcanoPage
      title="Notifikasi Gunung Api"
      hint="Notifikasi memakai sistem Web Push Seismos (Service Worker + VAPID) yang sama dengan notifikasi gempa dan tsunami."
    >
      <OfflineNotice offline={monitor.offline} />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <Panel title="Status langganan perangkat ini">
            <div className="space-y-3 px-4 py-3 text-sm">
              {!push.ready ? (
                <LoadingNotice>Memeriksa dukungan push…</LoadingNotice>
              ) : !push.supported ? (
                <p className="text-muted">
                  Browser ini tidak mendukung Web Push. Gunakan browser modern lewat HTTPS. Di iPhone/iPad, push web
                  memerlukan iOS 16.4+ dan aplikasi yang sudah ditambahkan ke Layar Utama.
                </p>
              ) : (
                <>
                  <p className="flex items-center gap-2">
                    {push.subscribed ? <BellRing size={16} aria-hidden className="text-ok" /> : <BellOff size={16} aria-hidden className="text-muted" />}
                    <span className="font-medium">{push.subscribed ? 'Notifikasi gunung api aktif di perangkat ini' : 'Notifikasi gunung api belum aktif'}</span>
                  </p>
                  <p className="text-xs text-muted">
                    Izin notifikasi browser: <strong>{push.permission}</strong>. Notifikasi dikirim server Seismos
                    setelah memeriksa sumber resmi secara berkala ({monitor.data?.monitor ? Math.round(monitor.data.monitor.pollSeconds / 60) : 5} menit).
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {!push.subscribed ? (
                      <button
                        type="button"
                        onClick={() => void push.enable()}
                        disabled={push.busy}
                        className="flex min-h-10 items-center gap-1.5 rounded-md bg-accent px-3 text-sm font-medium text-accent-ink disabled:opacity-40"
                      >
                        {push.busy ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <BellRing size={14} aria-hidden />}
                        Aktifkan notifikasi gunung api
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => void push.test()}
                          disabled={push.busy}
                          className="flex min-h-10 items-center gap-1.5 rounded-md bg-accent px-3 text-sm font-medium text-accent-ink disabled:opacity-40"
                        >
                          <Send size={14} aria-hidden /> Kirim push uji
                        </button>
                        <button
                          type="button"
                          onClick={() => void push.disable()}
                          disabled={push.busy}
                          className="flex min-h-10 items-center gap-1.5 rounded-md border border-line px-3 text-sm font-medium disabled:opacity-40"
                        >
                          <BellOff size={14} aria-hidden /> Nonaktifkan
                        </button>
                      </>
                    )}
                  </div>
                  {push.error && <p role="alert" className="text-sm text-danger">{push.error}</p>}
                  {push.message && <p role="status" className="text-sm text-ok">{push.message}</p>}
                </>
              )}
            </div>
          </Panel>

          <Panel title="Kategori notifikasi">
            <fieldset className="space-y-3 px-4 py-3 text-sm" disabled={!push.subscribed || push.busy}>
              <legend className="sr-only">Pilih kategori notifikasi gunung api</legend>
              {TOPIC_LABEL.map((topic) => (
                <label key={topic.key} className="flex items-start gap-2.5">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4"
                    checked={push.topics[topic.key]}
                    onChange={() => toggleTopic(topic.key)}
                  />
                  <span>
                    <span className="block font-medium">{topic.label}</span>
                    <span className="block text-xs text-muted">{topic.description}</span>
                  </span>
                </label>
              ))}
              {!push.subscribed && <p className="text-xs text-muted">Aktifkan notifikasi terlebih dahulu untuk mengubah kategori.</p>}
            </fieldset>
          </Panel>

          <Panel title="Catatan penting">
            <div className="space-y-2 px-4 py-3 text-sm text-muted">
              <p className="flex items-start gap-2">
                <ShieldAlert size={15} aria-hidden className="mt-0.5 shrink-0" />
                Sumber resmi (MAGMA/PVMBG) tidak menyediakan feed push atau CAP publik. Karena itu server Seismos
                memeriksa endpoint resmi secara berkala; notifikasi tidak dikirim ulang untuk data yang identik, dan
                pemeriksaan pertama hanya menjadi dasar sehingga berita lama tidak dikirim.
              </p>
              <p className="flex items-start gap-2">
                <TriangleAlert size={15} aria-hidden className="mt-0.5 shrink-0" />
                Kenaikan tingkat aktivitas <strong className="text-ink">bukan</strong> bukti erupsi. Notifikasi erupsi
                hanya dibuat dari informasi letusan (VEN) resmi.
              </p>
              <p>
                Push hanya terkirim saat perangkat memiliki koneksi dan langganan masih valid. Notifikasi ini bukan
                pengganti peringatan resmi pemerintah.
              </p>
            </div>
          </Panel>
        </div>

        <div className="space-y-3">
          <Panel title="Status pemantauan server">
            {monitor.loading && !monitor.data ? (
              <p className="px-4 py-3 text-sm text-muted">Memuat status pemantauan…</p>
            ) : monitor.data?.monitor ? (
              <dl className="space-y-1.5 px-4 py-3 text-xs">
                <div><dt className="inline font-semibold">Pemeriksaan terakhir: </dt><dd className="inline text-muted">{monitor.data.monitor.lastCheckAt ? fmtTime(monitor.data.monitor.lastCheckAt) : 'belum berjalan'}</dd></div>
                <div><dt className="inline font-semibold">Interval: </dt><dd className="inline text-muted">{Math.round(monitor.data.monitor.pollSeconds / 60)} menit</dd></div>
                <div><dt className="inline font-semibold">Dasar notifikasi: </dt><dd className="inline text-muted">{monitor.data.monitor.seeded ? 'sudah tercatat' : 'belum tercatat'}</dd></div>
                <div><dt className="inline font-semibold">Notifikasi terproses: </dt><dd className="inline text-muted">{monitor.data.monitor.notifications.length}</dd></div>
                <div className="pt-1">
                  <p className="font-semibold">Sumber yang diperiksa:</p>
                  <ul className="mt-1 space-y-1">
                    {monitor.data.monitor.sources.map((source) => (
                      <li key={source.id} className={source.ok ? 'text-ok' : 'text-danger'}>
                        {source.id}: {source.ok ? 'ok' : (source.error ?? 'gagal')} ({source.count} data)
                      </li>
                    ))}
                    {monitor.data.monitor.sources.length === 0 && <li className="text-muted">Belum ada pemeriksaan tercatat.</li>}
                  </ul>
                </div>
              </dl>
            ) : (
              <p className="px-4 py-3 text-sm text-muted">
                Status pemantauan belum tersedia. Server memulai pemeriksaan otomatis beberapa detik setelah proses
                server berjalan.
              </p>
            )}
          </Panel>

          <Panel title="Notifikasi terakhir">
            {notifications.length === 0 ? (
              <p className="px-4 py-3 text-sm text-muted">
                Belum ada perubahan tingkat aktivitas, informasi letusan, atau VONA baru yang terdeteksi sejak server
                mulai memantau.
              </p>
            ) : (
              <ul className="divide-y divide-line text-xs">
                {notifications.slice(0, 10).map((notification) => (
                  <li key={notification.key} className="px-4 py-2">
                    <p className="font-medium">{notification.title}</p>
                    <p className="text-muted">{fmtTime(notification.detectedAt)} · {notification.delivery.status}</p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Pengaturan notifikasi lain">
            <div className="space-y-1.5 px-4 py-3 text-xs">
              <Link href="/settings" className="block font-medium text-accent underline">Pengaturan umum & notifikasi gempa</Link>
              <Link href="/tsunami" className="block font-medium text-accent underline">Notifikasi tsunami</Link>
              <Link href="/gunung-berapi" className="block font-medium text-accent underline">Ringkasan gunung api</Link>
            </div>
          </Panel>
        </div>
      </div>

      <Disclaimer>
        Seismos Indonesia menyajikan informasi resmi MAGMA/PVMBG untuk pemantauan. Untuk keadaan darurat, ikuti arahan
        PVMBG, BNPB, dan pemerintah daerah setempat.
      </Disclaimer>
    </VolcanoPage>
  );
}
