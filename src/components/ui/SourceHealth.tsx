'use client';

import { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { PageTitle, Panel, Skeleton, StateBox } from '@/components/ui/common';
import { fmtAgo, fmtTime } from '@/lib/formatting';

/**
 * Halaman status kesehatan sumber data (OI-04).
 *
 * Menampilkan sumber mana yang berhasil, berapa entri yang terbaca, dan pesan
 * galat bila ada. Tanpa panel admin dan tanpa rahasia: semua yang tampil di sini
 * berasal dari endpoint publik yang juga dipakai halaman lain.
 */

interface HealthSource {
  group: string;
  id: string;
  label: string;
  ok: boolean;
  count: number | null;
  error: string | null;
  checkedAt: string;
}

interface HealthResponse {
  ok: boolean;
  checkedAt: string;
  total: number;
  failedCount: number;
  sources: HealthSource[];
}

export function SourceHealth() {
  const [data, setData] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/health', { cache: 'no-store' });
      if (!response.ok) throw new Error(`Status sumber membalas HTTP ${response.status}`);
      setData((await response.json()) as HealthResponse);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Status sumber tidak dapat dimuat');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const groups = new Map<string, HealthSource[]>();
  for (const source of data?.sources ?? []) {
    const list = groups.get(source.group) ?? [];
    list.push(source);
    groups.set(source.group, list);
  }

  return (
    <div>
      <PageTitle
        title="Status Sumber Data"
        hint="Kesehatan sumber resmi yang dipakai aplikasi: BMKG untuk gempa, tsunami, dan cuaca, serta MAGMA/PVMBG untuk gunung api. Halaman ini hanya membaca; tidak ada data yang diubah."
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted">
          {data
            ? `Diperiksa ${fmtTime(data.checkedAt)} (${fmtAgo(data.checkedAt)})`
            : loading ? 'Memeriksa sumber…' : 'Belum ada pemeriksaan'}
        </p>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded border border-line px-3 py-1.5 text-xs font-medium hover:bg-line/40 disabled:opacity-60"
        >
          <RefreshCw size={13} aria-hidden className={loading ? 'animate-spin' : ''} />
          {loading ? 'Memeriksa…' : 'Periksa ulang'}
        </button>
      </div>

      {error && (
        <StateBox kind="error" title="Status sumber tidak dapat dimuat">
          {error}
        </StateBox>
      )}

      {!error && loading && !data && (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-10 w-full" />)}
        </div>
      )}

      {data && (
        <div className="space-y-4">
          <div
            role="status"
            className={`rounded-lg border p-4 text-sm ${data.ok ? 'border-ok/50 bg-ok/5' : 'border-danger/50 bg-danger/5'}`}
          >
            <p className="font-semibold">
              {data.ok
                ? `Semua ${data.total} sumber merespons normal`
                : `${data.failedCount} dari ${data.total} sumber bermasalah`}
            </p>
            <p className="mt-1 text-muted">
              {data.ok
                ? 'Data yang ditampilkan aplikasi berasal dari sumber yang sedang sehat.'
                : 'Data dari sumber yang gagal mungkin tidak tampil atau memakai hasil terakhir yang berhasil diambil. Rujuk kanal resmi BMKG/PVMBG bila informasi dibutuhkan segera.'}
            </p>
          </div>

          {Array.from(groups.entries()).map(([group, sources]) => (
            <Panel key={group} title={group}>
              <ul className="divide-y divide-line">
                {sources.map((source) => (
                  <li key={source.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
                    <span className="flex items-center gap-2">
                      <span
                        aria-hidden
                        className={`inline-block h-2 w-2 shrink-0 rounded-full ${source.ok ? 'bg-ok' : 'bg-danger'}`}
                      />
                      <span className="font-medium">{source.label}</span>
                      {/* Status diucapkan juga, tidak hanya diwarnai. */}
                      <span className="sr-only">{source.ok ? 'berhasil' : 'gagal'}</span>
                    </span>
                    <span className={`text-xs ${source.ok ? 'text-muted' : 'text-danger'}`}>
                      {source.ok
                        ? `${source.count ?? 0} entri · ${fmtAgo(source.checkedAt)}`
                        : `Gagal: ${source.error ?? 'tanpa keterangan'}`}
                    </span>
                  </li>
                ))}
              </ul>
            </Panel>
          ))}
        </div>
      )}
    </div>
  );
}
