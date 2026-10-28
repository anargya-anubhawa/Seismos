'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle, Camera, ChevronLeft, ChevronRight, Clock, Eye, ExternalLink, ImageOff, Loader2, Maximize2,
  Mountain, X,
} from 'lucide-react';
import { fmtTime } from '@/lib/formatting';
import { levelLabel } from '@/lib/volcano/magma';
import type { GalleryPhoto, VonaColor, VonaNotice, VolcanoCamera, VolcanoLevel, VolcanoReport } from '@/types/volcano';

/**
 * Gaya status aktivitas resmi. Warna selalu disertai teks (Level + sebutan)
 * supaya informasi tidak bergantung pada warna saja.
 */
const LEVEL_STYLE: Record<VolcanoLevel, string> = {
  1: 'border-ok/60 bg-ok/10 text-ok',
  2: 'border-[#B08A00]/60 bg-[#F2C14E]/20 text-[#6B5400] dark:text-[#F2C14E]',
  3: 'border-[#C2711A]/60 bg-[#C2711A]/15 text-[#8A4A0C] dark:text-[#F2B45E]',
  4: 'border-danger/70 bg-danger/15 text-danger',
};

const LEVEL_DOT: Record<VolcanoLevel, string> = {
  1: 'bg-ok',
  2: 'bg-[#C9A227]',
  3: 'bg-[#C2711A]',
  4: 'bg-danger',
};

export function VolcanoLevelBadge({ level, compact = false }: { level: VolcanoLevel | null; compact?: boolean }) {
  if (!level) {
    return (
      <span className="inline-flex items-center rounded border border-line bg-line/20 px-1.5 py-0.5 text-[11px] font-semibold text-muted">
        Tingkat tidak tercantum
      </span>
    );
  }
  return (
    <span
      className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-semibold ${compact ? 'text-[11px]' : 'text-xs'} ${LEVEL_STYLE[level]}`}
    >
      <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${LEVEL_DOT[level]}`} />
      {levelLabel(level)}
    </span>
  );
}

const VONA_STYLE: Record<VonaColor, string> = {
  GREEN: 'border-ok/60 bg-ok/10 text-ok',
  YELLOW: 'border-[#B08A00]/60 bg-[#F2C14E]/20 text-[#6B5400] dark:text-[#F2C14E]',
  ORANGE: 'border-[#C2711A]/60 bg-[#C2711A]/15 text-[#8A4A0C] dark:text-[#F2B45E]',
  RED: 'border-danger/70 bg-danger/15 text-danger',
};

