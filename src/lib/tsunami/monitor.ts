import type { TsunamiSourceId, TsunamiSourceStatus } from '@/types/tsunami';
import { fetchDatagempa, fetchInatewsTsunami, fetchTsunamiHistory, type InatewsResult } from '@/services/tsunami';
import {
  applyCandidate, classifyChange, createAlert, findMatchingAlert, fingerprintAlert,
  type TsunamiNotificationKind,
} from './identity';
import type { TsunamiCandidate } from './parse';
import { deliverTsunamiNotification, type DeliveryResult } from './push';
import {
  loadState, saveState, withTsunamiLock,
  type StoredTsunamiAlert, type TsunamiStoreState,
} from './store';

export const POLL_SECONDS = Math.max(30, Math.min(3_600, Number(process.env.TSUNAMI_POLL_SECONDS ?? 60)));
export const HISTORY_POLL_SECONDS = Math.max(120, Math.min(3_600, Number(process.env.TSUNAMI_HISTORY_POLL_SECONDS ?? 300)));
const API_MIN_GAP_MS = 25_000;
const SCHEDULED_MIN_GAP_MS = 10_000;
const RETENTION_DAYS = Math.max(7, Math.min(365, Number(process.env.TSUNAMI_RETENTION_DAYS ?? 90)));
const MAX_PUSH_ATTEMPTS = 5;

/** Urutan keutamaan sumber bila dua kandidat punya waktu terbit sama. */
const SOURCE_PRIORITY: Record<TsunamiSourceId, number> = { datagempa: 0, history: 1, inatews: 2 };

const errorText = (error: unknown): string => {
  const message = error instanceof Error ? error.message : String(error);
  return message.length > 300 ? `${message.slice(0, 299)}…` : message;
};

const maxIso = (left: string | null, right: string): string => {
  if (!left) return right;
  return Date.parse(right) >= Date.parse(left) ? right : left;
};

function successStatus(
  previous: TsunamiSourceStatus,
  fetchedAt: string,
  count: number,
): TsunamiSourceStatus {
  return { ...previous, fetchedAt, ok: true, stale: false, error: null, count };
}

function failureStatus(previous: TsunamiSourceStatus, error: string): TsunamiSourceStatus {
  return { ...previous, ok: false, stale: true, error, count: previous.count };
}

interface SourceOutcome<T> {
  ok: boolean;
  data: T | null;
  error: string | null;
  fetchedAt: string | null;
}

interface PendingSnapshot {
  alert: StoredTsunamiAlert;
  kind: TsunamiNotificationKind;
  fingerprint: string;
  queuedAt: string;
  attempts: number;
}

interface DeliveryAttempt extends PendingSnapshot {
  delivery: DeliveryResult;
  error: string | null;
}

export interface TsunamiRunResult {
  ok: boolean;
  skipped: boolean;
  reason: string;
  checkedAt: string | null;
  historyChecked: boolean;
  changed: { id: string; kind: TsunamiNotificationKind }[];
  deliveries: {
    id: string;
    kind: TsunamiNotificationKind;
    subscribers: number;
    sent: number;
    failed: number;
    removed: number;
    error: string | null;
  }[];
  errors: string[];
}

interface CheckResult {
  skipped: boolean;
  checkedAt: string | null;
  historyChecked: boolean;
  changes: { id: string; kind: TsunamiNotificationKind }[];
  pending: PendingSnapshot[];
  errors: string[];
}

function pruneAlerts(alerts: StoredTsunamiAlert[], nowMs: number): StoredTsunamiAlert[] {
  const cutoff = nowMs - RETENTION_DAYS * 86_400_000;
  const active = alerts.filter((alert) => alert.status === 'active');
  const ended = alerts
    .filter((alert) => alert.status === 'ended')
    .filter((alert) => {
      const at = Date.parse(alert.endedAt ?? alert.issueTime);
      return !Number.isFinite(at) || at >= cutoff;
    })
    .sort((a, b) => b.issueTime.localeCompare(a.issueTime));
  return [...active, ...ended];
}

