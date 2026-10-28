/* Service worker: cache shell statis + menerima push tsunami. Data API tidak pernah di-cache. */
const CACHE = 'seismos-shell-v4';
const PRECACHE = [
  '/',
  '/manifest.webmanifest',
  '/icon.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
];
// Saat dev, SW didaftarkan dengan /sw.js?dev=1 agar cache tidak mengganggu HMR.
const DEV = new URL(self.location.href).searchParams.has('dev');

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      if (!DEV) {
        const cache = await caches.open(CACHE);
        await Promise.allSettled(PRECACHE.map((url) => cache.add(url)));
      }
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  if (DEV) return;
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Data gempa, tsunami, dan seismogram harus selalu segar; jangan pernah di-cache.
  if (url.pathname.startsWith('/api/')) return;
  if (url.searchParams.has('_rsc')) return;

  if (req.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req);
          if (fresh.ok) {
            const cache = await caches.open(CACHE);
            cache.put(req, fresh.clone()).catch(() => {});
          }
          return fresh;
        } catch {
          const cache = await caches.open(CACHE);
          return (await cache.match(req)) || (await cache.match('/'))
            || new Response('Tidak ada koneksi dan halaman ini belum tersimpan.', {
              status: 503,
              headers: { 'Content-Type': 'text/plain; charset=utf-8' },
            });
        }
      })(),
    );
    return;
  }

  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icon') || url.pathname === '/apple-touch-icon.png') {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        const hit = await cache.match(req);
        if (hit) return hit;
        const fresh = await fetch(req);
        if (fresh.ok) cache.put(req, fresh.clone()).catch(() => {});
        return fresh;
      })(),
    );
  }
});

function safePayload(event) {
  if (!event.data) return {};
  try {
    const parsed = event.data.json();
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    try {
      return { body: event.data.text() };
    } catch {
      return {};
    }
  }
}

function sameOriginUrl(raw, fallback = '/tsunami') {
  try {
    const target = new URL(typeof raw === 'string' && raw ? raw : fallback, self.location.origin);
    return target.origin === self.location.origin ? target.href : new URL(fallback, self.location.origin).href;
  } catch {
    return new URL(fallback, self.location.origin).href;
  }
}

self.addEventListener('push', (event) => {
  const data = safePayload(event);
  // Muatan gunung api ditandai `channel: 'volcano'`; sisanya adalah notifikasi tsunami/gempa.
  const isVolcano = data.channel === 'volcano';
  const fallbackTitle = isVolcano ? 'Informasi gunung api MAGMA' : 'Peringatan tsunami BMKG';
  const title = typeof data.title === 'string' && data.title.trim() ? data.title : fallbackTitle;
  const fallbackBody = isVolcano
    ? 'Buka Seismos Indonesia untuk memeriksa status aktivitas gunung api terbaru dari MAGMA/PVMBG.'
    : 'Buka Seismos Indonesia untuk memeriksa status peringatan tsunami terbaru.';
  const body = typeof data.body === 'string' && data.body.trim() ? data.body : fallbackBody;
  const defaultUrl = isVolcano ? '/gunung-berapi' : '/tsunami';
  const url = sameOriginUrl(data.url, defaultUrl);
  const tag = typeof data.tag === 'string' && data.tag
    ? data.tag
    : (isVolcano ? 'seismos-volcano' : 'seismos-tsunami');
  const issueAt = Date.parse(isVolcano ? data.occurredAt : data.issueTime);
  const active = isVolcano ? true : data.status !== 'ended';
  const options = {
    body,
    tag,
    renotify: true,
    requireInteraction: Boolean(data.requireInteraction) && active,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    timestamp: Number.isFinite(issueAt) ? issueAt : Date.now(),
    vibrate: isVolcano
      ? (data.kind === 'eruption' ? [300, 120, 300, 120, 600] : [200, 100, 200])
      : (active ? [300, 120, 300, 120, 600] : [150]),
    data: {
      url,
      channel: isVolcano ? 'volcano' : 'tsunami',
      alertId: typeof data.alertId === 'string' ? data.alertId : null,
      status: active ? 'active' : 'ended',
    },
    actions: active ? [{ action: 'open', title: 'Buka detail' }] : [],
  };

  event.waitUntil(
    self.registration.showNotification(title, options).catch(() => {
      /* Izin dapat dicabut kapan saja; jangan gagalkan event push. */
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const url = sameOriginUrl(data.url, data.channel === 'volcano' ? '/gunung-berapi' : '/tsunami');
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windows) {
      if (client.url.startsWith(self.location.origin)) {
        await client.focus();
        if ('navigate' in client) {
          try { await client.navigate(url); } catch { /* biarkan tab yang ada */ }
        }
        return;
      }
    }
    await self.clients.openWindow(url);
  })());
});

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

/* Browser dapat merotasi langganan; daftarkan ulang tanpa menunggu tab dibuka.
   Kunci VAPID sama untuk semua topik, jadi langganan baru dikirim ke tsunami dan gunung api. */
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil((async () => {
    try {
      const config = await fetch('/api/tsunami/push/config', { cache: 'no-store' }).then((response) => response.json());
      if (!config || typeof config.publicKey !== 'string' || !config.publicKey) return;
      const subscription = await self.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(config.publicKey),
      });
      await fetch('/api/tsunami/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: subscription.toJSON() }),
      });
      // Langganan yang sama dapat dipakai notifikasi gunung api; diamkan bila pengguna tidak memilihnya.
      await fetch('/api/volcano/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: subscription.toJSON() }),
      }).catch(() => {});
      if (event.oldSubscription) {
        await fetch('/api/tsunami/push/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: event.oldSubscription.endpoint }),
        }).catch(() => {});
      }
    } catch {
      /* Dicoba lagi saat pengguna membuka halaman dan menekan Aktifkan. */
    }
  })());
});
