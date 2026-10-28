'use client';

import Link from 'next/link';
import { BellOff, BellRing, ExternalLink, Loader2, Send, Smartphone, TriangleAlert } from 'lucide-react';
import { useTsunamiPush } from '@/hooks/useTsunamiPush';

const btn = 'flex min-h-10 items-center justify-center gap-1.5 rounded-md px-3 text-sm font-medium disabled:opacity-40';

export function TsunamiPushSettings({ compact = false }: { compact?: boolean }) {
  const { ready, supported, permission, subscribed, busy, error, message, storageWarning, enable, disable, test } = useTsunamiPush();

  if (!ready) {
    return <p role="status" className="text-sm text-muted">Memeriksa dukungan push tsunami…</p>;
  }

  if (!supported) {
    return (
      <div className="space-y-2 text-sm">
        <p className="text-muted">
          Browser ini tidak mendukung Web Push. Gunakan browser modern lewat HTTPS. Di iPhone/iPad, push web
          memerlukan iOS 16.4+ dan aplikasi yang sudah ditambahkan ke Layar Utama.
        </p>
        <Link href="/tsunami" className="inline-flex items-center gap-1.5 font-medium text-accent underline">
          Buka halaman tsunami <ExternalLink size={13} aria-hidden />
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3 text-sm">
      <p className="text-muted">
        Push tsunami adalah pengaturan terpisah dari notifikasi gempa di atas. Server memeriksa BMKG dan mengirim
        notifikasi saat ada peringatan tsunami baru, pembaruan resmi, atau pernyataan berakhir — bukan hanya karena
        ada gempa besar. Push dapat muncul saat halaman tertutup, tetapi tetap bergantung pada browser, sistem operasi,
        koneksi, dan izin perangkat.
      </p>

      {storageWarning && (
        <p role="status" className="flex items-start gap-2 rounded border border-[#B08A00]/50 bg-[#B08A00]/5 px-3 py-2 text-xs text-muted">
          <TriangleAlert size={15} aria-hidden className="mt-0.5 shrink-0" />
          <span>
            Penyimpanan server tidak persisten. Push tetap aktif selama instance server hidup, tetapi pendaftaran
            perangkat dapat hilang saat server dimulai ulang. Aktifkan ulang push bila notifikasi berhenti datang.
          </span>
        </p>
      )}

      <div className={`rounded-md border px-3 py-2.5 ${subscribed ? 'border-ok/50 bg-ok/5' : 'border-line bg-bg/60'}`} role="status" aria-live="polite">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="inline-flex items-center gap-2 font-medium">
            {subscribed ? <BellRing size={16} aria-hidden className="text-ok" /> : <BellOff size={16} aria-hidden className="text-muted" />}
            {subscribed ? 'Push tsunami aktif di perangkat ini' : 'Push tsunami belum aktif'}
          </span>
          <span className={`text-xs font-semibold ${subscribed ? 'text-ok' : permission === 'denied' ? 'text-danger' : 'text-muted'}`}>
            {permission === 'denied' ? 'Izin ditolak' : subscribed ? 'Terdaftar di server' : 'Tidak berlangganan'}
          </span>
        </div>
        <p className="mt-1 text-xs text-muted">
          {permission === 'denied'
            ? 'Buka pengaturan situs di browser (ikon gembok) lalu izinkan Notifikasi, kemudian coba lagi.'
            : subscribed
              ? 'Langganan ini hanya untuk peringatan tsunami. Notifikasi gempa lokal diatur terpisah di bagian atas.'
              : 'Aktifkan untuk menerima peringatan tsunami resmi BMKG lewat layanan push browser.'}
        </p>
      </div>

      {error && (
        <p role="alert" className="flex items-start gap-2 rounded border border-danger/50 bg-danger/5 px-3 py-2 text-xs text-danger">
          <TriangleAlert size={15} aria-hidden className="mt-0.5 shrink-0" /> {error}
        </p>
      )}
      {message && <p role="status" className="rounded border border-ok/40 bg-ok/5 px-3 py-2 text-xs text-ok">{message}</p>}

      <div className="flex flex-wrap gap-2">
        {subscribed ? (
          <>
            <button type="button" className={`${btn} border border-line`} onClick={() => void test()} disabled={busy}>
              {busy ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <Send size={15} aria-hidden />}
              Kirim tes push
            </button>
            <button type="button" className={`${btn} border border-line`} onClick={() => void disable()} disabled={busy}>
              {busy ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <BellOff size={15} aria-hidden />}
              Matikan push tsunami
            </button>
          </>
        ) : (
          <button
            type="button"
            className={`${btn} bg-accent text-accent-ink`}
            onClick={() => void enable()}
            disabled={busy || permission === 'denied'}
          >
            {busy ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <BellRing size={15} aria-hidden />}
            Aktifkan push tsunami
          </button>
        )}
      </div>

      {!compact && (
        <p className="flex items-start gap-1.5 text-xs text-muted">
          <Smartphone size={14} aria-hidden className="mt-0.5 shrink-0" />
          Langganan disimpan di server ini. Menghapus data situs di browser akan mematikan langganan; aktifkan ulang
          bila diperlukan. Untuk peringatan resmi 24 jam, gunakan aplikasi Info BMKG atau kanal resmi BMKG.
        </p>
      )}
    </div>
  );
}
