import type { TsunamiAlert, TsunamiAlertStatus, TsunamiAlertUpdate, TsunamiSourceId } from '../../types/tsunami';
import type { TsunamiCandidate } from './parse';

export type TsunamiNotificationKind = 'issued' | 'updated' | 'cancelled';

const ORIGIN_MATCH_MS = 3 * 60_000;
const DISTANCE_MATCH_KM = 100;
const MAGNITUDE_MATCH = 1.5;
const MAX_UPDATES = 100;
const MAX_EVENT_IDS = 50;

/** Hash FNV-1a kecil agar ID detail tetap pendek dan deterministik. */
function hash(input: string): string {
  let value = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    value ^= input.charCodeAt(i);
    value = Math.imul(value, 0x01000193);
  }
  return (value >>> 0).toString(36);
}

function distanceKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const rad = Math.PI / 180;
  const dLat = (bLat - aLat) * rad;
  const dLon = (bLon - aLon) * rad;
  const s = Math.sin(dLat / 2) ** 2
    + Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(Math.max(0, 1 - s)));
}

const normalizeText = (value: string): string => value.toUpperCase().replace(/[^A-Z0-9]/g, '');

function sameRegionText(a: string, b: string): boolean {
  const left = normalizeText(a);
  const right = normalizeText(b);
  if (!left || !right) return false;
  return left === right || left.includes(right) || right.includes(left);
}

/** Kunci identitas awal; dipakai saat peringatan pertama kali dibuat. */
export function alertIdentityKey(candidate: TsunamiCandidate): string {
  const anchor = candidate.originTime ?? candidate.issueTime;
  const ms = Date.parse(anchor);
  const minute = Number.isFinite(ms) ? Math.floor(ms / 60_000) : 0;
  const lat = candidate.latitude === null ? '' : candidate.latitude.toFixed(2);
  const lon = candidate.longitude === null ? '' : candidate.longitude.toFixed(2);
  return `${minute}|${lat}|${lon}|${normalizeText(candidate.region).slice(0, 40)}`;
}

export function alertIdForKey(key: string): string {
  return `tsu-${hash(key)}`;
}

export function alertIdForCandidate(candidate: TsunamiCandidate): string {
  return alertIdForKey(alertIdentityKey(candidate));
}

export function distanceBetweenAlertsKm(a: TsunamiAlert, b: TsunamiCandidate): number | null {
  if (a.latitude === null || a.longitude === null || b.latitude === null || b.longitude === null) return null;
  return distanceKm(a.latitude, a.longitude, b.latitude, b.longitude);
}

/**
 * Mencari peringatan yang sama. BMKG menerbitkan `eventid` baru untuk setiap
 * pembaruan, jadi kecocokan utama memakai waktu gempa + lokasi. Ambang dibuat
 * ketat agar gempa susulan yang berbeda tidak digabung.
 */
export function findMatchingAlert<T extends TsunamiAlert>(alerts: T[], candidate: TsunamiCandidate): T | null {
  for (const alert of alerts) {
    if (alert.sourceEventIds.includes(candidate.eventId)) return alert;
  }

  const candidateOrigin = candidate.originTime ? Date.parse(candidate.originTime) : Number.NaN;
  for (const alert of alerts) {
    const alertOrigin = alert.originTime ? Date.parse(alert.originTime) : Number.NaN;
    if (Number.isFinite(candidateOrigin) && Number.isFinite(alertOrigin)) {
      if (Math.abs(candidateOrigin - alertOrigin) > ORIGIN_MATCH_MS) continue;
      if (candidate.magnitude !== null && alert.magnitude !== null
        && Math.abs(candidate.magnitude - alert.magnitude) > MAGNITUDE_MATCH) continue;
      const distance = distanceBetweenAlertsKm(alert, candidate);
      if (distance !== null) {
        if (distance <= DISTANCE_MATCH_KM) return alert;
        continue;
      }
      if (sameRegionText(alert.region, candidate.region)) return alert;
      continue;
    }

    // Bila salah satu sumber tidak mencantumkan waktu gempa, gunakan waktu
    // terbit dan teks lokasi sebagai pertahanan terakhir.
    const issueDiff = Math.abs(Date.parse(candidate.issueTime) - Date.parse(alert.issueTime));
    if (issueDiff <= 30 * 60_000 && sameRegionText(alert.region, candidate.region)) return alert;
  }
  return null;
}

