import assert from 'node:assert/strict';
import test from 'node:test';
import {
  creditLines, decodeEntities, reportText, earthquakeReportText, earthquakeSummaryText, formatCoordinate, krbText, listSummaryText,
  SEISMOS_NAME, SOURCE_BMKG, SOURCE_BMKG_WEATHER, SOURCE_MAGMA, siteOrigin, sourceUrl, tsunamiReportText,
  volcanoStatusText,
} from '../src/lib/share/report-text';
import type { Earthquake } from '../src/types/earthquake';

const QUAKE: Earthquake = {
  id: '2026-10-29T03:34:00+08:00-8.1-112.0',
  originTime: '2026-10-28T19:34:00.000Z',
  latitude: -8.1,
  longitude: 112.0,
  magnitude: 5.2,
  depthKm: 10,
  region: 'Pusat gempa berada di darat 12 km barat laut Malang',
  tsunamiNote: 'Tidak berpotensi tsunami',
  sources: ['terbaru'],
};

test('formatCoordinate memakai LU/LS dan BT/BB seperti BMKG', () => {
  assert.equal(formatCoordinate(-8.1, 112.0), '8.10 LS 112.00 BT');
  assert.equal(formatCoordinate(3.2, 98.5), '3.20 LU 98.50 BT');
  assert.equal(formatCoordinate(-1.5, -120.25), '1.50 LS 120.25 BB');
});

test('siteOrigin mengambil origin dan jatuh ke alamat bawaan', () => {
  assert.equal(siteOrigin('https://seismos.anargya.my.id/event/abc'), 'https://seismos.anargya.my.id');
  assert.equal(siteOrigin(''), 'https://seismos.anargya.my.id');
  assert.equal(siteOrigin('bukan-url'), 'https://seismos.anargya.my.id');
  assert.equal(siteOrigin(null), 'https://seismos.anargya.my.id');
});

test('creditLines selalu berisi aplikasi, tautan, dan sumber data', () => {
  const credit = creditLines('https://seismos.anargya.my.id', SOURCE_BMKG);
  const lines = credit.split('\n');
  assert.equal(lines.length, 2);
  assert.match(lines[0], new RegExp(SEISMOS_NAME));
  assert.match(lines[0], /https:\/\/seismos\.anargya\.my\.id/);
  assert.match(lines[1], /^Sumber data: BMKG/);
});

test('sourceUrl mengarah ke halaman resmi tiap sumber, bukan selalu gempa', () => {
  // Regresi: dulu tautan "buka sumber" jatuh ke daftar gempa BMKG untuk semua
  // sumber selain MAGMA, sehingga halaman cuaca menautkan ke menu yang salah.
  assert.equal(sourceUrl(SOURCE_BMKG), 'https://data.bmkg.go.id/gempabumi/');
  assert.equal(sourceUrl(SOURCE_MAGMA), 'https://magma.esdm.go.id');
  assert.equal(sourceUrl(SOURCE_BMKG_WEATHER), 'https://www.bmkg.go.id/cuaca');
  // Label tak dikenal tetap menghasilkan tautan yang masuk akal.
  assert.equal(sourceUrl('sumber lain'), 'https://www.bmkg.go.id');
});

test('earthquakeReportText mengikuti susunan BMKG dan diakhiri kredit', () => {
  const text = earthquakeReportText(QUAKE, { pageUrl: 'https://seismos.anargya.my.id/event/x' });
  assert.match(text, /^INFORMASI GEMPA BUMI/);
  assert.match(text, /Magnitudo: 5\.2/);
  assert.match(text, /Kedalaman: 10 km/);
  assert.match(text, /Lokasi: 8\.10 LS 112\.00 BT/);
  assert.match(text, /Pusat gempa: darat 12 km barat laut Malang/);
  assert.match(text, /Potensi: Tidak berpotensi tsunami/);
  assert.match(text, /Sumber data: BMKG/);
  // Awalan "Pusat gempa berada di" tidak diulang setelah label.
  assert.match(text, /Pusat gempa: darat 12 km barat laut Malang/);
  assert.doesNotMatch(text, /Pusat gempa: Pusat gempa/);
  // Tidak boleh mengarang baris "Dirasakan" bila BMKG tidak menerbitkannya.
  assert.doesNotMatch(text, /Dirasakan:/);
});

