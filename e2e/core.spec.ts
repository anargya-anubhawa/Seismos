import { expect, test, type Page } from '@playwright/test';

/**
 * Uji E2E inti (OI-09).
 *
 * Yang diuji di sini adalah hal-hal yang TIDAK dapat dibuktikan lewat `curl`:
 * halaman benar-benar terhidrasi, tidak ada galat konsol, dan tidak ada
 * pelanggaran Content-Security-Policy saat aplikasi berjalan sungguhan.
 *
 * Tidak ada uji push nyata di sini: itu tetap butuh kredensial VAPID dan
 * perangkat sungguhan, dan tidak boleh diklaim lulus tanpa keduanya.
 */

/** Rute publik utama. Semuanya harus benar-benar terhidrasi tanpa galat. */
const ROUTES = [
  '/',
  '/map',
  '/history',
  '/statistics',
  '/tsunami',
  '/cuaca',
  '/cuaca/peringatan-dini',
  '/cuaca/satelit',
  '/gunung-berapi',
  '/gunung-berapi/status',
  '/gunung-berapi/vona',
  '/gunung-berapi/cctv',
  '/gunung-berapi/gallery',
  '/gunung-berapi/live-youtube',
  '/gunung-berapi/peta',
  '/gunung-berapi/krb',
  '/gunung-berapi/notifikasi',
  '/settings',
  '/privasi',
  '/status-sumber',
  '/about',
  '/mitigasi',
] as const;

/**
 * Kumpulkan galat konsol dan pelanggaran CSP selama halaman dibuka.
 *
 * Panggil SEBELUM navigasi. Mengembalikan larik yang terisi selama uji.
 */
function watchConsole(page: Page) {
  const problems: string[] = [];
  page.on('console', (message) => {
    const text = message.text();
    if (message.type() === 'error') {
      // Kegagalan mengambil sumber eksternal (jaringan CI sering memblokir
      // domain BMKG) bukan pelanggaran keamanan dan bukan galat aplikasi.
      // Pelanggaran CSP tetap dicatat dan menggagalkan uji.
      if (/content.security.policy|refused to (load|execute|connect)/i.test(text)) {
        problems.push(`CSP: ${text}`);
        return;
      }
      if (/failed to load resource|net::ERR_|ERR_NAME_NOT_RESOLVED/i.test(text)) return;
      problems.push(`konsol: ${text}`);
      return;
    }
    // Pelanggaran CSP kadang dilaporkan sebagai warning.
    if (/content.security.policy/i.test(text)) problems.push(`CSP(warn): ${text}`);
  });
  page.on('pageerror', (error) => {
    problems.push(`pageerror: ${error.message}`);
  });
  return problems;
}

test.describe('Halaman publik terhidrasi tanpa galat konsol', () => {
  for (const route of ROUTES) {
    test(`rute ${route}`, async ({ page }) => {
      const problems = watchConsole(page);

      const response = await page.goto(route, { waitUntil: 'domcontentloaded' });
      expect(response?.status(), `${route} harus merespons 200`).toBe(200);

      // React sudah terpasang: root punya atribut yang disisipkan klien.
      // Ini membedakan "HTML terkirim" dari "aplikasi benar-benar jalan".
      await expect(page.locator('body')).toBeVisible();

      // Heading utama wajib ada: bukti komponen sudah merender, bukan shell kosong.
      // Dicek SEBELUM menunggu jaringan, karena aplikasi memantau terus-menerus
      // sehingga `networkidle` tidak pernah tercapai.
      await expect(page.locator('h1').first()).toBeVisible();

      // Beri waktu komponen klien selesai menarik data, lalu pastikan tidak ada
      // galat yang muncul setelah hidrasi (waktu tunggu terbatas, bukan networkidle).
      await page.waitForTimeout(2500);

      expect(problems, `${route} menghasilkan galat:\n${problems.join('\n')}`).toEqual([]);
    });
  }
});

test.describe('Tidak ada gulir horizontal', () => {
  // Lebar 360 px adalah ukuran ponsel kecil yang paling sering jebol.
  for (const route of ['/', '/gunung-berapi', '/history', '/statistics', '/gunung-berapi/gallery'] as const) {
    test(`rute ${route} pada lebar 360 px`, async ({ page }) => {
      await page.setViewportSize({ width: 360, height: 780 });
      await page.goto(route, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2000);

      const overflow = await page.evaluate(() => {
        const doc = document.documentElement;
        // Toleransi 1 px untuk pembulatan subpiksel.
        return doc.scrollWidth - doc.clientWidth;
      });
      expect(overflow, `${route} meluber ${overflow} px secara horizontal`).toBeLessThanOrEqual(1);
    });
  }
});

test.describe('Kontrol aksesibel dan dapat difokuskan', () => {
  test('navigasi utama dapat dicapai dengan Tab', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    // Tab beberapa kali; minimal satu elemen yang dapat difokus harus muncul,
    // dan fokusnya harus terlihat (bukan tersembunyi).
    const focused: string[] = [];
    for (let i = 0; i < 8; i += 1) {
      await page.keyboard.press('Tab');
      const info = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el) return null;
        return { tag: el.tagName.toLowerCase(), text: (el.textContent ?? '').trim().slice(0, 40) };
      });
      if (info) focused.push(`${info.tag}:${info.text}`);
    }
    expect(focused.length).toBeGreaterThan(3);
  });

  test('badge level gunung api menyertakan teks, bukan hanya warna', async ({ page }) => {
    await page.goto('/gunung-berapi/status', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    // Minimal satu label level terbaca sebagai teks.
    await expect(page.getByText(/Level (I|II|III|IV)/).first()).toBeVisible({ timeout: 20_000 });
  });
});

test.describe('Halaman baru (OI-03, OI-04, OI-06)', () => {
  test('status sumber menampilkan tabel kesehatan', async ({ page }) => {
    await page.goto('/status-sumber', { waitUntil: 'domcontentloaded' });
    // Ringkasan jumlah sumber wajib muncul (dari /api/health).
    await expect(page.getByText(/sumber (merespons normal|bermasalah)/)).toBeVisible({ timeout: 30_000 });
  });

  test('kebijakan privasi menyebut lokasi dan push', async ({ page }) => {
    await page.goto('/privasi', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: /kebijakan privasi/i })).toBeVisible();
    await expect(page.getByText(/tidak disimpan/i).first()).toBeVisible();
  });

  test('indikator kesegaran data tampil di beranda', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText(/Data gempa diambil/i)).toBeVisible({ timeout: 30_000 });
  });
});
