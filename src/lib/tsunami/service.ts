import type { TsunamiAlert, TsunamiFeed, TsunamiSourceStatus } from '@/types/tsunami';
import { buildTsunamiFeed } from './feed';
import { loadState } from './store';

/** Buang metadata internal push sebelum data dikirim ke browser. */
export function publicTsunamiAlert(alert: TsunamiAlert): TsunamiAlert {
  const copy: Record<string, unknown> = { ...alert };
  delete copy.pendingNotification;
  delete copy.lastNotifiedFingerprint;
  delete copy.lastNotifiedAt;
  delete copy.lastNotificationKind;
  return copy as unknown as TsunamiAlert;
}

export async function getTsunamiFeed(): Promise<TsunamiFeed> {
  const state = await loadState();
  const feed = buildTsunamiFeed(state);
  return {
    ...feed,
    activeAlerts: feed.activeAlerts.map(publicTsunamiAlert),
    alerts: feed.alerts.map(publicTsunamiAlert),
  };
}

export interface TsunamiAlertDetail {
  alert: TsunamiAlert;
  checkedAt: string | null;
  stale: boolean;
  sources: TsunamiSourceStatus[];
}

export async function getTsunamiAlert(id: string): Promise<TsunamiAlertDetail | null> {
  const state = await loadState();
  const stored = state.alerts.find((alert) => alert.id === id);
  if (!stored) return null;
  const feed = buildTsunamiFeed(state);
  return {
    alert: publicTsunamiAlert(stored),
    checkedAt: feed.checkedAt,
    stale: feed.stale,
    sources: feed.sources,
  };
}
