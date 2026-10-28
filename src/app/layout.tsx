import type { Metadata, Viewport } from 'next';
import { Public_Sans } from 'next/font/google';
import './globals.css';
import { EarthquakeProvider } from '@/hooks/useEarthquakes';
import { NotificationProvider } from '@/hooks/useNotifications';
import { Shell } from '@/components/navigation/Shell';
import { WeatherStrip } from '@/components/weather/WeatherStrip';
import { ServiceWorkerRegister } from '@/components/pwa/ServiceWorkerRegister';

const sans = Public_Sans({ subsets: ['latin'], variable: '--font-sans' });

export const metadata: Metadata = {
  title: { default: 'Seismos Indonesia', template: '%s — Seismos Indonesia' },
  description: 'Pemantauan gempa bumi Indonesia dari data terbuka BMKG/InaTEWS, peta dan jarak episenter, notifikasi wilayah, seismograf perangkat, dan seismogram gunung api MAGMA/PVMBG.',
  applicationName: 'Seismos Indonesia',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  appleWebApp: {
    capable: true,
    title: 'Seismos Indonesia',
    statusBarStyle: 'default',
  },
  formatDetection: { telephone: false },
};
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#163E78' },
    { media: '(prefers-color-scheme: dark)', color: '#081322' },
  ],
};

// Menerapkan tema tersimpan sebelum render pertama agar tidak berkedip.
const themeScript = `try{var t=localStorage.getItem('seismos-theme');var d=t==='dark'||(t!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches);if(d)document.documentElement.classList.add('dark')}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning className={sans.variable}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="font-sans antialiased">
        <EarthquakeProvider>
          <NotificationProvider>
            <Shell weatherStrip={<WeatherStrip />}>{children}</Shell>
            <ServiceWorkerRegister />
          </NotificationProvider>
        </EarthquakeProvider>
      </body>
    </html>
  );
}
