
'use client';

import { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Phone,
  ShieldCheck,
  Waves,
} from 'lucide-react';
import { MMI_SCALE, mmiColor, mmiTextColor } from '@/lib/felt';
import { NotificationSummary } from '@/components/notifications/NotificationSettings';
import { PageTitle, Panel } from '@/components/ui/common';

const STEPS = [
  {
    title: 'Sebelum gempa',
    icon: ShieldCheck,
    items: [
      'Kenali jalur evakuasi dan titik kumpul yang aman di rumah, sekolah, atau tempat kerja.',
      'Amankan lemari, rak, dan benda berat agar tidak jatuh; letakkan barang berat di bagian bawah.',
      'Siapkan tas siaga: air, makanan ringan, senter, baterai, kotak P3K, obat pribadi, dokumen penting, dan uang tunai.',
      'Latih “Drop, Cover, Hold On”: berlindung di bawah meja kokoh, lindungi kepala, dan berpegangan.',
      'Sepakati cara menghubungi keluarga bila jaringan terganggu. Gunakan pesan singkat, bukan panggilan.',
    ],
  },
  {
    title: 'Saat guncangan',
    icon: AlertTriangle,
    items: [
      'Berlindung di bawah meja atau perabot kokoh; jangan berlari keluar saat guncangan masih berlangsung.',
      'Lindungi kepala dan leher dengan tangan, bantal, atau benda lunak. Jauhi kaca, jendela, dan benda yang mudah jatuh.',
      'Jika berada di luar ruangan, menjauh dari gedung, tiang listrik, pohon besar, dan papan reklame.',
      'Jika sedang berkendara, menepi di tempat terbuka dan berhenti; jangan berhenti di bawah jembatan atau flyover.',
      'Jangan menggunakan lift. Jika terjebak, tetap tenang dan ketuk benda keras untuk memberi tanda.',
    ],
  },
  {
    title: 'Setelah gempa',
    icon: CheckCircle2,
    items: [
      'Periksa diri dan orang di sekitar. Berikan pertolongan pertama bila aman dan Anda terlatih.',
      'Waspadai gempa susulan. Keluar dengan hati-hati, jangan menyalakan api atau listrik bila tercium gas.',
      'Jangan masuk ke bangunan yang retak atau miring sampai dinyatakan aman oleh petugas.',
      'Dengarkan informasi resmi BMKG/BNPB. Jangan menyebarkan foto, video, atau klaim yang belum terverifikasi.',
      'Simpan air dan makanan; bantu tetangga yang rentan, anak-anak, lansia, dan penyandang disabilitas.',
    ],
  },
];

const LINKS = [
  {
    label: 'Antisipasi Gempa Bumi — BMKG',
    href: 'https://www.bmkg.go.id/gempabumi/mitigasi/antisipasi-gempabumi',
  },
  {
    label: 'Edukasi Gempa Bumi dan Tsunami — BMKG',
    href: 'https://www.bmkg.go.id/gempabumi/mitigasi/edukasi-gempabumi-tsunami',
  },
  {
    label: 'Skala MMI — BMKG',
    href: 'https://www.bmkg.go.id/gempabumi/skala-mmi',
  },
  {
    label: 'Katalog Gempa Bumi dan Tsunami — BMKG',
    href: 'https://www.bmkg.go.id/gempabumi/mitigasi/katalog-gempabumi-tsunami',
  },
  {
    label: 'Peta Isoseismal — BMKG',
    href: 'https://www.bmkg.go.id/gempabumi/peta-isoseismal',
  },
  {
    label: 'InaTEWS — BMKG',
    href: 'https://inatews.bmkg.go.id/',
  },
];

const EMERGENCY_KIT_ITEMS = [
  'Air minum dan makanan tahan lama',
  'Senter, baterai cadangan, power bank',
  'Kotak P3K dan obat pribadi',
  'Masker, sarung tangan, peluit',
  'Salinan dokumen penting dalam kantong tahan air',
  'Uang tunai pecahan kecil',
  'Pakaian layak, selimut, jas hujan',
  'Daftar kontak darurat keluarga',
  'Radio baterai (jika tersedia)',
];

