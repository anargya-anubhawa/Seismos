'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import {
  Activity, BarChart3, History, Info, LayoutDashboard, Map, Menu, Moon, Mountain, RefreshCw,
  Search, Settings, Sun, X,
} from 'lucide-react';
import { useEarthquakes } from '@/hooks/useEarthquakes';
import { fmtClock } from '@/lib/formatting';
import { applyTheme, getThemePreference, THEME_CHANGE_EVENT } from '@/lib/theme';
import { NotificationToggle } from '@/components/notifications/NotificationSettings';
import { BrandMark } from '@/components/ui/common';

const NAV = [
  { href: '/', label: 'Dashboard', short: 'Beranda', icon: LayoutDashboard },
  { href: '/map', label: 'Peta Gempa', short: 'Peta', icon: Map },
  { href: '/history', label: 'Riwayat Gempa', short: 'Riwayat', icon: History },
  { href: '/volcano-seismogram', label: 'Seismogram Gunung Api', short: 'Gunung', icon: Mountain },
  { href: '/seismograph', label: 'Seismograf Perangkat', short: 'Sensor', icon: Activity },
  { href: '/statistics', label: 'Statistik Seismik', short: 'Statistik', icon: BarChart3 },
  { href: '/settings', label: 'Pengaturan', short: 'Setelan', icon: Settings },
  { href: '/about', label: 'Tentang Seismos Indonesia', short: 'Tentang', icon: Info },
];

const PRIMARY = NAV.slice(0, 5);
const SECONDARY = NAV.slice(5);

function ConnectionStatus() {
  const { data, error, loading, refresh } = useEarthquakes();
  let tone = 'text-ok';
  let label = 'Terhubung ke BMKG';
  if (loading && !data) { tone = 'text-muted'; label = 'Menghubungkan…'; }
  else if (!data) { tone = 'text-danger'; label = 'Gagal terhubung'; }
  else if (error) { tone = 'text-danger'; label = 'Pembaruan gagal, memakai data terakhir'; }
  else if (data.sources.some((s) => s.error || s.stale)) { tone = 'text-danger'; label = 'Sebagian sumber tertunda'; }

  return (
    <div className="flex items-center gap-2 text-sm" role="status" aria-live="polite">
      <span className={`inline-flex items-center gap-1.5 font-medium ${tone}`}>
        <span aria-hidden className="h-2 w-2 rounded-full bg-current" />
        <span className="hidden max-w-[11rem] truncate sm:inline">{label}</span>
        <span className="sr-only">{label}</span>
      </span>
      {data?.updatedAt && (
        <span className="hidden text-muted lg:inline">Diambil {fmtClock(data.updatedAt)}</span>
      )}
      <button onClick={refresh} aria-label="Muat ulang data" className="rounded p-1.5 text-muted hover:bg-line/50 hover:text-ink">
        <RefreshCw size={16} />
      </button>
    </div>
  );
}