test('earthquakeReportText menaruh baris Dirasakan apa adanya bila tersedia', () => {
  const text = earthquakeReportText(
    { ...QUAKE, felt: 'III Malang, II Kepanjen' },
    { pageUrl: 'https://x.test/event/1' },
  );
  assert.match(text, /Dirasakan: III Malang, II Kepanjen/);
});

test('potensi kosong diganti kalimat baku, bukan dibiarkan kosong', () => {
  const text = earthquakeReportText({ ...QUAKE, tsunamiNote: '' });
  assert.match(text, /Potensi: Tidak berpotensi tsunami/);
});

test('earthquakeSummaryText tetap membawa kredit sumber', () => {
  const text = earthquakeSummaryText(QUAKE);
  assert.match(text, /Gempa M 5\.2, kedalaman 10 km/);
  assert.match(text, /Sumber data: BMKG/);
});

test('volcanoStatusText memuat tingkat resmi dan sumber MAGMA', () => {
  const text = volcanoStatusText({
    name: 'Merapi', code: 'MER', province: 'DI Yogyakarta', level: 3, levelLabel: 'Level III (Siaga)',
  });
  assert.match(text, /^STATUS GUNUNG MERAPI/);
  assert.match(text, /Kode: MER/);
  assert.match(text, /Tingkat aktivitas: Level III \(Siaga\)/);
  assert.match(text, /Sumber data: MAGMA/);
});

test('krbText menyebut tahun, ukuran, dan sumber resmi', () => {
  const text = krbText({ volcanoName: 'Hobal', year: '2010', fileSize: 10_029_152 });
  assert.match(text, /^PETA KRB — GUNUNG HOBAL/);
  assert.match(text, /Tahun peta: 2010/);
  assert.match(text, /Ukuran berkas: 10\.0 MB/);
  assert.match(text, /Sumber data: MAGMA/);
});

test('tsunamiReportText memuat arahan dan kredit BMKG', () => {
  const text = tsunamiReportText({
    subject: 'Peringatan Dini Tsunami', issueTime: '2026-10-28T19:40:00.000Z', status: 'AKTIF',
    phase: 'WASPADA', region: 'Selatan Jawa', magnitude: 7.1, depthKm: 30,
    potential: 'Berpotensi tsunami', instructions: ['Jauhi pantai', 'Ikuti arahan resmi'],
  });
  assert.match(text, /^INFORMASI PERINGATAN TSUNAMI/);
  assert.match(text, /Status: AKTIF · WASPADA/);
  assert.match(text, /Magnitudo: 7\.1/);
  assert.match(text, /- Jauhi pantai/);
  assert.match(text, /Sumber data: BMKG/);
});

test('listSummaryText mencantumkan judul, isi, dan sumber', () => {
  const text = listSummaryText('Status gunung api', ['MER: Siaga', 'AGU: Normal'], SOURCE_MAGMA);
  assert.match(text, /^STATUS GUNUNG API/);
  assert.match(text, /MER: Siaga/);
  assert.match(text, /Sumber data: MAGMA/);
});

test('decodeEntities mengurai entitas HTML dari sumber MAGMA', () => {
  assert.equal(decodeEntities('Suhu 26.7-27.6&deg;C, angin &amp; hujan'), 'Suhu 26.7-27.6\u00b0C, angin & hujan');
  assert.equal(decodeEntities('kode &#176; dan &#x41;'), 'kode \u00b0 dan A');
  // Entitas tak dikenal dibiarkan apa adanya, bukan dihapus diam-diam.
  assert.equal(decodeEntities('nilai &tidakdikenal; tetap'), 'nilai &tidakdikenal; tetap');
});

test('reportText mengurai entitas pada teks laporan', () => {
  const text = reportText({
    id: 'r1', slug: 'kra', volcanoCode: 'KRA', volcanoName: 'Anak Krakatau', province: null, date: '2026-10-28',
    period: '00:00-06:00', timeZone: 'WIB', level: 3, levelLabel: 'Level III (Siaga)', publishedAt: null,
    author: null, recommendation: null, visualText: null,
    climatologyText: 'Suhu udara sekitar 26.7-27.6&deg;C.', remarks: null, seismic: [], visualImagePath: null,
    kind: 'aktivitas', sourceUrl: 'https://magma.esdm.go.id',
  });
  assert.match(text, /26\.7-27\.6\u00b0C/);
  assert.doesNotMatch(text, /&deg;/);
});
