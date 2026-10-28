import {
  eruptionCandidate, detectLevelChanges, vonaCandidate,
  type LevelObservation, type VolcanoNotificationCandidate,
} from '@/lib/volcano/magma';
import { getEruptions, getVolcanoStatuses, getVonaNotices } from '@/services/magma/volcano';
import type { VolcanoNotification } from '@/types/volcano';
import { deliverVolcanoNotification, type DeliveryResult } from './push';
import {
  loadState, saveState, withVolcanoLock,
  type StoredVolcanoLevel, type VolcanoStoreState,
} from './store';

/**
 * Pemantauan berkala sumber resmi (MAGMA/PVMBG) di server.
 *
 * - Perubahan tingkat aktivitas: dibandingkan dengan status terakhir yang
 *   diproses, bukan disimpulkan dari laporan.
 * - Erupsi: hanya dari informasi letusan (VEN) resmi yang belum pernah diproses.
 * - VONA: hanya dari VONA baru yang diterbitkan.
 * - Pemeriksaan pertama hanya menyiapkan dasar (tidak mengirim backlog).
 * - Pengiriman push dicatat per notifikasi agar tidak terkirim ganda.
 */

export const POLL_SECONDS = Math.max(120, Math.min(3_600, Number(process.env.VOLCANO_POLL_SECONDS ?? 300)));
const API_MIN_GAP_MS = 60_000;
const SCHEDULED_MIN_GAP_MS = 60_000;
const MAX_PUSH_ATTEMPTS = 5;

const errorText = (error: unknown): string => {
  const message = error instanceof Error ? error.message : String(error);
  return message.length > 300 ? `${message.slice(0, 299)}…` : message;
};

const maxIso = (left: string | null, right: string): string =>
  (!left ? right : (Date.parse(right) >= Date.parse(left) ? right : left));

interface SourceRecord {
  fetchedAt: string | null;
  ok: boolean;
  stale: boolean;
  error: string | null;
  count: number;
}

export interface VolcanoRunResult {
  ok: boolean;
  skipped: boolean;
  reason: string;
  checkedAt: string | null;
  seeded: boolean;
  changed: { key: string; kind: VolcanoNotification['kind']; volcanoName: string }[];
  deliveries: {
    key: string;
    kind: VolcanoNotification['kind'];
    subscribers: number;
    sent: number;
    failed: number;
    removed: number;
    error: string | null;
  }[];
  errors: string[];
}

function levelMap(state: VolcanoStoreState): Map<string, LevelObservation> {
  const map = new Map<string, LevelObservation>();
  for (const record of Object.values(state.levels) as StoredVolcanoLevel[]) {
    map.set(record.code, { code: record.code, name: record.name, level: record.level as LevelObservation['level'], label: record.label });
  }
  return map;
}

async function deliverPending(notifications: VolcanoNotification[]): Promise<{
  notification: VolcanoNotification;
  delivery: DeliveryResult;
  error: string | null;
}[]> {
  const out: { notification: VolcanoNotification; delivery: DeliveryResult; error: string | null }[] = [];
  for (const notification of notifications) {
    let delivery: DeliveryResult = { subscribers: 0, sent: 0, failed: 0, removed: 0 };
    let error: string | null = null;
    try {
      delivery = await deliverVolcanoNotification(notification);
    } catch (e) {
      error = errorText(e);
    }
    out.push({ notification, delivery, error });
  }
  return out;
}

