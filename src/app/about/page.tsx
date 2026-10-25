import type { Metadata } from 'next';
import Link from 'next/link';
import { AlertTriangle, ArrowRight, BookOpen, ExternalLink, Info } from 'lucide-react';
import { BrandMark, Panel } from '@/components/ui/common';
import pkg from '../../../package.json';

export const metadata: Metadata = {
  title: { absolute: 'Tentang Seismos Indonesia' },
  description:
    'Tujuan, sumber data, batasan, perilaku privasi, dan informasi versi Seismos Indonesia.',
};

const SOURCE_BADGE = {
  integrated: { label: 'Terintegrasi', className: 'bg-ok/10 text-ok' },
  reference: { label: 'Tautan referensi', className: 'bg-line/70 text-muted' },
  support: { label: 'Pendukung', className: 'bg-accent/10 text-accent' },
} as const;

const SOURCES = [
  {
    title: 'BMKG — Data Gempa terbuka',
    status: 'integrated' as const,
    description:
      'Aplikasi memanggil endpoint data terbuka BMKG untuk gempa terbaru, 15 gempa M 5,0+, dan 15 gempa dirasakan, lalu menambahkan feed live InaTEWS serta 30 gempa dirasakan terbaru.',
    detail:
      'Field magnitudo, kedalaman, koordinat, waktu, potensi tsunami, dan teks “Dirasakan” ditampilkan tanpa mengubah angkanya. Keterangan dirasakan dipakai sebagai informasi guncangan dan penanda gempa penting.',
    href: 'https://data.bmkg.go.id/gempabumi/',
    linkLabel: 'data.bmkg.go.id/gempabumi',
  },
  {
    title: 'BMKG — Gempa Real-time',
    status: 'reference' as const,
    description:
      'Halaman resmi BMKG untuk melihat gempa terkini. Aplikasi tidak mengambil halaman ini secara langsung.',
    detail:
      'Kebaruan data aplikasi berasal dari endpoint data terbuka dan feed InaTEWS di atas. Halaman ini disediakan sebagai rujukan resmi.',
    href: 'https://www.bmkg.go.id/gempabumi/gempabumi-realtime',
    linkLabel: 'bmkg.go.id/gempabumi/gempabumi-realtime',
  },
  {
    title: 'MAGMA Indonesia — Live Seismograf',
    status: 'integrated' as const,
    description:
      'Aplikasi mengambil daftar stasiun dan gambar seismogram dari layanan publik MAGMA Indonesia (PVMBG, Badan Geologi, Kementerian ESDM).',
    detail:
      'Halaman live MAGMA tidak disematkan karena sumber membatasi iframe. Gambar diteruskan melalui server aplikasi dengan cache singkat.',
    href: 'https://magma.esdm.go.id/volcano/live-seismograf',
    linkLabel: 'magma.esdm.go.id/volcano/live-seismograf',
  },
  {
    title: 'OpenStreetMap dan aset pendukung',
    status: 'support' as const,
    description:
      'Peta memakai tile OpenStreetMap. Shakemap BMKG, bila tersedia pada data kejadian, dimuat langsung dari server statis BMKG.',
    detail:
      'Atribusi peta ditampilkan di sudut peta. Ketentuan penggunaan setiap sumber tetap berlaku.',
    href: 'https://www.openstreetmap.org/copyright',
    linkLabel: 'openstreetmap.org/copyright',
  },
];

