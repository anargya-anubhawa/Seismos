import { randomBytes } from 'node:crypto';
import { chmod, mkdir, open, readFile, rename, stat, unlink } from 'node:fs/promises';
import path from 'node:path';
import type { VolcanoNotification } from '@/types/volcano';

/**
 * Penyimpanan server gunung api (JSON + kunci berkas), mengikuti pola
 * penyimpanan tsunami. Isinya: status terakhir tiap gunung api (untuk deteksi
 * perubahan tingkat), ID sumber yang sudah pernah diproses (dedupe), antrean
 * notifikasi, dan langganan push (topik volcano).
 */

export interface StoredVolcanoLevel {
  code: string;
  name: string;
  level: number;
  label: string;
  seenAt: string;
}

export interface StoredVolcanoPushSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  /** Topik gunung api yang diaktifkan pengguna. */
  topics: {
    volcano: boolean;
    levelChange: boolean;
    eruption: boolean;
    vona: boolean;
    recommendation: boolean;
  };
  createdAt: string;
  updatedAt: string;
}

export interface StoredVapidKeys {
  publicKey: string;
  privateKey: string;
  createdAt: string;
}

export interface VolcanoStoreState {
  version: 1;
  /** Kunci: kode gunung api (mis. MER). */
  levels: Record<string, StoredVolcanoLevel>;
  /** ID VEN/VONA/perubahan level yang sudah diproses (dibatasi jumlahnya). */
  seenEruptions: string[];
  seenVona: string[];
  seenLevelChanges: string[];
  /** Status proses per sumber, untuk halaman monitor. */
  sources: Record<string, {
    fetchedAt: string | null;
    ok: boolean;
    stale: boolean;
    error: string | null;
    count: number;
  }>;
  notifications: VolcanoNotification[];
  lastCheckAt: string | null;
  lastCheckReason: string | null;
  lastSuccessAt: string | null;
  /** Waktu pemeriksaan pertama yang berhasil. Tidak ada push sebelum ini. */
  seededAt: string | null;
  checkCount: number;
}

const DATA_DIR = process.env.VOLCANO_DATA_DIR
  ? path.resolve(process.env.VOLCANO_DATA_DIR)
  : path.join(process.cwd(), '.data', 'volcano');

const MAX_NOTIFICATIONS = 200;
const MAX_SEEN = 1_500;
const MAX_SUBSCRIPTIONS = 10_000;
const LOCK_STALE_MS = 2 * 60_000;
const LOCK_WAIT_MS = 45_000;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function volcanoDataDir(): string {
  return DATA_DIR;
}

/**
 * Berkas kunci VAPID bersama (dibuat oleh sistem push tsunami/gempa). Gunung api
 * memakai kunci yang sama supaya satu langganan browser dapat menerima semua
 * topik notifikasi.
 */
const SHARED_VAPID_FILE = process.env.TSUNAMI_DATA_DIR
  ? path.join(path.resolve(process.env.TSUNAMI_DATA_DIR), 'vapid.json')
  : path.join(process.cwd(), '.data', 'tsunami', 'vapid.json');

const filePath = (name: string): string => path.join(DATA_DIR, `${name}.json`);
const lockPath = (name: string): string => path.join(DATA_DIR, `${name}.lock`);

async function ensureDataDir(): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true, mode: 0o700 });
  await chmod(DATA_DIR, 0o700).catch(() => { /* filesystem tanpa dukungan chmod */ });
}

async function readJson<T>(name: string, fallback: T): Promise<T> {
  try {
    const raw = await readFile(filePath(name), 'utf8');
    return JSON.parse(raw) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return fallback;
    if (error instanceof SyntaxError) {
      const backup = `${name}.corrupt-${Date.now()}.json`;
      await rename(filePath(name), filePath(backup)).catch(() => { /* abaikan */ });
      console.error(`[volcano] ${name}.json rusak; disalin ke ${backup}.`);
      return fallback;
    }
    throw error;
  }
}

async function atomicWrite(name: string, value: unknown): Promise<void> {
  await ensureDataDir();
  await atomicWriteFile(filePath(name), value);
}

async function atomicWriteFile(target: string, value: unknown): Promise<void> {
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
        await unlink(target).catch(() => { /* abaikan */ });
        continue;
      }
      await sleep(100);
    }
  }
  throw new Error('Kunci penyimpanan gunung api sedang dipakai proses lain');
}

const queues = new Map<string, Promise<void>>();

