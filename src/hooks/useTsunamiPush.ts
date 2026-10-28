'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface PushConfigResponse {
  publicKey?: string;
  enabled?: boolean;
  error?: string;
}

interface PushState {
  ready: boolean;
  supported: boolean;
  permission: NotificationPermission;
  subscribed: boolean;
  busy: boolean;
  error: string | null;
  message: string | null;
  enable: () => Promise<void>;
  disable: () => Promise<void>;
  test: () => Promise<void>;
}

const READY_TIMEOUT_MS = 12_000;

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

function sameApplicationKey(current: ArrayBuffer | null, desired: Uint8Array): boolean {
  if (!current) return false;
  const bytes = new Uint8Array(current);
  if (bytes.length !== desired.length) return false;
  for (let i = 0; i < bytes.length; i++) if (bytes[i] !== desired[i]) return false;
  return true;
}

async function registrationReady(): Promise<ServiceWorkerRegistration> {
  if (!('serviceWorker' in navigator)) throw new Error('Service Worker tidak didukung browser ini');
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<ServiceWorkerRegistration>((_, reject) => {
      window.setTimeout(() => reject(new Error('Service Worker belum siap. Muat ulang halaman lalu coba lagi.')), READY_TIMEOUT_MS);
    }),
  ]);
}

async function fetchConfig(): Promise<string> {
  const response = await fetch('/api/tsunami/push/config', { cache: 'no-store' });
  const payload = await response.json().catch(() => null) as PushConfigResponse | null;
  if (!response.ok || !payload?.publicKey) {
    throw new Error(payload?.error ?? 'Konfigurasi push tsunami belum tersedia di server.');
  }
  return payload.publicKey;
}

async function postSubscription(subscription: PushSubscription): Promise<void> {
  const response = await fetch('/api/tsunami/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subscription: subscription.toJSON() }),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(payload?.error ?? `Server menolak langganan push (HTTP ${response.status})`);
  }
}

/**
 * Pengaturan push tsunami terpisah dari notifikasi gempa lokal. Langganan
 * disimpan di server; Service Worker menerima push saat halaman tertutup bila
 * browser/OS mengizinkannya.
 */
export function useTsunamiPush(): PushState {
  const [ready, setReady] = useState(false);
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const mounted = useRef(true);

  const syncSubscription = useCallback(async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return;
    try {
      const registration = await registrationReady();
      const subscription = await registration.pushManager.getSubscription();
      if (mounted.current) setSubscribed(Boolean(subscription));
    } catch {
      if (mounted.current) setSubscribed(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    const ok = typeof window !== 'undefined'
      && 'Notification' in window
      && 'serviceWorker' in navigator
      && 'PushManager' in window;
    setSupported(ok);
    if (!ok) {
      setReady(true);
      return;
    }
    setPermission(Notification.permission);
    void Promise.allSettled([fetchConfig(), syncSubscription()]).then((results) => {
      if (!mounted.current) return;
      const config = results[0];
      if (config.status === 'rejected') {
        setError(config.reason instanceof Error ? config.reason.message : 'Konfigurasi push tsunami tidak tersedia.');
      }
      setReady(true);
    });

    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        setPermission(Notification.permission);
        void syncSubscription();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      mounted.current = false;
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [syncSubscription]);

  const enable = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
        throw new Error('Push tsunami tidak didukung browser ini. Gunakan HTTPS dan browser modern.');
      }
      let result = Notification.permission;
      if (result === 'default') result = await Notification.requestPermission();
      setPermission(result);
      if (result !== 'granted') {
        throw new Error(result === 'denied'
          ? 'Izin notifikasi ditolak. Buka pengaturan situs di browser lalu izinkan Notifikasi.'
          : 'Izin notifikasi belum diberikan.');
      }

      const publicKey = await fetchConfig();
      const desiredKey = urlBase64ToUint8Array(publicKey);
      const registration = await registrationReady();
      let subscription = await registration.pushManager.getSubscription();
      if (subscription && !sameApplicationKey(subscription.options.applicationServerKey, desiredKey)) {
        await subscription.unsubscribe().catch(() => false);
        subscription = null;
      }
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: desiredKey as BufferSource,
        });
      }
      await postSubscription(subscription);
      if (mounted.current) {
        setSubscribed(true);
        setMessage('Push tsunami aktif di perangkat ini. Notifikasi resmi BMKG akan dikirim server saat ada peringatan baru, pembaruan, atau pernyataan berakhir.');
      }
    } catch (cause) {
      if (mounted.current) setError(cause instanceof Error ? cause.message : 'Gagal mengaktifkan push tsunami.');
    } finally {
      if (mounted.current) setBusy(false);
    }
  }, [busy]);

  const disable = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const registration = await registrationReady();
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await fetch('/api/tsunami/push/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        }).catch(() => { /* server akan menghapus endpoint mati saat push berikutnya */ });
        await subscription.unsubscribe();
      }
      if (mounted.current) {
        setSubscribed(false);
        setMessage('Push tsunami dimatikan di perangkat ini. Notifikasi gempa lokal tidak terpengaruh.');
      }
    } catch (cause) {
      if (mounted.current) setError(cause instanceof Error ? cause.message : 'Gagal mematikan push tsunami.');
    } finally {
      if (mounted.current) setBusy(false);
    }
  }, [busy]);

  const test = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const registration = await registrationReady();
      const subscription = await registration.pushManager.getSubscription();
      if (!subscription) throw new Error('Belum ada langganan push di perangkat ini.');
      const response = await fetch('/api/tsunami/push/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      });
      const payload = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(payload?.error ?? `Tes push gagal (HTTP ${response.status})`);
      if (mounted.current) setMessage('Tes push dikirim ke layanan push browser. Notifikasi dapat muncul beberapa detik kemudian.');
    } catch (cause) {
      if (mounted.current) setError(cause instanceof Error ? cause.message : 'Tes push gagal.');
    } finally {
      if (mounted.current) setBusy(false);
    }
  }, [busy]);

  return { ready, supported, permission, subscribed, busy, error, message, enable, disable, test };
}