async function ingest(
  state: TsunamiStoreState,
  candidates: TsunamiCandidate[],
  nowIso: string,
): Promise<{
  alerts: StoredTsunamiAlert[];
  changes: { id: string; kind: TsunamiNotificationKind }[];
}> {
  const initial = new Map(state.alerts.map((alert) => [alert.id, alert]));
  let alerts = [...state.alerts];
  const touched = new Set<string>();

  const ordered = [...candidates].sort((a, b) => {
    const time = Date.parse(a.issueTime) - Date.parse(b.issueTime);
    if (time !== 0) return time;
    return SOURCE_PRIORITY[a.source] - SOURCE_PRIORITY[b.source];
  });

  for (const candidate of ordered) {
    const existing = findMatchingAlert(alerts, candidate);
    if (existing) {
      const applied = applyCandidate(existing, candidate, nowIso);
      if (applied.changed) {
        alerts = alerts.map((alert) => (alert.id === existing.id ? applied.alert : alert));
        touched.add(existing.id);
      }
    } else {
      const created = createAlert(candidate, nowIso);
      const record: StoredTsunamiAlert = {
        ...created,
        lastNotifiedFingerprint: null,
        lastNotifiedAt: null,
        lastNotificationKind: null,
        pendingNotification: null,
      };
      alerts = [...alerts, record];
      touched.add(record.id);
    }
  }

  const changes: { id: string; kind: TsunamiNotificationKind }[] = [];
  for (const id of touched) {
    const alert = alerts.find((item) => item.id === id);
    if (!alert) continue;
    const previous = initial.get(id) ?? null;
    const kind = previous
      ? classifyChange(previous, alert, false)
      : alert.status === 'active' ? 'issued' : null;
    if (!kind) continue;

    const fingerprint = fingerprintAlert(alert);
    if (!alert.pendingNotification
      || alert.pendingNotification.kind !== kind
      || alert.pendingNotification.fingerprint !== fingerprint) {
      alert.pendingNotification = {
        kind,
        fingerprint,
        queuedAt: nowIso,
        attempts: 0,
      };
    }
    changes.push({ id, kind });
  }

  return { alerts, changes };
}

async function deliverPending(pending: PendingSnapshot[]): Promise<DeliveryAttempt[]> {
  const attempts: DeliveryAttempt[] = [];
  for (const item of pending) {
    try {
      const delivery = await deliverTsunamiNotification(item.alert, item.kind);
      attempts.push({ ...item, delivery, error: null });
    } catch (error) {
      attempts.push({
        ...item,
        delivery: { subscribers: 0, sent: 0, failed: 1, removed: 0 },
        error: errorText(error),
      });
    }
  }

  if (attempts.length === 0) return attempts;

  try {
    await withTsunamiLock('monitor', async () => {
      const state = await loadState();
      let changed = false;
      for (const attempt of attempts) {
        const current = state.alerts.find((alert) => alert.id === attempt.alert.id);
        const queued = current?.pendingNotification;
        if (!current || !queued || queued.fingerprint !== attempt.fingerprint) continue;
        const delivered = attempt.delivery.subscribers === 0 || attempt.delivery.sent > 0;
        if (delivered) {
          current.lastNotifiedFingerprint = attempt.fingerprint;
          current.lastNotifiedAt = new Date().toISOString();
          current.lastNotificationKind = attempt.kind;
          current.pendingNotification = null;
          changed = true;
        } else {
          queued.attempts += 1;
          if (queued.attempts >= MAX_PUSH_ATTEMPTS) {
            console.error(`[tsunami] menyerah mengirim push ${attempt.alert.id} setelah ${queued.attempts} percobaan.`);
            current.lastNotifiedFingerprint = attempt.fingerprint;
            current.lastNotifiedAt = new Date().toISOString();
            current.lastNotificationKind = attempt.kind;
            current.pendingNotification = null;
          }
          changed = true;
        }
      }
      if (changed) await saveState(state);
    });
  } catch (error) {
    console.error(`[tsunami] gagal menyimpan status pengiriman push: ${errorText(error)}`);
  }

  return attempts;
}

/**
 * Satu siklus pemeriksaan. Riwayat BMKG diperiksa lebih jarang daripada feed
 * WRS. Kunci monitor mencegah dua proses mengirim notifikasi ganda.
 */
