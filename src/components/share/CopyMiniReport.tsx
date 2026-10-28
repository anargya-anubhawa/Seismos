'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { copyText } from './ShareActions';

/**
 * Tombol salin ringkas untuk dipakai di dalam baris tabel atau kartu daftar.
 * Bila penyalinan otomatis gagal, pengguna diberi tahu agar dapat menyalin
 * dari halaman detail — tombol tidak pernah "diam" tanpa umpan balik.
 */
export function CopyMiniReport({ text, label }: { text: string; label: string }) {
  const [state, setState] = useState<'idle' | 'ok' | 'fail'>('idle');

  return (
    <button
      type="button"
      onClick={async () => setState((await copyText(text)) ? 'ok' : 'fail')}
      aria-label={label}
      title={state === 'fail' ? 'Tidak dapat menyalin. Buka halaman detail lalu salin laporan.' : label}
      className="inline-flex shrink-0 items-center gap-1 rounded border border-line px-1.5 py-0.5 text-[11px] font-medium text-muted hover:bg-line/40 hover:text-ink"
    >
      {state === 'ok'
        ? <Check size={11} aria-hidden className="text-ok" />
        : <Copy size={11} aria-hidden className={state === 'fail' ? 'text-danger' : ''} />}
      <span className="sr-only" role="status" aria-live="polite">
        {state === 'ok' ? 'Laporan disalin.' : state === 'fail' ? 'Gagal menyalin.' : ''}
      </span>
      {state === 'ok' ? 'Tersalin' : state === 'fail' ? 'Gagal' : 'Salin'}
    </button>
  );
}
