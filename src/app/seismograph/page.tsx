'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Download, Pause, Play, RotateCcw, Save, Square, Trash2, Volume2, VolumeX } from 'lucide-react';
import { useDeviceSeismograph, type SensorStatus } from '@/hooks/useDeviceSeismograph';
import { useSeismicAudio } from '@/hooks/useSeismicAudio';
import { RingBuffer } from '@/lib/seismograph/buffer';
import { assessQuality } from '@/lib/seismograph/processing';
import { deleteSession, loadSessions, saveSession, samplesToCsv, type SavedSession } from '@/lib/seismograph/sessions';
import { downloadText } from '@/lib/csv';
import { PageTitle, Panel } from '@/components/ui/common';
import { SignalCanvas } from '@/components/seismograph/SignalCanvas';

const STATUS_TEXT: Record<SensorStatus, string> = {
  idle: 'Siap. Tekan Mulai.',
  requesting: 'Meminta izin sensor…',
  waiting: 'Menunggu data sensor…',
  running: 'Merekam',
  paused: 'Dijeda',
  stopped: 'Berhenti',
  denied: 'Izin sensor ditolak',
  unsupported: 'Browser atau perangkat ini tidak menyediakan sensor gerak',
  insecure: 'Sensor gerak hanya bisa diakses lewat HTTPS',
  nodata: 'Sensor tidak mengirim data (umum di komputer desktop)',
};

const btn = 'flex min-h-11 items-center gap-1.5 rounded-md px-4 text-sm font-medium disabled:opacity-40';
const sel = 'rounded-md border border-line bg-surface px-2.5 py-2 text-sm';

function makeDemo(): RingBuffer {
  // Sinyal sintetis deterministik. Hanya untuk memperlihatkan bentuk grafik.
  const b = new RingBuffer(4000);
  for (let i = 0; i < 3000; i++) {
    const t = i * 10;
    const s = t / 1000;
    const burst = s > 12 && s < 18 ? Math.exp(-(s - 12) / 2) : 0;
    b.push(t,
      0.05 * Math.sin(s * 37) + burst * 1.2 * Math.sin(2 * Math.PI * 6 * s),
      0.05 * Math.sin(s * 53 + 1) + burst * 0.8 * Math.sin(2 * Math.PI * 5 * s + 1),
      0.05 * Math.sin(s * 29 + 2) + burst * 0.6 * Math.sin(2 * Math.PI * 7 * s + 2));
  }
  return b;
}

