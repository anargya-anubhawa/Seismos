import Link from 'next/link';
import type { ReactNode } from 'react';
import type { Earthquake } from '@/types/earthquake';
import { fmtAgo, fmtTime, magColor } from '@/lib/formatting';
import { mmiColor, mmiInfo, mmiRoman, mmiTextColor } from '@/lib/felt';
import { BMKG_ATTRIBUTION_URL } from '@/lib/constants';

export function BrandMark({ size = 28, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 28 28"
      aria-hidden
      focusable="false"
      className={className}
    >
      <rect width="28" height="28" rx="6" fill="rgb(var(--accent))" />
      <path
        d="M3 15h5l2-7 3 12 3-9 2 4h7"
        fill="none"
        stroke="rgb(var(--accent-ink))"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function LoadingNotice({ children = 'Mengambil data…' }: { children?: ReactNode }) {
  return (
    <p role="status" aria-live="polite" className="mb-3 text-sm text-muted">
      {children}
    </p>
  );
}

export function StaleDataNotice({ error, updatedAt }: { error: string | null; updatedAt: string | null }) {
  if (!error) return null;
  return (
    <div role="alert" className="mb-4 rounded-lg border border-danger/50 bg-surface px-4 py-2.5 text-sm text-danger">
      Pembaruan data gagal ({error}). Menampilkan data terakhir yang berhasil diambil
      {updatedAt ? ` pada ${fmtTime(updatedAt)}` : ''}; data ini bisa sudah tidak mutakhir.
    </div>
  );
}

export function MagBadge({ m, large = false }: { m: number; large?: boolean }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded font-semibold text-[#0B1A2E] ${large ? 'h-14 w-14 text-xl' : 'h-9 w-11 text-sm'}`}
      style={{ background: magColor(m) }}
      aria-label={`Magnitudo ${m.toFixed(1)}`}
    >
      {m.toFixed(1)}
    </span>
  );
}

export function MmiBadge({ mmi, label, compact = false }: { mmi: number; label?: string; compact?: boolean }) {
  const info = mmiInfo(mmi);
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center gap-1 rounded font-semibold ${compact ? 'px-1.5 py-0.5 text-[11px]' : 'px-2 py-0.5 text-xs'}`}
      style={{ background: mmiColor(mmi), color: mmiTextColor(mmi) }}
      title={`MMI ${mmiRoman(mmi)} — ${info.short}: ${info.description}`}
      aria-label={`Intensitas MMI ${label ?? mmiRoman(mmi)}, ${info.short}`}
    >
      MMI {label ?? mmiRoman(mmi)}
    </span>
  );
}

export function PageTitle({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="mb-4">
      <h1 className="text-xl font-semibold">{title}</h1>
      {hint && <p className="mt-1 max-w-3xl text-sm text-muted">{hint}</p>}
    </div>
  );
}

export function Panel({
  title,
  children,
  className = '',
  headingLevel: Heading = 'h2',
}: {
  title?: string;
  children: ReactNode;
  className?: string;
  headingLevel?: 'h2' | 'h3';
}) {
  return (
    <section className={`min-w-0 rounded-lg border border-line bg-surface ${className}`}>
      {title && <Heading className="border-b border-line px-4 py-2.5 text-sm font-semibold">{title}</Heading>}
      {children}
    </section>
  );
}

export function StateBox({ kind, title, children }: { kind: 'loading' | 'error' | 'empty'; title: string; children?: ReactNode }) {
  return (
    <div className={`rounded-lg border p-6 text-sm ${kind === 'error' ? 'border-danger/50' : 'border-line'} bg-surface`} role={kind === 'error' ? 'alert' : undefined}>
      <p className={`font-semibold ${kind === 'error' ? 'text-danger' : ''}`}>{title}</p>
      {kind === 'loading' && <div className="mt-3 h-2 w-40 animate-pulse rounded bg-line" />}
      {children && <div className="mt-1 text-muted">{children}</div>}
    </div>
  );
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-line/70 ${className}`} aria-hidden />;
}

export function EventRow({ q, active, onSelect }: { q: Earthquake; active?: boolean; onSelect?: (id: string) => void }) {
  return (
    <li className={`flex items-start gap-3 border-b border-line px-4 py-3 last:border-0 ${active ? 'bg-accent/10' : ''}`}>
      <MagBadge m={q.magnitude} />
      <div className="min-w-0 flex-1">
        {onSelect ? (
          <button onClick={() => onSelect(q.id)} className="text-left text-sm font-medium hover:underline">{q.region}</button>
        ) : (
          <p className="text-sm font-medium">{q.region}</p>
        )}
        <p className="mt-0.5 text-xs text-muted">
          {fmtTime(q.originTime)} ({fmtAgo(q.originTime)}) · Kedalaman {q.depthKm} km
        </p>
        <p className="mt-0.5 text-xs text-muted">
          {q.latitude.toFixed(2)}, {q.longitude.toFixed(2)}
          {q.maxMmi ? ` · Dirasakan hingga MMI ${mmiRoman(q.maxMmi)}` : q.felt ? ' · Ada keterangan dirasakan' : ''}
        </p>
        {q.maxMmi && <div className="mt-1"><MmiBadge mmi={q.maxMmi} compact /></div>}
        {q.tsunamiNote && <p className="mt-0.5 text-xs">BMKG: {q.tsunamiNote}</p>}
      </div>
      <Link href={`/event/${encodeURIComponent(q.id)}`} className="shrink-0 rounded border border-line px-2.5 py-1.5 text-xs font-medium hover:bg-line/40">
        Detail
      </Link>
    </li>
  );
}

export function Attribution() {
  return (
    <p className="mt-6 text-xs text-muted">
      Sumber data: <a className="underline" href={BMKG_ATTRIBUTION_URL} target="_blank" rel="noopener noreferrer">BMKG/InaTEWS (data.bmkg.go.id)</a>.
      Informasi sementara dan dapat berubah setelah pemutakhiran; rujuk kanal resmi BMKG untuk keputusan keselamatan.
    </p>
  );
}
