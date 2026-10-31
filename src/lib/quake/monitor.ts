/**
 * Pemantau gempa backend: satu siklus = ambil 5 feed BMKG → putuskan → kirim FCM.
 *
 * ## Hubungan dengan web
 * Web **tidak** punya pemantau gempa; notifikasinya hanya hidup selama halaman terbuka
 * (`src/hooks/useNotifications.tsx`). Siklus ini meniru *aturan keputusannya* agar
 * notifikasi native tidak menyimpang dari apa yang web tampilkan:
 *
 *  - aturan penting: `isSignificantEarthquake` (dipakai ulang, bukan disalin);
 *  - cakupan `important`/`all` dan area `indonesia`/`province`: `quake/rule.ts`;
 *  - seed gating: siklus pertama hanya menandai, tidak mengirim — sama seperti
 *    `seenReady`/`markSignificantSeen` di web yang mencegah backlog 15–30 notifikasi.
 *
 * ## Dedupe
 * Memakai sidik jari toleran (`quake/identity.ts`), BUKAN `Earthquake.id`, karena id itu
 * berubah saat BMKG mengoreksi waktu/koordinat (D-012).
 *
 * ## Yang tidak dilakukan
 * Tidak ada retry berlapis: satu percobaan per perangkat per siklus, status disimpan agar
 * siklus berikutnya memutuskan ulang. Ini mencegah notifikasi ganda.
 */

import { getBmkgEarthquakes } from '../../services/bmkg';
import type { Earthquake } from '../../types/earthquake';
import { publicErrorMessage } from '../public-error';
import type { FcmCredentials, FcmMessage } from './fcm';
import { sendToDevice } from './fcm';
import {
  findKnownQuake, fingerprintQuake, quakeNotificationKey,
  type NotifiedQuake,
} from './identity';
import { matchesQuakeRule } from './rule';
import {
  loadDevices, loadMonitorState, revokeDevices, saveDevices, saveMonitorState,
  withQuakeLock, type StoredDevice,
} from './store';

/** Jeda minimum antar siklus terjadwal. Sama dengan `POLL_SECONDS` tsunami (60 s). */
export const POLL_SECONDS = Math.max(
  30,
  Math.min(3_600, Number(process.env.QUAKE_POLL_SECONDS ?? 60)),
);

/**
 * Batas umur kejadian yang layak dinotifikasikan. Web memakai `LOOKBACK_MS = 6 jam` dan
 * `ALARM_MAX_AGE_MS = 15 menit` untuk alarm. Untuk push, ambang yang masuk akal adalah
 * jendela umur feed + margin, supaya koreksi BMKG atas gempa kemarin tidak muncul sebagai
 * notifikasi "baru".
 */
export const NOTIFY_MAX_AGE_MS = Math.max(
  15 * 60_000,
  Math.min(24 * 3_600_000, Number(process.env.QUAKE_NOTIFY_MAX_AGE_MS ?? 3 * 3_600_000)),
);

/** TTL pesan FCM: notifikasi gempa basi tidak berguna dan hanya mengganggu. */
const MESSAGE_TTL_SECONDS = 3_600;

const MIN_GAP_MS = 10_000;

export interface QuakeRunResult {
  ok: boolean;
  skipped: boolean;
  reason: string;
  checkedAt: string | null;
  seeded: boolean;
  /** Kejadian yang dianggap layak dikirim pada siklus ini. */
  candidates: { eventId: string; magnitude: number; region: string }[];
  deliveries: { deviceId: string; ok: boolean; error: string | null }[];
  devices: number;
  revoked: number;
  errors: string[];
}

/** Payload data-only yang diterima Android. Semua nilai string (batasan FCM). */
export function buildQuakePayload(event: Earthquake, important: boolean): Record<string, string> {
  const payload: Record<string, string> = {
    kind: 'earthquake',
    eventId: event.id,
    occurredAt: event.originTime,
    magnitude: event.magnitude.toFixed(1),
    depthKm: String(Math.round(event.depthKm)),
    region: event.region,
    lat: event.latitude.toFixed(3),
    lon: event.longitude.toFixed(3),
    severity: important ? 'important' : 'minor',
    channelId: important ? 'seismos_earthquake_important' : 'seismos_earthquake_info',
  };
  if (event.felt) payload.felt = event.felt;
  if (typeof event.maxMmi === 'number') payload.maxMmi = String(event.maxMmi);
  if (event.tsunamiNote) payload.tsunamiNote = event.tsunamiNote;
  return payload;
}

