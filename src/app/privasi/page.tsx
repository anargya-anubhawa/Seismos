import type { Metadata } from 'next';
import Link from 'next/link';
import { PageTitle, Panel } from '@/components/ui/common';

export const metadata: Metadata = {
  title: { absolute: 'Kebijakan Privasi — Seismos Indonesia' },
  description:
    'Data apa yang diproses Seismos Indonesia, apa yang disimpan di perangkat Anda, apa yang tersimpan di server, dan cara berhenti berlangganan notifikasi.',
};

/**
 * Kebijakan privasi (OI-06).
 *
 * Isi halaman ini diturunkan dari kode yang benar-benar ada, bukan dari
 * pernyataan umum. Setiap klaim di bawah dapat diperiksa di berkas yang
 * disebutkan. Bila perilaku kode berubah, halaman ini WAJIB ikut diperbarui —
 * pernyataan privasi yang tidak sesuai kode lebih buruk daripada tidak ada.
 */
export default function PrivasiPage() {
  return (
    <div className="max-w-3xl">
      <PageTitle
        title="Kebijakan Privasi"
        hint="Ringkasan singkat: Seismos tidak punya akun pengguna, tidak memakai analitik pihak ketiga, dan tidak menjual atau membagikan data. Lokasi Anda dipakai untuk mencari prakiraan cuaca dan tidak disimpan di server."
      />

      <div className="space-y-4 text-sm">
        <Panel title="Yang tidak kami lakukan">
          <ul className="space-y-2 px-4 py-3">
            {[
              'Tidak ada akun, login, atau profil pengguna. Tidak ada nama, email, atau nomor telepon yang diminta.',
              'Tidak ada analitik atau pelacak pihak ketiga (Google Analytics, piksel iklan, dan sejenisnya).',
              'Tidak ada cookie iklan dan tidak ada penjualan atau pembagian data ke pihak ketiga.',
              'Tidak ada pembuatan profil perilaku: kami tidak mencatat halaman apa yang Anda buka.',
            ].map((item) => (
              <li key={item} className="flex gap-2">
                <span aria-hidden className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-ok" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="Lokasi (geolokasi)">
          <div className="space-y-2 px-4 py-3">
            <p>
              Izin lokasi <strong>hanya</strong> diminta bila Anda menekan tombol untuk memakai lokasi
              saat ini pada halaman cuaca atau peta. Izin tidak diminta otomatis saat halaman dibuka.
            </p>
            <p>
              Koordinat dikirim ke server Seismos <em>hanya</em> sebagai parameter permintaan
              (<code className="rounded bg-line/40 px-1">?lat=..&amp;lon=..</code>) agar server dapat
              mencari wilayah prakiraan BMKG terdekat. Koordinat itu <strong>tidak disimpan</strong>:
              tidak ditulis ke berkas, tidak dicatat di log, dan tidak disimpan ke basis data.
            </p>
            <p>
              Wilayah hasil pencarian disimpan <strong>di peramban Anda</strong> (localStorage) supaya
              cuaca tetap tampil saat Anda membuka aplikasi lagi. Data itu tidak pernah dikirim ke kami,
              dan hilang bila Anda membersihkan data situs.
            </p>
            <p className="text-muted">
              Bila Anda menolak izin lokasi, aplikasi tetap berfungsi: pilih wilayah secara manual.
            </p>
          </div>
        </Panel>

        <Panel title="Notifikasi push">
          <div className="space-y-2 px-4 py-3">
            <p>
              Notifikasi bersifat opsional dan hanya aktif bila Anda menekannya secara sadar lalu
              mengizinkan notifikasi di peramban.
            </p>
            <p>
              Saat aktif, peramban membuat <em>endpoint langganan</em> unik yang dikelola layanan push
              peramban (mis. Google, Mozilla, Apple, Microsoft). Endpoint beserta kunci enkripsi publik
              perangkat disimpan di server Seismos agar notifikasi dapat dikirim. Data ini
              <strong> tidak terhubung ke identitas</strong>: tidak ada akun, jadi kami tidak tahu siapa
              pemiliknya.
            </p>
            <p>
              Langganan yang sudah tidak aktif dihapus otomatis ketika layanan push menyatakan endpoint
              tidak lagi berlaku (HTTP 404/410).
            </p>
            <p>
              <strong>Cara berhenti:</strong> matikan notifikasi dari halaman Notifikasi gunung api
              atau tsunami, atau cabut izin notifikasi untuk situs ini di pengaturan peramban. Keduanya
              menghentikan pengiriman.
            </p>
          </div>
        </Panel>

        <Panel title="Yang tersimpan di server">
          <ul className="space-y-2 px-4 py-3">
            <li>
              <strong>Langganan push</strong> — endpoint dan kunci enkripsi perangkat, tanpa identitas.
              Bertahan sampai Anda berhenti berlangganan atau endpoint dinyatakan tidak berlaku.
            </li>
            <li>
              <strong>Status pemantauan</strong> — catatan internal (waktu pemeriksaan terakhir, daftar
              notifikasi yang sudah dikirim) supaya notifikasi tidak dikirim berulang. Tidak memuat data
              pribadi.
            </li>
            <li>
              <strong>Log server</strong> — galat teknis pada server web. Kode aplikasi tidak mencatat
              alamat IP pengguna ke log; IP hanya dipakai sementara di memori untuk membatasi laju
              permintaan dan tidak disimpan. (Catatan: penyedia hosting atau reverse proxy Anda mungkin
              menyimpan log akses standar di luar kendali aplikasi.)
            </li>
          </ul>
        </Panel>

        <Panel title="Sumber data pihak ketiga">
          <div className="space-y-2 px-4 py-3">
            <p>
              Seluruh data kebencanaan berasal dari sumber resmi Indonesia: BMKG/InaTEWS (gempa,
              tsunami, cuaca) dan MAGMA/PVMBG (gunung api). Server Seismos mengambil data dari sumber
              itu; peramban Anda tidak menghubungi layanan pelacak mana pun.
            </p>
            <p>
              Halaman peta memuat tile dari OpenStreetMap dan ArcGIS, dan halaman siaran langsung
              memuat pemutar YouTube (<code className="rounded bg-line/40 px-1">youtube-nocookie.com</code>)
              — hanya jika Anda membuka halaman itu. Penyedia tersebut punya kebijakan privasi sendiri.
            </p>
          </div>
        </Panel>

        <Panel title="Hak dan pertanyaan">
          <div className="space-y-2 px-4 py-3">
            <p>
              Karena tidak ada akun, tidak ada profil yang dapat diminta, diekspor, atau dihapus.
              Satu-satunya data yang terkait perangkat Anda adalah langganan push, dan Anda dapat
              menghapusnya sendiri kapan saja seperti dijelaskan di atas.
            </p>
            <p className="text-muted">
              Halaman ini menjelaskan perilaku aplikasi, bukan nasihat hukum. Untuk informasi darurat,
              selalu rujuk kanal resmi BMKG.
            </p>
          </div>
        </Panel>

        <p className="text-xs text-muted">
          Lihat juga <Link className="underline" href="/about">Tentang Seismos Indonesia</Link> (sumber
          data dan batasan) dan <Link className="underline" href="/status-sumber">Status Sumber Data</Link>.
        </p>
      </div>
    </div>
  );
}
