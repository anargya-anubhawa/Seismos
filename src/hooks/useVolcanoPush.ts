'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Langganan Web Push untuk notifikasi gunung api. Memakai Service Worker dan
 * langganan browser yang sama dengan notifikasi tsunami/gempa; yang berbeda
 * hanya kategori (topik) yang dikirim ke server.
 */

export interface VolcanoTopics {
  volcano: boolean;
  levelChange: boolean;
  eruption: boolean;
  vona: boolean;
  recommendation: boolean;
}

export const DEFAULT_VOLCANO_TOPICS: VolcanoTopics = {
  volcano: true,
  levelChange: true,
  eruption: true,
  vona: false,
  recommendation: false,
};

interface PushState {
  ready: boolean;
  supported: boolean;
  permission: NotificationPermission;
  subscribed: boolean;
  topics: VolcanoTopics;
  endpoint: string | null;
  busy: boolean;
  error: string | null;
  message: string | null;
  enable: () => Promise<void>;
  disable: () => Promise<void>;
  saveTopics: (topics: VolcanoTopics) => Promise<void>;
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
  if (!navigator.serviceWorker) throw new Error('Service Worker tidak tersedia');
  // Registrasi utama dilakukan aplikasi; daftarkan bila belum ada.
  const existing = await navigator.serviceWorker.getRegistration('/');
  if (existing) return existing;
  await navigator.serviceWorker.register('/sw.js');
  return navigator.serviceWorker.ready;
}

export function useVolcanoPush(): PushState {
  const [ready, setReady] = useState(false);
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [subscribed, setSubscribed] = useState(false);
  const [topics, setTopics] = useState<VolcanoTopics>(DEFAULT_VOLCANO_TOPICS);
  const [endpoint, setEndpoint] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const mounted = useRef(true);

  const syncState = useCallback(async () => {
    const ok = typeof window !== 'undefined'
      && 'serviceWorker' in navigator
      && 'PushManager' in window
      && 'Notification' in window;
    if (!mounted.current) return;
    setSupported(ok);
    if (!ok) { setReady(true); return; }
    setPermission(Notification.permission);
    try {
      const registration = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise<null>((resolve) => setTimeout(() => resolve(null), READY_TIMEOUT_MS)),
      ]);
      if (!registration) { setReady(true); return; }
      const subscription = await registration.pushManager.getSubscription();
      if (!mounted.current) return;
      setSubscribed(Boolean(subscription));
      setEndpoint(subscription?.endpoint ?? null);
      if (subscription) {
        const stored = await fetch(`/api/volcano/push/topics?endpoint=${encodeURIComponent(subscription.endpoint)}`, { cache: 'no-store' })
          .then((response) => (response.ok ? response.json() : null))
          .catch(() => null) as { topics?: VolcanoTopics } | null;
        if (stored?.topics && mounted.current) setTopics(stored.topics);
      }
    } catch {
      /* dibiarkan: tombol aktifkan akan mencoba lagi */
    } finally {
      if (mounted.current) setReady(true);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void syncState();
    return () => { mounted.current = false; };
  }, [syncState]);

  const enable = useCallback(async () => {
    setBusy(true); setError(null); setMessage(null);
    try {
      const config = await fetch('/api/volcano/push/config', { cache: 'no-store' }).then((r) => r.json()) as
        { publicKey?: string; error?: string };
      if (!config.publicKey) throw new Error(config.error ?? 'Kunci push server tidak tersedia');
      const granted = await Notification.requestPermission();
      setPermission(granted);
      if (granted !== 'granted') throw new Error('Izin notifikasi tidak diberikan');
      const registration = await registrationReady();
      const key = urlBase64ToUint8Array(config.publicKey);
      let subscription = await registration.pushManager.getSubscription();
      if (subscription && !sameApplicationKey(subscription.options.applicationServerKey as ArrayBuffer | null, key)) {
        await subscription.unsubscribe();
        subscription = null;
      }
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: key as unknown as BufferSource,
        });
      }
      const response = await fetch('/api/volcano/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: subscription.toJSON(), topics: { ...topics, volcano: true } }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(payload?.error ?? 'Langganan gagal disimpan di server');
      }
      setSubscribed(true);
      setEndpoint(subscription.endpoint);
      setTopics((current) => ({ ...current, volcano: true }));
      setMessage('Notifikasi gunung api aktif untuk perangkat ini.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Notifikasi gunung api gagal diaktifkan');
    } finally {
      setBusy(false);
    }
  }, [topics]);

  const disable = useCallback(async () => {
    setBusy(true); setError(null); setMessage(null);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await fetch('/api/volcano/push/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        }).catch(() => {});
        await subscription.unsubscribe().catch(() => {});
      }
      setSubscribed(false);
      setEndpoint(null);
      setMessage('Notifikasi gunung api dinonaktifkan untuk perangkat ini.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Notifikasi gagal dinonaktifkan');
    } finally {
      setBusy(false);
    }
  }, []);

  const saveTopics = useCallback(async (next: VolcanoTopics) => {
    setBusy(true); setError(null); setMessage(null);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (!subscription) throw new Error('Aktifkan notifikasi gunung api terlebih dahulu');
      const response = await fetch('/api/volcano/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: subscription.toJSON(), topics: next }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(payload?.error ?? 'Kategori notifikasi gagal disimpan');
      }
      setTopics(next);
      setMessage('Kategori notifikasi gunung api diperbarui.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kategori notifikasi gagal disimpan');
    } finally {
      setBusy(false);
    }
  }, []);

  const test = useCallback(async () => {
    setBusy(true); setError(null); setMessage(null);
    try {
      if (!endpoint) throw new Error('Aktifkan notifikasi terlebih dahulu');
      const response = await fetch('/api/volcano/push/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint }),
      });
      const payload = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(payload?.error ?? 'Push uji gagal dikirim');
      setMessage('Push uji dikirim. Periksa notifikasi perangkat Anda.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Push uji gagal dikirim');
    } finally {
      setBusy(false);
    }
  }, [endpoint]);

  return {
    ready, supported, permission, subscribed, topics, endpoint, busy, error, message,
    enable, disable, saveTopics, test,
  };
}