/** Perangkat yang benar-benar harus menerima pesan ini. */
export function devicesFor(
  devices: StoredDevice[],
  event: Earthquake,
): StoredDevice[] {
  return devices.filter((device) => {
    if (device.revokedAt || !device.fcmToken) return false;
    if (!device.quakeEnabled) return false;
    return matchesQuakeRule(device.quake, event);
  });
}

/** Aturan "penting" untuk memilih channel/prioritas. Sama dengan `alerts.ts`. */
function isImportant(event: Earthquake): boolean {
  return event.magnitude >= 5
    || (event.feltReports?.length ?? 0) > 0
    || (event.maxMmi ?? 0) > 0;
}

function recordFor(event: Earthquake, decidedAt: string): NotifiedQuake {
  return {
    key: quakeNotificationKey(event),
    originTime: event.originTime,
    latitude: event.latitude,
    longitude: event.longitude,
    magnitude: event.magnitude,
    fingerprint: fingerprintQuake(event),
    decidedAt,
  };
}

/**
 * Satu siklus pemantauan.
 *
 * `force` melewati jeda minimum (dipakai endpoint monitor bertanda tangan untuk uji).
 * Bila `credentials` null, keputusan tetap dihitung dan state tetap diperbarui, tetapi
 * tidak ada pengiriman — ini membuat siklus dapat diuji tanpa kredensial nyata.
 */
export async function runQuakeCheck(
  reason = 'manual',
  options: { force?: boolean; credentials?: FcmCredentials | null } = {},
): Promise<QuakeRunResult> {
  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const credentials = options.credentials ?? null;

  // ---- Fase 1: keputusan, di dalam kunci supaya dua proses tidak memutuskan bersamaan ----
  const decision = await withQuakeLock('state', async () => {
    const state = await loadMonitorState();
    const last = state.lastCheckAt ? Date.parse(state.lastCheckAt) : Number.NaN;
    if (!options.force && Number.isFinite(last) && nowMs - last < MIN_GAP_MS) {
      return { skipped: true as const, state, candidates: [] as Earthquake[], seeded: false, errors: [] as string[] };
    }

    const errors: string[] = [];
    const feed = await getBmkgEarthquakes().catch((error) => {
      errors.push(publicErrorMessage(error, 'Gagal mengambil data BMKG'));
      return null;
    });

    // Semua sumber gagal DAN tidak ada cache: jangan mengubah state apa pun. Kalau state
    // diperbarui dengan nol kejadian, siklus berikutnya akan menganggap semua gempa "baru".
    if (!feed || feed.events.length === 0) {
      if (errors.length === 0) errors.push('Tidak ada kejadian dari BMKG');
      const failed = {
        ...state,
        lastCheckAt: nowIso,
        lastCheckReason: reason,
        lastError: errors.join('; '),
        checkCount: state.checkCount + 1,
      };
      await saveMonitorState(failed);
      return { skipped: false as const, state: failed, candidates: [] as Earthquake[], seeded: false, errors };
    }

    const seeded = state.seededAt !== null;
    const fresh: Earthquake[] = [];
    const known = [...state.known];

    // Urutkan terlama dulu agar siklus yang tertinggal beberapa kejadian tetap menjaga urutan.
    const ordered = [...feed.events].sort(
      (a, b) => Date.parse(a.originTime) - Date.parse(b.originTime),
    );

    for (const event of ordered) {
      const age = nowMs - Date.parse(event.originTime);
      if (!Number.isFinite(age)) continue;
      if (age > NOTIFY_MAX_AGE_MS) continue;

      const previous = findKnownQuake(known, event);
      if (previous) {
        const nextFingerprint = fingerprintQuake(event);
        if (previous.fingerprint === nextFingerprint) continue;
        // Isi berubah (mis. koreksi magnitudo). Perbarui catatan; notifikasi pembaruan
        // dikirim hanya untuk kejadian yang masih baru agar koreksi lama tidak berbunyi.
        previous.fingerprint = nextFingerprint;
        previous.magnitude = event.magnitude;
        previous.originTime = event.originTime;
        previous.latitude = event.latitude;
        previous.longitude = event.longitude;
        previous.decidedAt = nowIso;
        if (seeded && age <= 30 * 60_000) fresh.push(event);
        continue;
      }

      known.push(recordFor(event, nowIso));
      if (seeded) fresh.push(event);
    }

    const next = {
      ...state,
      known: known.slice(-500),
      lastCheckAt: nowIso,
      lastCheckReason: reason,
      lastSuccessAt: nowIso,
      seededAt: state.seededAt ?? nowIso,
      checkCount: state.checkCount + 1,
      lastError: null,
    };
    await saveMonitorState(next);

    if (!seeded) {
      // Siklus pertama: hanya menandai. Tidak ada pengiriman, tidak ada backlog.
      return { skipped: false as const, state: next, candidates: [] as Earthquake[], seeded: false, errors };
    }
    return { skipped: false as const, state: next, candidates: fresh, seeded: true, errors };
  });

  if (decision.skipped) {
    return {
      ok: true, skipped: true, reason,
      checkedAt: decision.state.lastCheckAt,
      seeded: decision.state.seededAt !== null,
      candidates: [], deliveries: [], devices: 0, revoked: 0, errors: [],
    };
  }

  const result: QuakeRunResult = {
    ok: true,
    skipped: false,
    reason,
    checkedAt: nowIso,
    seeded: decision.seeded,
    candidates: decision.candidates.map((e) => ({
      eventId: e.id, magnitude: e.magnitude, region: e.region,
    })),
    deliveries: [],
    devices: 0,
    revoked: 0,
    errors: [...decision.errors],
  };

  if (decision.candidates.length === 0) return result;

  // ---- Fase 2: pengiriman, di luar kunci ----
  const devices = await loadDevices();
  result.devices = devices.length;

  if (!credentials) {
    // Tanpa kredensial, jangan klaim terkirim. State sudah diperbarui, jadi begitu
    // kredensial diisi, notifikasi berikutnya tetap berjalan normal.
    if (!decision.candidates.length) return result;
    result.errors.push('FCM belum dikonfigurasi; keputusan dicatat tanpa pengiriman');
    return result;
  }

  const decidedAt = nowIso;
  const notified = new Map<string, { key: string; fingerprint: string }>();
  const dead: string[] = [];

  for (const event of decision.candidates) {
    const targets = devicesFor(devices, event);
    if (targets.length === 0) continue;
    const important = isImportant(event);
    const payload = buildQuakePayload(event, important);
    const key = quakeNotificationKey(event);
    const fingerprint = fingerprintQuake(event);

    for (const device of targets) {
      const message: FcmMessage = {
        token: device.fcmToken,
        data: payload,
        priority: important ? 'high' : 'normal',
        ttlSeconds: MESSAGE_TTL_SECONDS,
        collapseKey: key,
      };
      const sent = await sendToDevice(credentials, message);
      result.deliveries.push({ deviceId: device.deviceId, ok: sent.ok, error: sent.error });
      if (sent.ok) notified.set(device.deviceId, { key, fingerprint });
      else if (sent.unregistered) dead.push(device.deviceId);
    }
  }

  if (notified.size > 0) {
    for (const device of devices) {
      const hit = notified.get(device.deviceId);
      if (!hit) continue;
      device.lastNotifiedKey = hit.key;
      device.lastNotifiedFingerprint = hit.fingerprint;
      device.lastNotifiedAt = decidedAt;
    }
    await saveDevices(devices);
  }

  if (dead.length > 0) result.revoked = await revokeDevices(dead);
  return result;
}

