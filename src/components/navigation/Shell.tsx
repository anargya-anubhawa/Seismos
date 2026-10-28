'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import {
  Activity, BarChart3, ChevronDown, CloudSun, History, Info, LayoutDashboard, Map, Menu, Moon,
  Mountain, RefreshCw, Satellite, Search, Settings, Sun, TriangleAlert, Waves, X,
} from 'lucide-react';
import { useEarthquakes } from '@/hooks/useEarthquakes';
import { fmtClock } from '@/lib/formatting';
import { applyTheme, getThemePreference, THEME_CHANGE_EVENT } from '@/lib/theme';
import { NotificationToggle } from '@/components/notifications/NotificationSettings';
import { BrandMark } from '@/components/ui/common';

/**
 * Struktur navigasi berkelompok. Setiap kelompok tampil sebagai submenu
 * (accordion) di bilah samping dan sebagai bagian berjudul pada lembar menu
 * ponsel, sehingga daftar menu tetap rapi meski jumlah halaman bertambah.
 */
interface NavItem {
  href: string;
  label: string;
  short: string;
  icon: typeof Map;
  /** Awalan jalur tambahan yang dianggap bagian dari menu ini. */
  also?: string[];
}

interface NavGroup {
  id: string;
  label: string;
  icon: typeof Map;
  items: NavItem[];
}

const GROUP_GEMPA: NavGroup = {
  id: 'gempa',
  label: 'Gempa Bumi',
  icon: Activity,
  items: [
    { href: '/map', label: 'Peta Gempa', short: 'Peta', icon: Map },
    { href: '/history', label: 'Riwayat Gempa', short: 'Riwayat', icon: History },
    { href: '/statistics', label: 'Statistik Seismik', short: 'Statistik', icon: BarChart3 },
    { href: '/seismograph', label: 'Seismograf Perangkat', short: 'Sensor', icon: Activity },
  ],
};

const GROUP_CUACA: NavGroup = {
  id: 'cuaca',
  label: 'Cuaca',
  icon: CloudSun,
  items: [
    { href: '/cuaca', label: 'Prakiraan Cuaca', short: 'Prakiraan', icon: CloudSun },
    { href: '/cuaca/peringatan-dini', label: 'Peringatan Dini Cuaca Ekstrem', short: 'Peringatan', icon: TriangleAlert },
    { href: '/cuaca/satelit', label: 'Citra Satelit', short: 'Satelit', icon: Satellite },
  ],
};

const GROUP_GUNUNG: NavGroup = {
  id: 'gunung',
  label: 'Gunung Berapi',
  icon: Mountain,
  items: [
    {
      href: '/gunung-berapi',
      label: 'Gunung Berapi',
      short: 'Gunung',
      icon: Mountain,
      also: ['/volcano-seismogram'],
    },
  ],
};

const GROUP_LAINNYA: NavGroup = {
  id: 'lainnya',
  label: 'Lainnya',
  icon: Info,
  items: [
    { href: '/settings', label: 'Pengaturan', short: 'Setelan', icon: Settings },
    { href: '/about', label: 'Tentang Seismos Indonesia', short: 'Tentang', icon: Info },
  ],
};

const GROUPS: NavGroup[] = [GROUP_GEMPA, GROUP_CUACA, GROUP_GUNUNG, GROUP_LAINNYA];

/** Empat pintasan bilah bawah ponsel (sisanya lewat tombol "Lainnya"). */
const PRIMARY: NavItem[] = [
  { href: '/', label: 'Dashboard', short: 'Beranda', icon: LayoutDashboard },
  { href: '/map', label: 'Peta Gempa', short: 'Peta', icon: Map },
  { href: '/tsunami', label: 'Peringatan Tsunami', short: 'Tsunami', icon: Waves },
  { href: '/cuaca', label: 'Prakiraan Cuaca', short: 'Cuaca', icon: CloudSun },
  { href: '/gunung-berapi', label: 'Gunung Berapi', short: 'Gunung', icon: Mountain },
];

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

const itemActive = (pathname: string, item: NavItem): boolean => {
  if (item.href === '/cuaca') {
    // Menu prakiraan tidak boleh aktif saat membuka submenu peringatan/satelit.
    return pathname === '/cuaca';
  }
  if (item.href === '/gunung-berapi') {
    return pathname.startsWith('/gunung-berapi') || pathname.startsWith('/volcano-seismogram');
  }
  return pathname.startsWith(item.href) || (item.also ?? []).some((p) => pathname.startsWith(p));
};

const itemInGroupActive = (pathname: string, group: NavGroup): boolean =>
  group.items.some((item) => itemActive(pathname, item));

