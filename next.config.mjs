import path from 'node:path';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
    }
    return config;
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        ],
      },
    ];
  },
};
export default nextConfig;
