'use client';

import { AlertTriangle, CheckCircle2, ExternalLink, Phone, ShieldCheck, Waves } from 'lucide-react';
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
  { label: 'Antisipasi Gempa Bumi — BMKG', href: 'https://www.bmkg.go.id/gempabumi/mitigasi/antisipasi-gempabumi' },
  { label: 'Edukasi Gempa Bumi dan Tsunami — BMKG', href: 'https://www.bmkg.go.id/gempabumi/mitigasi/edukasi-gempabumi-tsunami' },
  { label: 'Skala MMI — BMKG', href: 'https://www.bmkg.go.id/gempabumi/skala-mmi' },
  { label: 'Katalog Gempa Bumi dan Tsunami — BMKG', href: 'https://www.bmkg.go.id/gempabumi/mitigasi/katalog-gempabumi-tsunami' },
  { label: 'Peta Isoseismal — BMKG', href: 'https://www.bmkg.go.id/gempabumi/peta-isoseismal' },
  { label: 'InaTEWS — BMKG', href: 'https://inatews.bmkg.go.id/' },
];

export default function MitigationPage() {
  return (
    <>
      <PageTitle
        title="Mitigasi & Kesiapsiagaan"
        hint="Langkah keselamatan sebelum, saat, dan setelah gempa. Ringkasan dari panduan BMKG; bukan pengganti pelatihan atau prosedur resmi lengkap."
      />

      <div role="note" className="mb-4 flex gap-3 rounded-lg border border-danger/50 bg-surface px-4 py-3 text-sm">
        <AlertTriangle size={20} aria-hidden className="mt-0.5 shrink-0 text-danger" />
        <div>
          <p className="font-semibold">Aplikasi ini bukan sistem peringatan dini.</p>
          <p className="mt-0.5 text-muted">
            Selalu ikuti instruksi resmi BMKG, BNPB, dan pemerintah daerah. Jangan menunggu notifikasi aplikasi untuk menyelamatkan diri.
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {STEPS.map(({ title, icon: Icon, items }) => (
          <Panel key={title} title={title}>
            <div className="px-4 py-3">
              <Icon size={22} aria-hidden className="mb-2 text-accent" />
              <ul className="space-y-2 text-sm">
                {items.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                    <span className="text-muted">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Panel>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel title="Jika gempa kuat dan berada di pesisir">
          <div className="flex gap-3 px-4 py-4 text-sm">
            <Waves size={22} aria-hidden className="mt-0.5 shrink-0 text-accent" />
            <div className="space-y-2 text-muted">
              <p>
                Jika guncangan terasa kuat atau berlangsung lama, <strong className="text-ink">segera menjauh dari pantai dan sungai</strong>,
                menuju tempat tinggi. Jangan menunggu sirene atau peringatan resmi.
              </p>
              <p>
                Tsunami dapat tiba dalam hitungan menit. Tetap di tempat tinggi sampai BMKG menyatakan status bahaya berakhir.
                Jangan kembali ke pantai untuk melihat atau mengambil barang.
              </p>
              <p className="text-xs">
                Status resmi tsunami: <a className="underline" href="https://inatews.bmkg.go.id/" target="_blank" rel="noopener noreferrer">InaTEWS BMKG</a>.
              </p>
            </div>
          </div>
        </Panel>

        <Panel title="Kontak dan kanal resmi">
          <ul className="divide-y divide-line text-sm">
            <li className="flex items-center gap-3 px-4 py-3">
              <Phone size={16} aria-hidden className="shrink-0 text-accent" />
              <span><strong>112</strong> — nomor darurat nasional (bebas pulsa, sesuai ketersediaan daerah).</span>
            </li>
            <li className="flex items-center gap-3 px-4 py-3">
              <Phone size={16} aria-hidden className="shrink-0 text-accent" />
              <span><strong>196</strong> — Contact Center BMKG.</span>
            </li>
            {LINKS.map((l) => (
              <li key={l.href} className="px-4 py-2.5">
                <a className="inline-flex items-center gap-1.5 font-medium underline" href={l.href} target="_blank" rel="noopener noreferrer">
                  {l.label} <ExternalLink size={13} aria-hidden />
                </a>
              </li>
            ))}
          </ul>
          <p className="border-t border-line px-4 py-2 text-xs text-muted">
            Nomor darurat dapat berbeda menurut daerah. Simpan kontak BPBD setempat.
          </p>
        </Panel>
      </div>

      <Panel title="Notifikasi & alarm gempa di aplikasi ini" className="mt-4">
        <div className="px-4 py-3">
          <NotificationSummary />
        </div>
      </Panel>

      <Panel title="Skala MMI (ringkasan)" className="mt-4">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-line text-left text-muted">
              <tr>
                <th className="px-4 py-2.5 font-medium">MMI</th>
                <th className="px-2 py-2.5 font-medium">Sebutan</th>
                <th className="px-4 py-2.5 font-medium">Gambaran yang dirasakan</th>
              </tr>
            </thead>
            <tbody>
              {MMI_SCALE.map((s) => (
                <tr key={s.mmi} className="border-b border-line last:border-0">
                  <td className="px-4 py-2.5">
                    <span
                      className="inline-flex min-w-9 justify-center rounded px-1.5 py-0.5 text-xs font-semibold"
                      style={{ background: mmiColor(s.mmi), color: mmiTextColor(s.mmi) }}
                    >
                      {s.roman}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-2 py-2.5 font-medium">{s.short}</td>
                  <td className="px-4 py-2.5 text-muted">{s.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="border-t border-line px-4 py-2.5 text-xs text-muted">
          Ringkasan disusun dari halaman Skala MMI BMKG. Uraian resmi dan contoh lengkap ada di{' '}
          <a className="underline" href="https://www.bmkg.go.id/gempabumi/skala-mmi" target="_blank" rel="noopener noreferrer">bmkg.go.id/gempabumi/skala-mmi</a>.
        </p>
      </Panel>

      <Panel title="Tas siaga gempa (contoh)" className="mt-4">
        <ul className="grid gap-2 px-4 py-3 text-sm text-muted sm:grid-cols-2 lg:grid-cols-3">
          {[
            'Air minum dan makanan tahan lama',
            'Senter, baterai cadangan, power bank',
            'Kotak P3K dan obat pribadi',
            'Masker, sarung tangan, peluit',
            'Salinan dokumen penting dalam kantong tahan air',
            'Uang tunai pecahan kecil',
            'Pakaian layak, selimut, jas hujan',
            'Daftar kontak darurat keluarga',
            'Radio baterai (jika tersedia)',
          ].map((item) => (
            <li key={item} className="flex gap-2">
              <CheckCircle2 size={15} aria-hidden className="mt-0.5 shrink-0 text-ok" />
              {item}
            </li>
          ))}
        </ul>
      </Panel>

      <p className="mt-6 text-xs text-muted">
        Sumber utama: BMKG (bmkg.go.id). Untuk prosedur resmi, pelatihan, dan informasi daerah, hubungi BPBD setempat.
      </p>
    </>
  );
}
