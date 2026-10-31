/**
 * Penyimpanan perangkat & status pemantau gempa.
 *
 * Pola diambil dari `src/lib/tsunami/store.ts` yang sudah berjalan di produksi:
 * berkas JSON di satu direktori data, tulis atomik (temp + fsync + rename + chmod 0600),
 * kunci antarproses berbasis berkas `*.lock`, antrean dalam proses, cadangan memori bila
 * direktori tidak dapat ditulis, dan berkas rusak disalin (tidak dihapus).
 *
 * **Yang tidak disimpan:** tidak ada token FCM di log, tidak ada kredensial FCM di sini.
 * `devices.json` memuat token karena token itulah alamat pengiriman — sama seperti
 * `subscriptions.json` menyimpan endpoint Web Push pada versi tsunami. Berkas ditulis 0600
 * dan tidak pernah disajikan ke klien.
 */

import { randomBytes } from 'node:crypto';
import { open, readFile, rename, stat, unlink } from 'node:fs/promises';
import path from 'node:path';
import { StorageUnavailableError, createMemoryStore, createStorageProbe } from '../storage';
import type { NotifiedQuake } from './identity';
import type { QuakeRule } from './rule';

const DATA_DIR = process.env.QUAKE_DATA_DIR
  ? path.resolve(process.env.QUAKE_DATA_DIR)
  : path.join(process.cwd(), '.data', 'quake');

const MAX_DEVICES = 50_000;
const MAX_KNOWN = 500;
const LOCK_STALE_MS = 2 * 60_000;
const LOCK_WAIT_MS = 45_000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function quakeDataDir(): string {
  return DATA_DIR;
}

const filePath = (name: string): string => path.join(DATA_DIR, `${name}.json`);
const lockPath = (name: string): string => path.join(DATA_DIR, `${name}.lock`);

const storage = createStorageProbe(DATA_DIR, 'Pendaftaran perangkat & status pemantau gempa');
const memoryStore = createMemoryStore();
const memoryOnly = new Set<string>();

/** Peringatan penyimpanan untuk ditampilkan di UI (null = normal). */
export function storageWarning(): string | null {
  return storage.warning();
}

export interface StoredDevice {
  deviceId: string;
  fcmToken: string;
  platform: 'android';
  appVersion: string | null;
  locale: string | null;
  createdAt: string;
  updatedAt: string;
  /** Token pasti tidak berlaku lagi; tidak dikirimi pesan tetapi tetap disimpan untuk audit. */
  revokedAt: string | null;
  quake: QuakeRule;
  quakeEnabled: boolean;
  quietHours: { enabled: boolean; startLocal: string; endLocal: string };
  /** Event terakhir yang sudah diputuskan untuk perangkat ini. */
  lastNotifiedKey: string | null;
  lastNotifiedFingerprint: string | null;
  lastNotifiedAt: string | null;
}

export interface MonitorState {
  version: 1;
  /** Kejadian yang sudah diputuskan; dipakai dedupe lintas siklus. */
  known: NotifiedQuake[];
  lastCheckAt: string | null;
  lastCheckReason: string | null;
  lastSuccessAt: string | null;
  /** Diisi pada siklus pertama yang berhasil; sebelum itu tidak ada notifikasi dikirim. */
  seededAt: string | null;
  checkCount: number;
  lastError: string | null;
}

export function emptyMonitorState(): MonitorState {
  return {
    version: 1,
    known: [],
    lastCheckAt: null,
    lastCheckReason: null,
    lastSuccessAt: null,
    seededAt: null,
    checkCount: 0,
    lastError: null,
  };
}

async function readJson<T>(name: string, fallback: T): Promise<T> {
  if (memoryOnly.has(name)) {
    const raw = memoryStore.get(name);
    return raw === undefined ? fallback : (JSON.parse(raw) as T);
  }
  try {
    return JSON.parse(await readFile(filePath(name), 'utf8')) as T;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') {
      if (!storage.available()) {
        memoryOnly.add(name);
        const raw = memoryStore.get(name);
        return raw === undefined ? fallback : (JSON.parse(raw) as T);
      }
      return fallback;
    }
    if (error instanceof SyntaxError) {
      // Jangan hapus data pengguna diam-diam; simpan untuk investigasi.
      const backup = `${name}.corrupt-${Date.now()}.json`;
      await rename(filePath(name), filePath(backup)).catch(() => { /* abaikan */ });
      console.error(`[quake] ${name}.json rusak; disalin ke ${backup}.`);
      return fallback;
    }
    throw error;
  }
}

