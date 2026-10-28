'use client';

import Link from 'next/link';
import { ExternalLink, Info, RefreshCw, WifiOff } from 'lucide-react';
import { PageTitle } from '@/components/ui/common';
import { CopyLinkButton, ShareMenu, type ShareAttachment } from '@/components/share/ShareActions';
import { SOURCE_MAGMA } from '@/lib/share/report-text';
import { fmtAgo, fmtTime } from '@/lib/formatting';
import { VolcanoTabs } from './VolcanoTabs';

/** Menampilkan alasan data tidak tersedia + tautan sumber resmi. */
export function VolcanoErrorBox({ message, retry }: { message: string; retry?: () => void }) {
  return (
    <div role="alert" className="rounded-lg border border-danger/50 bg-surface px-4 py-3 text-sm">
      <p className="font-semibold text-danger">Data gunung api tidak dapat dimuat</p>
      <p className="mt-1 text-muted">{message}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {retry && (
          <button
            type="button"
            onClick={retry}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-line px-2.5 text-xs font-medium hover:bg-line/40"
          >
            <RefreshCw size={13} aria-hidden /> Coba lagi
          </button>
        )}
        <a
          href="https://magma.esdm.go.id"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-line px-2.5 text-xs font-medium text-accent hover:bg-line/40"
        >
          Buka MAGMA Indonesia <ExternalLink size={12} aria-hidden />
        </a>
      </div>
    </div>
  );
}

export function VolcanoEmpty({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-line bg-surface px-4 py-6 text-sm">
      <p className="font-semibold">{title}</p>
      {children && <div className="mt-1 text-muted">{children}</div>}
    </div>
  );
}

export function OfflineNotice({ offline }: { offline: boolean }) {
  if (!offline) return null;
  return (
    <div role="status" className="mb-3 flex items-start gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-sm text-muted">
      <WifiOff size={15} aria-hidden className="mt-0.5 shrink-0" />
      Perangkat Anda sedang offline. Data terakhir yang sudah dimuat tetap ditampilkan; pembaruan akan dicoba otomatis saat koneksi kembali.
    </div>
  );
}

/** Bila data lebih tua dari yang diharapkan, jangan tampilkan sebagai kondisi terkini. */
export function StaleBadge({ updatedAt, maxAgeMs = 30 * 60_000 }: { updatedAt: string | null; maxAgeMs?: number }) {
  if (!updatedAt) {
    return <span className="rounded border border-line px-1.5 py-0.5 text-[11px] text-muted">waktu pembaruan tidak diketahui</span>;
  }
  const age = Date.now() - Date.parse(updatedAt);
  if (Number.isFinite(age) && age <= maxAgeMs) return null;
  return (
    <span className="rounded border border-[#C2711A]/60 bg-[#C2711A]/10 px-1.5 py-0.5 text-[11px] font-semibold text-[#8A4A0C] dark:text-[#F2B45E]">
      Data tertunda · terakhir {fmtAgo(updatedAt)}
    </span>
  );
}

/** Kerangka halaman: judul, tab, catatan sumber, isi. */
export function VolcanoPage({
  title,
  hint,
  updatedAt,
  errors = [],
  children,
  reportText,
  shareTitle,
  attachments = [],
  code,
}: {
  title: string;
  /** Kode gunung api; bila diisi, tab navigasi konteks gunung tampil. */
  code?: string;
  hint?: string;
  updatedAt?: string | null;
  errors?: string[];
  children: React.ReactNode;
  /** Teks laporan siap-salin; bila diisi, tombol salin & bagikan muncul. */
  reportText?: string;
  shareTitle?: string;
  attachments?: ShareAttachment[];
}) {
  return (
    <div className="min-w-0">
      <PageTitle title={title} hint={hint} />
      <VolcanoTabs code={code} />
      <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
        <span className="inline-flex items-center gap-1">
          <Info size={12} aria-hidden /> Sumber: MAGMA Indonesia — PVMBG, Badan Geologi, KESDM
        </span>
        {updatedAt && <span>Diambil {fmtTime(updatedAt)} ({fmtAgo(updatedAt)})</span>}
        <StaleBadge updatedAt={updatedAt ?? null} />
        <Link href="/gunung-berapi/notifikasi" className="text-accent underline">
          Atur notifikasi
        </Link>
      </div>
      {/*
        Aksi tautan & bagikan tersedia di setiap halaman gunung api agar pengguna
        dapat meneruskan halaman/laporan tanpa menyalin dari bilah alamat.
      */}
      <div className="mb-4 flex flex-wrap items-center gap-2 print:hidden">
        <CopyLinkButton />
        {reportText && (
          <ShareMenu title={shareTitle ?? title} text={reportText} attachments={attachments} />
        )}
      </div>
      {errors.length > 0 && (
        <div role="status" className="mb-3 rounded-lg border border-[#C2711A]/50 bg-[#C2711A]/5 px-3 py-2 text-xs">
          <p className="font-semibold">Sebagian data tidak dapat dimuat:</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-muted">
            {errors.slice(0, 6).map((error) => <li key={error}>{error}</li>)}
          </ul>
        </div>
      )}
      {children}
    </div>
  );
}

export function Disclaimer({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-6 rounded-lg border border-line bg-surface px-3 py-2 text-xs leading-relaxed text-muted">
      {children}
    </p>
  );
}
