'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ExternalLink, Info, Monitor, Moon, ShieldCheck, Sun, Trash2 } from 'lucide-react';
import { NotificationSettings } from '@/components/notifications/NotificationSettings';
import { TsunamiPushSettings } from '@/components/tsunami/TsunamiPushSettings';
import { VolcanoPushSettings } from '@/components/volcano/VolcanoPushSettings';
import { PageTitle, Panel } from '@/components/ui/common';
import { applyTheme, getThemePreference, THEME_CHANGE_EVENT, type ThemePreference } from '@/lib/theme';
import { clearSessions, loadSessions, MAX_SESSIONS } from '@/lib/seismograph/sessions';

const THEME_OPTIONS: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: 'system', label: 'Ikuti sistem', icon: Monitor },
  { value: 'light', label: 'Terang', icon: Sun },
  { value: 'dark', label: 'Gelap', icon: Moon },
];

export function SettingsContent() {
  const [theme, setTheme] = useState<ThemePreference>('system');
  const [sensorCount, setSensorCount] = useState<number | null>(null);

  useEffect(() => {
    const syncTheme = () => setTheme(getThemePreference());
    syncTheme();
    setSensorCount(loadSessions().length);
    window.addEventListener(THEME_CHANGE_EVENT, syncTheme);
    return () => window.removeEventListener(THEME_CHANGE_EVENT, syncTheme);
  }, []);

  const chooseTheme = (next: ThemePreference) => {
    setTheme(next);
    applyTheme(next);
  };

  const removeSessions = () => {
    if (!sensorCount) return;
    if (!window.confirm('Hapus semua sesi sensor yang tersimpan di browser ini? Tindakan ini tidak dapat dibatalkan.')) return;
    clearSessions();
    setSensorCount(0);
  };

  return (
    <>
      <PageTitle
        title="Pengaturan"
        hint="Atur notifikasi gempa lokal, push tsunami, push gunung api, alarm, tampilan, dan data lokal di browser ini. Setelan tidak disinkronkan antarperangkat."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <Panel title="Notifikasi & alarm gempa">
            <div className="px-4 py-3">
              <NotificationSettings />
            </div>
          </Panel>

          <Panel title="Notifikasi tsunami (push)">
            <div className="px-4 py-3">
              <TsunamiPushSettings />
            </div>
          </Panel>

          <Panel title="Notifikasi gunung api (push)">
            <div className="px-4 py-3">
              <VolcanoPushSettings />
            </div>
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel title="Tampilan">
            <div className="space-y-3 px-4 py-3 text-sm">
              <div role="group" aria-label="Tema tampilan" className="grid gap-2 sm:grid-cols-3">
                {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={theme === value}
                    onClick={() => chooseTheme(value)}
                    className={`flex min-h-10 items-center justify-center gap-2 rounded-md border px-3 text-sm ${
                      theme === value
                        ? 'border-accent bg-accent/10 font-semibold text-ink'
                        : 'border-line text-muted hover:bg-line/40 hover:text-ink'
                    }`}
                  >
                    <Icon size={16} aria-hidden />
                    {label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted">
                “Ikuti sistem” mengikuti tema perangkat. Pilihan tema disimpan di browser ini.
              </p>
            </div>
          </Panel>

          <Panel title="Data lokal">
            <div className="space-y-3 px-4 py-3 text-sm">
              <p className="text-muted">
                Sesi sensor tersimpan: <strong className="text-ink">
                  {sensorCount === null ? 'memeriksa…' : `${sensorCount} dari ${MAX_SESSIONS}`}
                </strong>.
              </p>
              <p className="text-xs text-muted">
                Sesi sensor berisi sampel gerakan perangkat dan tidak diunggah ke server. Setelan notifikasi dan tema
                juga disimpan di browser ini, bukan di akun.
              </p>
              <button
                type="button"
                onClick={removeSessions}
                disabled={!sensorCount}
                className="flex min-h-10 items-center gap-1.5 rounded-md border border-line px-3 text-sm font-medium disabled:opacity-40"
              >
                <Trash2 size={15} aria-hidden /> Hapus semua sesi sensor
              </button>
            </div>
          </Panel>
        </div>
      </div>

      <Panel title="Bantuan & informasi" className="mt-4">
        <ul className="divide-y divide-line text-sm">
          <li className="px-4 py-3">
            <Link href="/mitigasi" className="inline-flex items-center gap-1.5 font-medium text-accent underline">
              <ShieldCheck size={15} aria-hidden /> Mitigasi & kesiapsiagaan
            </Link>
            <p className="mt-1 text-xs text-muted">Panduan sebelum, saat, dan setelah gempa, serta tautan resmi BMKG.</p>
          </li>
          <li className="px-4 py-3">
            <Link href="/about" className="inline-flex items-center gap-1.5 font-medium text-accent underline">
              <Info size={15} aria-hidden /> Tentang Seismos Indonesia
            </Link>
            <p className="mt-1 text-xs text-muted">Sumber data, batasan, perilaku privasi, dan informasi versi.</p>
          </li>
          <li className="px-4 py-3">
            <a
              href="https://www.bmkg.go.id/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 font-medium text-accent underline"
            >
              Kanal resmi BMKG <ExternalLink size={13} aria-hidden />
            </a>
            <p className="mt-1 text-xs text-muted">Untuk informasi gempa dan peringatan resmi terbaru.</p>
          </li>
        </ul>
      </Panel>

      <p className="mt-4 text-xs text-muted">
        Pengaturan ini bukan pengganti sistem peringatan dini resmi. Selalu ikuti instruksi BMKG, BNPB, dan pemerintah daerah.
      </p>
    </>
  );
}