export async function runTsunamiCheck(reason = 'manual', force = false): Promise<TsunamiRunResult> {
  let check: CheckResult;
  try {
    check = await withTsunamiLock('monitor', async (): Promise<CheckResult> => {
      const state = await loadState();
      const now = Date.now();
      const lastCheck = state.lastCheckAt ? Date.parse(state.lastCheckAt) : Number.NaN;
      const gap = reason === 'api' ? API_MIN_GAP_MS : SCHEDULED_MIN_GAP_MS;
      if (!force && Number.isFinite(lastCheck) && now - lastCheck < gap) {
        return {
          skipped: true,
          checkedAt: state.lastCheckAt,
          historyChecked: false,
          changes: [],
          pending: [],
          errors: [],
        };
      }

      const lastHistoryAttempt = state.lastHistoryAttemptAt ? Date.parse(state.lastHistoryAttemptAt) : Number.NaN;
      const historyDue = !Number.isFinite(lastHistoryAttempt)
        || now - lastHistoryAttempt >= HISTORY_POLL_SECONDS * 1_000;

      const [datagempa, history] = await Promise.all([
        fetchDatagempa()
          .then((result): SourceOutcome<typeof result> => ({ ok: true, data: result, error: null, fetchedAt: result.fetchedAt }))
          .catch((error): SourceOutcome<never> => ({ ok: false, data: null, error: errorText(error), fetchedAt: null })),
        historyDue
          ? fetchTsunamiHistory()
            .then((result): SourceOutcome<typeof result> => ({ ok: true, data: result, error: null, fetchedAt: result.fetchedAt }))
            .catch((error): SourceOutcome<never> => ({ ok: false, data: null, error: errorText(error), fetchedAt: null }))
          : Promise.resolve(null),
      ]);

      // Sumber cadangan InaTEWS dipakai hanya bila riwayat gagal, agar beban ke
      // BMKG tidak bertambah saat sumber utama sehat. Hasilnya tetap dicatat
      // pada entri sumber `inatews` supaya halaman status jujur soal asalnya.
      const inatews: SourceOutcome<InatewsResult> | null = history && !history.ok
        ? await fetchInatewsTsunami()
          .then((result): SourceOutcome<InatewsResult> => ({ ok: true, data: result, error: null, fetchedAt: result.fetchedAt }))
          .catch((error): SourceOutcome<never> => ({ ok: false, data: null, error: errorText(error), fetchedAt: null }))
        : null;

      const nowIso = new Date(now).toISOString();
      const errors: string[] = [];
      if (!datagempa.ok && datagempa.error) errors.push(`datagempa: ${datagempa.error}`);
      if (history && !history.ok && history.error) errors.push(`riwayat: ${history.error}`);
      if (inatews && !inatews.ok && inatews.error) errors.push(`InaTEWS: ${inatews.error}`);

      const sourceMap = new Map<TsunamiSourceId, TsunamiSourceStatus>(
        state.sources.map((source) => [source.id, source]),
      );
      const dataPrevious = sourceMap.get('datagempa')!;
      const historyPrevious = sourceMap.get('history')!;

      let lastSuccessAt = state.lastSuccessAt;
      let lastHistorySuccessAt = state.lastHistorySuccessAt;

      if (datagempa.ok && datagempa.data) {
        const count = datagempa.data.candidate ? 1 : 0;
        sourceMap.set('datagempa', successStatus(dataPrevious, datagempa.data.fetchedAt, count));
        lastSuccessAt = maxIso(lastSuccessAt, datagempa.data.fetchedAt);
      } else {
        sourceMap.set('datagempa', failureStatus(dataPrevious, datagempa.error ?? 'Gagal mengambil feed'));
      }

      let historyChecked = false;
      if (history) {
        historyChecked = true;
        if (history.ok && history.data) {
          sourceMap.set('history', successStatus(historyPrevious, history.data.fetchedAt, history.data.candidates.length));
          lastSuccessAt = maxIso(lastSuccessAt, history.data.fetchedAt);
          lastHistorySuccessAt = maxIso(lastHistorySuccessAt, history.data.fetchedAt);
        } else {
          sourceMap.set('history', failureStatus(historyPrevious, history.error ?? 'Gagal mengambil riwayat'));
        }
      }

      if (inatews) {
        const inatewsPrevious = sourceMap.get('inatews')!;
        if (inatews.ok && inatews.data) {
          sourceMap.set('inatews', successStatus(inatewsPrevious, inatews.data.fetchedAt, inatews.data.candidates.length));
          lastSuccessAt = maxIso(lastSuccessAt, inatews.data.fetchedAt);
          lastHistorySuccessAt = maxIso(lastHistorySuccessAt, inatews.data.fetchedAt);
        } else {
          sourceMap.set('inatews', failureStatus(inatewsPrevious, inatews.error ?? 'Gagal mengambil arsip InaTEWS'));
        }
      }

      const candidates: TsunamiCandidate[] = [];
      if (datagempa.ok && datagempa.data?.candidate) candidates.push(datagempa.data.candidate);
      if (history?.ok && history.data) candidates.push(...history.data.candidates);
      if (inatews?.ok && inatews.data) candidates.push(...inatews.data.candidates);

      const ingested = await ingest(state, candidates, nowIso);
      const alerts = pruneAlerts(ingested.alerts, now);

      const nextState: TsunamiStoreState = {
        ...state,
        alerts,
        sources: Array.from(sourceMap.values()),
        lastCheckAt: nowIso,
        lastCheckReason: reason,
        lastSuccessAt,
        lastHistoryAttemptAt: historyDue ? nowIso : state.lastHistoryAttemptAt,
        lastHistorySuccessAt,
        seededAt: state.seededAt ?? ((datagempa.ok || (history?.ok ?? false) || (inatews?.ok ?? false)) ? nowIso : null),
        historyImportedAt: state.historyImportedAt ?? ((history?.ok ?? false) || (inatews?.ok ?? false) ? nowIso : null),
        checkCount: state.checkCount + 1,
      };
      await saveState(nextState);

      const pending: PendingSnapshot[] = alerts
        .filter((alert): alert is StoredTsunamiAlert & { pendingNotification: NonNullable<StoredTsunamiAlert['pendingNotification']> } =>
          Boolean(alert.pendingNotification))
        .map((alert) => ({
          alert,
          kind: alert.pendingNotification.kind,
          fingerprint: alert.pendingNotification.fingerprint,
          queuedAt: alert.pendingNotification.queuedAt,
          attempts: alert.pendingNotification.attempts,
        }));

      return {
        skipped: false,
        checkedAt: nowIso,
        historyChecked,
        changes: ingested.changes,
        pending,
        errors,
      };
    });
  } catch (error) {
    if (errorText(error).includes('Kunci penyimpanan')) {
      return {
        ok: true,
        skipped: true,
        reason,
        checkedAt: null,
        historyChecked: false,
        changed: [],
        deliveries: [],
        errors: [],
      };
    }
    throw error;
  }

  if (check.skipped) {
    return {
      ok: true,
      skipped: true,
      reason,
      checkedAt: check.checkedAt,
      historyChecked: false,
      changed: [],
      deliveries: [],
      errors: check.errors,
    };
  }

  const attempts = await deliverPending(check.pending);
  return {
    ok: true,
    skipped: false,
    reason,
    checkedAt: check.checkedAt,
    historyChecked: check.historyChecked,
    changed: check.changes,
    deliveries: attempts.map((attempt) => ({
      id: attempt.alert.id,
      kind: attempt.kind,
      subscribers: attempt.delivery.subscribers,
      sent: attempt.delivery.sent,
      failed: attempt.delivery.failed,
      removed: attempt.delivery.removed,
      error: attempt.error,
    })),
    errors: check.errors,
  };
}

