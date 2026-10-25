/** Estimasi gravitasi dengan low-pass eksponensial per sampel; dikurangkan dari accelerationIncludingGravity. */
export class GravityFilter {
  private g: [number, number, number] | null = null;
  constructor(readonly alpha = 0.02) {}

  reset(): void { this.g = null; }

  update(x: number, y: number, z: number): [number, number, number] {
    if (!this.g) {
      this.g = [x, y, z];
      return [0, 0, 0];
    }
    const g = this.g;
    g[0] += this.alpha * (x - g[0]);
    g[1] += this.alpha * (y - g[1]);
    g[2] += this.alpha * (z - g[2]);
    return [x - g[0], y - g[1], z - g[2]];
  }
}

export const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

export type QualityLevel = 'belum ada' | 'baik' | 'cukup' | 'rendah';

/** Penilaian indikatif berdasarkan laju sampling terukur dan rasio sampel tidak valid; bukan standar baku. */
export function assessQuality(rateHz: number | null, valid: number, invalid: number): { level: QualityLevel; note: string } {
  if (rateHz === null || valid < 2) return { level: 'belum ada', note: 'Belum cukup sampel untuk menilai.' };
  const total = valid + invalid;
  const badRatio = total > 0 ? invalid / total : 0;
  if (badRatio > 0.2) return { level: 'rendah', note: 'Banyak pembacaan sensor kosong atau tidak valid.' };
  if (rateHz >= 50) return { level: 'baik', note: 'Laju sampling tinggi untuk sensor perangkat.' };
  if (rateHz >= 20) return { level: 'cukup', note: 'Laju sampling sedang; getaran cepat bisa terlewat.' };
  return { level: 'rendah', note: 'Laju sampling rendah; sebagian besar getaran cepat tidak terekam.' };
}