function updateEntry(candidate: TsunamiCandidate): TsunamiAlertUpdate {
  return {
    issueTime: candidate.issueTime,
    phase: candidate.phase,
    subject: candidate.subject,
    status: candidate.status,
    headline: candidate.headline,
    regionCount: candidate.regions.length,
  };
}

function appendUpdate(updates: TsunamiAlertUpdate[], candidate: TsunamiCandidate): TsunamiAlertUpdate[] {
  const entry = updateEntry(candidate);
  const last = updates[updates.length - 1];
  if (last && last.issueTime === entry.issueTime && last.subject === entry.subject && last.status === entry.status) {
    return [...updates.slice(0, -1), entry];
  }
  return [...updates, entry].slice(-MAX_UPDATES);
}

export function createAlert(candidate: TsunamiCandidate, now = new Date().toISOString()): TsunamiAlert {
  return {
    id: alertIdForCandidate(candidate),
    sourceIds: [candidate.source],
    sourceEventIds: [candidate.eventId],
    subject: candidate.subject,
    phase: candidate.phase,
    status: candidate.status,
    issueTime: candidate.issueTime,
    originTime: candidate.originTime,
    magnitude: candidate.magnitude,
    depthKm: candidate.depthKm,
    latitude: candidate.latitude,
    longitude: candidate.longitude,
    region: candidate.region,
    headline: candidate.headline,
    description: candidate.description,
    potential: candidate.potential,
    instructions: candidate.instructions,
    regions: candidate.regions,
    regionsIssueTime: candidate.regions.length > 0 ? candidate.issueTime : null,
    observations: candidate.observations,
    maps: candidate.maps,
    sourceUrl: candidate.sourceUrl,
    sourceName: candidate.sourceName,
    firstSeenAt: now,
    updatedAt: now,
    endedAt: candidate.status === 'ended' ? candidate.issueTime : null,
    updates: [updateEntry(candidate)],
  };
}

function mergeMaps(previous: TsunamiAlert['maps'], candidate: TsunamiCandidate): TsunamiAlert['maps'] {
  return {
    travelTime: candidate.maps.travelTime ?? previous.travelTime,
    coastalThreat: candidate.maps.coastalThreat ?? previous.coastalThreat,
    seaLevel: candidate.maps.seaLevel ?? previous.seaLevel,
    shakemap: candidate.maps.shakemap ?? previous.shakemap,
  };
}

/**
 * Menerapkan pembaruan resmi yang lebih baru. Data yang tidak dirinci pada
 * pembaruan terakhir (mis. wilayah pada PD-4) tidak dihapus; waktu rujukan
 * wilayah tetap disimpan agar UI bisa menjelaskan sumbernya.
 */
