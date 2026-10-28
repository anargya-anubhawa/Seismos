import { fmtTime } from '../formatting';
import type { TsunamiAlert, TsunamiAlertStatus, TsunamiLevel } from '../../types/tsunami';
import type { TsunamiNotificationKind } from './identity';

export interface TsunamiPushPayload {
  title: string;
  body: string;
  tag: string;
  url: string;
  alertId: string;
  status: TsunamiAlertStatus;
  phase: string | null;
  subject: string;
  issueTime: string;
  regions: string[];
  summary: string;
  requireInteraction: boolean;
}

const LEVEL_ORDER: Record<TsunamiLevel, number> = { AWAS: 0, SIAGA: 1, WASPADA: 2 };

export const TSUNAMI_DETAIL_PATH = (id: string): string => `/tsunami/${encodeURIComponent(id)}`;

function statusLabel(alert: TsunamiAlert, kind: TsunamiNotificationKind): string {
  if (kind === 'cancelled' || alert.status === 'ended') return 'BERAKHIR';
  const phase = alert.phase ? ` ${alert.phase}` : '';
  return kind === 'updated' ? `DIPERBARUI${phase}` : `AKTIF${phase}`;
}

function regionSummary(alert: TsunamiAlert): string[] {
  const groups = new Map<string, Set<TsunamiLevel>>();
  for (const region of alert.regions) {
    const levels = groups.get(region.province) ?? new Set<TsunamiLevel>();
    levels.add(region.level);
    groups.set(region.province, levels);
  }
  return Array.from(groups.entries())
    .map(([province, levels]) => `${province} (${Array.from(levels).sort((a, b) => LEVEL_ORDER[a] - LEVEL_ORDER[b]).join('/')})`);
}

function truncate(value: string, max: number): string {
  const text = value.replace(/\s+/g, ' ').trim();
  return text.length <= max ? text : `${text.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

/**
 * Isi notifikasi push. Judul memakai subjek resmi BMKG apa adanya; status,
 * waktu terbit, wilayah, ringkasan, dan tautan detail disertakan terpisah.
 */
export function buildTsunamiPushPayload(alert: TsunamiAlert, kind: TsunamiNotificationKind): TsunamiPushPayload {
  const status = statusLabel(alert, kind);
  const regions = regionSummary(alert);
  const shownRegions = regions.slice(0, 8);
  const regionText = regions.length > shownRegions.length
    ? `${shownRegions.join(', ')}, dan ${regions.length - shownRegions.length} provinsi lain`
    : shownRegions.join(', ');
  const quake = [
    alert.magnitude !== null ? `M ${alert.magnitude.toFixed(1)}` : null,
    alert.depthKm !== null ? `kedalaman ${alert.depthKm} km` : null,
    alert.region || null,
  ].filter(Boolean).join(' · ');
  const summary = truncate(alert.headline || alert.description || alert.subject, 240);
  const lines = [
    `Status: ${status} · ${fmtTime(alert.issueTime)}`,
    quake,
    regionText ? `Wilayah: ${regionText}` : 'Wilayah belum dirinci pada pembaruan ini',
    summary,
    `Detail: ${TSUNAMI_DETAIL_PATH(alert.id)}`,
  ].filter((line): line is string => Boolean(line));

  return {
    title: alert.subject,
    body: lines.join('\n'),
    tag: `seismos-tsunami-${alert.id}`,
    url: TSUNAMI_DETAIL_PATH(alert.id),
    alertId: alert.id,
    status: alert.status,
    phase: alert.phase,
    subject: alert.subject,
    issueTime: alert.issueTime,
    regions: regions.slice(0, 40),
    summary,
    requireInteraction: alert.status === 'active',
  };
}