export function Shell({ children, weatherStrip }: { children: ReactNode; weatherStrip?: ReactNode }) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const isActive = (href: string) =>
    itemActive(pathname, { href, label: '', short: '', icon: Map });
  const secondaryActive = GROUPS.some((group) => itemInGroupActive(pathname, group));

  /** Submenu yang dibuka. Kelompok halaman aktif selalu terbuka. */
  const [openGroups, setOpenGroups] = useState<string[]>(() =>
    GROUPS.filter((group) => itemInGroupActive(pathname, group)).map((group) => group.id));

  // Halaman aktif berpindah (mis. lewat tautan di isi halaman): buka kelompoknya
  // agar pengguna melihat di mana posisinya.
  useEffect(() => {
    const active = GROUPS.filter((group) => itemInGroupActive(pathname, group)).map((group) => group.id);
    setOpenGroups((previous) => {
      const missing = active.filter((id) => !previous.includes(id));
      return missing.length === 0 ? previous : [...previous, ...missing];
    });
  }, [pathname]);

  const toggleGroup = (id: string) =>
    setOpenGroups((previous) => (previous.includes(id) ? previous.filter((value) => value !== id) : [...previous, id]));

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
          <Link
            href="/"
            aria-current={isActive('/') ? 'page' : undefined}
            className={`mb-1 flex items-center gap-2.5 rounded-md px-3 py-2 text-sm ${
              isActive('/') ? 'bg-accent/15 font-semibold text-ink' : 'text-muted hover:bg-line/40 hover:text-ink'
            }`}
          >
            <LayoutDashboard size={18} aria-hidden />
            Dashboard
          </Link>
          <Link
            href="/tsunami"
            aria-current={isActive('/tsunami') ? 'page' : undefined}
            className={`mb-1 flex items-center gap-2.5 rounded-md px-3 py-2 text-sm ${
              isActive('/tsunami') ? 'bg-accent/15 font-semibold text-ink' : 'text-muted hover:bg-line/40 hover:text-ink'
            }`}
          >
            <Waves size={18} aria-hidden />
            Peringatan Tsunami
          </Link>

          {GROUPS.map((group) => {
            const open = openGroups.includes(group.id);
            const active = itemInGroupActive(pathname, group);
            const panelId = `nav-grup-${group.id}`;
            const GroupIcon = group.icon;
            return (
              <div key={group.id} className="mb-0.5">
                <button
                  type="button"
                  onClick={() => toggleGroup(group.id)}
                  aria-expanded={open}
                  aria-controls={panelId}
                  className={`flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm ${
                    active ? 'font-semibold text-ink' : 'text-muted hover:bg-line/40 hover:text-ink'
                  }`}
                >
                  <GroupIcon size={18} aria-hidden />
                  <span className="flex-1 text-left">{group.label}</span>
                  <ChevronDown
                    size={14}
                    aria-hidden
                    className={`text-muted transition-transform ${open ? 'rotate-180' : ''}`}
                  />
                </button>
                {open && (
                  <ul id={panelId} className="mb-1 ml-3 space-y-0.5 border-l border-line pl-2">
                    {group.items.map((item) => {
                      const ItemIcon = item.icon;
                      const current = itemActive(pathname, item);
                      return (
                        <li key={item.href}>
                          <Link
                            href={item.href}
                            aria-current={current ? 'page' : undefined}
                            className={`flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px] ${
                              current ? 'bg-accent/15 font-semibold text-ink' : 'text-muted hover:bg-line/40 hover:text-ink'
                            }`}
                          >
                            <ItemIcon size={15} aria-hidden />
                            <span className="leading-tight">{item.label}</span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
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

      {/* Bar cuaca persisten tepat di bawah header: selalu terlihat tanpa
          menutupi kontrol navigasi di atasnya. */}
      {weatherStrip && (
        <div className="sticky top-[calc(2.75rem+env(safe-area-inset-top))] z-10 backdrop-blur">
          {weatherStrip}
        </div>
      )}

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
              {GROUP_GUNUNG.items.map(({ href, short, label, icon: Icon }, i) => (
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

            {[GROUP_GEMPA, GROUP_CUACA, GROUP_LAINNYA].map((group) => {
              const GroupIcon = group.icon;
              return (
                <section key={group.id} className="mt-3" aria-labelledby={`menu-${group.id}`}>
                  <p id={`menu-${group.id}`} className="mb-1.5 flex items-center gap-1.5 px-1 text-[11px] font-semibold uppercase tracking-wide text-muted">
                    <GroupIcon size={12} aria-hidden />
                    {group.label}
                  </p>
                  <ul className="space-y-0.5">
                    {group.items.map((item) => {
                      const ItemIcon = item.icon;
                      const current = itemActive(pathname, item);
                      return (
                        <li key={item.href}>
                          <Link
                            href={item.href}
                            aria-current={current ? 'page' : undefined}
                            onClick={() => setMoreOpen(false)}
                            className={`flex min-h-10 items-center gap-2.5 rounded-md border px-3 text-sm ${
                              current ? 'border-accent bg-accent/10 font-semibold' : 'border-line text-muted'
                            }`}
                          >
                            <ItemIcon size={16} aria-hidden />
                            {item.label}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            })}

            <p className="mt-3 px-1 text-xs text-muted">
              Notifikasi dapat diaktifkan lewat ikon lonceng; pengaturan lengkap ada di menu Pengaturan.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
