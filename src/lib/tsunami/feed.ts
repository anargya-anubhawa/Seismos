import type { TsunamiAlert, TsunamiFeed, TsunamiFeedState, TsunamiSourceStatus } from '../../types/tsunami';

export const DATAGEMPA_STALE_MS = 5 * 60_000;
export const HISTORY_STALE_MS = 30 * 60_000;
export const FEED_RECENT_ENDED = 10;

export interface TsunamiFeedInput {
  alerts: TsunamiAlert[];
  sources: TsunamiSourceStatus[];
  lastCheckAt: string | null;
  lastSuccessAt: string | null;
  lastHistorySuccessAt: string | null;
}

const sourceStaleAfter = (source: TsunamiSourceStatus): number =>
  source.id === 'datagempa' ? DATAGEMPA_STALE_MS : HISTORY_STALE_MS;

function withStaleness(sources: TsunamiSourceStatus[], now: number): TsunamiSourceStatus[] {
  return sources.map((source) => {
    const at = source.fetchedAt ? Date.parse(source.fetchedAt) : Number.NaN;
    const stale = !Number.isFinite(at) || now - at > sourceStaleAfter(source);
    return { ...source, stale };
  });
}

const byNewest = (a: TsunamiAlert, b: TsunamiAlert): number => {
  const left = Date.parse(a.issueTime);
  const right = Date.parse(b.issueTime);
  if (right !== left) return right - left;
  return b.updatedAt.localeCompare(a.updatedAt);
};

/**
 * Menyusun status feed. Aturan penting:
 * - Ada peringatan aktif => state "active" (walaupun sumber sedang tertunda).
 * - Tidak ada peringatan hanya boleh menjadi "none" bila riwayat BMKG segar.
 * - Selain itu "unknown"; jangan pernah menyimpulkan aman dari kegagalan sumber.
 */
export function buildTsunamiFeed(input: TsunamiFeedInput, now = Date.now()): TsunamiFeed {
  const sources = withStaleness(input.sources, now);
  const activeAlerts = input.alerts.filter((alert) => alert.status === 'active').sort(byNewest);
  const ended = input.alerts.filter((alert) => alert.status === 'ended').sort(byNewest).slice(0, FEED_RECENT_ENDED);
  const alerts = [...activeAlerts, ...ended].sort(byNewest);

  const historyAt = input.lastHistorySuccessAt ? Date.parse(input.lastHistorySuccessAt) : Number.NaN;
  const historyFresh = Number.isFinite(historyAt) && now - historyAt <= HISTORY_STALE_MS;

  let state: TsunamiFeedState;
  let message: string | null = null;
  if (activeAlerts.length > 0) {
    state = 'active';
    if (!historyFresh) {
      message = 'Peringatan terakhir yang diketahui masih berstatus aktif, tetapi pembaruan BMKG tertunda. Status ini belum tentu mutakhir; ikuti kanal resmi BMKG.';
    }
  } else if (historyFresh) {
    state = 'none';
  } else {
    state = 'unknown';
    message = input.lastHistorySuccessAt
      ? `Status tsunami tidak dapat dipastikan karena pembaruan BMKG belum berhasil. Pemeriksaan terakhir yang berhasil: ${input.lastHistorySuccessAt}. Jangan anggap situasi aman.`
      : 'Status tsunami tidak dapat dipastikan karena daftar peringatan BMKG belum pernah berhasil dimuat. Jangan anggap situasi aman; ikuti kanal resmi BMKG.';
  }

  const times = sources.map((source) => (source.fetchedAt ? Date.parse(source.fetchedAt) : Number.NaN))
    .filter((value) => Number.isFinite(value));
  const updatedAt = times.length > 0 ? new Date(Math.max(...times)).toISOString() : null;

  return {
    state,
    stale: !historyFresh,
    checkedAt: input.lastCheckAt,
    updatedAt,
    activeAlerts,
    alerts,
    sources,
    message,
  };
}
