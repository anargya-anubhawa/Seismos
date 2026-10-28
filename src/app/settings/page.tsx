import type { Metadata } from 'next';
import { SettingsContent } from '@/components/settings/SettingsContent';

export const metadata: Metadata = {
  title: 'Pengaturan',
  description: 'Atur izin notifikasi gempa lokal, push tsunami, area provinsi, bunyi alarm, tema, dan data lokal Seismos Indonesia.',
};

export default function SettingsPage() {
  return <SettingsContent />;
}
