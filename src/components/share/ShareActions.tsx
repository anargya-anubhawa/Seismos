'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Check, ChevronDown, Copy, Download, ExternalLink, Link2, Share2, TriangleAlert } from 'lucide-react';
import { SOURCE_MAGMA } from '@/lib/share/report-text';

/**
 * Salin teks ke papan klip dengan beberapa lapis cadangan.
 *
 * `navigator.clipboard` hanya tersedia pada konteks aman (HTTPS/localhost) dan
 * bisa ditolak tanpa interaksi pengguna. Bila gagal, `execCommand('copy')` masih
 * bekerja di peramban lama dan pada konteks tidak aman; bila keduanya gagal,
 * pemanggil menampilkan teks agar pengguna dapat menyalin manual.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* lanjut ke cadangan di bawah */
  }
  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    area.style.pointerEvents = 'none';
    document.body.appendChild(area);
    area.select();
    area.setSelectionRange(0, area.value.length);
    const ok = document.execCommand('copy');
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}

type CopyState = 'idle' | 'ok' | 'fail';

/**
 * Tombol "Salin tautan" halaman. URL absolut dibentuk dari `window.location`
 * agar tautan yang disalin selalu menunjuk halaman yang sedang dibuka; bila
 * peramban tidak menyediakan lokasi (mis. render di server), jalur relatif
 * dipakai sebagai gantinya sehingga tombol tetap berfungsi.
 */
export function CopyLinkButton({ label = 'Salin tautan', className = '', path }: {
  label?: string;
  className?: string;
  /** Jalur cadangan bila `window.location` tidak tersedia. */
  path?: string;
}) {
  const [state, setState] = useState<CopyState>('idle');

  const onClick = async () => {
    const href = typeof window !== 'undefined'
      ? window.location.href || (path ? `${window.location.origin}${path}` : '')
      : (path ?? '');
    const ok = href !== '' && await copyText(href);
    setState(ok ? 'ok' : 'fail');
  };

  return (
    <span className={`inline-flex flex-wrap items-center gap-2 ${className}`}>
      <button
        type="button"
        onClick={() => void onClick()}
        className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-line px-3 text-sm font-medium hover:bg-line/40"
      >
        {state === 'ok' ? <Check size={15} aria-hidden className="text-ok" /> : <Link2 size={15} aria-hidden />}
        {state === 'ok' ? 'Tautan disalin' : label}
      </button>
      <span className="sr-only" role="status" aria-live="polite">
        {state === 'ok' ? 'Tautan berhasil disalin.' : state === 'fail' ? 'Tautan tidak dapat disalin.' : ''}
      </span>
      {state === 'fail' && (
        <span className="text-xs text-danger">Tidak dapat menyalin. Salin dari bilah alamat.</span>
      )}
    </span>
  );
}

/**
 * Tombol "Salin laporan": menyalin teks siap-bagikan. Bila penyalinan gagal
 * (mis. peramban tanpa clipboard), teks ditampilkan di kotak pilih-sendiri agar
 * pengguna tetap bisa menyalinnya secara manual.
 */
export function CopyReportButton({ text, label = 'Salin laporan', className = '' }: {
  text: string;
  label?: string;
  className?: string;
}) {
  const [state, setState] = useState<CopyState>('idle');
  const area = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (state === 'fail') area.current?.focus();
  }, [state]);

  return (
    <div className={className}>
      <button
        type="button"
        onClick={async () => setState((await copyText(text)) ? 'ok' : 'fail')}
        className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-line px-3 text-sm font-medium hover:bg-line/40"
      >
        {state === 'ok' ? <Check size={15} aria-hidden className="text-ok" /> : <Copy size={15} aria-hidden />}
        {state === 'ok' ? 'Laporan disalin' : label}
      </button>
      <span className="sr-only" role="status" aria-live="polite">
        {state === 'ok' ? 'Laporan disalin ke papan klip.' : state === 'fail' ? 'Laporan tidak dapat disalin otomatis.' : ''}
      </span>
      {state === 'fail' && (
        <label className="mt-2 block text-xs">
          <span className="mb-1 flex items-center gap-1 text-danger">
            <TriangleAlert size={12} aria-hidden /> Tidak dapat menyalin otomatis. Pilih teks di bawah lalu salin.
          </span>
          <textarea
            ref={area}
            readOnly
            value={text}
            rows={Math.min(14, text.split('\n').length + 1)}
            className="w-full rounded-md border border-line bg-bg p-2 font-mono text-[11px]"
          />
        </label>
      )}
    </div>
  );
}