/** Serialisasi baca-ubah-tulis per berkas plus kunci berkas antarproses. */
export async function withVolcanoLock<T>(name: string, fn: () => Promise<T>): Promise<T> {
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

export function emptyState(): VolcanoStoreState {
  return {
    version: 1,
    levels: {},
    seenEruptions: [],
    seenVona: [],
    seenLevelChanges: [],
    sources: {},
    notifications: [],
    lastCheckAt: null,
    lastCheckReason: null,
    lastSuccessAt: null,
    seededAt: null,
    checkCount: 0,
  };
}

const stringArray = (value: unknown): string[] => (Array.isArray(value)
  ? value.filter((item): item is string => typeof item === 'string').slice(0, MAX_SEEN)
  : []);

const isNotification = (value: unknown): value is VolcanoNotification => {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<VolcanoNotification>;
  return typeof item.key === 'string'
    && (item.kind === 'level-change' || item.kind === 'eruption' || item.kind === 'vona' || item.kind === 'recommendation')
    && typeof item.volcanoName === 'string'
    && typeof item.url === 'string'
    && typeof item.detectedAt === 'string';
};

function normalizeState(raw: Partial<VolcanoStoreState>): VolcanoStoreState {
  const base = emptyState();
  const levels: Record<string, StoredVolcanoLevel> = {};
  if (raw.levels && typeof raw.levels === 'object') {
    for (const [code, value] of Object.entries(raw.levels)) {
      if (!value || typeof value !== 'object') continue;
      const record = value as Partial<StoredVolcanoLevel>;
      if (typeof record.level !== 'number' || typeof record.label !== 'string') continue;
      levels[code] = {
        code,
        name: typeof record.name === 'string' ? record.name : code,
        level: record.level,
        label: record.label,
        seenAt: typeof record.seenAt === 'string' ? record.seenAt : new Date().toISOString(),
      };
    }
  }
  const sources: VolcanoStoreState['sources'] = {};
  if (raw.sources && typeof raw.sources === 'object') {
    for (const [id, value] of Object.entries(raw.sources)) {
      if (!value || typeof value !== 'object') continue;
      const record = value as VolcanoStoreState['sources'][string];
      sources[id] = {
        fetchedAt: typeof record.fetchedAt === 'string' ? record.fetchedAt : null,
        ok: record.ok === true,
        stale: record.stale !== false,
        error: typeof record.error === 'string' ? record.error : null,
        count: typeof record.count === 'number' && Number.isFinite(record.count) ? record.count : 0,
      };
    }
  }
  return {
    ...base,
    levels,
    seenEruptions: stringArray(raw.seenEruptions),
    seenVona: stringArray(raw.seenVona),
    seenLevelChanges: stringArray(raw.seenLevelChanges),
    sources,
    notifications: Array.isArray(raw.notifications)
      ? raw.notifications.filter(isNotification).slice(0, MAX_NOTIFICATIONS)
      : [],
    lastCheckAt: typeof raw.lastCheckAt === 'string' ? raw.lastCheckAt : null,
    lastCheckReason: typeof raw.lastCheckReason === 'string' ? raw.lastCheckReason : null,
    lastSuccessAt: typeof raw.lastSuccessAt === 'string' ? raw.lastSuccessAt : null,
    seededAt: typeof raw.seededAt === 'string' ? raw.seededAt : null,
    checkCount: typeof raw.checkCount === 'number' && Number.isFinite(raw.checkCount) ? raw.checkCount : 0,
  };
}

export async function loadState(): Promise<VolcanoStoreState> {
  return normalizeState(await readJson<Partial<VolcanoStoreState>>('state', {}));
}

export async function saveState(state: VolcanoStoreState): Promise<void> {
  const normalized: VolcanoStoreState = {
    ...state,
    seenEruptions: state.seenEruptions.slice(-MAX_SEEN),
    seenVona: state.seenVona.slice(-MAX_SEEN),
    seenLevelChanges: state.seenLevelChanges.slice(-MAX_SEEN),
    notifications: [...state.notifications]
      .sort((a, b) => b.detectedAt.localeCompare(a.detectedAt))
      .slice(0, MAX_NOTIFICATIONS),
  };
  await atomicWrite('state', normalized);
}

/* ------------------------------ langganan push ----------------------------- */

export async function loadSubscriptions(): Promise<StoredVolcanoPushSubscription[]> {
  const raw = await readJson<unknown>('subscriptions', []);
  if (!Array.isArray(raw)) return [];
  return raw.filter((item): item is StoredVolcanoPushSubscription => {
    if (!item || typeof item !== 'object') return false;
    const record = item as Partial<StoredVolcanoPushSubscription>;
    return typeof record.endpoint === 'string'
      && record.keys !== undefined
      && typeof record.keys?.p256dh === 'string'
      && typeof record.keys?.auth === 'string'
      && record.topics !== undefined
      && typeof record.topics?.volcano === 'boolean';
  }).slice(0, MAX_SUBSCRIPTIONS);
}

export async function saveSubscriptions(subscriptions: StoredVolcanoPushSubscription[]): Promise<void> {
  await atomicWrite('subscriptions', subscriptions.slice(0, MAX_SUBSCRIPTIONS));
}

/**
 * Kunci VAPID disimpan satu kali untuk seluruh aplikasi dan dipakai bersama
 * oleh notifikasi gempa/tsunami maupun gunung api (satu langganan browser).
 */
export async function loadVapidKeys(): Promise<StoredVapidKeys | null> {
  try {
    const raw = JSON.parse(await readFile(SHARED_VAPID_FILE, 'utf8')) as Partial<StoredVapidKeys>;
    if (typeof raw.publicKey === 'string' && typeof raw.privateKey === 'string') {
      return { publicKey: raw.publicKey, privateKey: raw.privateKey, createdAt: String(raw.createdAt ?? '') };
    }
  } catch {
    /* belum ada kunci bersama */
  }
  return null;
}

export async function saveVapidKeys(keys: StoredVapidKeys): Promise<void> {
  await ensureDataDir();
  await atomicWriteFile(SHARED_VAPID_FILE, keys);
}
