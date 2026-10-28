'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Activity, Camera, FileText, Image as ImageIcon, Map, Mountain, Radio, Send, Waves, Bell } from 'lucide-react';

const TABS = [
  { href: '/gunung-berapi', label: 'Ringkasan', icon: Activity },
  { href: '/gunung-berapi/peta', label: 'Peta', icon: Map },
  { href: '/gunung-berapi/status', label: 'Status Aktivitas', icon: Mountain },
  { href: '/gunung-berapi/laporan-harian', label: 'Laporan Harian', icon: FileText },
  { href: '/gunung-berapi/laporan', label: 'Laporan Aktivitas', icon: FileText },
  { href: '/gunung-berapi/erupsi', label: 'Riwayat Erupsi', icon: Waves },
  { href: '/gunung-berapi/cctv', label: 'CCTV', icon: Camera },
  { href: '/gunung-berapi/seismogram', label: 'Live Seismogram', icon: Radio },
  { href: '/gunung-berapi/krb', label: 'Peta KRB', icon: Map },
  { href: '/gunung-berapi/gallery', label: 'Gallery', icon: ImageIcon },
  { href: '/gunung-berapi/vona', label: 'VONA', icon: Send },
  { href: '/gunung-berapi/notifikasi', label: 'Notifikasi', icon: Bell },
];

/** Navigasi tab antarfitur Gunung Berapi (dapat digulir horizontal di ponsel). */
export function VolcanoTabs() {
  const pathname = usePathname();
  return (
    <div className="-mx-1 mb-4 overflow-x-auto">
      <nav aria-label="Menu gunung berapi" className="flex min-w-max gap-1 px-1 pb-1">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = href === '/gunung-berapi' ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
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
      </nav>
    </div>
  );
}
