import path from 'node:path';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    /*
      Nonaktifkan Optimizer Gambar Next.js.
      Seismos tidak memakai optimasi gambar Next: satu-satunya pemakaian
      `next/image` (ikon cuaca BMKG) sudah memasang `unoptimized`, dan seluruh
      gambar gunung api/gempa melewati proxy sendiri yang sudah dibatasi host.
      Dengan optimizer mati, endpoint `/_next/image` tidak lagi dipakai, sehingga
      tidak ada jalur pemrosesan gambar Sharp yang bisa dieksploitasi. Ini juga
      menghindari pemuatan `sharp` yang tidak pernah terpakai.
    */
    unoptimized: true,
  },
  experimental: {
    // Next.js 14: instrumentation.ts dipakai untuk memulai pemantau tsunami.
    instrumentationHook: true,
    // web-push memakai modul Node (crypto/https); jangan dibundel ke edge/client.
    serverComponentsExternalPackages: ['web-push'],
  },
  webpack: (config, { isServer, nextRuntime, dir, webpack }) => {
    // Instrumentasi Next 14 tetap dibundel webpack; externalkan web-push agar
    // modul Node (http/https/net) tidak dicoba di-resolve untuk bundle server.
    if (isServer && nextRuntime !== 'edge') {
      const externals = Array.isArray(config.externals) ? config.externals : config.externals ? [config.externals] : [];
      config.externals = [...externals, 'web-push'];
    }
    // Next 14 juga mengompilasi instrumentation untuk Edge. Ganti pemantau Node
    // dengan stub agar modul `node:*` tidak masuk ke bundel Edge.
    if (nextRuntime === 'edge') {
      const tsunamiStub = path.join(dir, 'src/lib/tsunami/monitor.edge.ts');
      config.plugins.push(new webpack.NormalModuleReplacementPlugin(/^@\/lib\/tsunami\/monitor$/, tsunamiStub));
      const volcanoStub = path.join(dir, 'src/lib/volcano/monitor.edge.ts');
      config.plugins.push(new webpack.NormalModuleReplacementPlugin(/^@\/lib\/volcano\/monitor$/, volcanoStub));
      const quakeStub = path.join(dir, 'src/lib/quake/monitor.edge.ts');
      config.plugins.push(new webpack.NormalModuleReplacementPlugin(/^@\/lib\/quake\/monitor$/, quakeStub));
    }
    return config;
  },
  async headers() {
    /*
      CSP memakai nonce? Tidak: skrip tema di `layout.tsx` adalah konstanta statis
      dan Next.js menyisipkan skrip bootstrap-nya sendiri. Karena itu dipakai
      `'unsafe-inline'` untuk script — ditambah `strict-dynamic` tidak dipakai di
      sini karena akan memblokir skrip inline bawaan Next 14.

      Catatan: CSP ini tidak memblokir XSS yang berasal dari data pihak pertama
      (server tetap satu-satunya sumber HTML), tetapi menutup jalur injeksi
      eksternal: skrip hanya dari origin sendiri, tidak ada `eval`, dan frame
      hanya boleh dari YouTube (halaman siaran langsung).
    */
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      // Tile peta Leaflet: OpenStreetMap (jalan) dan ArcGIS (citra).
      "img-src 'self' data: blob: https://i.ytimg.com https://tile.openstreetmap.org https://server.arcgisonline.com",
      "font-src 'self' data:",
      "connect-src 'self'",
      "frame-src https://www.youtube-nocookie.com https://www.youtube.com",
      "media-src 'self'",
      "worker-src 'self'",
      "manifest-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'self'",
    ].join('; ');

    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Content-Security-Policy', value: csp },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          { key: 'Permissions-Policy', value: 'geolocation=(self), camera=(), microphone=(), payment=()' },
        ],
      },
    ];
  },
};
export default nextConfig;