/** Jalankan satu siklus pemeriksaan sumber resmi gunung api. */
export async function runVolcanoCheck(reason = 'manual', force = false): Promise<VolcanoRunResult> {
  let check: {
    skipped: boolean;
    checkedAt: string | null;
    seeded: boolean;
    candidates: VolcanoNotificationCandidate[];
    levels: Record<string, StoredVolcanoLevel>;
    sources: Record<string, SourceRecord>;
    errors: string[];
    lastSuccessAt: string | null;
    seenEruptions: string[];
    seenVona: string[];
    seenLevelChanges: string[];
  };

  try {
    check = await withVolcanoLock('monitor', async () => {
      const state = await loadState();
      const now = Date.now();
      const nowIso = new Date(now).toISOString();
      const lastCheck = state.lastCheckAt ? Date.parse(state.lastCheckAt) : Number.NaN;
      const gap = reason === 'api' ? API_MIN_GAP_MS : SCHEDULED_MIN_GAP_MS;
      if (!force && Number.isFinite(lastCheck) && now - lastCheck < gap) {
        return {
          skipped: true, checkedAt: state.lastCheckAt, seeded: state.seededAt !== null,
          candidates: [], levels: state.levels, sources: state.sources, errors: [],
          lastSuccessAt: state.lastSuccessAt, seenEruptions: state.seenEruptions,
          seenVona: state.seenVona, seenLevelChanges: state.seenLevelChanges,
        };
      }

      const [statuses, eruptions, vona] = await Promise.all([
        getVolcanoStatuses().catch(() => null),
        getEruptions().catch(() => null),
        getVonaNotices().catch(() => null),
      ]);

      const errors: string[] = [];
      const sources: Record<string, SourceRecord> = { ...state.sources };
      let lastSuccessAt = state.lastSuccessAt;

      const record = (id: string, fetchedAt: string | null, count: number, error: string | null): void => {
        sources[id] = {
          fetchedAt,
          ok: error === null,
          stale: error !== null,
          error,
          count,
        };
        if (error) errors.push(`${id}: ${error}`);
        else if (fetchedAt) lastSuccessAt = maxIso(lastSuccessAt, fetchedAt);
      };

      if (statuses) record('status', new Date(statuses.at).toISOString(), statuses.value.length, statuses.error);
      else record('status', sources.status?.fetchedAt ?? null, sources.status?.count ?? 0, 'Status aktivitas MAGMA gagal dimuat');
      if (eruptions) record('ven', new Date(eruptions.at).toISOString(), eruptions.value.length, eruptions.error);
      else record('ven', sources.ven?.fetchedAt ?? null, sources.ven?.count ?? 0, 'Informasi letusan MAGMA gagal dimuat');
      if (vona) record('vona', new Date(vona.at).toISOString(), vona.value.length, vona.error);
      else record('vona', sources.vona?.fetchedAt ?? null, sources.vona?.count ?? 0, 'VONA MAGMA gagal dimuat');

      const seeded = state.seededAt !== null;
      const candidates: VolcanoNotificationCandidate[] = [];
      const seenEruptions = [...state.seenEruptions];
      const seenVona = [...state.seenVona];
      const seenLevelChanges = [...state.seenLevelChanges];

      let levels: Record<string, StoredVolcanoLevel> = state.levels;
      if (statuses && !statuses.error && statuses.value.length > 0) {
        const current: LevelObservation[] = statuses.value.map((volcano) => ({
          code: volcano.code,
          name: volcano.name,
          level: volcano.level,
          label: volcano.levelLabel,
        }));
        if (seeded) {
          const changes = detectLevelChanges(levelMap(state), current, nowIso);
          for (const change of changes) {
            const seenKey = `${change.volcanoCode}:${change.sourceId}`;
            if (seenLevelChanges.includes(seenKey)) continue;
            seenLevelChanges.push(seenKey);
            candidates.push(change);
          }
        }
        levels = {};
        for (const volcano of current) {
          levels[volcano.code] = {
            code: volcano.code,
            name: volcano.name,
            level: volcano.level ?? 0,
            label: volcano.label,
            seenAt: nowIso,
          };
        }
      }

      if (eruptions && !eruptions.error && seeded) {
        // Hanya 30 VEN terbaru yang dipertimbangkan pada setiap siklus.
        for (const event of eruptions.value.slice(0, 30)) {
          const candidate = eruptionCandidate(event, new Set(seenEruptions));
          if (!candidate) continue;
          seenEruptions.push(event.id);
          candidates.push(candidate);
        }
      } else if (eruptions && !eruptions.error) {
        for (const event of eruptions.value.slice(0, 60)) {
          if (!seenEruptions.includes(event.id)) seenEruptions.push(event.id);
        }
      }

      if (vona && !vona.error && seeded) {
        for (const notice of vona.value.slice(0, 30)) {
          const candidate = vonaCandidate(notice, new Set(seenVona));
          if (!candidate) continue;
          seenVona.push(notice.id);
          candidates.push(candidate);
        }
      } else if (vona && !vona.error) {
        for (const notice of vona.value.slice(0, 60)) {
          if (!seenVona.includes(notice.id)) seenVona.push(notice.id);
        }
      }

      const accepted: VolcanoNotificationCandidate[] = [];
      const notifications = [...state.notifications];
      for (const candidate of candidates) {
        if (notifications.some((item) => item.key === candidate.key)) continue;
        accepted.push(candidate);
        notifications.push({
          key: candidate.key,
          kind: candidate.kind,
          volcanoCode: candidate.volcanoCode,
          volcanoName: candidate.volcanoName,
          title: candidate.title,
          body: candidate.body,
          url: candidate.url,
          sourceId: candidate.sourceId,
          occurredAt: candidate.occurredAt,
          detectedAt: nowIso,
          delivery: {
            subscribers: 0,
            sent: 0,
            failed: 0,
            attempts: 0,
            lastAttemptAt: null,
            deliveredAt: null,
            status: 'pending',
          },
        });
      }

      const next: VolcanoStoreState = {
        ...state,
        levels,
        seenEruptions,
        seenVona,
        seenLevelChanges,
        sources,
        notifications,
        lastCheckAt: nowIso,
        lastCheckReason: reason,
        lastSuccessAt,
        // Pemeriksaan pertama yang berhasil hanya menjadi dasar; tidak mengirim backlog.
        seededAt: state.seededAt ?? (
          (statuses && !statuses.error) || (eruptions && !eruptions.error) || (vona && !vona.error)
            ? nowIso
            : null
        ),
        checkCount: state.checkCount + 1,
      };
      await saveState(next);

      return {
        skipped: false,
        checkedAt: nowIso,
        seeded: seeded || next.seededAt !== null,
        candidates: accepted,
        levels,
        sources,
        errors,
        lastSuccessAt,
        seenEruptions,
        seenVona,
        seenLevelChanges,
      };
    });
  } catch (error) {
    if (errorText(error).includes('Kunci penyimpanan')) {
      return { ok: true, skipped: true, reason, checkedAt: null, seeded: true, changed: [], deliveries: [], errors: [] };
    }
    throw error;
  }

  if (check.skipped) {
    return { ok: true, skipped: true, reason, checkedAt: check.checkedAt, seeded: check.seeded, changed: [], deliveries: [], errors: check.errors };
  }

  const state = await loadState();
  const pending = state.notifications.filter((item) => item.delivery.status === 'pending');
  const results = await deliverPending(pending);
  const outcomes = new Map(results.map((result) => [result.notification.key, result]));

  await withVolcanoLock('monitor', async () => {
    const current = await loadState();
    const nowIso = new Date().toISOString();
    current.notifications = current.notifications.map((item) => {
      const outcome = outcomes.get(item.key);
      if (!outcome) return item;
      const { delivery, error } = outcome;
      const attempts = item.delivery.attempts + 1;
      const status: VolcanoNotification['delivery']['status'] = error
        ? (attempts >= MAX_PUSH_ATTEMPTS ? 'failed' : 'pending')
        : delivery.subscribers === 0
          ? 'no-subscribers'
          : delivery.sent > 0 ? 'delivered' : (attempts >= MAX_PUSH_ATTEMPTS ? 'failed' : 'pending');
      return {
        ...item,
        delivery: {
          subscribers: delivery.subscribers,
          sent: delivery.sent,
          failed: delivery.failed,
          attempts,
          lastAttemptAt: nowIso,
          deliveredAt: status === 'delivered' ? nowIso : item.delivery.deliveredAt,
          status,
        },
      };
    });
    await saveState(current);
  });

  return {
    ok: true,
    skipped: false,
    reason,
    checkedAt: check.checkedAt,
    seeded: check.seeded,
    changed: check.candidates.map((candidate) => ({
      key: candidate.key,
      kind: candidate.kind,
      volcanoName: candidate.volcanoName,
    })),
    deliveries: results.map((result) => ({
      key: result.notification.key,
      kind: result.notification.kind,
      subscribers: result.delivery.subscribers,
      sent: result.delivery.sent,
      failed: result.delivery.failed,
      removed: result.delivery.removed,
      error: result.error,
    })),
    errors: check.errors,
  };
}