export default function MitigationPage() {
  const [checkedItems, setCheckedItems] = useState<string[]>([]);

  const completedCount = checkedItems.length;
  const totalItems = EMERGENCY_KIT_ITEMS.length;
  const progress = (completedCount / totalItems) * 100;

  return (
    <>
      <PageTitle
        title="Mitigasi & Kesiapsiagaan"
        hint="Langkah keselamatan sebelum, saat, dan setelah gempa. Ringkasan dari panduan BMKG; bukan pengganti pelatihan atau prosedur resmi lengkap."
      />

      <div
        role="note"
        className="mb-4 flex min-w-0 gap-3 rounded-lg border border-danger/50 bg-surface px-4 py-3 text-sm"
      >
        <AlertTriangle
          size={20}
          aria-hidden
          className="mt-0.5 shrink-0 text-danger"
        />
        <div className="min-w-0">
          <p className="font-semibold">
            Aplikasi ini bukan sistem peringatan dini.
          </p>
          <p className="mt-0.5 text-muted">
            Selalu ikuti instruksi resmi BMKG, BNPB, dan pemerintah daerah.
            Jangan menunggu notifikasi aplikasi untuk menyelamatkan diri.
          </p>
        </div>
      </div>

      {/* Langkah mitigasi */}
      <div className="grid w-full min-w-0 grid-cols-1 gap-4 lg:grid-cols-3">
        {STEPS.map(({ title, icon: Icon, items }) => (
          <Panel key={title} title={title} className="min-w-0">
            <div className="min-w-0 px-4 py-3">
              <Icon
                size={22}
                aria-hidden
                className="mb-2 text-accent"
              />
              <ul className="space-y-2 text-sm">
                {items.map((item) => (
                  <li key={item} className="flex min-w-0 gap-2">
                    <span
                      aria-hidden
                      className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent"
                    />
                    <span className="min-w-0 text-muted">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Panel>
        ))}
      </div>

      {/* Tsunami dan kontak resmi */}
      <div className="mt-4 grid w-full min-w-0 grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel
          title="Jika gempa kuat dan berada di pesisir"
          className="min-w-0"
        >
          <div className="flex min-w-0 gap-3 px-4 py-4 text-sm">
            <Waves
              size={22}
              aria-hidden
              className="mt-0.5 shrink-0 text-accent"
            />
            <div className="min-w-0 space-y-2 text-muted">
              <p>
                Jika guncangan terasa kuat atau berlangsung lama,{' '}
                <strong className="text-ink">
                  segera menjauh dari pantai dan sungai
                </strong>
                , menuju tempat tinggi. Jangan menunggu sirene atau peringatan
                resmi.
              </p>
              <p>
                Tsunami dapat tiba dalam hitungan menit. Tetap di tempat tinggi
                sampai BMKG menyatakan status bahaya berakhir. Jangan kembali
                ke pantai untuk melihat atau mengambil barang.
              </p>
              <p className="break-words text-xs">
                Status resmi tsunami:{' '}
                <a
                  className="underline"
                  href="https://inatews.bmkg.go.id/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  InaTEWS BMKG
                </a>
                .
              </p>
            </div>
          </div>
        </Panel>

        <Panel title="Kontak dan kanal resmi" className="min-w-0">
          <ul className="divide-y divide-line text-sm">
            <li className="flex min-w-0 items-center gap-3 px-4 py-3">
              <Phone
                size={16}
                aria-hidden
                className="shrink-0 text-accent"
              />
              <span className="min-w-0">
                <strong>112</strong> — nomor darurat nasional (bebas pulsa,
                sesuai ketersediaan daerah).
              </span>
            </li>
            <li className="flex min-w-0 items-center gap-3 px-4 py-3">
              <Phone
                size={16}
                aria-hidden
                className="shrink-0 text-accent"
              />
              <span className="min-w-0">
                <strong>196</strong> — Contact Center BMKG.
              </span>
            </li>
            {LINKS.map((link) => (
              <li key={link.href} className="min-w-0 px-4 py-2.5">
                <a
                  className="inline-flex max-w-full items-center gap-1.5 font-medium underline"
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <span className="break-words">{link.label}</span>
                  <ExternalLink
                    size={13}
                    aria-hidden
                    className="shrink-0"
                  />
                </a>
              </li>
            ))}
          </ul>
          <p className="border-t border-line px-4 py-2 text-xs text-muted">
            Nomor darurat dapat berbeda menurut daerah. Simpan kontak BPBD
            setempat.
          </p>
        </Panel>
      </div>

      {/* Notifikasi aplikasi */}
      <Panel
        title="Notifikasi & alarm gempa di aplikasi ini"
        className="mt-4 min-w-0"
      >
        <div className="min-w-0 px-4 py-3">
          <NotificationSummary />
        </div>
      </Panel>

      {/* Skala MMI */}
      <Panel title="Skala MMI (ringkasan)" className="mt-4 min-w-0">
        <div className="w-full max-w-full overflow-x-auto overscroll-x-contain">
          <table className="w-full min-w-[480px] text-sm">
            <thead className="border-b border-line text-left text-muted">
              <tr>
                <th className="px-4 py-2.5 font-medium">MMI</th>
                <th className="px-2 py-2.5 font-medium">Sebutan</th>
                <th className="px-4 py-2.5 font-medium">
                  Gambaran yang dirasakan
                </th>
              </tr>
            </thead>
            <tbody>
              {MMI_SCALE.map((scale) => (
                <tr
                  key={scale.mmi}
                  className="border-b border-line last:border-0"
                >
                  <td className="px-4 py-2.5">
                    <span
                      className="inline-flex min-w-9 justify-center rounded px-1.5 py-0.5 text-xs font-semibold"
                      style={{
                        background: mmiColor(scale.mmi),
                        color: mmiTextColor(scale.mmi),
                      }}
                    >
                      {scale.roman}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-2 py-2.5 font-medium">
                    {scale.short}
                  </td>
                  <td className="px-4 py-2.5 text-muted">
                    {scale.description}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="border-t border-line px-4 py-2.5 text-xs text-muted">
          Ringkasan disusun dari halaman Skala MMI BMKG. Uraian resmi dan
          contoh lengkap ada di{' '}
          <a
            className="underline"
            href="https://www.bmkg.go.id/gempabumi/skala-mmi"
            target="_blank"
            rel="noopener noreferrer"
          >
            bmkg.go.id/gempabumi/skala-mmi
          </a>
          .
        </p>
      </Panel>

      {/* Checklist tas siaga gempa */}
      <Panel title="Tas siaga gempa" className="mt-4 min-w-0">
        <div className="min-w-0 px-4 pt-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="text-muted">
              {completedCount} dari {totalItems} perlengkapan disiapkan
            </span>
            <button
              type="button"
              onClick={() => setCheckedItems([])}
              disabled={completedCount === 0}
              className="rounded font-medium text-accent underline disabled:cursor-not-allowed disabled:opacity-40"
            >
              Reset checklist
            </button>
          </div>

          <div
            className="h-2 w-full overflow-hidden rounded-full bg-line"
            role="progressbar"
            aria-label="Progres persiapan tas siaga gempa"
            aria-valuemin={0}
            aria-valuemax={totalItems}
            aria-valuenow={completedCount}
          >
            <div
              className="h-full rounded-full bg-accent transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <ul className="grid min-w-0 grid-cols-1 gap-2 px-4 py-3 sm:grid-cols-2 lg:grid-cols-3">
          {EMERGENCY_KIT_ITEMS.map((item, index) => {
            const checked = checkedItems.includes(item);
            const id = `emergency-kit-${index}`;

            return (
              <li key={item} className="min-w-0">
                <label
                  htmlFor={id}
                  className={`flex h-full min-w-0 cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm transition-colors ${
                    checked
                      ? 'border-accent/40 bg-accent/5'
                      : 'border-line hover:bg-line/30'
                  }`}
                >
                  <input
                    id={id}
                    type="checkbox"
                    checked={checked}
                    onChange={(event) => {
                      setCheckedItems((previous) =>
                        event.target.checked
                          ? [...previous, item]
                          : previous.filter((value) => value !== item),
                      );
                    }}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-current"
                  />

                  <span
                    className={`min-w-0 break-words ${
                      checked ? 'text-muted line-through' : 'text-ink'
                    }`}
                  >
                    {item}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>

        {completedCount === totalItems && (
          <div className="mx-4 mb-4 flex min-w-0 gap-2 rounded-lg border border-ok/30 bg-ok/5 p-3 text-sm text-ok">
            <CheckCircle2 size={18} className="mt-0.5 shrink-0" aria-hidden />
            <p>
              Semua perlengkapan sudah dicentang. Pastikan barang benar-benar
              tersedia, masih layak digunakan, dan siap dibawa.
            </p>
          </div>
        )}
      </Panel>

      <p className="mt-6 text-xs text-muted">
        Sumber utama: BMKG (bmkg.go.id). Untuk prosedur resmi, pelatihan, dan
        informasi daerah, hubungi BPBD setempat.
      </p>
    </>
  );
}
