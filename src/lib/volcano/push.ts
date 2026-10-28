import * as webpush from 'web-push';
import type { VolcanoNotification } from '@/types/volcano';
import {
  loadSubscriptions, loadVapidKeys, saveSubscriptions, saveVapidKeys, withVolcanoLock,
  type StoredVolcanoPushSubscription, type StoredVapidKeys,
} from './store';

/**
 * Pengiriman Web Push gunung api memakai infrastruktur yang sama dengan
 * notifikasi tsunami/gempa: kunci VAPID yang sama, Service Worker yang sama,
 * dan satu langganan browser. Yang berbeda hanya topik per kategori
 * (`topics.volcano`, `levelChange`, `eruption`, `vona`, `recommendation`).
 */

const VAPID_SUBJECT = (process.env.VAPID_SUBJECT ?? 'https://github.com/anargya-anubhawa/seismos-indonesia').trim();
const MAX_SUBSCRIPTIONS = 10_000;
const TEST_COOLDOWN_MS = 30_000;
const BATCH = 25;

export interface VolcanoTopics {
  volcano: boolean;
  levelChange: boolean;
  eruption: boolean;
  vona: boolean;
  recommendation: boolean;
}

export const DEFAULT_TOPICS: VolcanoTopics = {
  volcano: true,
  levelChange: true,
  eruption: true,
  vona: false,
  recommendation: false,
};

let vapidPromise: Promise<StoredVapidKeys> | null = null;
const testTimes = new Map<string, number>();

function envKeys(): { publicKey: string; privateKey: string } | null {
  const publicKey = (process.env.VAPID_PUBLIC_KEY ?? process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '').trim();
  const privateKey = (process.env.VAPID_PRIVATE_KEY ?? '').trim();
  if (!publicKey || !privateKey) return null;
  if (publicKey.length < 80 || privateKey.length < 40) {
    console.error('[volcano] VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY tidak tampak valid; memakai kunci tersimpan.');
    return null;
  }
  return { publicKey, privateKey };
}

async function persistGeneratedVapid(): Promise<StoredVapidKeys> {
  return withVolcanoLock('vapid', async () => {
    const saved = await loadVapidKeys();
    if (saved) return saved;
    const generated = webpush.generateVAPIDKeys();
    const record: StoredVapidKeys = {
      publicKey: generated.publicKey,
      privateKey: generated.privateKey,
      createdAt: new Date().toISOString(),
    };
    await saveVapidKeys(record);
    return record;
  });
}

/** Kunci VAPID dari env, atau kunci bersama yang sudah tersimpan di server. */
export function getVapidKeys(): Promise<StoredVapidKeys> {
  if (!vapidPromise) {
    vapidPromise = (async () => {
      const fromEnv = envKeys();
      if (fromEnv) return { ...fromEnv, createdAt: 'env' };
      return persistGeneratedVapid();
    })().then((keys) => {
      webpush.setVapidDetails(VAPID_SUBJECT, keys.publicKey, keys.privateKey);
      return keys;
    }).catch((error) => {
      vapidPromise = null;
      throw error;
    });
  }
  return vapidPromise;
}

export async function getPublicKey(): Promise<string> {
  return (await getVapidKeys()).publicKey;
}

export interface VolcanoSubscriptionInput {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  topics?: Partial<VolcanoTopics>;
}

export function isValidPushSubscription(value: unknown): value is VolcanoSubscriptionInput {
  if (!value || typeof value !== 'object') return false;
  const subscription = value as Partial<VolcanoSubscriptionInput>;
  if (typeof subscription.endpoint !== 'string' || subscription.endpoint.length > 2048) return false;
  let url: URL;
  try { url = new URL(subscription.endpoint); } catch { return false; }
  const localhost = url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '[::1]';
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && localhost)) return false;
  if (!subscription.keys || typeof subscription.keys !== 'object') return false;
  const { p256dh, auth } = subscription.keys;
  if (typeof p256dh !== 'string' || p256dh.length < 20 || p256dh.length > 512) return false;
  if (typeof auth !== 'string' || auth.length < 8 || auth.length > 256) return false;
  return /^[A-Za-z0-9_-]+={0,2}$/.test(p256dh) && /^[A-Za-z0-9_-]+={0,2}$/.test(auth);
}

/**
 * Normalisasi kategori notifikasi.
 *
 * `fallback = 'default'` (langganan baru): kategori yang tidak dikirim memakai
 * bawaan. `fallback = 'off'` (pembaruan): kategori yang tidak dikirim dianggap
 * nonaktif, sehingga nilai `false` yang dikirim pengguna selalu dihormati.
 * Tanpa ini, mematikan kategori akan diam-diam kembali aktif ke nilai bawaan.
 */
export function normalizeTopics(value: unknown, fallback: 'default' | 'off' = 'default'): VolcanoTopics {
  const raw = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const pick = (key: keyof VolcanoTopics): boolean => {
    if (typeof raw[key] === 'boolean') return raw[key] as boolean;
    return fallback === 'default' ? DEFAULT_TOPICS[key] : false;
  };
  const topics: VolcanoTopics = {
    volcano: typeof raw.volcano === 'boolean' ? raw.volcano as boolean : fallback === 'default',
    levelChange: pick('levelChange'),
    eruption: pick('eruption'),
    vona: pick('vona'),
    recommendation: pick('recommendation'),
  };
  // Minimal satu kategori harus aktif bila topik gunung api diaktifkan.
  if (topics.volcano && !topics.levelChange && !topics.eruption && !topics.vona && !topics.recommendation) {
    topics.levelChange = true;
  }
  return topics;
}

