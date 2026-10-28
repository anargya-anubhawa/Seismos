import { volcanoSlug } from '@/lib/volcano/magma';
import type { KrbMap } from '@/types/volcano';

/**
 * Tautan internal untuk halaman gunung api. Semua tautan dibangun dari kode
 * resmi karena rute `/gunung-berapi/[kode]` dicocokkan lewat kode, bukan nama.
 * Menggunakan nama sebagai slug menimbulkan tautan salah untuk gunung api yang
 * nama peta berbeda dengan kodenya (mis. peta "Hobal" berkode "HOB").
 */
export function volcanoHref(code: string, section?: string): string {
  const base = `/gunung-berapi/${code.trim().toLowerCase()}`;
  return section ? `${base}/${section}` : base;
}

/**
 * Tautan detail dari satu peta KRB. Kode hasil pencocokan server dipakai lebih
 * dahulu; bila tidak tersedia, slug nama dipakai sebagai upaya terakhir agar
 * pengguna tetap mendapat tautan, bukan tombol mati.
 */
export function krbDetailHref(map: Pick<KrbMap, 'volcanoName' | 'volcanoCode'>): string {
  const code = map.volcanoCode?.trim();
  return volcanoHref(code || volcanoSlug('', map.volcanoName));
}
