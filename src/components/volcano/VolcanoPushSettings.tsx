'use client';

import Link from 'next/link';
import { BellOff, BellRing, ExternalLink, Loader2, Send } from 'lucide-react';
import { useVolcanoPush, type VolcanoTopics } from '@/hooks/useVolcanoPush';

const btn = 'flex min-h-10 items-center justify-center gap-1.5 rounded-md px-3 text-sm font-medium disabled:opacity-40';

/**
 * Ringkasan notifikasi gunung api untuk halaman Pengaturan. Pengaturan lengkap
 * (termasuk penjelasan tiap kategori) tetap tersedia di halaman Notifikasi
 * Gunung Api; panel ini hanya menampilkan langganan perangkat dan kategori.
 */
export function VolcanoPushSettings({ compact = false }: { compact?: boolean }) {
  const push = useVolcanoPush();

  const toggleTopic = (key: keyof VolcanoTopics) => {
    void push.saveTopics({ ...push.topics, [key]: !push.topics[key] });
  };

  if (!push.ready) {
    return <p role="status" className="text-sm text-muted">Memeriksa dukungan push gunung api…</p>;
  }

  if (!push.supported) {
    return (
      <div className="space-y-2 text-sm">
        <p className="text-muted">
          Browser ini tidak mendukung Web Push. Gunakan browser modern lewat HTTPS. Di iPhone/iPad, push web
          memerlukan iOS 16.4+ dan aplikasi yang sudah ditambahkan ke Layar Utama.
        </p>
        <Link href="/gunung-berapi/notifikasi" className="inline-flex items-center gap-1.5 font-medium text-accent underline">
          Halaman notifikasi gunung api <ExternalLink size={13} aria-hidden />
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3 text-sm">
      <div
        role="status"
        aria-live="polite"
        className={`rounded-md border px-3 py-2.5 ${push.subscribed ? 'border-ok/50 bg-ok/5' : 'border-line bg-bg/60'}`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="inline-flex items-center gap-2 font-medium">
            {push.subscribed
              ? <BellRing size={16} aria-hidden className="text-ok" />
              : <BellOff size={16} aria-hidden className="text-muted" />}
            {push.subscribed ? 'Push gunung api aktif di perangkat ini' : 'Push gunung api belum aktif'}
          </span>
          <span className={`text-xs font-semibold ${push.subscribed ? 'text-ok' : push.permission === 'denied' ? 'text-danger' : 'text-muted'}`}>
            {push.permission === 'denied' ? 'Izin ditolak' : push.subscribed ? 'Terdaftar di server' : 'Tidak berlangganan'}
          </span>
        </div>
        <p className="mt-1 text-xs text-muted">
          Notifikasi memakai sistem push yang sama dengan gempa dan tsunami. Langganan berlaku untuk perangkat ini.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {!push.subscribed ? (
          <button
            type="button"
            onClick={() => void push.enable()}
            disabled={push.busy}
            className={`${btn} bg-accent text-accent-ink`}
          >
            {push.busy ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <BellRing size={14} aria-hidden />}
            Aktifkan notifikasi gunung api
          </button>
        ) : (
          <>
            <button type="button" onClick={() => void push.test()} disabled={push.busy} className={`${btn} bg-accent text-accent-ink`}>
              <Send size={14} aria-hidden /> Kirim push uji
            </button>
            <button type="button" onClick={() => void push.disable()} disabled={push.busy} className={`${btn} border border-line`}>
              <BellOff size={14} aria-hidden /> Nonaktifkan
            </button>
          </>
        )}
      </div>

      {!compact && (
        <fieldset className="space-y-2" disabled={!push.subscribed || push.busy}>
          <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Kategori notifikasi</legend>
          {([
            { key: 'levelChange' as const, label: 'Perubahan tingkat aktivitas' },
            { key: 'eruption' as const, label: 'Laporan erupsi resmi (VEN)' },
            { key: 'vona' as const, label: 'VONA (penerbangan)' },
          ]).map(({ key, label }) => (
            <label key={key} className="flex items-center gap-2.5">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={Boolean(push.topics[key])}
                onChange={() => toggleTopic(key)}
              />
              <span>{label}</span>
            </label>
          ))}
        </fieldset>
      )}

      {push.error && <p role="alert" className="text-xs text-danger">{push.error}</p>}
      {push.message && <p role="status" className="text-xs text-ok">{push.message}</p>}

      <p className="text-xs text-muted">
        Penjelasan lengkap tiap kategori dan status pemeriksaan server ada di{' '}
        <Link href="/gunung-berapi/notifikasi" className="font-medium text-accent underline">
          halaman notifikasi gunung api
        </Link>.
      </p>
    </div>
  );
}