/** Satu lampiran dokumen yang dapat ikut dibagikan bila peramban mendukung. */
export interface ShareAttachment {
  /** Nama berkas saat diunduh/dibagikan, mis. "shakemap-m5.2.png". */
  fileName: string;
  /** URL berkas. Bisa URL pihak ketiga (BMKG) atau proxy internal. */
  url: string;
  type: string;
  label: string;
}

/**
 * Tombol "Kirim ke…" dengan pilihan tujuan.
 *
 * Keterbatasan yang perlu dipahami: Web Share API hanya dapat melampirkan
 * *berkas* pada peramban yang mendukung `navigator.canShare({files})` — umumnya
 * Android Chrome. iOS/Safari dan WhatsApp Web tidak mengizinkannya, sehingga
 * untuk tujuan tersebut lampiran disediakan sebagai tautan unduh tersendiri
 * dan teks laporan tetap dibagikan. Karena itu tombol selalu menyebut apa yang
 * benar-benar ikut terkirim, bukan menampilkan keberhasilan palsu.
 */
export function ShareMenu({
  title,
  text,
  attachments = [],
  label = 'Kirim ke…',
  className = '',
  compact = false,
}: {
  title: string;
  text: string;
  attachments?: ShareAttachment[];
  label?: string;
  className?: string;
  /** Ukuran tombol kecil untuk baris aksi di dalam kartu/daftar. */
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'fail' | 'info'; message: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const host = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    const onClick = (event: MouseEvent) => {
      if (host.current && !host.current.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onClick);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onClick);
    };
  }, [open]);

  const supported = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const sharePlain = async () => {
    if (!supported) {
      const ok = await copyText(`${text}\n\n${title}`);
      setNotice(ok
        ? { kind: 'info', message: 'Peramban ini tidak mendukung menu bagikan. Teks laporan sudah disalin.' }
        : { kind: 'fail', message: 'Peramban tidak mendukung menu bagikan maupun papan klip.' });
      return;
    }
    try {
      await navigator.share({ title, text });
      setNotice({ kind: 'ok', message: 'Laporan dibagikan.' });
      setOpen(false);
    } catch (error) {
      if ((error as Error)?.name === 'AbortError') return;
      setNotice({ kind: 'fail', message: 'Laporan tidak dapat dibagikan dari peramban ini.' });
    }
  };

  const shareWithFiles = async () => {
    setBusy(true);
    setNotice(null);
    try {
      if (!supported) throw new Error('unsupported');
      const files: File[] = [];
      for (const attachment of attachments) {
        const response = await fetch(attachment.url);
        if (!response.ok) throw new Error(`Gagal mengambil ${attachment.label}`);
        const blob = await response.blob();
        files.push(new File([blob], attachment.fileName, { type: blob.type || attachment.type }));
      }
      const data: ShareData = { title, text, files };
      if (!navigator.canShare?.(data)) throw new Error('cannot-share-files');
      await navigator.share(data);
      setNotice({ kind: 'ok', message: `Laporan dan ${files.length} lampiran dibagikan.` });
      setOpen(false);
    } catch (error) {
      const name = (error as Error)?.name;
      if (name === 'AbortError') return;
      // Berkas tidak bisa dibagikan: tetap bagikan teksnya, lalu arahkan
      // pengguna ke tautan unduh eksplisit. Ini mencegah kesan "gagal total".
      setNotice({
        kind: 'info',
        message: 'Peramban ini tidak mengizinkan lampiran berkas dibagikan langsung. Bagikan teks laporan lalu unduh lampiran di bawah.',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div ref={host} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => { setOpen((value) => !value); setNotice(null); }}
        aria-expanded={open}
        aria-haspopup="true"
        className={compact
          ? 'inline-flex min-h-8 items-center gap-1 rounded border border-line px-1.5 text-[11px] font-medium text-muted hover:bg-line/40 hover:text-ink'
          : 'inline-flex min-h-9 items-center gap-1.5 rounded-md border border-line px-3 text-sm font-medium hover:bg-line/40'}
      >
        <Share2 size={compact ? 11 : 15} aria-hidden /> {label}
        <ChevronDown size={compact ? 10 : 13} aria-hidden className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 z-30 mt-1 w-72 rounded-lg border border-line bg-surface p-2 shadow-lg">
          <button
            type="button"
            onClick={() => void sharePlain()}
            className="flex w-full items-start gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-line/40"
          >
            <Share2 size={15} aria-hidden className="mt-0.5 shrink-0" />
            <span>
              <span className="block font-medium">Bagikan laporan (teks)</span>
              <span className="block text-xs text-muted">Lewat menu bagikan perangkat: WhatsApp, Telegram, dll.</span>
            </span>
          </button>

          <CopyReportButton text={text} label="Salin laporan" className="px-2 py-2" />

          {attachments.length > 0 && (
            <div className="mt-1 border-t border-line pt-1">
              <button
                type="button"
                onClick={() => void shareWithFiles()}
                disabled={busy}
                className="flex w-full items-start gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-line/40 disabled:opacity-50"
              >
                <Download size={15} aria-hidden className="mt-0.5 shrink-0" />
                <span>
                  <span className="block font-medium">{busy ? 'Menyiapkan lampiran…' : 'Bagikan teks + lampiran'}</span>
                  <span className="block text-xs text-muted">
                    Berkas ikut terkirim hanya pada peramban yang mendukung (umumnya Chrome Android).
                  </span>
                </span>
              </button>
              <ul className="space-y-1 px-2 pb-1 pt-1">
                <li className="text-[11px] font-semibold uppercase tracking-wide text-muted">Lampiran dokumen</li>
                {attachments.map((attachment) => (
                  <li key={attachment.url} className="flex items-center gap-2 text-xs">
                    <a
                      href={attachment.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-w-0 flex-1 truncate font-medium text-accent underline"
                    >
                      {attachment.label}
                    </a>
                    <a
                      href={attachment.url}
                      download={attachment.fileName}
                      className="inline-flex shrink-0 items-center gap-1 text-muted hover:text-ink"
                      aria-label={`Unduh ${attachment.label}`}
                    >
                      <Download size={12} aria-hidden /> Unduh
                    </a>
                  </li>
                ))}
              </ul>
              <p className="px-2 pb-1 text-[11px] text-muted">
                Sumber akan membuka berkas di tab baru. Alt teks laporan tidak disertakan otomatis pada WhatsApp Web.
              </p>
            </div>
          )}

          {notice && (
            <p
              role="status"
              className={`mt-1 rounded-md px-2 py-1.5 text-xs ${notice.kind === 'fail' ? 'bg-danger/10 text-danger' : notice.kind === 'ok' ? 'bg-ok/10 text-ok' : 'bg-line/40 text-muted'}`}
            >
              {notice.message}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Baris aksi standar untuk halaman laporan: salin tautan, salin laporan, dan
 * menu "Kirim ke…". Dipakai agar perilaku sama di menu gempa, tsunami, dan
 * gunung api (termasuk posisi kredit sumber).
 */
export function ShareActions({
  pageUrl,
  reportText,
  shareTitle,
  attachments,
  origin,
  source,
  extra,
}: {
  /** Jalur halaman untuk kredit & tautan (bila tidak membaca window). */
  pageUrl?: string;
  reportText?: string;
  shareTitle?: string;
  attachments?: ShareAttachment[];
  /** Nama aplikasi asal untuk baris kredit. */
  origin?: string;
  /** Sumber data resmi untuk baris kredit. */
  source: string;
  extra?: ReactNode;
}) {
  const [href, setHref] = useState(pageUrl ?? '');
  useEffect(() => {
    if (typeof window !== 'undefined') setHref(window.location.href || pageUrl || '');
  }, [pageUrl]);

  return (
    <div className="print:hidden">
      <div className="flex flex-wrap items-center gap-2">
        <CopyLinkButton path={pageUrl} />
        {reportText && <CopyReportButton text={reportText} />}
        {reportText && (
          <ShareMenu
            title={shareTitle ?? 'Laporan Seismos Indonesia'}
            text={reportText}
            attachments={attachments}
          />
        )}
        {extra}
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-muted">
        Laporan dari <strong className="text-ink">{origin ?? 'Seismos Indonesia'}</strong>
        {href ? (
          <>
            {' — '}
            <a href={href} className="underline" target="_blank" rel="noopener noreferrer">
              {href.replace(/^https?:\/\//, '')}
            </a>
          </>
        ) : null}
        <br />
        Sumber data: {source}
        {' '}
        <a
          href={source === SOURCE_MAGMA ? 'https://magma.esdm.go.id' : 'https://data.bmkg.go.id/gempabumi/'}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-0.5 underline"
        >
          buka sumber <ExternalLink size={10} aria-hidden />
        </a>
      </p>
    </div>
  );
}