export function VonaBadge({ code }: { code: VonaColor | null }) {
  if (!code) return <span className="rounded border border-line px-1.5 py-0.5 text-[11px] text-muted">Kode tidak tercantum</span>;
  return (
    <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[11px] font-semibold ${VONA_STYLE[code]}`}>
      {code}
    </span>
  );
}

export function VolcanoLink({ code, name, className = '' }: { code: string; name: string; className?: string }) {
  return (
    <Link href={`/gunung-berapi/${code.toLowerCase()}`} className={`font-medium text-accent underline-offset-2 hover:underline ${className}`}>
      {name}
    </Link>
  );
}

/** Pratinjau gambar sumber (seismogram, CCTV, visual laporan) dengan status gagal yang jelas. */
export function SourceImage({
  src,
  alt,
  className,
  eager = false,
  onLoadState,
  caption,
}: {
  src: string;
  alt: string;
  className?: string;
  eager?: boolean;
  onLoadState?: (state: 'loaded' | 'failed') => void;
  caption?: string;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);

  if (failed) {
    return (
      <div className={`flex flex-col items-center justify-center gap-1 bg-bg p-3 text-center text-xs text-muted ${className ?? ''}`}>
        <ImageOff size={18} aria-hidden />
        <span>Gambar sedang tidak tersedia dari sumber MAGMA.</span>
        {caption && <span className="text-[11px]">{caption}</span>}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={className}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      onError={() => { setFailed(true); onLoadState?.('failed'); }}
      onLoad={() => onLoadState?.('loaded')}
    />
  );
}

/** Modal sederhana untuk pratinjau gambar penuh (CCTV, gallery, visual laporan). */
export function ImageDialog({
  title,
  subtitle,
  children,
  onClose,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  onClose: () => void;
  footer?: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') document.getElementById('image-dialog-prev')?.click();
      if (e.key === 'ArrowRight') document.getElementById('image-dialog-next')?.click();
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 sm:p-6" role="presentation" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="flex max-h-full w-full max-w-5xl flex-col overflow-hidden rounded-lg border border-line bg-surface shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-line px-4 py-3">
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold">{title}</h2>
            {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
          </div>
          <button autoFocus onClick={onClose} aria-label="Tutup pratinjau" className="rounded p-2 text-muted hover:bg-line/50 hover:text-ink">
            <X size={20} aria-hidden />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto bg-white p-2 sm:p-3">{children}</div>
        {footer && <div className="border-t border-line px-4 py-3 text-xs">{footer}</div>}
      </div>
    </div>
  );
}

const cameraAge = (capturedAt: string | null): { tone: 'ok' | 'warn' | 'danger'; label: string } => {
  if (!capturedAt) return { tone: 'danger', label: 'Waktu gambar tidak tercantum' };
  const hours = (Date.now() - Date.parse(capturedAt)) / 3_600_000;
  if (hours < 3) return { tone: 'ok', label: 'Gambar baru (≤ 3 jam)' };
  if (hours < 24) return { tone: 'warn', label: `Gambar terakhir ${Math.round(hours)} jam lalu` };
  return { tone: 'danger', label: `Gambar terakhir ${Math.round(hours / 24)} hari lalu — kamera mungkin tidak aktif` };
};

/**
 * Kamera MAGMA menyediakan gambar statis (bukan stream video). Gambar hanya
 * dimuat saat kartu terlihat dan dihentikan saat tab tidak aktif agar banyak
 * kamera tidak membebani browser.
 */
export function CameraCard({
  camera,
  onOpen,
  showVolcano = false,
}: {
  camera: VolcanoCamera;
  onOpen: () => void;
  showVolcano?: boolean;
}) {
  const host = useRef<HTMLLIElement | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const age = cameraAge(camera.capturedAt);
  const toneClass = age.tone === 'ok' ? 'text-ok' : age.tone === 'warn' ? 'text-[#8A6A00] dark:text-[#F2C14E]' : 'text-danger';

  return (
    <li ref={host} className="overflow-hidden rounded-lg border border-line bg-surface">
      <div className="flex items-start justify-between gap-2 px-3 py-2.5">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold" title={camera.volcanoName}>
            {showVolcano ? camera.volcanoName : (camera.station || camera.volcanoName)}
          </h3>
          <p className="mt-0.5 truncate text-xs text-muted" title={camera.id}>
            {showVolcano ? `${camera.station || 'kamera'} · ${camera.volcanoCode}` : `Kamera ${camera.station || '—'}`}
          </p>
        </div>
        <span className={`shrink-0 text-[10px] font-semibold uppercase tracking-wide ${toneClass}`}>{age.tone === 'ok' ? 'Baru' : age.tone === 'warn' ? 'Tertunda' : 'Lama'}</span>
      </div>
      {/*
        Snapshot dimuat langsung tanpa perlu diklik, tetapi dengan
        `loading="lazy"` supaya gambar yang masih jauh di bawah layar baru
        diunduh ketika hampir terlihat. Dengan begitu pengguna langsung melihat
        citra kamera begitu kartunya masuk layar, tanpa memicu puluhan unduhan
        sekaligus saat halaman dibuka.
      */}
      <button
        type="button"
        onClick={onOpen}
        className="relative block aspect-video w-full border-y border-line bg-bg/60"
        aria-label={`Perbesar kamera ${camera.station} di ${camera.volcanoName}`}
      >
        {!loaded && !failed && (
          <span className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-xs text-muted">
            <Loader2 size={18} aria-hidden className="animate-spin" />
            <span>Memuat citra kamera…</span>
          </span>
        )}
        {failed ? (
          <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-xs text-muted">
            <ImageOff size={18} aria-hidden />
            <span>Citra kamera sedang tidak tersedia.</span>
          </span>
        ) : (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={camera.imagePath}
            alt={`Citra kamera ${camera.station || camera.id} Gunung ${camera.volcanoName}`}
            loading="lazy"
            decoding="async"
            className={`h-full w-full object-cover transition-opacity ${loaded ? 'opacity-100' : 'opacity-0'}`}
            onLoad={() => setLoaded(true)}
            onError={() => setFailed(true)}
          />
        )}
        <span className="absolute bottom-1.5 right-1.5 inline-flex items-center gap-1 rounded bg-black/55 px-1.5 py-0.5 text-[10px] font-medium text-white">
          <Maximize2 size={10} aria-hidden /> Perbesar
        </span>
      </button>
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-xs">
        <span className={`inline-flex items-center gap-1 ${toneClass}`}>
          <Clock size={11} aria-hidden />
          {camera.capturedAt ? fmtTime(camera.capturedAt) : 'waktu tidak tercantum'}
        </span>
        <div className="flex items-center gap-1">
          <button type="button" onClick={onOpen} className="inline-flex min-h-8 items-center gap-1 rounded-md border border-line px-2 text-xs font-medium hover:bg-line/40">
            <Maximize2 size={12} aria-hidden /> Perbesar
          </button>
          <a href={camera.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-8 items-center gap-1 rounded-md border border-line px-2 text-xs font-medium hover:bg-line/40">
            Sumber <ExternalLink size={11} aria-hidden />
          </a>
        </div>
      </div>
      <p className="border-t border-line px-3 py-1.5 text-[11px] text-muted">{age.label}</p>
    </li>
  );
}

export function CameraGallery({ cameras, label }: { cameras: VolcanoCamera[]; label: string }) {
  const [index, setIndex] = useState<number | null>(null);
  const current = index === null ? null : cameras[index] ?? null;

  return (
    <>
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cameras.map((camera, i) => (
          <CameraCard key={camera.id} camera={camera} showVolcano onOpen={() => setIndex(i)} />
        ))}
      </ul>
      {current && (
        <ImageDialog
          title={`Kamera ${current.station || current.id}`}
          subtitle={`Gunung ${current.volcanoName} · ${current.capturedAt ? `gambar ${fmtTime(current.capturedAt)}` : 'waktu tidak tercantum'}`}
          onClose={() => setIndex(null)}
          footer={(
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-muted">{label} · gambar statis (bukan video live)</span>
              <div className="flex items-center gap-1">
                <button
                  id="image-dialog-prev"
                  type="button"
                  onClick={() => setIndex((i) => (i === null ? null : (i - 1 + cameras.length) % cameras.length))}
                  className="inline-flex min-h-8 items-center gap-1 rounded-md border border-line px-2 font-medium"
                >
                  <ChevronLeft size={13} aria-hidden /> Sebelumnya
                </button>
                <span className="px-1 text-muted">{index! + 1}/{cameras.length}</span>
                <button
                  id="image-dialog-next"
                  type="button"
                  onClick={() => setIndex((i) => (i === null ? null : (i + 1) % cameras.length))}
                  className="inline-flex min-h-8 items-center gap-1 rounded-md border border-line px-2 font-medium"
                >
                  Berikutnya <ChevronRight size={13} aria-hidden />
                </button>
              </div>
              <a href={current.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-accent underline">
                Gambar asli <ExternalLink size={11} aria-hidden />
              </a>
            </div>
          )}
        >
          <SourceImage eager src={current.imagePath} alt={`Gambar kamera ${current.station} Gunung ${current.volcanoName}`} className="mx-auto block max-h-[70vh] w-full object-contain" />
        </ImageDialog>
      )}
    </>
  );
}

/**
 * Satu ubin galeri. Foto diunduh otomatis dengan `loading="lazy"`, jadi galeri
 * panjang hanya mengambil gambar yang mendekati layar. Menekan ubin membuka
 * tampilan penuh.
 */
function PhotoTile({ photo, onOpen }: { photo: GalleryPhoto; onOpen: () => void }) {
  const label = photo.visualDate ? `Visual ${photo.visualDate}` : 'Tanggal visual tidak tercantum';

  return (
    <div className="overflow-hidden rounded-lg border border-line bg-surface">
      {/*
        Foto dimuat langsung tanpa perlu diklik. `loading="lazy"` membatasi
        unduhan pada galeri panjang: hanya foto yang mendekati layar yang
        diambil, sehingga halaman tetap ringan tanpa menyembunyikan gambar
        di balik tombol "Muat foto".
      */}
      <button
        type="button"
        onClick={onOpen}
        className="block aspect-[5/3] w-full bg-white"
        aria-label={`Buka foto dokumentasi visual ${photo.volcanoName}${photo.visualDate ? ` tanggal ${photo.visualDate}` : ''}`}
      >
        <LazyPhoto src={photo.imagePath} alt={`Dokumentasi visual Gunung ${photo.volcanoName}`} />
      </button>
      <div className="px-2 py-1.5">
        <span className="block truncate text-xs font-semibold">{photo.volcanoName}</span>
        <span className="block text-[11px] text-muted">{label}</span>
      </div>
    </div>
  );
}

/** Foto galeri: `<img>` biasa agar tidak perlu JavaScript hanya untuk menampilkan. */
function LazyPhoto({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <span className="flex h-full w-full flex-col items-center justify-center gap-1 bg-bg/60 text-[11px] text-muted">
        <ImageOff size={16} aria-hidden />
        Foto tidak tersedia
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      className="block h-full w-full object-contain"
      onError={() => setFailed(true)}
    />
  );
}

export function GalleryGrid({ photos }: { photos: GalleryPhoto[] }) {
  const [index, setIndex] = useState<number | null>(null);
  const current = index === null ? null : photos[index] ?? null;
  return (
    <>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {photos.map((photo, i) => (
          <li key={photo.id}>
            <PhotoTile photo={photo} onOpen={() => setIndex(i)} />
          </li>
        ))}
      </ul>
      {current && (
        <ImageDialog
          title={`Gunung ${current.volcanoName}`}
          subtitle={[
            current.visualDate ? `Visual ${current.visualDate}` : null,
            current.uploadedAt ? `Diunggah ${fmtTime(current.uploadedAt)}` : null,
          ].filter(Boolean).join(' · ') || 'Metadata tanggal tidak diterbitkan sumber'}
          onClose={() => setIndex(null)}
          footer={(
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-muted">Sumber: MAGMA Indonesia / PVMBG. Tidak ada keterangan foto tambahan yang diterbitkan.</span>
              <div className="flex items-center gap-1">
                <button
                  id="image-dialog-prev"
                  type="button"
                  onClick={() => setIndex((i) => (i === null ? null : (i - 1 + photos.length) % photos.length))}
                  className="inline-flex min-h-8 items-center gap-1 rounded-md border border-line px-2 font-medium"
                >
                  <ChevronLeft size={13} aria-hidden /> Sebelumnya
                </button>
                <span className="px-1 text-muted">{index! + 1}/{photos.length}</span>
                <button
                  id="image-dialog-next"
                  type="button"
                  onClick={() => setIndex((i) => (i === null ? null : (i + 1) % photos.length))}
                  className="inline-flex min-h-8 items-center gap-1 rounded-md border border-line px-2 font-medium"
                >
                  Berikutnya <ChevronRight size={13} aria-hidden />
                </button>
              </div>
              <a href={current.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-accent underline">
                Gambar asli <ExternalLink size={11} aria-hidden />
              </a>
            </div>
          )}
        >
          <SourceImage eager src={current.imagePath} alt={`Dokumentasi visual Gunung ${current.volcanoName}`} className="mx-auto block max-h-[70vh] w-full object-contain" />
        </ImageDialog>
      )}
    </>
  );
}

export function ReportCard({ report, showVolcano = true }: { report: VolcanoReport; showVolcano?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <article className="rounded-lg border border-line bg-surface">
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-line px-4 py-2.5">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold">
            {showVolcano ? `${report.volcanoName} · ` : ''}{report.date}{report.period ? ` · ${report.period}` : ''}
          </h3>
          <p className="mt-0.5 text-xs text-muted">
            {report.kind === 'harian' ? 'Laporan Harian' : 'Laporan Aktivitas'}
            {report.timeZone ? ` · ${report.timeZone}` : ''}
            {report.author ? ` · disusun ${report.author}` : ''}
          </p>
        </div>
        <VolcanoLevelBadge level={report.level} compact />
      </div>
      <dl className="space-y-2 px-4 py-3 text-sm">
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-muted">Pengamatan visual</dt>
          <dd className={`mt-0.5 whitespace-pre-line ${expanded ? '' : 'line-clamp-4'}`}>{report.visualText || 'Tidak dicantumkan sumber.'}</dd>
        </div>
        {report.seismic.length > 0 && (
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted">Kegempaan</dt>
            <dd className="mt-0.5">
              <ul className="list-disc space-y-0.5 pl-4 text-xs">
                {report.seismic.slice(0, expanded ? undefined : 3).map((item, i) => (
                  <li key={`${item.name}-${i}`}>{item.text}</li>
                ))}
              </ul>
            </dd>
          </div>
        )}
        <button type="button" onClick={() => setExpanded((v) => !v)} className="inline-flex min-h-8 items-center gap-1 rounded-md border border-line px-2 text-xs font-medium">
          {expanded ? 'Ringkas tampilan' : 'Lihat rincian lengkap'}
        </button>
        {expanded && report.recommendation && (
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted">Rekomendasi resmi</dt>
            <dd className="mt-0.5 whitespace-pre-line text-xs">{report.recommendation}</dd>
          </div>
        )}
      </dl>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-2 text-xs">
        <span className="text-muted">Sumber laporan: MAGMA Indonesia — PVMBG</span>
        <Link href={`/gunung-berapi/laporan/${report.id}`} className="inline-flex items-center gap-1 font-medium text-accent underline">
          Buka laporan lengkap <ChevronRight size={12} aria-hidden />
        </Link>
      </div>
    </article>
  );
}

export function VonaCard({ notice }: { notice: VonaNotice }) {
  return (
    <li className="rounded-lg border border-line bg-surface px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <Mountain size={15} aria-hidden className="text-muted" />
        <span className="text-sm font-semibold">{notice.volcanoName}</span>
        <VonaBadge code={notice.currentCode} />
        <span className="text-xs text-muted">{notice.noticeNumber ?? 'nomor tidak tercantum'}</span>
        <span className="ml-auto inline-flex items-center gap-1 text-xs text-muted"><Clock size={11} aria-hidden /> {fmtTime(notice.issuedAt)}</span>
      </div>
      <p className="mt-1 text-xs text-muted">
        Kode sebelumnya {notice.previousCode ?? 'tidak tercantum'} → {notice.currentCode ?? 'tidak tercantum'}
        {notice.ashHeightM !== null ? ` · tinggi abu ${notice.ashHeightM} m` : ' · tinggi abu tidak tercantum'}
        {notice.durationMinutes !== null ? ` · durasi ${notice.durationMinutes} menit` : ''}
      </p>
      {notice.description && <p className="mt-1 text-xs">{notice.description}</p>}
      <p className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted">
        {notice.typeLabel && <span>Jenis: {notice.typeLabel}</span>}
        {notice.isSent && <span className="inline-flex items-center gap-1"><AlertTriangle size={10} aria-hidden /> Terkirim ke penerbangan</span>}
        <a href={notice.sourceUrl} target="_blank" rel="noopener noreferrer" className="ml-auto inline-flex items-center gap-1 font-medium text-accent underline">
          VONA MAGMA <ExternalLink size={11} aria-hidden />
        </a>
      </p>
    </li>
  );
}

export function CameraEmptyHint({ officialUrl }: { officialUrl: string }) {
  return (
    <div className="rounded-lg border border-line bg-surface p-4 text-sm">
      <p className="flex items-start gap-2">
        <Camera size={17} aria-hidden className="mt-0.5 shrink-0 text-muted" />
        MAGMA tidak menyediakan kamera untuk gunung api ini, atau daftar kamera sedang tidak dapat dimuat.
        Halaman CCTV resmi MAGMA memuat kamera yang aktif.
      </p>
      <a href={officialUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 font-medium text-accent underline">
        Buka CCTV MAGMA <ExternalLink size={12} aria-hidden />
      </a>
    </div>
  );
}
