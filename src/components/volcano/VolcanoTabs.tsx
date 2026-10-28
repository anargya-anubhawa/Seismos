'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Activity, Camera, FileText, MapPin, Radio, Waves } from 'lucide-react';

/**
 * Navigasi konteks satu gunung api.
 *
 * Empat halaman yang dulu berdiri sendiri di menu utama — Status Aktivitas,
 * Laporan Aktivitas, Laporan Harian, Riwayat Erupsi — kini hidup di dalam
 * halaman gunung api masing-masing (`/gunung-berapi/<kode>/status` dan
 * seterusnya) supaya menu utama tidak padat. Halaman global lamanya tetap ada
 * bila dibuka lewat tautan langsung, hanya tidak ditampilkan di menu.
 */
const TABS = [
  { slug: '', label: 'Ringkasan', icon: Activity },
  { slug: 'peta', label: 'Peta', icon: MapPin },
  { slug: 'status', label: 'Status Aktivitas', icon: Activity },
  { slug: 'laporan', label: 'Laporan Aktivitas', icon: FileText },
  { slug: 'laporan-harian', label: 'Laporan Harian', icon: FileText },
  { slug: 'erupsi', label: 'Riwayat Erupsi', icon: Waves },
  { slug: 'cctv', label: 'CCTV', icon: Camera },
  { slug: 'seismogram', label: 'Seismogram', icon: Radio },
  { slug: 'krb', label: 'Peta KRB', icon: MapPin },
] as const;

/** Empat bagian yang ditonjolkan tepat di bawah nama gunung api. */
const HIGHLIGHTED = new Set(['status', 'laporan', 'laporan-harian', 'erupsi']);

/** Tampilkan tab bila berada di konteks satu gunung api. */
export function VolcanoTabs({ code }: { code?: string }) {
  const pathname = usePathname();
  const base = `/gunung-berapi/${(code ?? '').toLowerCase()}`;
  if (!code) return null;
  const hrefOf = (slug: string) => (slug ? `${base}/${slug}` : base);

  // Di halaman ringkasan gunung, yang ditonjolkan hanya empat bagian inti;
  // di subhalaman lain seluruh tab tampil agar pengguna bisa berpindah bebas.
  const onRoot = pathname === base;
  const tabs = onRoot ? TABS.filter((tab) => HIGHLIGHTED.has(tab.slug)) : TABS;

  return (
    <div className="-mx-1 mb-4 overflow-x-auto">
      <nav aria-label={`Menu Gunung ${code.toUpperCase()}`} className="flex min-w-max gap-1 px-1 pb-1">
        {tabs.map(({ slug, label, icon: Icon }) => {
          const href = hrefOf(slug);
          const active = pathname === href;
          return (
            <Link
              key={slug || 'ringkasan'}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={`flex min-h-9 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium ${
                active ? 'border-accent bg-accent/10 text-ink' : 'border-line text-muted hover:bg-line/40 hover:text-ink'
              }`}
            >
              <Icon size={14} aria-hidden /> {label}
            </Link>
          );
        })}
        {onRoot && (
          <Link
            href={`${base}/cctv`}
            className="flex min-h-9 items-center gap-1.5 rounded-md border border-line px-2.5 text-xs font-medium text-muted hover:bg-line/40 hover:text-ink"
          >
            <Camera size={14} aria-hidden /> CCTV &amp; lainnya
          </Link>
        )}
      </nav>
    </div>
  );
}