export function applyCandidate<T extends TsunamiAlert>(
  alert: T,
  candidate: TsunamiCandidate,
  now = new Date().toISOString(),
): { alert: T; changed: boolean } {
  const currentMs = Date.parse(alert.issueTime);
  const nextMs = Date.parse(candidate.issueTime);
  if (Number.isFinite(currentMs) && Number.isFinite(nextMs) && nextMs < currentMs) {
    return { alert, changed: false };
  }
  if (alert.issueTime === candidate.issueTime
    && alert.subject === candidate.subject
    && alert.status === candidate.status
    && fingerprintAlert(alert) === fingerprintCandidate(candidate, alert)) {
    return { alert, changed: false };
  }

  const sourceIds: TsunamiSourceId[] = Array.from(new Set([...alert.sourceIds, candidate.source]));
  const sourceEventIds = Array.from(new Set([...alert.sourceEventIds, candidate.eventId])).slice(-MAX_EVENT_IDS);
  const nextStatus: TsunamiAlertStatus = candidate.status;
  const hasNewRegions = candidate.regions.length > 0;
  const hasNewObservations = candidate.observations.length > 0;

  const updated: T = {
    ...alert,
    sourceIds,
    sourceEventIds,
    subject: candidate.subject || alert.subject,
    phase: candidate.phase ?? alert.phase,
    status: nextStatus,
    issueTime: candidate.issueTime,
    originTime: alert.originTime ?? candidate.originTime,
    magnitude: candidate.magnitude ?? alert.magnitude,
    depthKm: candidate.depthKm ?? alert.depthKm,
    latitude: candidate.latitude ?? alert.latitude,
    longitude: candidate.longitude ?? alert.longitude,
    region: candidate.region || alert.region,
    headline: candidate.headline || alert.headline,
    description: candidate.description || alert.description,
    potential: candidate.potential || alert.potential,
    instructions: candidate.instructions.length > 0 ? candidate.instructions : alert.instructions,
    regions: hasNewRegions ? candidate.regions : alert.regions,
    regionsIssueTime: hasNewRegions ? candidate.issueTime : alert.regionsIssueTime,
    observations: hasNewObservations ? candidate.observations : alert.observations,
    maps: mergeMaps(alert.maps, candidate),
    sourceUrl: candidate.sourceUrl || alert.sourceUrl,
    sourceName: candidate.sourceName || alert.sourceName,
    updatedAt: now,
    endedAt: nextStatus === 'ended' ? (alert.endedAt ?? candidate.issueTime) : null,
    updates: appendUpdate(alert.updates, candidate),
  };
  return { alert: updated, changed: true };
}

function candidateContent(candidate: TsunamiCandidate): string {
  return JSON.stringify({
    status: candidate.status,
    phase: candidate.phase,
    subject: candidate.subject,
    issueTime: candidate.issueTime,
    headline: candidate.headline,
    regions: candidate.regions.map((r) => `${r.level}|${r.province}|${r.district}`),
    observations: candidate.observations.map((o) => `${o.location}|${o.heightM ?? ''}`),
    instructions: candidate.instructions,
  });
}

function fingerprintCandidate(candidate: TsunamiCandidate, alert: TsunamiAlert): string {
  const nextRegions = candidate.regions.length > 0
    ? candidate.regions
    : alert.regions;
  const nextObservations = candidate.observations.length > 0
    ? candidate.observations
    : alert.observations;
  return hash(JSON.stringify({
    status: candidate.status,
    phase: candidate.phase ?? alert.phase,
    subject: candidate.subject,
    issueTime: candidate.issueTime,
    headline: candidate.headline,
    regions: nextRegions.map((r) => `${r.level}|${r.province}|${r.district}`),
    observations: nextObservations.map((o) => `${o.location}|${o.heightM ?? ''}`),
    instructions: candidate.instructions.length > 0 ? candidate.instructions : alert.instructions,
  }));
}

/** Sidik jari isi notifikasi; perubahan kecil seperti updatedAt tidak dihitung. */
export function fingerprintAlert(alert: TsunamiAlert): string {
  return hash(JSON.stringify({
    status: alert.status,
    phase: alert.phase,
    subject: alert.subject,
    issueTime: alert.issueTime,
    headline: alert.headline,
    regions: alert.regions.map((r) => `${r.level}|${r.province}|${r.district}`),
    observations: alert.observations.map((o) => `${o.location}|${o.heightM ?? ''}`),
    instructions: alert.instructions,
  }));
}

/**
 * Menentukan jenis notifikasi. Seed pertama (riwayat lama) tidak menghasilkan
 * notifikasi; pembaruan hanya dikirim bila isi resminya berubah.
 */
export function classifyChange(
  previous: TsunamiAlert | null,
  next: TsunamiAlert,
  isSeed: boolean,
): TsunamiNotificationKind | null {
  if (isSeed) return null;
  if (!previous) return next.status === 'active' ? 'issued' : null;
  if (previous.status === 'active' && next.status === 'ended') return 'cancelled';
  if (previous.status === 'ended' && next.status === 'active') return 'issued';
  if (previous.status === 'active' && next.status === 'active'
    && fingerprintAlert(previous) !== fingerprintAlert(next)) return 'updated';
  return null;
}

export { candidateContent };
