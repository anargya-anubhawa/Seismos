import Link from 'next/link';
import type { Earthquake } from '@/types/earthquake';
import { MMI_SCALE, mmiColor, mmiInfo, mmiTextColor } from '@/lib/felt';
import { MmiBadge, Panel } from '@/components/ui/common';

/**
 * Ringkasan MMI dari laporan "Dirasakan" BMKG. Komponen ini tidak menghitung
 * estimasi intensitas: nilai yang ditampilkan hanya yang benar-benar terbaca
 * dari teks sumber.
 */
export function MmiSummary({
  events,
  className = '',
}: {
  events: Earthquake[];
  className?: string;
}) {
  const withMmi = events.filter((event) => (event.maxMmi ?? 0) > 0);
  const highest = withMmi.reduce((max, event) => Math.max(max, event.maxMmi ?? 0), 0);

  return (
    <Panel title="Ringkasan skala MMI" className={className}>
      <div className="p-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs text-muted">Intensitas tertinggi dilaporkan</p>
            {highest > 0 ? (
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <MmiBadge mmi={highest} />
                <span className="text-sm font-medium">{mmiInfo(highest).short}</span>
              </div>
            ) : (
              <p className="mt-1 text-sm">Belum ada laporan MMI yang terbaca.</p>
            )}
          </div>
          <p className="text-xs text-muted">
            {withMmi.length}/{events.length} kejadian · laporan BMKG
          </p>
        </div>

        <div className="mt-3">
          <p className="text-xs font-medium text-muted">
            Jumlah kejadian menurut MMI tertinggi
          </p>
          <ol
            className="mt-1.5 grid grid-cols-6 gap-1 sm:flex sm:overflow-x-auto sm:overscroll-x-contain sm:pb-1"
            aria-label="Skala MMI dari I sampai XII beserta jumlah kejadian"
          >
            {MMI_SCALE.map((scale) => {
              const count = withMmi.filter((event) => event.maxMmi === scale.mmi).length;
              return (
                <li key={scale.mmi} className="shrink-0 text-center">
                  <span
                    className="inline-flex h-7 min-w-8 items-center justify-center rounded px-1.5 text-[11px] font-semibold"
                    style={{
                      background: mmiColor(scale.mmi),
                      color: mmiTextColor(scale.mmi),
                    }}
                    title={`MMI ${scale.roman} — ${scale.short}: ${scale.description}`}
                    aria-label={`MMI ${scale.roman}, ${scale.short}`}
                  >
                    {scale.roman}
                  </span>
                  <span className="mt-0.5 block text-[10px] tabular-nums text-muted">
                    {count}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>

        <p className="mt-1.5 text-xs text-muted">
          Nilai diambil dari teks “Dirasakan” BMKG, bukan estimasi seluruh
          wilayah.{' '}
          <Link href="/mitigasi" className="underline">
            Uraian skala
          </Link>
          .
        </p>
      </div>
    </Panel>
  );
}
