/**
 * Test helper: memetakan alias `@/...` ke folder `src/`.
 *
 * `sucrase-node` tidak membaca `paths` dari tsconfig, sedangkan kode produksi sengaja
 * memakai alias `@/` (itu konvensi Next.js di repo ini dan tidak akan diubah hanya demi
 * satu skrip tes). Skrip tes yang menyentuh modul beralias cukup mengimpor berkas ini
 * paling awal. Pengaruhnya hanya pada proses tes, tidak pada build aplikasi.
 */

import Module from 'node:module';
import path from 'node:path';

const SRC = path.join(process.cwd(), 'src');

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ModuleAny = Module as any;
const originalResolve = ModuleAny._resolveFilename;

ModuleAny._resolveFilename = function resolve(
  request: string,
  ...rest: unknown[]
): string {
  if (typeof request === 'string' && request.startsWith('@/')) {
    // eslint-disable-next-line prefer-rest-params
    return originalResolve.call(this, path.join(SRC, request.slice(2)), ...rest);
  }
  // eslint-disable-next-line prefer-rest-params
  return originalResolve.call(this, request, ...rest);
};
