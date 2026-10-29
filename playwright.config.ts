import { defineConfig, devices } from '@playwright/test';

/**
 * Konfigurasi uji E2E (OI-09).
 *
 * Tujuan utama: menutup celah yang menjadi alasan audit tidak menyatakan
 * `READY` — yaitu butir "tidak ada pelanggaran CSP di konsol", "halaman
 * terhidrasi", dan "tidak ada galat konsol yang menghambat" yang hanya dapat
 * dibuktikan di peramban sungguhan.
 *
 * Port dibuat khusus (E2E_PORT) agar tidak bentrok dengan server pengembangan
 * yang mungkin sedang berjalan.
 */
const PORT = Number(process.env.E2E_PORT ?? 3700);

export default defineConfig({
  testDir: './e2e',
  // Uji ini berjalan pada build produksi (`next start`), bukan dev server.
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],

  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium-desktop',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      // Uji responsif: lebar 360 px (ponsel kecil) sering menjadi sumber gulir
      // horizontal yang tidak terlihat di desktop.
      name: 'chromium-mobile',
      use: { ...devices['Pixel 5'] },
    },
  ],

  webServer: {
    // `PORT` sengaja tidak diset lewat env: Next membaca `-p` secara langsung,
    // dan menyetel keduanya membuat log menyebut port lain dari yang diuji.
    command: `npx next start -p ${PORT}`,
    url: `http://127.0.0.1:${PORT}`,
    // Jangan pakai ulang server lain: port ini khusus uji E2E.
    reuseExistingServer: false,
    timeout: 180_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
