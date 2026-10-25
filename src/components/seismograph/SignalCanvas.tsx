'use client';

import { useEffect, useRef } from 'react';
import type { RingBuffer } from '@/lib/seismograph/buffer';

interface Props {
  buffer: RingBuffer;
  windowSec: number;
  /** m/s² (simetris untuk X/Y/Z, 0..skala untuk resultan) atau 'auto' */
  scale: number | 'auto';
  mode: 'xyz' | 'resultant';
  title: string;
  demo?: boolean;
}

type DrawProps = Pick<Props, 'buffer' | 'windowSec' | 'scale' | 'mode' | 'demo'>;

const AXES = [
  { label: 'X', color: '#E8833A', dash: [] as number[], get: (b: RingBuffer, i: number) => b.x(i) },
  { label: 'Y', color: '#5FA8D3', dash: [6, 3], get: (b: RingBuffer, i: number) => b.y(i) },
  { label: 'Z', color: '#8FBF6A', dash: [2, 3], get: (b: RingBuffer, i: number) => b.z(i) },
];

const cssRgb = (el: Element, name: string, fallback: string) => {
  const v = getComputedStyle(el).getPropertyValue(`--${name}`).trim();
  return v ? `rgb(${v})` : fallback;
};

const fmt = (v: number) => v.toLocaleString('id-ID', { maximumFractionDigits: 2 });

function draw(ctx: CanvasRenderingContext2D, w: number, h: number, p: DrawProps, el: Element) {
  const ink = cssRgb(el, 'ink', '#111');
  const muted = cssRgb(el, 'muted', '#667');
  const line = cssRgb(el, 'line', '#ccd');
  const accent = cssRgb(el, 'accent', '#36c');
  const L = 54, R = 10, T = 22, B = 30;
  const pw = Math.max(10, w - L - R);
  const ph = Math.max(10, h - T - B);
  const buf = p.buffer;

  ctx.clearRect(0, 0, w, h);
  ctx.font = '12px system-ui, sans-serif';

  const winMs = p.windowSec * 1000;
  const tEnd = buf.lastT;
  const tMin = tEnd - winMs;
  const i0 = buf.size > 0 ? buf.firstIndexAtOrAfter(tMin) : 0;
  const n = buf.size - i0;
  const stride = Math.max(1, Math.floor(n / (pw * 2)));

  const value = (i: number) => (p.mode === 'resultant' ? Math.hypot(buf.x(i), buf.y(i), buf.z(i)) : 0);

  let s: number;
  if (p.scale === 'auto') {
    let m = 0;
    for (let i = i0; i < buf.size; i += stride) {
      m = p.mode === 'resultant' ? Math.max(m, value(i)) : Math.max(m, Math.abs(buf.x(i)), Math.abs(buf.y(i)), Math.abs(buf.z(i)));
    }
    s = Math.max(0.1, m * 1.15);
  } else {
    s = p.scale;
  }
  const yMin = p.mode === 'resultant' ? 0 : -s;
  const yMax = s;
  const px = (t: number) => L + ((t - tMin) / winMs) * pw;
  const py = (v: number) => T + (1 - (v - yMin) / (yMax - yMin)) * ph;

  // grid + sumbu
  ctx.lineWidth = 1;
  ctx.strokeStyle = line;
  ctx.fillStyle = muted;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (let k = 0; k <= 4; k++) {
    const v = yMin + ((yMax - yMin) * k) / 4;
    const y = py(v);
    ctx.beginPath(); ctx.moveTo(L, y); ctx.lineTo(L + pw, y); ctx.stroke();
    ctx.fillText(fmt(v), L - 6, y);
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (let k = 0; k <= 5; k++) {
    const x = L + (pw * k) / 5;
    ctx.beginPath(); ctx.moveTo(x, T); ctx.lineTo(x, T + ph); ctx.stroke();
    ctx.fillText(`${fmt(-p.windowSec + (p.windowSec * k) / 5)}`, x, T + ph + 4);
  }
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('m/s²', 4, 14);
  ctx.textAlign = 'right';
  ctx.fillText('waktu (detik, 0 = sampel terakhir)', w - R, h - 2);

  if (buf.size === 0) {
    ctx.fillStyle = muted;
    ctx.textAlign = 'center';
    ctx.fillText('Belum ada data sensor', L + pw / 2, T + ph / 2);
  } else {
    ctx.save();
    ctx.beginPath();
    ctx.rect(L, T, pw, ph);
    ctx.clip();
    const series = p.mode === 'resultant'
      ? [{ label: 'Resultan', color: accent, dash: [] as number[], get: (_b: RingBuffer, i: number) => value(i) }]
      : AXES;
    for (const a of series) {
      ctx.beginPath();
      ctx.strokeStyle = a.color;
      ctx.lineWidth = 1.5;
      ctx.setLineDash(a.dash);
      let first = true;
      for (let i = i0; i < buf.size; i += stride) {
        const x = px(buf.t(i));
        const y = py(a.get(buf, i));
        if (first) { ctx.moveTo(x, y); first = false; } else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.restore();
    ctx.setLineDash([]);

    // legenda (warna + pola garis + huruf)
    let lx = L + 8;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    for (const a of series) {
      ctx.strokeStyle = a.color;
      ctx.lineWidth = 2;
      ctx.setLineDash(a.dash);
      ctx.beginPath(); ctx.moveTo(lx, 11); ctx.lineTo(lx + 18, 11); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = ink;
      ctx.fillText(a.label, lx + 22, 11);
      lx += 22 + ctx.measureText(a.label).width + 14;
    }
  }

  if (p.demo) {
    const msg = 'DATA DEMO — bukan pengukuran';
    ctx.font = 'bold 13px system-ui, sans-serif';
    const tw = ctx.measureText(msg).width + 16;
    ctx.fillStyle = '#D1495B';
    ctx.fillRect(L + pw - tw - 6, T + 6, tw, 24);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(msg, L + pw - tw / 2 - 6, T + 18);
  }
}

export function SignalCanvas({ buffer, windowSec, scale, mode, title, demo }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const props = useRef<DrawProps>({ buffer, windowSec, scale, mode, demo });
  props.current = { buffer, windowSec, scale, mode, demo };

  useEffect(() => {
    const c = ref.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx) return;
    let raf = 0;
    let lastKey = '';
    let w = 0;
    let h = 0;
    const ro = new ResizeObserver(() => {
      const r = c.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      w = r.width;
      h = r.height;
      c.width = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      lastKey = '';
    });
    ro.observe(c);
    // Menggambar ulang hanya bila data/parameter/ukuran/tema berubah, bukan tiap frame.
    const loop = () => {
      const p = props.current;
      const key = `${p.buffer.id}|${p.buffer.version}|${p.windowSec}|${p.scale}|${p.mode}|${w}x${h}|${document.documentElement.className}|${p.demo ? 1 : 0}`;
      if (key !== lastKey && w > 0) {
        lastKey = key;
        draw(ctx, w, h, p, c);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={ref}
      role="img"
      aria-label={`${title}. Grafik garis percepatan terhadap waktu; nilai numerik ringkas ada di panel status.`}
      className="h-56 w-full"
    />
  );
}
