import Link from 'next/link';
import {
  Activity, Clock, ExternalLink, MapPin, Radio, ShieldAlert, TriangleAlert, Waves,
} from 'lucide-react';
import { fmtTime } from '@/lib/formatting';
import type {
  TsunamiAlert, TsunamiAlertUpdate, TsunamiLevel, TsunamiObservation, TsunamiRegion, TsunamiSourceStatus,
} from '@/types/tsunami';

const LEVEL_STYLE: Record<TsunamiLevel, string> = {
  AWAS: 'border-danger/60 bg-danger/10 text-danger',
  SIAGA: 'border-[#C2711A]/60 bg-[#C2711A]/10 text-[#9A530C] dark:text-[#F2B45E]',
  WASPADA: 'border-[#B08A00]/50 bg-[#F2C14E]/15 text-[#7A6000] dark:text-[#F2C14E]',
};

const LEVEL_LABEL: Record<TsunamiLevel, string> = {
  AWAS: 'Awas — evakuasi',
  SIAGA: 'Siaga — siap evakuasi',
  WASPADA: 'Waspada — jauhi pantai',
};

export function TsunamiLevelBadge({ level, compact = false }: { level: TsunamiLevel; compact?: boolean }) {
  return (
    <span className={`inline-flex items-center rounded border px-1.5 py-0.5 font-semibold ${compact ? 'text-[11px]' : 'text-xs'} ${LEVEL_STYLE[level]}`}>
      {level}
    </span>
  );
}

export function TsunamiStatusBadge({ alert }: { alert: Pick<TsunamiAlert, 'status' | 'phase'> }) {
  if (alert.status === 'ended') {
    return (
      <span className="inline-flex items-center gap-1 rounded border border-line bg-line/30 px-2 py-0.5 text-xs font-semibold text-muted">
        BERAKHIR{alert.phase ? ` · ${alert.phase}` : ''}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded border border-danger/60 bg-danger/10 px-2 py-0.5 text-xs font-semibold text-danger">
      <span aria-hidden className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
      AKTIF{alert.phase ? ` · ${alert.phase}` : ''}
    </span>
  );
}

export function TsunamiAlertHeader({ alert }: { alert: TsunamiAlert }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Waves size={18} aria-hidden className={alert.status === 'active' ? 'text-danger' : 'text-muted'} />
      <TsunamiStatusBadge alert={alert} />
      <span className="inline-flex items-center gap-1 text-xs text-muted">
        <Clock size={13} aria-hidden /> Terbit {fmtTime(alert.issueTime)}
      </span>
    </div>
  );
}

function groupRegions(regions: TsunamiRegion[]): { level: TsunamiLevel; rows: TsunamiRegion[] }[] {
  const order: TsunamiLevel[] = ['AWAS', 'SIAGA', 'WASPADA'];
  return order
    .map((level) => ({ level, rows: regions.filter((region) => region.level === level) }))
    .filter((group) => group.rows.length > 0);
}