export async function upsertSubscription(input: VolcanoSubscriptionInput): Promise<VolcanoTopics> {
  const topics = normalizeTopics(input.topics);
  await withVolcanoLock('subscriptions', async () => {
    const subscriptions = await loadSubscriptions();
    const now = new Date().toISOString();
    const index = subscriptions.findIndex((item) => item.endpoint === input.endpoint);
    if (index >= 0) {
      subscriptions[index] = {
        ...subscriptions[index],
        keys: { p256dh: input.keys.p256dh, auth: input.keys.auth },
        topics,
        updatedAt: now,
      };
    } else {
      if (subscriptions.length >= MAX_SUBSCRIPTIONS) throw new Error('Batas jumlah langganan push tercapai');
      subscriptions.push({
        endpoint: input.endpoint,
        keys: { p256dh: input.keys.p256dh, auth: input.keys.auth },
        topics,
        createdAt: now,
        updatedAt: now,
      });
    }
    await saveSubscriptions(subscriptions);
  });
  return topics;
}

export async function removeSubscription(endpoint: string): Promise<boolean> {
  return withVolcanoLock('subscriptions', async () => {
    const subscriptions = await loadSubscriptions();
    const next = subscriptions.filter((item) => item.endpoint !== endpoint);
    if (next.length === subscriptions.length) return false;
    await saveSubscriptions(next);
    return true;
  });
}

export async function findSubscription(endpoint: string): Promise<StoredVolcanoPushSubscription | null> {
  return (await loadSubscriptions()).find((item) => item.endpoint === endpoint) ?? null;
}

async function removeSubscriptions(endpoints: string[]): Promise<void> {
  if (endpoints.length === 0) return;
  const remove = new Set(endpoints);
  await withVolcanoLock('subscriptions', async () => {
    const subscriptions = await loadSubscriptions();
    await saveSubscriptions(subscriptions.filter((item) => !remove.has(item.endpoint)));
  });
}

const topicForKind = (kind: VolcanoNotification['kind']): keyof VolcanoTopics => {
  if (kind === 'level-change') return 'levelChange';
  if (kind === 'eruption') return 'eruption';
  if (kind === 'vona') return 'vona';
  return 'recommendation';
};

export interface DeliveryResult {
  subscribers: number;
  sent: number;
  failed: number;
  removed: number;
}

/** Bangun muatan push untuk Service Worker Seismos. */
export function buildVolcanoPushPayload(notification: VolcanoNotification): Record<string, unknown> {
  const interaction = notification.kind === 'eruption' || notification.kind === 'level-change';
  return {
    channel: 'volcano',
    title: notification.title,
    body: notification.body,
    tag: `seismos-volcano-${notification.key}`.slice(0, 120),
    url: notification.url,
    kind: notification.kind,
    volcanoCode: notification.volcanoCode || null,
    volcanoName: notification.volcanoName,
    occurredAt: notification.occurredAt,
    requireInteraction: interaction,
  };
}

/** Kirim satu notifikasi gunung api ke semua langganan yang mengaktifkan kategorinya. */
export async function deliverVolcanoNotification(notification: VolcanoNotification): Promise<DeliveryResult> {
  const kindTopic = topicForKind(notification.kind);
  const subscriptions = (await loadSubscriptions()).filter((item) => item.topics.volcano && item.topics[kindTopic]);
  if (subscriptions.length === 0) return { subscribers: 0, sent: 0, failed: 0, removed: 0 };

  await getVapidKeys();
  const payload = JSON.stringify(buildVolcanoPushPayload(notification));
  const options: webpush.RequestOptions = {
    TTL: 6 * 3_600,
    urgency: kindTopic === 'vona' ? 'normal' : 'high',
    topic: `volcano-${kindTopic}`.slice(0, 32),
  };

  let sent = 0;
  let failed = 0;
  const dead: string[] = [];

  for (let offset = 0; offset < subscriptions.length; offset += BATCH) {
    const batch = subscriptions.slice(offset, offset + BATCH);
    await Promise.all(batch.map(async (subscription) => {
      try {
        await webpush.sendNotification({ endpoint: subscription.endpoint, keys: subscription.keys }, payload, options);
        sent++;
      } catch (error) {
        failed++;
        const status = (error as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) dead.push(subscription.endpoint);
        else console.error(`[volcano] push gagal (${status ?? 'tanpa status'}): ${error instanceof Error ? error.message : 'kesalahan tidak dikenal'}`);
      }
    }));
  }

  await removeSubscriptions(dead);
  return { subscribers: subscriptions.length, sent, failed, removed: dead.length };
}

export async function sendTestPush(endpoint: string): Promise<void> {
  const last = testTimes.get(endpoint) ?? 0;
  if (Date.now() - last < TEST_COOLDOWN_MS) throw new Error('Tunggu sebentar sebelum mengirim tes lagi');
  const subscription = (await loadSubscriptions()).find((item) => item.endpoint === endpoint);
  if (!subscription) throw new Error('Langganan push tidak ditemukan; aktifkan ulang notifikasi gunung api');
  await getVapidKeys();
  testTimes.set(endpoint, Date.now());
  await webpush.sendNotification({
    endpoint: subscription.endpoint,
    keys: subscription.keys,
  }, JSON.stringify({
    channel: 'volcano',
    title: 'Tes notifikasi gunung api — Seismos Indonesia',
    body: 'Push gunung api aktif. Server akan mengirim notifikasi saat MAGMA/PVMBG menerbitkan perubahan tingkat aktivitas, informasi letusan, atau VONA baru.',
    tag: 'seismos-volcano-test',
    url: '/gunung-berapi',
    kind: 'test',
    requireInteraction: false,
  }), { TTL: 300, urgency: 'normal', topic: 'volcano-test' });
}