/** Dipanggil route API: jalankan pemeriksaan bila cache sudah lebih tua dari ambang. */
export async function ensureVolcanoFresh(maxAgeMs = 120_000): Promise<void> {
  try {
    const state = await loadState();
    const last = state.lastCheckAt ? Date.parse(state.lastCheckAt) : Number.NaN;
    if (Number.isFinite(last) && Date.now() - last < maxAgeMs) return;
    await runVolcanoCheck('api');
  } catch (error) {
    console.error(`[volcano] pemeriksaan otomatis gagal: ${errorText(error)}`);
  }
}

interface MonitorGlobal {
  timer: NodeJS.Timeout;
  initial: NodeJS.Timeout;
}

const monitorGlobal = globalThis as typeof globalThis & {
  __seismosVolcanoMonitor?: MonitorGlobal;
};

/** Memulai polling latar belakang di proses server Next.js. */
export function startVolcanoMonitor(): void {
  if (process.env.VOLCANO_MONITOR_DISABLED === '1') return;
  if (monitorGlobal.__seismosVolcanoMonitor) return;

  const run = (reason: string) => {
    void runVolcanoCheck(reason).catch((error) => {
      console.error(`[volcano] siklus ${reason} gagal: ${errorText(error)}`);
    });
  };

  const initial = setTimeout(() => run('startup'), 4_000);
  initial.unref?.();
  const timer = setInterval(() => run('scheduled'), POLL_SECONDS * 1_000);
  timer.unref?.();
  monitorGlobal.__seismosVolcanoMonitor = { timer, initial };
}

export function stopVolcanoMonitor(): void {
  const current = monitorGlobal.__seismosVolcanoMonitor;
  if (!current) return;
  clearTimeout(current.initial);
  clearInterval(current.timer);
  monitorGlobal.__seismosVolcanoMonitor = undefined;
}