export default function SeismographPage() {
  const sensor = useDeviceSeismograph();
  const { status, stats } = sensor;
  const [windowSec, setWindowSec] = useState(10);
  const [scale, setScale] = useState<'auto' | number>('auto');
  const [demo, setDemo] = useState(false);
  const demoBuf = useRef<RingBuffer | null>(null);
  const [saved, setSaved] = useState<SavedSession[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => setSaved(loadSessions()), []);

  const active = status === 'waiting' || status === 'running' || status === 'nodata';
  const blocked = status === 'unsupported' || status === 'insecure' || status === 'denied' || status === 'nodata';
  const hasData = stats.valid > 0;
  const buffer = useMemo(() => {
    if (demo) { demoBuf.current ??= makeDemo(); return demoBuf.current; }
    return sensor.live.current;
  }, [demo, sensor.live]);
  const audio = useSeismicAudio({ buffer, active: active && !demo });
  const quality = assessQuality(stats.rateHz, stats.valid, stats.invalid);
  const elapsed = (stats.elapsedMs / 1000).toFixed(1);

  const exportCsv = () => {
    const s = sensor.snapshot();
    downloadText(`seismos-sensor-${s.startedAt.slice(0, 19).replace(/[:T]/g, '-')}.csv`, samplesToCsv(s.data));
  };
  const save = () => {
    const r = saveSession(sensor.snapshot());
    if (r.ok) { setSaved(loadSessions()); setMsg(r.session.decimated ? 'Sesi disimpan di perangkat ini (dikurangi sampelnya agar muat). Ekspor CSV menyimpan data penuh.' : 'Sesi disimpan di perangkat ini.'); }
    else setMsg(r.error);
  };

  return (
    <>
      <PageTitle title="Seismograf Perangkat" hint="Merekam getaran lokal dari sensor gerak perangkat. Data diproses di perangkat dan tidak dikirim ke server." />

      <div role="note" className="mb-4 rounded-lg border border-line bg-surface px-4 py-3 text-sm">
        <p className="font-semibold">Batasan penting</p>
        <ul className="mt-1 list-disc space-y-0.5 pl-5 text-muted">
          <li>Sensor ponsel bukan seismometer profesional dan tidak dapat menggantikannya.</li>
          <li>Hasil sangat dipengaruhi orientasi, penempatan, dan gerakan perangkat atau penggunanya (mengetuk meja, berjalan, getaran kendaraan).</li>
          <li>Data ini tidak dipakai untuk peringatan gempa dan tidak dapat menentukan magnitudo. Untuk informasi resmi, lihat BMKG.</li>
          <li>Suara sensor hanyalah umpan balik audio dari grafik; bukan alarm gempa dan tidak menentukan kekuatan gempa.</li>
          <li>Letakkan perangkat diam di permukaan rata sebelum mulai agar pembacaan lebih bermakna.</li>
        </ul>
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Kontrol pengukuran">
        <button className={`${btn} bg-accent text-accent-ink`} disabled={active || status === 'paused' || status === 'requesting' || status === 'unsupported' || status === 'insecure'} onClick={() => { setDemo(false); audio.unlock(); sensor.start(); }}>
          <Play size={16} aria-hidden /> Mulai
        </button>
        <button className={`${btn} border border-line`} disabled={!active} onClick={sensor.pause}><Pause size={16} aria-hidden /> Jeda</button>
        <button className={`${btn} border border-line`} disabled={status !== 'paused'} onClick={() => { audio.unlock(); sensor.resume(); }}><Play size={16} aria-hidden /> Lanjutkan</button>
        <button className={`${btn} border border-line`} disabled={!active && status !== 'paused'} onClick={sensor.stop}><Square size={16} aria-hidden /> Berhenti</button>
        <button className={`${btn} border border-line`} disabled={active} onClick={() => { setDemo(false); sensor.reset(); setMsg(null); }}><RotateCcw size={16} aria-hidden /> Reset grafik</button>
        <button
          type="button"
          className={`${btn} border border-line`}
          onClick={() => audio.setEnabled(!audio.enabled)}
          aria-pressed={audio.enabled}
          disabled={!audio.supported}
          title={audio.supported ? 'Nyalakan atau matikan suara sensor' : 'Browser tidak mendukung audio'}
        >
          {audio.enabled ? <Volume2 size={16} aria-hidden /> : <VolumeX size={16} aria-hidden />}
          Suara sensor {audio.enabled ? 'aktif' : 'nonaktif'}
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <label className="flex items-center gap-2">
          <span className="text-muted">Volume suara sensor</span>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={audio.volume}
            disabled={!audio.supported || !audio.enabled}
            onChange={(e) => audio.setVolume(Number(e.target.value))}
            className="w-36 accent-accent disabled:opacity-50"
          />
          <span className="w-9 text-xs text-muted">{audio.volume}%</span>
        </label>
        <p className="text-xs text-muted">
          Bunyi mengikuti amplitudo: makin kuat getaran, makin cepat dan keras. Suara hanya saat sensor langsung aktif,
          bukan alarm gempa.
        </p>
        {!audio.supported && <p className="text-xs text-danger">Browser ini tidak mendukung audio Web.</p>}
      </div>

      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="text-sm"><span className="mb-1 block text-muted">Rentang waktu grafik</span>
          <select className={sel} value={windowSec} onChange={(e) => setWindowSec(Number(e.target.value))}>
            {[5, 10, 30, 60].map((s) => <option key={s} value={s}>{s} detik</option>)}
          </select></label>
        <label className="text-sm"><span className="mb-1 block text-muted">Skala vertikal</span>
          <select className={sel} value={String(scale)} onChange={(e) => setScale(e.target.value === 'auto' ? 'auto' : Number(e.target.value))}>
            <option value="auto">Otomatis</option>
            {[0.1, 0.5, 1, 2, 5, 10].map((s) => <option key={s} value={s}>± {s} m/s²</option>)}
          </select></label>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Panel title={demo ? 'Percepatan sumbu X, Y, Z (DATA DEMO)' : 'Percepatan sumbu X, Y, Z'}>
            <SignalCanvas buffer={buffer} windowSec={windowSec} scale={scale} mode="xyz" title="Percepatan sumbu X, Y, Z" demo={demo} />
          </Panel>
          <Panel title={demo ? 'Resultan percepatan (DATA DEMO)' : 'Resultan percepatan'}>
            <SignalCanvas buffer={buffer} windowSec={windowSec} scale={scale} mode="resultant" title="Resultan percepatan" demo={demo} />
            <p className="px-4 pb-3 text-xs text-muted">Resultan = √(x² + y² + z²) dari percepatan linier (gravitasi sudah dikurangkan), dalam m/s².</p>
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel title="Status sensor">
            <dl className="px-4 py-3 text-sm" aria-live="polite">
              {([
                ['Status', demo ? 'Menampilkan DATA DEMO' : STATUS_TEXT[status]],
                ['Izin sensor', sensor.permission],
                ['Waktu pengukuran', `${elapsed} detik`],
                ['Laju sampling terukur', stats.rateHz ? `${stats.rateHz.toFixed(1)} Hz` : '—'],
                ['Sampel valid / tidak valid', `${stats.valid} / ${stats.invalid}`],
                ['Kualitas (indikatif)', `${quality.level}. ${quality.note}`],
              ] as const).map(([k, v]) => (
                <div key={k} className="flex gap-3 border-b border-line py-1.5 last:border-0">
                  <dt className="w-32 shrink-0 text-muted">{k}</dt><dd>{v}</dd>
                </div>
              ))}
            </dl>
            <p className="border-t border-line px-4 py-2.5 text-xs text-muted">
              Metode: {stats.method}. {stats.truncated && 'Batas rekaman (60.000 sampel) tercapai; sampel berikutnya hanya tampil di grafik, tidak direkam.'}
            </p>
          </Panel>

          {blocked && (
            <Panel title="Panduan kompatibilitas">
              <div className="space-y-2 px-4 py-3 text-sm">
                <p>Sensor gerak biasanya tersedia di ponsel dan tablet. Komputer desktop umumnya tidak memilikinya.</p>
                <ul className="list-disc space-y-1 pl-5 text-muted">
                  <li>Buka halaman ini lewat HTTPS (atau localhost).</li>
                  <li>iPhone/iPad: izinkan “Gerak &amp; Orientasi” saat diminta. Jika sudah menolak, tutup dan buka ulang Safari.</li>
                  <li>Android/Chrome: periksa Pengaturan situs → Sensor gerak.</li>
                </ul>
                <button className={`${btn} border border-line`} onClick={() => setDemo((d) => !d)}>
                  {demo ? 'Sembunyikan DATA DEMO' : 'Lihat contoh grafik (DATA DEMO)'}
                </button>
                <p className="text-xs text-muted">Contoh grafik adalah sinyal sintetis untuk memperlihatkan tampilan. Bukan pengukuran dan tidak dapat diekspor.</p>
              </div>
            </Panel>
          )}

          <Panel title="Simpan dan ekspor">
            <div className="flex flex-wrap gap-2 px-4 py-3">
              <button className={`${btn} bg-accent text-accent-ink`} disabled={!hasData || active} onClick={exportCsv}><Download size={16} aria-hidden /> Ekspor CSV</button>
              <button className={`${btn} border border-line`} disabled={!hasData || active} onClick={save}><Save size={16} aria-hidden /> Simpan sesi</button>
            </div>
            <p className="px-4 pb-2 text-xs text-muted">Hentikan atau jeda pengukuran dulu. Hingga 5 sesi disimpan di browser ini saja.</p>
            {msg && <p role="status" className="px-4 pb-3 text-sm">{msg}</p>}
            {saved.length > 0 && (
              <ul className="border-t border-line">
                {saved.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-2 border-b border-line px-4 py-2.5 text-sm last:border-0">
                    <span>
                      {new Date(s.startedAt).toLocaleString('id-ID')}
                      <span className="block text-xs text-muted">{(s.durationMs / 1000).toFixed(0)} dtk · {s.samples} sampel{s.rateHz ? ` · ${s.rateHz.toFixed(0)} Hz` : ''}</span>
                    </span>
                    <span className="flex gap-1">
                      <button aria-label="Ekspor sesi ke CSV" className="rounded p-2 hover:bg-line/40" onClick={() => downloadText(`seismos-sesi-${s.id}.csv`, samplesToCsv(s.data))}><Download size={16} /></button>
                      <button aria-label="Hapus sesi" className="rounded p-2 hover:bg-line/40" onClick={() => { deleteSession(s.id); setSaved(loadSessions()); }}><Trash2 size={16} /></button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
