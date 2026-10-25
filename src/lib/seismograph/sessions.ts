const KEY = 'seismos:sensor-sessions:v1';
export const MAX_SESSIONS = 5;
const MAX_SAMPLES = 20_000;

/** `data` = deret datar [t_ms_relatif, x, y, z, t, x, y, z, ...] dalam m/s². */
export interface SavedSession {
  id: string;
  startedAt: string;
  durationMs: number;
  samples: number;
  rateHz: number | null;
  method: string;
  decimated: boolean;
  data: number[];
}

const isSession = (s: unknown): s is SavedSession =>
  !!s && typeof s === 'object' && typeof (s as SavedSession).id === 'string' && Array.isArray((s as SavedSession).data);

export function loadSessions(): SavedSession[] {
  try {
    const raw = localStorage.getItem(KEY);
    const arr: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter(isSession) : [];
  } catch {
    return [];
  }
}

export type SaveInput = Omit<SavedSession, 'id' | 'decimated' | 'samples'>;

export function saveSession(input: SaveInput): { ok: true; session: SavedSession } | { ok: false; error: string } {
  const n = Math.floor(input.data.length / 4);
  const stride = Math.max(1, Math.ceil(n / MAX_SAMPLES));
  const data: number[] = [];
  for (let i = 0; i < n; i += stride) {
    const o = i * 4;
    data.push(
      Math.round(input.data[o] * 10) / 10,
      Math.round(input.data[o + 1] * 1e4) / 1e4,
      Math.round(input.data[o + 2] * 1e4) / 1e4,
      Math.round(input.data[o + 3] * 1e4) / 1e4,
    );
  }
  const session: SavedSession = {
    ...input,
    id: `s${Date.now().toString(36)}`,
    samples: data.length / 4,
    decimated: stride > 1,
    data,
  };
  try {
    const next = [...loadSessions(), session].slice(-MAX_SESSIONS);
    localStorage.setItem(KEY, JSON.stringify(next));
    return { ok: true, session };
  } catch {
    return { ok: false, error: 'Penyimpanan lokal penuh atau dinonaktifkan di browser ini. Gunakan Ekspor CSV.' };
  }
}

export function deleteSession(id: string): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(loadSessions().filter((s) => s.id !== id)));
  } catch { /* abaikan */ }
}

export function clearSessions(): void {
  try { localStorage.removeItem(KEY); } catch { /* abaikan */ }
}

export function samplesToCsv(data: number[]): string {
  const lines = ['waktu_detik,x_m_s2,y_m_s2,z_m_s2,resultan_m_s2'];
  for (let i = 0; i + 3 < data.length; i += 4) {
    const [t, x, y, z] = [data[i], data[i + 1], data[i + 2], data[i + 3]];
    lines.push([(t / 1000).toFixed(3), x.toFixed(4), y.toFixed(4), z.toFixed(4), Math.hypot(x, y, z).toFixed(4)].join(','));
  }
  return lines.join('\r\n');
}