function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const sync = () => setDark(document.documentElement.classList.contains('dark'));
    sync();
    window.addEventListener(THEME_CHANGE_EVENT, sync);
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onSystemChange = () => {
      if (getThemePreference() === 'system') applyTheme('system');
    };
    media.addEventListener('change', onSystemChange);
    return () => {
      window.removeEventListener(THEME_CHANGE_EVENT, sync);
      media.removeEventListener('change', onSystemChange);
    };
  }, []);

  const toggle = () => {
    const next = dark ? 'light' : 'dark';
    applyTheme(next);
    setDark(next === 'dark');
  };

  return (
    <button onClick={toggle} aria-label={dark ? 'Beralih ke tema terang' : 'Beralih ke tema gelap'} className="rounded p-2 text-muted hover:bg-line/50 hover:text-ink">
      {dark ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}

function SearchBox() {
  const router = useRouter();
  const [q, setQ] = useState('');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    router.push(q.trim() ? `/history?q=${encodeURIComponent(q.trim())}` : '/history');
  };
  return (
    <form onSubmit={submit} role="search" className="relative hidden md:block">
      <Search size={16} aria-hidden className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        aria-label="Cari lokasi gempa"
        placeholder="Cari lokasi…"
        className="w-52 rounded-md border border-line bg-surface py-1.5 pl-8 pr-2 text-sm"
      />
    </form>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));
  const secondaryActive = SECONDARY.some((n) => isActive(n.href));

  useEffect(() => { setMoreOpen(false); }, [pathname]);

  useEffect(() => {
    if (!moreOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMoreOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [moreOpen]);

  return (
    <div className="min-h-screen md:pl-56">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-56 flex-col border-r border-line bg-surface md:flex">
        <Link href="/" className="flex items-center gap-2.5 px-4 py-4">
          <BrandMark size={28} className="shrink-0" />
          <span className="text-base font-semibold leading-tight">Seismos<br />Indonesia</span>
        </Link>
        <nav aria-label="Menu utama" className="flex-1 overflow-y-auto px-2 py-2">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              aria-current={isActive(href) ? 'page' : undefined}
              className={`mb-0.5 flex items-center gap-2.5 rounded-md px-3 py-2 text-sm ${
                isActive(href) ? 'bg-accent/15 font-semibold text-ink' : 'text-muted hover:bg-line/40 hover:text-ink'
              }`}
            >
              <Icon size={18} aria-hidden />
              {label}
            </Link>
          ))}
        </nav>
        <p className="px-4 pb-4 text-xs leading-relaxed text-muted">
          Bukan sistem peringatan dini resmi. Untuk informasi resmi, rujuk BMKG dan PVMBG.
        </p>
      </aside>

      <header className="sticky top-0 z-20 flex items-center justify-between gap-2 border-b border-line bg-surface/95 px-4 py-2.5 backdrop-blur">
        <Link href="/" className="text-base font-semibold md:hidden">Seismos Indonesia</Link>
        <SearchBox />
        <div className="ml-auto flex items-center gap-0.5">
          <ConnectionStatus />
          <NotificationToggle />
          <ThemeToggle />
        </div>
      </header>

      <main className="px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-5 md:px-6 md:pb-8">{children}</main>

      <nav aria-label="Menu utama" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-6 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] md:hidden">
        {PRIMARY.map(({ href, short, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            aria-current={isActive(href) ? 'page' : undefined}
            className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] ${isActive(href) ? 'font-semibold text-accent' : 'text-muted'}`}
          >
            <Icon size={20} aria-hidden />
            {short}
          </Link>
        ))}
        <button
          onClick={() => setMoreOpen((v) => !v)}
          aria-expanded={moreOpen}
          aria-controls="menu-lainnya"
          className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] ${
            secondaryActive || moreOpen ? 'font-semibold text-accent' : 'text-muted'
          }`}
        >
          {moreOpen ? <X size={20} aria-hidden /> : <Menu size={20} aria-hidden />}
          Lainnya
        </button>
      </nav>

      {moreOpen && (
        <div className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] top-0 z-40 md:hidden" role="presentation" onClick={() => setMoreOpen(false)}>
          <div aria-hidden className="absolute inset-0 bg-black/40" />
          <div
            id="menu-lainnya"
            role="dialog"
            aria-modal="true"
            aria-label="Menu lainnya"
            className="absolute inset-x-0 bottom-0 max-h-full overflow-y-auto rounded-t-xl border-t border-line bg-surface p-3 pb-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex items-center justify-between px-1">
              <p className="text-sm font-semibold">Menu lainnya</p>
              <button onClick={() => setMoreOpen(false)} aria-label="Tutup menu" className="rounded p-1.5 text-muted hover:bg-line/50 hover:text-ink">
                <X size={18} aria-hidden />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {SECONDARY.map(({ href, short, label, icon: Icon }, i) => (
                <Link
                  key={href}
                  href={href}
                  autoFocus={i === 0}
                  aria-current={isActive(href) ? 'page' : undefined}
                  onClick={() => setMoreOpen(false)}
                  className={`flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-lg border px-2 text-center text-xs ${
                    isActive(href) ? 'border-accent bg-accent/10 font-semibold' : 'border-line text-muted'
                  }`}
                >
                  <Icon size={21} aria-hidden />
                  {short}
                  <span className="sr-only">— {label}</span>
                </Link>
              ))}
            </div>
            <p className="mt-3 px-1 text-xs text-muted">
              Notifikasi dapat diaktifkan lewat ikon lonceng; pengaturan lengkap ada di menu Pengaturan.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
