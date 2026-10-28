'use client';

import { useEffect } from 'react';

/**
 * Mendaftarkan service worker di produksi dan dev. Di dev, query `?dev=1`
 * membuat SW melewati cache agar HMR tidak terganggu; push tetap berfungsi.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const url = process.env.NODE_ENV === 'production' ? '/sw.js' : '/sw.js?dev=1';

    const register = () => {
      void navigator.serviceWorker.register(url, { scope: '/' }).then((registration) => {
        // Pastikan SW terbaru aktif saat aplikasi dibuka.
        void registration.update().catch(() => { /* offline atau server sibuk */ });
      }).catch(() => {
        /* PWA tetap bisa dipakai tanpa cache offline; push akan menampilkan error di pengaturan. */
      });
    };

    if (document.readyState === 'complete') {
      register();
      return;
    }
    window.addEventListener('load', register, { once: true });
    return () => window.removeEventListener('load', register);
  }, []);

  return null;
}