const PRIVACY = [
  {
    title: 'Lokasi GPS',
    description:
      'Aplikasi hanya meminta lokasi saat Anda menekan “Lokasi saya” di peta atau “Gunakan lokasi saya” di Pengaturan. Koordinat dipakai di browser untuk menampilkan titik Anda, menghitung jarak ke episenter, dan menebak provinsi terdekat. Koordinat tidak dikirim ke server aplikasi dan tidak disimpan sebagai riwayat. Penyedia geolokasi browser atau sistem operasi dapat memproses data sesuai kebijakan mereka.',
  },
  {
    title: 'Notifikasi dan alarm',
    description:
      'Izin Notifikasi diminta saat Anda menekan Aktifkan. Cakupan, area, provinsi, bunyi alarm, volume, dan ID gempa yang sudah dilihat disimpan di localStorage browser ini. Notifikasi dan alarm hanya berjalan selama halaman aplikasi terbuka; tidak ada push service atau server notifikasi. Filter provinsi memakai provinsi terdekat dari koordinat, bukan batas administratif resmi, sehingga gempa di laut atau dekat perbatasan dapat masuk ke provinsi tetangga. Alarm ini bukan sirine evakuasi resmi.',
  },
  {
    title: 'Sensor gerak dan suara',
    description:
      'Sensor hanya aktif setelah Anda menekan Mulai. Data percepatan diproses di browser dan tidak dikirim ke server aplikasi. Suara sensor dibuat secara lokal dengan Web Audio API dari amplitudo grafik; suara itu bukan alarm gempa dan tidak menentukan magnitudo.',
  },
  {
    title: 'Penyimpanan lokal',
    description:
      'Hingga 5 sesi sensor, tema, dan preferensi notifikasi disimpan di localStorage browser ini. Anda dapat menghapus sesi sensor dari Pengaturan. Tidak ada akun, database, atau sinkronisasi antarperangkat.',
  },
  {
    title: 'Peta dan sumber eksternal',
    description:
      'Tile peta dimuat dari OpenStreetMap; shakemap, bila ada, dimuat dari server BMKG. Permintaan ke layanan tersebut dapat memperlihatkan alamat IP dan informasi teknis kepada penyedia masing-masing. Ketentuan privasi mereka berlaku.',
  },
  {
    title: 'Keamanan',
    description:
      'Aplikasi memakai header keamanan dasar, validasi ID stasiun pada proxy gambar, dan tidak menyimpan data pengguna di server. Ini bukan jaminan keamanan menyeluruh. Laporkan masalah lewat kontak pengembang di bagian bawah halaman ini.',
  },
];

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-5xl">
      <section className="rounded-xl border border-line bg-surface px-5 py-6 sm:px-7 sm:py-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <BrandMark size={64} className="shrink-0 rounded-xl" />
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold sm:text-3xl">Seismos Indonesia</h1>
            <p className="mt-2 max-w-3xl text-base font-medium">
              Data gempa, peta, statistik, notifikasi wilayah, dan seismogram gunung api dengan sumber serta batasan yang dinyatakan.
            </p>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted">
              Aplikasi pemantauan gempa bumi dan aktivitas seismik yang menyatukan data BMKG/InaTEWS,
              peta episenter dengan jarak dari lokasi Anda, notifikasi dan alarm per wilayah, seismogram
              gunung api MAGMA/PVMBG, sensor gerak perangkat, dan panduan mitigasi.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href="/"
                className="inline-flex min-h-10 items-center gap-1.5 rounded-md bg-accent px-3.5 text-sm font-medium text-accent-ink"
              >
                Buka dashboard <ArrowRight size={15} aria-hidden />
              </Link>
              <a
                href="#sumber-data"
                className="inline-flex min-h-10 items-center gap-1.5 rounded-md border border-line px-3.5 text-sm font-medium hover:bg-line/40"
              >
                Lihat sumber data
              </a>
            </div>
          </div>
        </div>
        <div className="mt-5 flex gap-3 rounded-lg border border-danger/40 bg-danger/5 px-4 py-3 text-sm">
          <AlertTriangle size={19} aria-hidden className="mt-0.5 shrink-0 text-danger" />
          <p>
            <strong>Aplikasi ini bukan sistem peringatan dini resmi.</strong> Aplikasi tidak memprediksi
            gempa. Untuk keputusan keselamatan, ikuti informasi dan instruksi BMKG, PVMBG, BNPB, serta
            pemerintah daerah.
          </p>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Tentang aplikasi</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <Panel title="Yang disatukan" headingLevel="h3">
            <div className="space-y-2 px-4 py-3 text-sm text-muted">
              <p>
                Data gempa BMKG/InaTEWS, peta episenter dengan jarak dari lokasi Anda, riwayat yang dapat
                difilter, statistik, notifikasi dan alarm per wilayah, seismogram gunung api, sensor
                perangkat, dan panduan mitigasi berada dalam satu antarmuka.
              </p>
              <p>
                Pengguna dapat memeriksa detail kejadian, mengunduh CSV, membandingkan periode,
                merekam getaran lokal, dan mengatur peringatan browser.
              </p>
            </div>
          </Panel>
          <Panel title="Masalah yang dibantu" headingLevel="h3">
            <div className="space-y-2 px-4 py-3 text-sm text-muted">
              <p>
                Informasi gempa tersebar di beberapa kanal dan mudah disalahartikan. Aplikasi
                menampilkan data yang tersedia, waktu pengambilan, dan batasannya agar lebih mudah
                diperiksa.
              </p>
              <p>
                Tujuannya membantu pembacaan data, bukan menggantikan analisis atau kewenangan
                lembaga resmi.
              </p>
            </div>
          </Panel>
          <Panel title="Untuk siapa" headingLevel="h3">
            <div className="px-4 py-3 text-sm text-muted">
              <p>
                Masyarakat umum, pelajar dan mahasiswa, pendidik, relawan, dan pembaca yang perlu
                memeriksa data gempa terbuka. Aplikasi tidak memerlukan akun.
              </p>
            </div>
          </Panel>
          <Panel title="Yang tidak dilakukan" headingLevel="h3">
            <div className="px-4 py-3 text-sm text-muted">
              <p>
                Tidak memprediksi gempa, tidak menerbitkan peringatan dini resmi, dan tidak
                menggantikan pemantauan BMKG atau PVMBG. Lokasi hanya dipakai setelah Anda
                mengizinkannya; aplikasi tidak melacak posisi di latar belakang.
              </p>
            </div>
          </Panel>
        </div>
      </section>

      <section id="sumber-data" className="mt-8 scroll-mt-20">
        <h2 className="text-lg font-semibold">Sumber data</h2>
        <p className="mt-1 max-w-3xl text-sm text-muted">
          Aplikasi membedakan data yang benar-benar diintegrasikan dari tautan referensi. Status
          “terintegrasi” berarti aplikasi memanggil layanan sumber, bukan klaim kemitraan atau
          dukungan resmi.
        </p>
        <div className="mt-3 space-y-3">
          {SOURCES.map((source) => {
            const badge = SOURCE_BADGE[source.status];
            return (
              <article key={source.title} className="rounded-lg border border-line bg-surface">
                <div className="flex flex-wrap items-start justify-between gap-2 border-b border-line px-4 py-3">
                  <h3 className="text-sm font-semibold">{source.title}</h3>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${badge.className}`}>
                    {badge.label}
                  </span>
                </div>
                <div className="space-y-2 px-4 py-3 text-sm text-muted">
                  <p>{source.description}</p>
                  <p>{source.detail}</p>
                  <a
                    href={source.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex max-w-full items-center gap-1 break-all font-medium text-ink underline"
                  >
                    {source.linkLabel} <ExternalLink size={13} className="shrink-0" aria-hidden />
                  </a>
                </div>
              </article>
            );
          })}
        </div>
        <div className="mt-3 rounded-lg border border-line bg-surface px-4 py-3 text-sm text-muted">
          <p>
            Ketersediaan dan jadwal pembaruan mengikuti sumber masing-masing. Aplikasi memeriksa data
            gempa setiap 60 detik saat tab terlihat dan daftar stasiun MAGMA setiap 5 menit; cache
            server juga dapat menahan respons hingga 60 detik. Jadwal permintaan ini bukan jaminan
            bahwa sumber sudah memutakhirkan datanya.
          </p>
          <p className="mt-2">
            Aplikasi tidak memiliki afiliasi, kemitraan, atau endorsement dari BMKG, PVMBG, maupun
            OpenStreetMap.
          </p>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Privasi dan keamanan</h2>
        <p className="mt-1 max-w-3xl text-sm text-muted">
          Penjelasan berikut mengikuti perilaku aplikasi saat ini, bukan jaminan keamanan menyeluruh.
          Fitur lokasi, notifikasi, alarm, dan suara sensor bersifat opsional dan dikendalikan dari
          browser Anda.
        </p>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {PRIVACY.map((item) => (
            <article key={item.title} className="rounded-lg border border-line bg-surface p-4">
              <h3 className="text-sm font-semibold">{item.title}</h3>
              <p className="mt-2 text-sm text-muted">{item.description}</p>
            </article>
          ))}
        </div>
        <div className="mt-3 flex gap-3 rounded-lg border border-line bg-surface px-4 py-3 text-sm text-muted">
          <BookOpen size={18} aria-hidden className="mt-0.5 shrink-0 text-accent" />
          <p>
            Pertanyaan, koreksi data, atau laporan masalah dapat dikirim ke Instagram{' '}
            <a
              href="https://instagram.com/anargya.anubhawa"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-ink underline"
            >
              @anargya.anubhawa
            </a>
            . Untuk informasi gempa dan peringatan resmi, gunakan kanal BMKG dan PVMBG yang tercantum
            di bagian sumber.
          </p>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Versi, pengembang, dan lisensi</h2>
        <Panel title="Informasi proyek" headingLevel="h3" className="mt-3">
          <dl className="px-4 py-3 text-sm">
            <div className="flex flex-col gap-0.5 border-b border-line py-2 sm:flex-row sm:gap-3">
              <dt className="w-40 shrink-0 text-muted">Versi aplikasi</dt>
              <dd className="font-medium">{pkg.version}</dd>
            </div>
            <div className="flex flex-col gap-0.5 border-b border-line py-2 sm:flex-row sm:gap-3">
              <dt className="w-40 shrink-0 text-muted">Tanggal rilis</dt>
              <dd>25 Oktober 2026</dd>
            </div>
            <div className="flex flex-col gap-0.5 border-b border-line py-2 sm:flex-row sm:gap-3">
              <dt className="w-40 shrink-0 text-muted">Pengembang</dt>
              <dd>Anargya Anubhawa</dd>
            </div>
            <div className="flex flex-col gap-0.5 border-b border-line py-2 sm:flex-row sm:gap-3">
              <dt className="w-40 shrink-0 text-muted">Repositori publik</dt>
              <dd>
                <a
                  href="https://github.com/anargya-anubhawa/seismos-indonesia"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex max-w-full items-center gap-1 break-all font-medium underline"
                >
                  github.com/anargya-anubhawa/seismos-indonesia <ExternalLink size={13} className="shrink-0" aria-hidden />
                </a>
              </dd>
            </div>
            <div className="flex flex-col gap-0.5 border-b border-line py-2 sm:flex-row sm:gap-3">
              <dt className="w-40 shrink-0 text-muted">Kontak</dt>
              <dd>
                <a
                  href="https://instagram.com/anargya.anubhawa"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-medium underline"
                >
                  Instagram @anargya.anubhawa <ExternalLink size={13} aria-hidden />
                </a>
              </dd>
            </div>
            <div className="flex flex-col gap-0.5 py-2 sm:flex-row sm:gap-3">
              <dt className="w-40 shrink-0 text-muted">Lisensi aplikasi</dt>
              <dd>
                <a
                  href="https://github.com/anargya-anubhawa/seismos-indonesia/blob/main/LICENSE"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-medium underline"
                >
                  MIT License <ExternalLink size={13} aria-hidden />
                </a>
              </dd>
            </div>
          </dl>
          <p className="border-t border-line px-4 py-3 text-xs text-muted">
            Atribusi data: BMKG/InaTEWS untuk data gempa dan keterangan dirasakan; MAGMA Indonesia/PVMBG
            untuk seismogram gunung api; OpenStreetMap untuk tile peta. Data dan gambar tetap mengikuti
            ketentuan sumber masing-masing. Pustaka open source yang dipakai tercantum di{' '}
            <code className="rounded bg-line/50 px-1 py-0.5">package.json</code>.
          </p>
        </Panel>
      </section>

      <div className="mt-8 flex flex-col gap-3 border-t border-line py-5 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-center gap-1.5">
          <Info size={15} aria-hidden /> Versi {pkg.version} · Data mengikuti sumber masing-masing.
        </p>
        <Link href="/" className="font-medium text-ink underline">
          Kembali ke dashboard
        </Link>
      </div>
    </div>
  );
}