async function atomicWrite(name: string, value: unknown): Promise<void> {
  const payload = `${JSON.stringify(value, null, 2)}\n`;
  try {
    await storage.ensure();
  } catch (error) {
    if (!(error instanceof StorageUnavailableError)) throw error;
    memoryOnly.add(name);
    memoryStore.set(name, payload);
    return;
  }
  const target = filePath(name);
  const temp = `${target}.${process.pid}.${randomBytes(6).toString('hex')}.tmp`;
  const handle = await open(temp, 'w', 0o600);
  try {
    await handle.writeFile(payload, 'utf8');
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
  memoryOnly.delete(name);
  memoryStore.clear();
}

async function acquireFileLock(name: string): Promise<() => Promise<void>> {
  try {
    await storage.ensure();
  } catch (error) {
    if (!(error instanceof StorageUnavailableError)) throw error;
    return async () => { /* tanpa disk, antrean dalam proses sudah cukup */ };
  }
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
  throw new Error('Kunci penyimpanan pemantau gempa sedang dipakai proses lain');
}

const queues = new Map<string, Promise<void>>();

/** Serialisasi baca-ubah-tulis per berkas, plus kunci antarproses. */
export async function withQuakeLock<T>(name: string, fn: () => Promise<T>): Promise<T> {
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

function normalizeDevice(raw: unknown): StoredDevice | null {
  if (!raw || typeof raw !== 'object') return null;
  const d = raw as Partial<StoredDevice>;
  if (typeof d.deviceId !== 'string' || !d.deviceId) return null;
  // Token kosong DIIZINKAN selama perangkat sudah dicabut. `upsertDevice`/`revokeDevices`
  // mengosongkan token sebagai cara mencabut; menolak token kosong di sini akan membuat
  // perangkat tercabut menghilang pada pembacaan berikutnya, sehingga jejak audit hilang
  // dan `revokeDevices` tampak tidak pernah berhasil.
  const fcmToken = typeof d.fcmToken === 'string' ? d.fcmToken : '';
  const revokedAt = typeof d.revokedAt === 'string' ? d.revokedAt : null;
  if (!fcmToken && !revokedAt) return null;
  const now = new Date().toISOString();
  return {
    deviceId: d.deviceId,
    fcmToken,
    platform: 'android',
    appVersion: typeof d.appVersion === 'string' ? d.appVersion : null,
    locale: typeof d.locale === 'string' ? d.locale : null,
    createdAt: typeof d.createdAt === 'string' ? d.createdAt : now,
    updatedAt: typeof d.updatedAt === 'string' ? d.updatedAt : now,
    revokedAt,
    quakeEnabled: d.quakeEnabled !== false,
    quake: d.quake && typeof d.quake === 'object'
      ? {
        scope: d.quake.scope === 'all' ? 'all' : 'important',
        area: d.quake.area === 'province' || d.quake.area === 'radius' ? d.quake.area : 'indonesia',
        provinceId: typeof d.quake.provinceId === 'string' ? d.quake.provinceId : null,
        radiusKm: typeof d.quake.radiusKm === 'number' ? d.quake.radiusKm : null,
        centerLat: typeof d.quake.centerLat === 'number' ? d.quake.centerLat : null,
        centerLon: typeof d.quake.centerLon === 'number' ? d.quake.centerLon : null,
      }
      : {
        scope: 'important', area: 'indonesia', provinceId: null,
        radiusKm: null, centerLat: null, centerLon: null,
      },
    quietHours: d.quietHours && typeof d.quietHours === 'object'
      ? {
        enabled: d.quietHours.enabled === true,
        startLocal: typeof d.quietHours.startLocal === 'string' ? d.quietHours.startLocal : '22:00',
        endLocal: typeof d.quietHours.endLocal === 'string' ? d.quietHours.endLocal : '06:00',
      }
      : { enabled: false, startLocal: '22:00', endLocal: '06:00' },
    lastNotifiedKey: typeof d.lastNotifiedKey === 'string' ? d.lastNotifiedKey : null,
    lastNotifiedFingerprint: typeof d.lastNotifiedFingerprint === 'string' ? d.lastNotifiedFingerprint : null,
    lastNotifiedAt: typeof d.lastNotifiedAt === 'string' ? d.lastNotifiedAt : null,
  };
}

export async function loadDevices(): Promise<StoredDevice[]> {
  const raw = await readJson<unknown>('devices', []);
  if (!Array.isArray(raw)) return [];
  return raw
    .map(normalizeDevice)
    .filter((d): d is StoredDevice => d !== null)
    .slice(0, MAX_DEVICES);
}

export async function saveDevices(devices: StoredDevice[]): Promise<void> {
  await atomicWrite('devices', devices.slice(0, MAX_DEVICES));
}

export async function findDevice(deviceId: string): Promise<StoredDevice | null> {
  return (await loadDevices()).find((d) => d.deviceId === deviceId) ?? null;
}

/**
 * Upsert idempoten. Token yang sama pada `deviceId` lain dipindahkan: FCM hanya boleh
 * mengirim ke satu pemilik token, kalau tidak satu ponsel menerima notifikasi ganda.
 */
export async function upsertDevice(input: {
  deviceId: string;
  fcmToken: string;
  appVersion: string | null;
  locale: string | null;
}): Promise<StoredDevice> {
  return withQuakeLock('devices', async () => {
    const devices = await loadDevices();
    const now = new Date().toISOString();
    const existing = devices.find((d) => d.deviceId === input.deviceId);

    // Token lama milik perangkat LAIN dipindahkan ke pemanggil. FCM hanya boleh mengirim
    // ke satu pemilik token; bila dua deviceId menyimpan token yang sama, satu ponsel
    // menerima setiap notifikasi dua kali.
    //
    // Perangkat lama TIDAK dihapus, hanya dicabut (token dikosongkan + `revokedAt`), sama
    // seperti `revokeDevices`. Menghapusnya akan membuang jejak audit dan berbeda dari
    // semantik pencabutan di tempat lain; `findDevice` tetap mengembalikannya dengan
    // `revokedAt` terisi sehingga dapat ditelusuri.
    //
    // Ini terjadi sungguhan: pengguna memasang ulang aplikasi sehingga mendapat deviceId
    // baru sementara Firebase belum mencabut token lama.
    for (const other of devices) {      if (other.deviceId === input.deviceId) continue;
      if (other.fcmToken !== input.fcmToken) continue;
      if (!other.revokedAt) other.revokedAt = now;
      other.fcmToken = '';
      other.updatedAt = now;
    }

    if (existing) {
      existing.fcmToken = input.fcmToken;
      existing.updatedAt = now;
      existing.revokedAt = null;
      existing.appVersion = input.appVersion;
      existing.locale = input.locale;
      await saveDevices(devices);
      return existing;
    }

    if (devices.length >= MAX_DEVICES) throw new Error('Batas jumlah perangkat terdaftar tercapai');
    const created = normalizeDevice({
      ...input,
      createdAt: now,
      updatedAt: now,
    })!;
    await saveDevices([...devices, created]);
    return created;
  });
}

export async function updateDevice(
  deviceId: string,
  mutate: (device: StoredDevice) => StoredDevice,
): Promise<StoredDevice | null> {
  return withQuakeLock('devices', async () => {
    const devices = await loadDevices();
    const index = devices.findIndex((d) => d.deviceId === deviceId);
    if (index < 0) return null;
    const next = mutate(devices[index]);
    next.updatedAt = new Date().toISOString();
    devices[index] = next;
    await saveDevices(devices);
    return next;
  });
}

export async function removeDevice(deviceId: string): Promise<boolean> {
  return withQuakeLock('devices', async () => {
    const devices = await loadDevices();
    const next = devices.filter((d) => d.deviceId !== deviceId);
    if (next.length === devices.length) return false;
    await saveDevices(next);
    return true;
  });
}

/** Menghapus perangkat yang tokennya dinyatakan tidak berlaku oleh FCM. */
export async function revokeDevices(deviceIds: string[]): Promise<number> {
  if (deviceIds.length === 0) return 0;
  return withQuakeLock('devices', async () => {
    const devices = await loadDevices();
    const target = new Set(deviceIds);
    const now = new Date().toISOString();
    let count = 0;
    for (const device of devices) {
      if (target.has(device.deviceId) && !device.revokedAt) {
        device.revokedAt = now;
        device.updatedAt = now;
        // Token dikosongkan agar token mati tidak tersisa di disk. Keputusan pengiriman
        // tetap bergantung pada `revokedAt` (`devicesFor`), jadi pencabutan aman meski
        // token sempat kosong; ini hanya mengurangi data yang tidak berguna.
        device.fcmToken = '';
        count++;
      }
    }
    if (count > 0) await saveDevices(devices);
    return count;
  });
}

export async function loadMonitorState(): Promise<MonitorState> {
  const raw = await readJson<Partial<MonitorState>>('state', {});
  const base = emptyMonitorState();
  const known = Array.isArray(raw.known)
    ? raw.known.filter((item): item is NotifiedQuake => Boolean(
      item && typeof item === 'object'
      && typeof (item as NotifiedQuake).key === 'string'
      && typeof (item as NotifiedQuake).fingerprint === 'string'
      && typeof (item as NotifiedQuake).originTime === 'string',
    )).slice(-MAX_KNOWN)
    : [];
  return {
    ...base,
    known,
    lastCheckAt: typeof raw.lastCheckAt === 'string' ? raw.lastCheckAt : null,
    lastCheckReason: typeof raw.lastCheckReason === 'string' ? raw.lastCheckReason : null,
    lastSuccessAt: typeof raw.lastSuccessAt === 'string' ? raw.lastSuccessAt : null,
    seededAt: typeof raw.seededAt === 'string' ? raw.seededAt : null,
    checkCount: typeof raw.checkCount === 'number' && Number.isFinite(raw.checkCount) ? raw.checkCount : 0,
    lastError: typeof raw.lastError === 'string' ? raw.lastError : null,
  };
}

export async function saveMonitorState(state: MonitorState): Promise<void> {
  await atomicWrite('state', {
    ...state,
    known: state.known.slice(-MAX_KNOWN),
  });
}

export { MAX_KNOWN, MAX_DEVICES };