export function TsunamiRegionList({ alert }: { alert: TsunamiAlert }) {
  const groups = groupRegions(alert.regions);
  const regionsFromEarlier = alert.regionsIssueTime && alert.regionsIssueTime !== alert.issueTime;
  if (groups.length === 0) {
    return (
      <p className="text-sm text-muted">
        BMKG tidak merinci wilayah pesisir pada pembaruan ini. Ini bukan berarti tidak ada wilayah terdampak;
        periksa kanal resmi BMKG.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {groups.map(({ level, rows }) => (
        <div key={level}>
          <div className="mb-1.5 flex flex-wrap items-center gap-2">
            <TsunamiLevelBadge level={level} />
            <span className="text-xs text-muted">{LEVEL_LABEL[level]} · {rows.length} wilayah</span>
          </div>
          <ul className="grid gap-1 sm:grid-cols-2">
            {rows.map((region) => (
              <li key={`${region.province}|${region.district}|${region.level}`} className="rounded border border-line bg-bg/50 px-2.5 py-1.5 text-xs">
                <span className="font-medium">{region.district || region.province}</span>
                {region.district && region.province && region.district !== region.province && (
                  <span className="text-muted"> · {region.province}</span>
                )}
                {(region.date || region.time) && (
                  <span className="mt-0.5 block text-[11px] text-muted">
                    {[region.date, region.time].filter(Boolean).join(' · ')}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
      <p className="text-[11px] text-muted">
        Daftar wilayah mengikuti pembaruan resmi BMKG
        {alert.regionsIssueTime ? ` ${fmtTime(alert.regionsIssueTime)}` : ''}.
        {regionsFromEarlier ? ' Pembaruan terakhir tidak merinci ulang wilayah, jadi daftar ini berasal dari pembaruan sebelumnya.' : ''}
        {alert.status === 'ended' ? ' Peringatan sudah dinyatakan berakhir; daftar ini adalah rincian terakhir sebelum berakhir.' : ''}
      </p>
    </div>
  );
}

export function TsunamiObservationList({ observations }: { observations: TsunamiObservation[] }) {
  if (observations.length === 0) {
    return <p className="text-sm text-muted">Belum ada pengamatan muka laut yang dirinci BMKG pada data ini.</p>;
  }
  return (
    <ul className="grid gap-1 sm:grid-cols-2">
      {observations.map((observation) => (
        <li key={`${observation.location}|${observation.date}|${observation.time}`} className="flex items-start justify-between gap-2 rounded border border-line bg-bg/50 px-2.5 py-1.5 text-xs">
          <span className="font-medium">{observation.location}</span>
          <span className="text-right text-muted">
            {observation.heightM !== null ? `${observation.heightM.toFixed(2)} m` : 'tinggi tidak tercantum'}
            {(observation.date || observation.time) && (
              <span className="block text-[11px]">{[observation.date, observation.time].filter(Boolean).join(' · ')}</span>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}

/**
 * BMKG tidak menerbitkan ETA tekstual per wilayah pada endpoint ini. Jangan
 * menghitung atau mengarang ETA; tampilkan peta resmi bila tersedia.
 */
export function TsunamiEtaNotice({ alert }: { alert: TsunamiAlert }) {
  const map = alert.maps.travelTime;
  return (
    <div className="rounded border border-line bg-bg/50 px-3 py-2 text-xs">
      <p className="font-medium">Perkiraan waktu tiba (ETA)</p>
      {map ? (
        <p className="mt-0.5 text-muted">
          Tidak ada ETA tekstual per wilayah pada data BMKG ini. Gunakan peta waktu tempuh resmi BMKG:
          {' '}
          <a href={map} target="_blank" rel="noopener noreferrer" className="font-medium text-accent underline">
            buka peta waktu tempuh (ttmap) <ExternalLink size={11} aria-hidden className="inline" />
          </a>.
        </p>
      ) : (
        <p className="mt-0.5 text-muted">
          Data BMKG ini tidak memuat ETA atau peta waktu tempuh. Aplikasi tidak memperkirakan ETA sendiri.
        </p>
      )}
    </div>
  );
}

export function TsunamiAlertCard({ alert, compact = false }: { alert: TsunamiAlert; compact?: boolean }) {
  return (
    <article className={`rounded-lg border bg-surface ${alert.status === 'active' ? 'border-danger/50' : 'border-line'}`}>
      <div className="space-y-3 p-4">
        <TsunamiAlertHeader alert={alert} />
        <div>
          <h3 className="text-base font-semibold leading-snug">{alert.subject}</h3>
          <p className="mt-1 text-sm text-muted">{alert.headline}</p>
        </div>

        <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
          <div className="flex items-center gap-1.5">
            <Activity size={14} aria-hidden className="text-muted" />
            <dt className="text-muted">Gempa</dt>
            <dd className="font-medium">
              {alert.magnitude !== null ? `M ${alert.magnitude.toFixed(1)}` : 'magnitudo tidak tercantum'}
              {alert.depthKm !== null ? ` · ${alert.depthKm} km` : ''}
            </dd>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock size={14} aria-hidden className="text-muted" />
            <dt className="text-muted">Waktu gempa</dt>
            <dd>{alert.originTime ? fmtTime(alert.originTime) : 'tidak tercantum'}</dd>
          </div>
          <div className="flex items-start gap-1.5 sm:col-span-2">
            <MapPin size={14} aria-hidden className="mt-0.5 text-muted" />
            <dt className="sr-only">Lokasi</dt>
            <dd>{alert.region}</dd>
          </div>
        </dl>

        <div>
          <h4 className="mb-2 text-sm font-semibold">Wilayah pesisir</h4>
          <TsunamiRegionList alert={alert} />
        </div>

        {!compact && alert.observations.length > 0 && (
          <div>
            <h4 className="mb-2 text-sm font-semibold">Pengamatan muka laut</h4>
            <TsunamiObservationList observations={alert.observations} />
          </div>
        )}

        <TsunamiEtaNotice alert={alert} />

        <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
          <Link
            href={`/tsunami/${encodeURIComponent(alert.id)}`}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-md bg-accent px-3 text-sm font-medium text-accent-ink"
          >
            <Radio size={15} aria-hidden /> Detail peringatan
          </Link>
          <a
            href={alert.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-line px-3 text-sm font-medium"
          >
            <ExternalLink size={14} aria-hidden /> Sumber resmi BMKG
          </a>
          <span className="ml-auto text-[11px] text-muted">{alert.sourceName}</span>
        </div>
      </div>
    </article>
  );
}

export function TsunamiSourceStatusList({ sources }: { sources: TsunamiSourceStatus[] }) {
  if (sources.length === 0) return null;
  return (
    <ul className="divide-y divide-line text-sm">
      {sources.map((source) => {
        const tone = !source.ok || source.stale ? 'text-danger' : 'text-ok';
        return (
          <li key={source.id} className="px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium">{source.label}</span>
              <span className={`text-xs font-semibold ${tone}`}>
                {!source.ok
                  ? 'Gagal diperbarui'
                  : source.stale ? 'Data terlambat' : 'Segar'}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-muted">
              {source.fetchedAt
                ? `Terakhir berhasil ${fmtTime(source.fetchedAt)} · ${source.count} catatan resmi`
                : 'Belum pernah berhasil dimuat'}
            </p>
            {source.error && <p role="alert" className="mt-0.5 text-xs text-danger">{source.error}</p>}
            <a href={source.url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-accent underline">
              Buka sumber <ExternalLink size={11} aria-hidden />
            </a>
          </li>
        );
      })}
    </ul>
  );
}

export function TsunamiUpdateTimeline({ updates }: { updates: TsunamiAlertUpdate[] }) {
  if (updates.length === 0) return <p className="text-sm text-muted">Belum ada riwayat pembaruan.</p>;
  return (
    <ol className="space-y-2">
      {[...updates].reverse().map((update, index) => (
        <li key={`${update.issueTime}-${index}`} className="rounded border border-line bg-bg/40 px-3 py-2 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex rounded border px-1.5 py-0.5 text-[11px] font-semibold ${update.status === 'ended' ? 'border-line bg-line/30 text-muted' : 'border-danger/50 bg-danger/10 text-danger'}`}>
              {update.status === 'ended' ? 'BERAKHIR' : 'AKTIF'}
            </span>
            {update.phase && <span className="text-xs font-medium">{update.phase}</span>}
            <span className="text-xs text-muted">{fmtTime(update.issueTime)}</span>
            <span className="text-xs text-muted">· {update.regionCount} wilayah dirinci</span>
          </div>
          <p className="mt-1 font-medium">{update.subject}</p>
          {update.headline && <p className="mt-0.5 text-xs text-muted">{update.headline}</p>}
        </li>
      ))}
    </ol>
  );
}

export function TsunamiSafetyGuidance() {
  return (
    <div className="space-y-3 px-4 py-3 text-sm">
      <div className="flex items-start gap-2 rounded border border-danger/40 bg-danger/5 px-3 py-2">
        <TriangleAlert size={17} aria-hidden className="mt-0.5 shrink-0 text-danger" />
        <p>
          <strong>Jangan menunggu aplikasi ini untuk menyelamatkan diri.</strong> Jika berada di pantai dan merasakan
          gempa kuat, melihat air laut surut, atau mendengar suara gemuruh, segera menjauh ke tempat tinggi.
        </p>
      </div>
      <ul className="list-disc space-y-1.5 pl-5 text-muted">
        <li>Ikuti instruksi resmi BMKG, BNPB, BPBD, dan pemerintah daerah.</li>
        <li>Jauhi pantai, muara sungai, dan bangunan rendah di tepi laut sampai BMKG menyatakan peringatan berakhir.</li>
        <li>Gunakan jalur evakuasi resmi; hindari jembatan pesisir yang mungkin rusak.</li>
        <li>Waspadai gelombang susulan. Peringatan dapat diperbarui atau dinyatakan berakhir secara bertahap (PD-4).</li>
        <li>Bantu tetangga, anak-anak, lansia, dan penyandang disabilitas menuju tempat aman.</li>
      </ul>
      <p className="flex items-start gap-2 text-xs text-muted">
        <ShieldAlert size={15} aria-hidden className="mt-0.5 shrink-0" />
        Aplikasi ini bukan sistem peringatan dini resmi, bukan sirine evakuasi, dan tidak menggantikan kanal BMKG.
      </p>
    </div>
  );
}
