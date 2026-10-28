import { randomBytes } from 'node:crypto';
import { chmod, mkdir, open, readFile, rename, stat, unlink } from 'node:fs/promises';
import path from 'node:path';
import type { TsunamiAlert, TsunamiSourceStatus } from '@/types/tsunami';
import type { TsunamiNotificationKind } from './identity';

export interface StoredTsunamiAlert extends TsunamiAlert {
  lastNotifiedFingerprint: string | null;
  lastNotifiedAt: string | null;
  lastNotificationKind: TsunamiNotificationKind | null;
  pendingNotification: {
    kind: TsunamiNotificationKind;
    fingerprint: string;
    queuedAt: string;
    attempts: number;
  } | null;
}

export interface TsunamiStoreState {
  version: 1;
  alerts: StoredTsunamiAlert[];
  sources: TsunamiSourceStatus[];
  lastCheckAt: string | null;
  lastCheckReason: string | null;
  lastSuccessAt: string | null;
  lastHistoryAttemptAt: string | null;
  lastHistorySuccessAt: string | null;
  /** Pemeriksaan pertama yang berhasil (sumber apa pun); penanda agar backlog tidak dikirim. */
  seededAt: string | null;
  /** Impor pertama halaman riwayat; 30 pembaruan lama tidak boleh memicu push. */
  historyImportedAt: string | null;
  checkCount: number;
}

export interface StoredPushSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  topics: { tsunami: boolean };
  createdAt: string;
  updatedAt: string;
}

export interface StoredVapidKeys {
  publicKey: string;
  privateKey: string;
  createdAt: string;
}

const DATA_DIR = process.env.TSUNAMI_DATA_DIR
  ? path.resolve(process.env.TSUNAMI_DATA_DIR)
  : path.join(process.cwd(), '.data', 'tsunami');

const MAX_ALERTS = 300;
const MAX_SUBSCRIPTIONS = 10_000;
const LOCK_STALE_MS = 2 * 60_000;
const LOCK_WAIT_MS = 45_000;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function tsunamiDataDir(): string {
  return DATA_DIR;
}

const filePath = (name: string): string => path.join(DATA_DIR, `${name}.json`);
const lockPath = (name: string): string => path.join(DATA_DIR, `${name}.lock`);

async function ensureDataDir(): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true, mode: 0o700 });
  await chmod(DATA_DIR, 0o700).catch(() => { /* filesystem tanpa izin chmod */ });
}

async function readJson<T>(name: string, fallback: T): Promise<T> {
  try {
    const raw = await readFile(filePath(name), 'utf8');
    return JSON.parse(raw) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return fallback;
    if (error instanceof SyntaxError) {
      // Simpan berkas rusak untuk investigasi; jangan hapus data pengguna diam-diam.
      const backup = `${name}.corrupt-${Date.now()}.json`;
      await rename(filePath(name), filePath(backup)).catch(() => { /* abaikan */ });
      console.error(`[tsunami] ${name}.json rusak; disalin ke ${backup}.`);
      return fallback;
    }
    throw error;
  }
}

async function atomicWrite(name: string, value: unknown): Promise<void> {
  await ensureDataDir();
  const target = filePath(name);
  const temp = `${target}.${process.pid}.${randomBytes(6).toString('hex')}.tmp`;
  const handle = await open(temp, 'w', 0o600);
  try {
    await handle.writeFile(`${JSON.stringify(value, null, 2)}\n`, 'utf8');
    await handle.sync();
  } finally {
    await handle.close();
  }
  try {
    await rename(temp, target);
  } catch (error) {
    await unlink(temp).catch(() => { /* abaikan */ });
    throw error;
  }
}