/** Dipanggil route API: perbarui bila data sudah lebih tua dari ambang. */
export async function ensureTsunamiFresh(maxAgeMs = 30_000): Promise<void> {
  try {
    const state = await loadState();
    const last = state.lastCheckAt ? Date.parse(state.lastCheckAt) : Number.NaN;
    if (Number.isFinite(last) && Date.now() - last < maxAgeMs) return;
    await runTsunamiCheck('api');
  } catch (error) {
    console.error(`[tsunami] pemeriksaan otomatis gagal: ${errorText(error)}`);
  }
}

interface MonitorGlobal {
  timer: NodeJS.Timeout;
  initial: NodeJS.Timeout;
}

const monitorGlobal = globalThis as typeof globalThis & {
  __seismosTsunamiMonitor?: MonitorGlobal;
};

/** Memulai polling latar belakang di proses server Next.js. */
export function startTsunamiMonitor(): void {
  if (process.env.TSUNAMI_MONITOR_DISABLED === '1') return;
  if (monitorGlobal.__seismosTsunamiMonitor) return;

  const run = (reason: string) => {
    void runTsunamiCheck(reason).catch((error) => {
      console.error(`[tsunami] siklus ${reason} gagal: ${errorText(error)}`);
    });
  };

  const initial = setTimeout(() => run('startup'), 1_500);
  initial.unref?.();
  const timer = setInterval(() => run('scheduled'), POLL_SECONDS * 1_000);
  timer.unref?.();
  monitorGlobal.__seismosTsunamiMonitor = { timer, initial };
}

export function stopTsunamiMonitor(): void {
  const current = monitorGlobal.__seismosTsunamiMonitor;
  if (!current) return;
  clearTimeout(current.initial);
  clearInterval(current.timer);
  monitorGlobal.__seismosTsunamiMonitor = undefined;
}
