import * as webpush from 'web-push';
import type { TsunamiAlert, TsunamiPushConfig, TsunamiPushSubscriptionInput } from '@/types/tsunami';
import type { TsunamiNotificationKind } from './identity';
import { buildTsunamiPushPayload } from './push-payload';
import {
  loadSubscriptions, loadVapidKeys, saveSubscriptions, saveVapidKeys, withTsunamiLock,
  type StoredPushSubscription, type StoredVapidKeys,
} from './store';

const VAPID_SUBJECT = (process.env.VAPID_SUBJECT ?? 'https://github.com/anargya-anubhawa/seismos-indonesia').trim();
const MAX_SUBSCRIPTIONS = 10_000;
const TEST_COOLDOWN_MS = 30_000;

let vapidPromise: Promise<StoredVapidKeys> | null = null;
const testTimes = new Map<string, number>();

function envKeys(): { publicKey: string; privateKey: string } | null {
  const publicKey = (process.env.VAPID_PUBLIC_KEY ?? process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '').trim();
  const privateKey = (process.env.VAPID_PRIVATE_KEY ?? '').trim();
  if (!publicKey || !privateKey) return null;
  if (publicKey.length < 80 || privateKey.length < 40) {
    console.error('[tsunami] VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY tidak tampak valid; memakai kunci tersimpan.');
    return null;
  }
  return { publicKey, privateKey };
}

async function persistGeneratedVapid(): Promise<StoredVapidKeys> {
  return withTsunamiLock('vapid', async () => {
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

/** Kunci VAPID dari env, atau dibuat sekali dan disimpan di data dir server. */
export function getVapidKeys(): Promise<StoredVapidKeys> {
  if (!vapidPromise) {
    vapidPromise = (async () => {
      const fromEnv = envKeys();
      if (fromEnv) {
        return { ...fromEnv, createdAt: 'env' };
      }
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

export async function getPushConfig(): Promise<TsunamiPushConfig> {
  const keys = await getVapidKeys();
  return { publicKey: keys.publicKey, enabled: true };
}

export function isValidPushSubscription(value: unknown): value is TsunamiPushSubscriptionInput {
  if (!value || typeof value !== 'object') return false;
  const subscription = value as Partial<TsunamiPushSubscriptionInput>;
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

export async function upsertSubscription(input: TsunamiPushSubscriptionInput): Promise<void> {
  await withTsunamiLock('subscriptions', async () => {
    const subscriptions = await loadSubscriptions();
    const now = new Date().toISOString();
    const index = subscriptions.findIndex((item) => item.endpoint === input.endpoint);
    if (index >= 0) {
      subscriptions[index] = {
        ...subscriptions[index],
        keys: { p256dh: input.keys.p256dh, auth: input.keys.auth },
        topics: { tsunami: true },
        updatedAt: now,
      };
    } else {
      if (subscriptions.length >= MAX_SUBSCRIPTIONS) throw new Error('Batas jumlah langganan push tercapai');
      subscriptions.push({
        endpoint: input.endpoint,
        keys: { p256dh: input.keys.p256dh, auth: input.keys.auth },
        topics: { tsunami: true },
        createdAt: now,
        updatedAt: now,
      });
    }
    await saveSubscriptions(subscriptions);
  });
}

export async function removeSubscription(endpoint: string): Promise<boolean> {
  return withTsunamiLock('subscriptions', async () => {
    const subscriptions = await loadSubscriptions();
    const next = subscriptions.filter((item) => item.endpoint !== endpoint);
    if (next.length === subscriptions.length) return false;
    await saveSubscriptions(next);
    return true;
  });
}

async function removeSubscriptions(endpoints: string[]): Promise<void> {
  if (endpoints.length === 0) return;
  const remove = new Set(endpoints);
  await withTsunamiLock('subscriptions', async () => {
    const subscriptions = await loadSubscriptions();
    await saveSubscriptions(subscriptions.filter((item) => !remove.has(item.endpoint)));
  });
}

export interface DeliveryResult {
  subscribers: number;
  sent: number;
  failed: number;
  removed: number;
}

/** Kirim satu peringatan/pembaruan ke semua langganan tsunami yang aktif. */
export async function deliverTsunamiNotification(
  alert: TsunamiAlert,
  kind: TsunamiNotificationKind,
): Promise<DeliveryResult> {
  const subscriptions = (await loadSubscriptions()).filter((item) => item.topics.tsunami !== false);
  if (subscriptions.length === 0) return { subscribers: 0, sent: 0, failed: 0, removed: 0 };

  await getVapidKeys();
  const payload = JSON.stringify(buildTsunamiPushPayload(alert, kind));
  const options: webpush.RequestOptions = {
    TTL: kind === 'cancelled' ? 900 : 3_600,
    urgency: kind === 'cancelled' ? 'normal' : 'high',
    topic: 'seismos-tsunami',
  };

  let sent = 0;
  let failed = 0;
  const dead: string[] = [];

  for (let offset = 0; offset < subscriptions.length; offset += 25) {
    const batch = subscriptions.slice(offset, offset + 25);
    await Promise.all(batch.map(async (subscription: StoredPushSubscription) => {
      try {
        await webpush.sendNotification({
          endpoint: subscription.endpoint,
          keys: subscription.keys,
        }, payload, options);
        sent++;
      } catch (error) {
        failed++;
        const status = (error as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) dead.push(subscription.endpoint);
        else console.error(`[tsunami] push gagal (${status ?? 'tanpa status'}): ${error instanceof Error ? error.message : 'kesalahan tidak dikenal'}`);
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
  if (!subscription) throw new Error('Langganan push tidak ditemukan; aktifkan ulang notifikasi tsunami');
  await getVapidKeys();
  testTimes.set(endpoint, Date.now());
  await webpush.sendNotification({
    endpoint: subscription.endpoint,
    keys: subscription.keys,
  }, JSON.stringify({
    title: 'Tes push tsunami — Seismos Indonesia',
    body: 'Push tsunami aktif. Notifikasi resmi BMKG akan muncul setelah server mendeteksi peringatan baru, pembaruan, atau pernyataan berakhir.',
    tag: 'seismos-tsunami-test',
    url: '/tsunami',
    status: 'active',
    requireInteraction: false,
  }), { TTL: 300, urgency: 'normal', topic: 'seismos-tsunami-test' });
}