async function acquireFileLock(name: string): Promise<() => Promise<void>> {
  await ensureDataDir();
  const target = lockPath(name);
  const started = Date.now();
  while (Date.now() - started < LOCK_WAIT_MS) {
    try {
      const handle = await open(target, 'wx', 0o600);
      await handle.writeFile(`${process.pid} ${new Date().toISOString()}\n`, 'utf8');
      return async () => {
        await handle.close().catch(() => { /* abaikan */ });
        await unlink(target).catch(() => { /* abaikan */ });
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      const info = await stat(target).catch(() => null);
      if (info && Date.now() - info.mtimeMs > LOCK_STALE_MS) {
        await unlink(target).catch(() => { /* proses lain mungkin sudah menghapus */ });
        continue;
      }
      await sleep(100);
    }
  }
  throw new Error('Kunci penyimpanan tsunami sedang dipakai proses lain');
}

const queues = new Map<string, Promise<void>>();

/** Serialisasi baca-ubah-tulis per berkas, plus kunci berkas antarproses. */
export async function withTsunamiLock<T>(name: string, fn: () => Promise<T>): Promise<T> {
  const previous = queues.get(name) ?? Promise.resolve();
  let releaseQueue: () => void = () => {};
  const gate = new Promise<void>((resolve) => { releaseQueue = resolve; });
  const queued = previous.then(() => gate);
  queues.set(name, queued);
  await previous.catch(() => { /* antrean sebelumnya gagal; lanjutkan */ });

  let releaseFile: (() => Promise<void>) | null = null;
  try {
    releaseFile = await acquireFileLock(name);
    return await fn();
  } finally {
    if (releaseFile) await releaseFile();
    releaseQueue();
    if (queues.get(name) === queued) queues.delete(name);
  }
}

const DATAGEMPA_SOURCE_URL = (process.env.TSUNAMI_DATAGEMPA_URL ?? 'https://cdn.bmkg.go.id/datagempa.json').trim();
const HISTORY_SOURCE_URL = (process.env.TSUNAMI_HISTORY_URL ?? 'https://www.bmkg.go.id/gempabumi/berpotensi-tsunami').trim();

export const DEFAULT_SOURCES: TsunamiSourceStatus[] = [
  {
    id: 'datagempa',
    label: 'Feed WRS BMKG (datagempa)',
    url: DATAGEMPA_SOURCE_URL,
    fetchedAt: null,
    ok: false,
    stale: true,
    error: null,
    count: 0,
  },
  {
    id: 'history',
    label: 'Riwayat peringatan tsunami BMKG',
    url: HISTORY_SOURCE_URL,
    fetchedAt: null,
    ok: false,
    stale: true,
    error: null,
    count: 0,
  },
];

export function emptyState(): TsunamiStoreState {
  return {
    version: 1,
    alerts: [],
    sources: DEFAULT_SOURCES.map((source) => ({ ...source })),
    lastCheckAt: null,
    lastCheckReason: null,
    lastSuccessAt: null,
    lastHistoryAttemptAt: null,
    lastHistorySuccessAt: null,
    seededAt: null,
    historyImportedAt: null,
    checkCount: 0,
  };
}

function isAlertLike(value: unknown): value is TsunamiAlert {
  if (!value || typeof value !== 'object') return false;
  const alert = value as Partial<TsunamiAlert>;
  return typeof alert.id === 'string'
    && (alert.status === 'active' || alert.status === 'ended')
    && typeof alert.issueTime === 'string'
    && Number.isFinite(Date.parse(alert.issueTime));
}

function normalizePending(value: StoredTsunamiAlert['pendingNotification'] | undefined): StoredTsunamiAlert['pendingNotification'] {
  if (!value || typeof value !== 'object') return null;
  const kind = value.kind;
  if (kind !== 'issued' && kind !== 'updated' && kind !== 'cancelled') return null;
  if (typeof value.fingerprint !== 'string' || typeof value.queuedAt !== 'string') return null;
  return {
    kind,
    fingerprint: value.fingerprint,
    queuedAt: value.queuedAt,
    attempts: typeof value.attempts === 'number' && Number.isFinite(value.attempts) ? value.attempts : 0,
  };
}

function normalizeState(raw: Partial<TsunamiStoreState>): TsunamiStoreState {
  const base = emptyState();
  const alerts = Array.isArray(raw.alerts)
    ? raw.alerts.filter(isAlertLike).slice(0, MAX_ALERTS).map((alert) => ({
      ...alert,
      sourceIds: Array.isArray(alert.sourceIds) ? alert.sourceIds : [],
      sourceEventIds: Array.isArray(alert.sourceEventIds) ? alert.sourceEventIds : [],
      regions: Array.isArray(alert.regions) ? alert.regions : [],
      observations: Array.isArray(alert.observations) ? alert.observations : [],
      instructions: Array.isArray(alert.instructions) ? alert.instructions : [],
      updates: Array.isArray(alert.updates) ? alert.updates : [],
      lastNotifiedFingerprint: typeof (alert as StoredTsunamiAlert).lastNotifiedFingerprint === 'string'
        ? (alert as StoredTsunamiAlert).lastNotifiedFingerprint
        : null,
      lastNotifiedAt: typeof (alert as StoredTsunamiAlert).lastNotifiedAt === 'string'
        ? (alert as StoredTsunamiAlert).lastNotifiedAt
        : null,
      lastNotificationKind: (alert as StoredTsunamiAlert).lastNotificationKind ?? null,
      pendingNotification: normalizePending((alert as StoredTsunamiAlert).pendingNotification),
    }))
    : [];

  const sourceMap = new Map<string, TsunamiSourceStatus>();
  for (const source of base.sources) sourceMap.set(source.id, source);
  if (Array.isArray(raw.sources)) {
    for (const source of raw.sources) {
      if (!source || typeof source !== 'object') continue;
      const id = (source as TsunamiSourceStatus).id;
      if (id === 'datagempa' || id === 'history') {
        sourceMap.set(id, { ...sourceMap.get(id)!, ...source });
      }
    }
  }

  return {
    version: 1,
    alerts,
    sources: Array.from(sourceMap.values()),
    lastCheckAt: typeof raw.lastCheckAt === 'string' ? raw.lastCheckAt : null,
    lastCheckReason: typeof raw.lastCheckReason === 'string' ? raw.lastCheckReason : null,
    lastSuccessAt: typeof raw.lastSuccessAt === 'string' ? raw.lastSuccessAt : null,
    lastHistoryAttemptAt: typeof raw.lastHistoryAttemptAt === 'string' ? raw.lastHistoryAttemptAt : null,
    lastHistorySuccessAt: typeof raw.lastHistorySuccessAt === 'string' ? raw.lastHistorySuccessAt : null,
    seededAt: typeof raw.seededAt === 'string' ? raw.seededAt : null,
    historyImportedAt: typeof raw.historyImportedAt === 'string' ? raw.historyImportedAt : null,
    checkCount: typeof raw.checkCount === 'number' && Number.isFinite(raw.checkCount) ? raw.checkCount : 0,
  };
}

export async function loadState(): Promise<TsunamiStoreState> {
  return normalizeState(await readJson<Partial<TsunamiStoreState>>('state', {}));
}

export async function saveState(state: TsunamiStoreState): Promise<void> {
  const normalized: TsunamiStoreState = {
    ...state,
    alerts: [...state.alerts]
      .sort((a, b) => b.issueTime.localeCompare(a.issueTime))
      .slice(0, MAX_ALERTS),
  };
  await atomicWrite('state', normalized);
}

export async function loadSubscriptions(): Promise<StoredPushSubscription[]> {
  const raw = await readJson<unknown>('subscriptions', []);
  if (!Array.isArray(raw)) return [];
  return raw.filter((item): item is StoredPushSubscription => {
    if (!item || typeof item !== 'object') return false;
    const record = item as Partial<StoredPushSubscription>;
    return typeof record.endpoint === 'string'
      && record.keys !== undefined
      && typeof record.keys.p256dh === 'string'
      && typeof record.keys.auth === 'string';
  }).slice(0, MAX_SUBSCRIPTIONS);
}

export async function saveSubscriptions(subscriptions: StoredPushSubscription[]): Promise<void> {
  await atomicWrite('subscriptions', subscriptions.slice(0, MAX_SUBSCRIPTIONS));
}

export async function loadVapidKeys(): Promise<StoredVapidKeys | null> {
  const raw = await readJson<Partial<StoredVapidKeys>>('vapid', {});
  if (typeof raw.publicKey === 'string' && typeof raw.privateKey === 'string') {
    return {
      publicKey: raw.publicKey,
      privateKey: raw.privateKey,
      createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : new Date().toISOString(),
    };
  }
  return null;
}

export async function saveVapidKeys(keys: StoredVapidKeys): Promise<void> {
  await atomicWrite('vapid', keys);
}

export { MAX_SUBSCRIPTIONS };