interface MonitorGlobal {
  timer: NodeJS.Timeout;
  initial: NodeJS.Timeout;
}

const monitorGlobal = globalThis as typeof globalThis & {
  __seismosQuakeMonitor?: MonitorGlobal;
};

/**
 * Memulai polling latar belakang. Nonaktif bila `QUAKE_MONITOR_DISABLED=1`, dan tidak
 * melakukan apa pun bila kredensial FCM belum ada — lebih baik diam daripada gagal
 * berulang setiap menit di log.
 */
export function startQuakeMonitor(): void {
  if (process.env.QUAKE_MONITOR_DISABLED === '1') return;
  if (monitorGlobal.__seismosQuakeMonitor) return;

  const run = (reason: string) => {
    void runQuakeCheck(reason).catch((error) => {
      console.error(`[quake] siklus ${reason} gagal: ${error instanceof Error ? error.message : String(error)}`);
    });
  };

  const initial = setTimeout(() => run('startup'), 3_000);
  initial.unref?.();
  const timer = setInterval(() => run('scheduled'), POLL_SECONDS * 1_000);
  timer.unref?.();
  monitorGlobal.__seismosQuakeMonitor = { timer, initial };
}

export function stopQuakeMonitor(): void {
  const current = monitorGlobal.__seismosQuakeMonitor;
  if (!current) return;
  clearTimeout(current.initial);
  clearInterval(current.timer);
  monitorGlobal.__seismosQuakeMonitor = undefined;
}
